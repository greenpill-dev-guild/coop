import { parseGemma4ToolCall } from './gemma4-bridge';

type Gemma4Tool = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

type WorkerInboundMessage =
  | { type: 'init'; modelId: string }
  | {
      type: 'request';
      requestId: string;
      request: {
        system?: string;
        prompt: string;
        imageUrl?: string;
        audioUrl?: string;
        audioSamplingRate?: number;
        tools?: Gemma4Tool[];
        forceToolName?: string;
        maxTokens?: number;
        temperature?: number;
      };
    }
  | { type: 'teardown' };

export type Gemma4HostTransport = {
  onMessage: (handler: (message: WorkerInboundMessage) => void) => void;
  postMessage: (message: unknown) => void;
};

// biome-ignore lint/suspicious/noExplicitAny: transformers.js exports are runtime-loaded
let processor: any = null;
// biome-ignore lint/suspicious/noExplicitAny: transformers.js exports are runtime-loaded
let model: any = null;
let activeModelId = '';
let started = false;

export function canUseBrowserCache(globalScope: object = globalThis) {
  try {
    return (
      'caches' in globalScope && typeof (globalScope as { caches?: unknown }).caches !== 'undefined'
    );
  } catch {
    return false;
  }
}

// MV3's default `extension_pages` CSP forbids `new Function()`, which
// onnxruntime-web's Embind glue uses on the inference hot path. The host
// therefore runs inside a sandboxed iframe page declared in the manifest,
// where the CSP allows `'unsafe-eval'`. The transport abstraction stays for
// test injection and so the same module can host alternative transports later.
export function startGemma4Host(transport: Gemma4HostTransport) {
  if (started) {
    return;
  }
  started = true;

  transport.onMessage(async (message) => {
    if (!message || typeof message !== 'object') return;

    if (message.type === 'init') {
      await handleInit(transport, message.modelId);
      return;
    }

    if (message.type === 'request') {
      await handleRequest(transport, message.requestId, message.request);
      return;
    }

    if (message.type === 'teardown') {
      processor = null;
      model = null;
      activeModelId = '';
    }
  });
}

async function handleInit(transport: Gemma4HostTransport, modelId: string) {
  if (model && activeModelId === modelId) {
    transport.postMessage({ type: 'init-ready', modelId, durationMs: 0 });
    return;
  }
  const start = Date.now();
  try {
    const { AutoProcessor, Gemma4ForConditionalGeneration, env } = (await import(
      '@huggingface/transformers'
      // biome-ignore lint/suspicious/noExplicitAny: dynamic import of transformers
    )) as any;
    if (env) {
      env.allowLocalModels = false;
      env.useBrowserCache = canUseBrowserCache();
    }

    processor = await AutoProcessor.from_pretrained(modelId);
    model = await Gemma4ForConditionalGeneration.from_pretrained(modelId, {
      dtype: 'q4f16',
      device: 'webgpu',
      // biome-ignore lint/suspicious/noExplicitAny: progress info has loose shape
      progress_callback: (info: any) => {
        const progress = typeof info?.progress === 'number' ? info.progress : 0;
        const status = typeof info?.status === 'string' ? info.status : '';
        transport.postMessage({ type: 'init-progress', progress, status });
      },
    });
    activeModelId = modelId;
    transport.postMessage({ type: 'init-ready', modelId, durationMs: Date.now() - start });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    transport.postMessage({ type: 'init-error', error: errorMessage });
  }
}

async function handleRequest(
  transport: Gemma4HostTransport,
  requestId: string,
  request: Extract<WorkerInboundMessage, { type: 'request' }>['request'],
) {
  const start = Date.now();
  if (!model || !processor) {
    transport.postMessage({
      type: 'response',
      requestId,
      ok: false,
      error: 'Gemma4 model is not initialized.',
      durationMs: 0,
    });
    return;
  }

  try {
    // biome-ignore lint/suspicious/noExplicitAny: chat content uses a heterogeneous union
    const userContent: any[] = [];
    let image: unknown = null;
    let audio: unknown = null;

    if (request.imageUrl) {
      const { load_image } = (await import(
        '@huggingface/transformers'
        // biome-ignore lint/suspicious/noExplicitAny: dynamic import
      )) as any;
      image = await load_image(request.imageUrl);
      userContent.push({ type: 'image' });
    }

    if (request.audioUrl) {
      const { read_audio } = (await import(
        '@huggingface/transformers'
        // biome-ignore lint/suspicious/noExplicitAny: dynamic import
      )) as any;
      audio = await read_audio(request.audioUrl, request.audioSamplingRate ?? 16000);
      userContent.push({ type: 'audio' });
    }

    userContent.push({ type: 'text', text: request.prompt });

    // biome-ignore lint/suspicious/noExplicitAny: chat message content is heterogeneous
    const messages: any[] = [];
    if (request.system) {
      messages.push({ role: 'system', content: [{ type: 'text', text: request.system }] });
    }
    messages.push({ role: 'user', content: userContent });

    const promptText = processor.apply_chat_template(messages, {
      add_generation_prompt: true,
      tokenize: false,
      tools: request.tools,
    });

    const inputs =
      image && audio
        ? await processor(promptText, image, audio)
        : image
          ? await processor(promptText, image)
          : audio
            ? await processor(promptText, null, audio)
            : await processor(promptText);

    const outputs = await model.generate({
      ...inputs,
      max_new_tokens: request.maxTokens ?? 512,
      do_sample: typeof request.temperature === 'number' && request.temperature > 0,
      temperature: request.temperature ?? 0,
    });

    const decoded = processor.batch_decode(
      outputs.slice(null, [inputs.input_ids.dims.at(-1), null]),
      { skip_special_tokens: true },
    );
    const output = (Array.isArray(decoded) ? decoded[0] : '') as string;
    const toolCall = parseGemma4ToolCall(output);

    // When the caller bound the request to a specific tool name (e.g.
    // `extract_opportunity` for the opportunity-extractor skill), only
    // surface the parsed tool call when the model picked that tool. Stray
    // calls drop back to the JSON-text path so the validator catches them.
    const filteredToolCall =
      request.forceToolName && toolCall && toolCall.name !== request.forceToolName
        ? undefined
        : toolCall;
    transport.postMessage({
      type: 'response',
      requestId,
      ok: true,
      output,
      toolCall: filteredToolCall,
      durationMs: Date.now() - start,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    transport.postMessage({
      type: 'response',
      requestId,
      ok: false,
      error: errorMessage,
      durationMs: Date.now() - start,
    });
  }
}
