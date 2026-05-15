const GEMMA4_DEFAULT_MODEL_ID = 'onnx-community/gemma-4-E2B-it-ONNX';
const GEMMA4_QUALITY_MODEL_ID = 'onnx-community/gemma-4-E4B-it-ONNX';
const GEMMA4_IDLE_TIMEOUT_MS = 15 * 60 * 1000;

export type Gemma4ToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type Gemma4Request = {
  system?: string;
  prompt: string;
  imageUrl?: string;
  audioUrl?: string;
  audioSamplingRate?: number;
  tools?: Gemma4ToolDefinition[];
  forceToolName?: string;
  maxTokens?: number;
  temperature?: number;
};

export type Gemma4ToolCall = {
  name: string;
  arguments: Record<string, unknown>;
};

export type Gemma4CompletionResult = {
  provider: 'gemma4';
  model: string;
  output: string;
  toolCall?: Gemma4ToolCall;
  durationMs: number;
};

type WorkerInboundMessage =
  | { type: 'init'; modelId: string }
  | {
      type: 'request';
      requestId: string;
      request: Gemma4Request;
    }
  | { type: 'teardown' };

type WorkerOutboundMessage =
  | { type: 'init-progress'; progress: number; status: string }
  | { type: 'init-ready'; modelId: string; durationMs: number }
  | { type: 'init-error'; error: string }
  | {
      type: 'response';
      requestId: string;
      ok: true;
      output: string;
      toolCall?: Gemma4ToolCall;
      durationMs: number;
    }
  | {
      type: 'response';
      requestId: string;
      ok: false;
      error: string;
      durationMs: number;
    };

export type Gemma4BridgeStatus = {
  ready: boolean;
  initProgress: number;
  initMessage: string;
  error: string | undefined;
  model: string;
};

export class AgentGemma4Bridge {
  private worker: Worker | null = null;
  private initPromise: Promise<void> | null = null;
  private ready = false;
  private modelId = GEMMA4_DEFAULT_MODEL_ID;
  private initProgress = 0;
  private initMessage = '';
  private lastError: string | undefined;
  private inflight = new Map<
    string,
    {
      resolve: (result: Gemma4CompletionResult) => void;
      reject: (error: Error) => void;
    }
  >();
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private epoch = 0;

  get status(): Gemma4BridgeStatus {
    return {
      ready: this.ready && !this.lastError,
      initProgress: this.initProgress,
      initMessage: this.initMessage,
      error: this.lastError,
      model: this.modelId,
    };
  }

  setModelVariant(variant: 'E2B' | 'E4B') {
    const next = variant === 'E4B' ? GEMMA4_QUALITY_MODEL_ID : GEMMA4_DEFAULT_MODEL_ID;
    if (next === this.modelId) {
      return;
    }
    this.modelId = next;
    this.teardown();
  }

  async initialize() {
    const start = Date.now();
    await this.ensureReady();
    return { model: this.modelId, durationMs: Date.now() - start };
  }

  prewarm() {
    void this.ensureReady().catch(() => {
      // Swallow prewarm errors; ensureReady has already cleared state.
    });
  }

  private resolveWorkerUrl(): string {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      return chrome.runtime.getURL('agent-gemma4-worker.js');
    }
    return 'agent-gemma4-worker.js';
  }

  private ensureReady(): Promise<void> {
    this.bumpIdleTimer();
    if (this.initPromise) {
      return this.initPromise;
    }

    const epoch = this.epoch;
    const workerUrl = this.resolveWorkerUrl();
    this.worker = new Worker(workerUrl, { type: 'module' });
    this.attachWorkerListener(this.worker);

    this.initPromise = new Promise<void>((resolve, reject) => {
      const onInitMessage = (event: MessageEvent<WorkerOutboundMessage>) => {
        const message = event.data;
        if (epoch !== this.epoch) {
          return;
        }
        if (message.type === 'init-progress') {
          this.initProgress = message.progress;
          this.initMessage = message.status;
          return;
        }
        if (message.type === 'init-ready') {
          this.modelId = message.modelId;
          this.ready = true;
          this.lastError = undefined;
          this.worker?.removeEventListener('message', onInitMessage);
          resolve();
          return;
        }
        if (message.type === 'init-error') {
          this.lastError = message.error;
          this.ready = false;
          this.worker?.removeEventListener('message', onInitMessage);
          reject(new Error(message.error));
        }
      };
      this.worker?.addEventListener('message', onInitMessage);
      this.postWorkerMessage({ type: 'init', modelId: this.modelId });
    }).catch((error) => {
      if (epoch === this.epoch) {
        this.initPromise = null;
        this.ready = false;
        this.worker?.terminate();
        this.worker = null;
      }
      throw error;
    });

    return this.initPromise;
  }

  private attachWorkerListener(worker: Worker) {
    worker.addEventListener('message', (event: MessageEvent<WorkerOutboundMessage>) => {
      const message = event.data;
      if (message.type !== 'response') {
        return;
      }
      const inflight = this.inflight.get(message.requestId);
      if (!inflight) {
        return;
      }
      this.inflight.delete(message.requestId);
      if (message.ok) {
        inflight.resolve({
          provider: 'gemma4',
          model: this.modelId,
          output: message.output,
          toolCall: message.toolCall,
          durationMs: message.durationMs,
        });
      } else {
        inflight.reject(new Error(message.error));
      }
    });
  }

  async complete(request: Gemma4Request): Promise<Gemma4CompletionResult> {
    await this.ensureReady();
    this.bumpIdleTimer();
    if (!this.worker) {
      throw new Error('Gemma4 worker is not available.');
    }

    const requestId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    return new Promise<Gemma4CompletionResult>((resolve, reject) => {
      this.inflight.set(requestId, { resolve, reject });
      this.postWorkerMessage({ type: 'request', requestId, request });
    });
  }

  private postWorkerMessage(message: WorkerInboundMessage) {
    this.worker?.postMessage(message);
  }

  private bumpIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    this.idleTimer = setTimeout(() => {
      this.teardown();
    }, GEMMA4_IDLE_TIMEOUT_MS);
  }

  teardown() {
    this.epoch += 1;
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    for (const [, inflight] of this.inflight) {
      inflight.reject(new Error('Gemma4 worker torn down before completion.'));
    }
    this.inflight.clear();
    this.worker?.terminate();
    this.worker = null;
    this.initPromise = null;
    this.ready = false;
    this.lastError = undefined;
    this.initProgress = 0;
    this.initMessage = '';
  }
}

export function getDefaultGemma4ModelId() {
  return GEMMA4_DEFAULT_MODEL_ID;
}

export function getQualityGemma4ModelId() {
  return GEMMA4_QUALITY_MODEL_ID;
}

export function parseGemma4ToolCall(text: string): Gemma4ToolCall | undefined {
  if (!text) return undefined;
  // Gemma 4 emits tool calls inside <tool_call>...</tool_call> markers.
  const tagged = text.match(/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/i);
  const candidate = tagged?.[1] ?? extractJsonObject(text);
  if (!candidate) return undefined;
  try {
    const parsed = JSON.parse(candidate) as {
      name?: unknown;
      arguments?: unknown;
      parameters?: unknown;
    };
    if (typeof parsed.name !== 'string') return undefined;
    const args =
      parsed.arguments && typeof parsed.arguments === 'object'
        ? (parsed.arguments as Record<string, unknown>)
        : parsed.parameters && typeof parsed.parameters === 'object'
          ? (parsed.parameters as Record<string, unknown>)
          : {};
    return { name: parsed.name, arguments: args };
  } catch {
    return undefined;
  }
}

function extractJsonObject(text: string): string | undefined {
  const fence = text.match(/```(?:json)?\s*([\s\S]+?)```/i);
  const body = fence?.[1] ?? text;
  const first = body.indexOf('{');
  const last = body.lastIndexOf('}');
  if (first < 0 || last <= first) return undefined;
  return body.slice(first, last + 1);
}
