import { resolveOnnxRuntimeWasmPaths } from './onnx-assets';

/**
 * Inference worker -- runs a local text-generation model in a dedicated
 * Web Worker so the sidepanel UI stays responsive.
 *
 * The model is loaded on first refine request (lazy init) and cached.
 * Communication uses a simple message protocol.
 */

export type InferenceWorkerRequest =
  | { type: 'init' }
  | { type: 'refine'; id: string; prompt: string; maxTokens?: number }
  | { type: 'cancel' }
  | { type: 'status' };

export type InferenceWorkerResponse =
  | {
      type: 'status';
      status: 'idle' | 'loading' | 'ready' | 'running' | 'failed';
      model?: string;
      error?: string;
    }
  | { type: 'refine-result'; id: string; output: string; durationMs: number }
  | { type: 'refine-error'; id: string; error: string }
  | { type: 'init-progress'; progress: number; message: string };

const MODEL_ID = 'onnx-community/Qwen2.5-0.5B-Instruct';
const DEFAULT_MAX_TOKENS = 128;

type StatusResponse = Extract<InferenceWorkerResponse, { type: 'status' }>;

let pipeline:
  | ((
      messages: Array<{ role: string; content: string }>,
      options: Record<string, unknown>,
    ) => Promise<Array<{ generated_text: string | Array<{ content: string }> }>>)
  | null = null;
let currentStatus: StatusResponse = { type: 'status', status: 'idle' };

// InterruptableStoppingCriteria from @huggingface/transformers provides
// cooperative cancellation — the model checks the flag between generation steps.
let stoppingCriteria: { interrupt(): void; reset(): void } | null = null;
let stoppingCriteriaList: { criteria: unknown[] } | null = null;
let inferenceWorkerStarted = false;

async function ensureModel() {
  if (pipeline) return;

  currentStatus = { type: 'status', status: 'loading', model: MODEL_ID };
  self.postMessage(currentStatus);

  try {
    // Dynamic import so the worker bundle only includes transformers when actually used
    const {
      pipeline: createPipeline,
      env,
      InterruptableStoppingCriteria,
      StoppingCriteriaList,
    } = await import('@huggingface/transformers');

    // Configure for worker context
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    if (env.backends.onnx.wasm) {
      env.backends.onnx.wasm.wasmPaths = resolveOnnxRuntimeWasmPaths();
    }

    const progressCallback = (progress: { progress?: number; status?: string }) => {
      if (progress?.progress !== undefined) {
        const msg: InferenceWorkerResponse = {
          type: 'init-progress',
          progress: progress.progress,
          message: progress.status || 'Downloading model weights...',
        };
        self.postMessage(msg);
      }
    };

    const hasWebGpu = typeof navigator !== 'undefined' && 'gpu' in navigator;
    if (hasWebGpu) {
      try {
        pipeline = (await createPipeline('text-generation', MODEL_ID, {
          dtype: 'q4',
          device: 'webgpu',
          progress_callback: progressCallback,
        })) as unknown as typeof pipeline;
      } catch {
        // WebGPU pipeline failed — fall back to WASM
        pipeline = null;
      }
    }
    if (!pipeline) {
      pipeline = (await createPipeline('text-generation', MODEL_ID, {
        dtype: 'q4',
        device: 'wasm',
        progress_callback: progressCallback,
      })) as unknown as typeof pipeline;
    }

    // Set up the reusable stopping criteria for cooperative cancellation.
    stoppingCriteria = new InterruptableStoppingCriteria();
    stoppingCriteriaList = new StoppingCriteriaList();
    (stoppingCriteriaList as unknown as { push(c: unknown): void }).push(
      stoppingCriteria as unknown as InstanceType<typeof InterruptableStoppingCriteria>,
    );

    currentStatus = { type: 'status', status: 'ready', model: MODEL_ID };
    self.postMessage(currentStatus);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    currentStatus = { type: 'status', status: 'failed', error: message };
    self.postMessage(currentStatus);
    throw error;
  }
}

async function handleRefine(id: string, prompt: string, maxTokens: number) {
  try {
    await ensureModel();

    currentStatus = { type: 'status', status: 'running', model: MODEL_ID };
    self.postMessage(currentStatus);

    // Reset the stopping criteria so a previous cancel doesn't block this run.
    stoppingCriteria?.reset();

    const start = Date.now();

    const messages = [{ role: 'user', content: prompt }];

    if (!pipeline) throw new Error('Inference pipeline not initialized');
    const result = await pipeline(messages, {
      max_new_tokens: maxTokens,
      temperature: 0.3,
      do_sample: true,
      return_full_text: false,
      stopping_criteria: stoppingCriteriaList,
    });

    const output =
      Array.isArray(result) && result[0]?.generated_text
        ? typeof result[0].generated_text === 'string'
          ? result[0].generated_text
          : Array.isArray(result[0].generated_text)
            ? (result[0].generated_text[result[0].generated_text.length - 1]?.content ?? '')
            : ''
        : '';

    const durationMs = Date.now() - start;

    currentStatus = { type: 'status', status: 'ready', model: MODEL_ID };
    self.postMessage(currentStatus);

    const response: InferenceWorkerResponse = {
      type: 'refine-result',
      id,
      output: typeof output === 'string' ? output : String(output),
      durationMs,
    };
    self.postMessage(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (pipeline) {
      currentStatus = { type: 'status', status: 'ready', model: MODEL_ID };
    } else {
      currentStatus = { type: 'status', status: 'failed', error: message };
    }
    self.postMessage(currentStatus);

    const response: InferenceWorkerResponse = {
      type: 'refine-error',
      id,
      error: message,
    };
    self.postMessage(response);
  }
}

export function startInferenceWorker() {
  if (inferenceWorkerStarted) {
    return;
  }

  inferenceWorkerStarted = true;

  self.onmessage = (event: MessageEvent<InferenceWorkerRequest>) => {
    const msg = event.data;

    switch (msg.type) {
      case 'init':
        ensureModel().catch((e) => {
          self.postMessage({ type: 'status', status: 'failed', error: String(e) });
        });
        break;

      case 'refine':
        handleRefine(msg.id, msg.prompt, msg.maxTokens ?? DEFAULT_MAX_TOKENS).catch((e) => {
          self.postMessage({ type: 'refine-error', id: msg.id, error: String(e) });
        });
        break;

      case 'cancel':
        // InterruptableStoppingCriteria cooperatively stops generation
        // between decode steps — the next token check will bail out.
        stoppingCriteria?.interrupt();
        break;

      case 'status':
        self.postMessage(currentStatus);
        break;
    }
  };
}
