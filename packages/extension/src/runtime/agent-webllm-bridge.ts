const WEBLLM_MODEL_ID = 'Qwen2-0.5B-Instruct-q4f16_1-MLC';
const WEBLLM_IDLE_TIMEOUT_MS = 15 * 60 * 1000;

type CompletionResult = {
  provider: 'webllm';
  model: string;
  output: string;
  durationMs: number;
};

type WebLlmEngine = {
  chat: {
    completions: {
      create(input: {
        messages: Array<{ role: 'system' | 'user'; content: string }>;
        temperature?: number;
        max_tokens?: number;
        response_format?: { type: 'json_object' | 'text' };
      }): Promise<{
        choices?: Array<{ message?: { content?: string | null } }>;
      }>;
    };
  };
};

type CreateWebWorkerMLCEngine = (
  worker: Worker,
  model: string,
  options?: {
    initProgressCallback?: (report: { progress?: number; text?: string }) => void;
  },
) => Promise<WebLlmEngine>;

export class AgentWebLlmBridge {
  private worker: Worker | null = null;
  private enginePromise: Promise<WebLlmEngine> | null = null;
  private lastError: string | undefined;
  private initProgress = 0;
  private initMessage = '';
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  get status() {
    return {
      ready: this.enginePromise !== null && !this.lastError,
      initProgress: this.initProgress,
      initMessage: this.initMessage,
      error: this.lastError,
      model: WEBLLM_MODEL_ID,
    };
  }

  private async ensureEngine() {
    this.bumpIdleTimer();
    if (this.enginePromise) {
      return this.enginePromise;
    }

    this.enginePromise = (async () => {
      const workerUrl =
        typeof chrome !== 'undefined' && chrome.runtime?.getURL
          ? chrome.runtime.getURL('agent-webllm-worker.js')
          : 'agent-webllm-worker.js';
      this.worker = new Worker(workerUrl, { type: 'module' });

      const { CreateWebWorkerMLCEngine } = (await import('@mlc-ai/web-llm')) as unknown as {
        CreateWebWorkerMLCEngine: CreateWebWorkerMLCEngine;
      };

      return CreateWebWorkerMLCEngine(this.worker, WEBLLM_MODEL_ID, {
        initProgressCallback: (report) => {
          this.initProgress = report.progress ?? this.initProgress;
          this.initMessage = report.text ?? this.initMessage;
        },
      });
    })().catch((error) => {
      this.lastError = error instanceof Error ? error.message : 'WebLLM initialization failed.';
      this.enginePromise = null;
      this.worker?.terminate();
      this.worker = null;
      throw error;
    });

    return this.enginePromise;
  }

  async complete(input: {
    system?: string;
    prompt: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<CompletionResult> {
    const start = Date.now();
    const engine = await this.ensureEngine();
    const response = await engine.chat.completions.create({
      messages: [
        ...(input.system ? [{ role: 'system' as const, content: input.system }] : []),
        { role: 'user' as const, content: input.prompt },
      ],
      temperature: input.temperature ?? 0.2,
      max_tokens: input.maxTokens ?? 512,
      response_format: { type: 'json_object' },
    });
    const output = response.choices?.[0]?.message?.content ?? '';
    this.bumpIdleTimer();

    return {
      provider: 'webllm',
      model: WEBLLM_MODEL_ID,
      output: typeof output === 'string' ? output : String(output),
      durationMs: Date.now() - start,
    };
  }

  private bumpIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    this.idleTimer = setTimeout(() => {
      this.teardown();
    }, WEBLLM_IDLE_TIMEOUT_MS);
  }

  teardown() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    this.worker?.terminate();
    this.worker = null;
    this.enginePromise = null;
    this.lastError = undefined;
    this.initProgress = 0;
    this.initMessage = '';
  }
}
