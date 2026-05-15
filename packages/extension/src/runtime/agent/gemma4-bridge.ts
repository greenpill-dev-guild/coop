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
  // The runtime surface is a sandboxed iframe rather than a Worker. MV3's
  // default `extension_pages` CSP forbids `new Function()` (used by
  // onnxruntime-web's Embind glue), and Workers spawned from `chrome-extension`
  // URLs inherit that CSP. The sandboxed iframe has its own CSP declared in
  // the manifest (`content_security_policy.sandbox`) that allows
  // `'unsafe-eval'`, so transformers.js + onnxruntime-web run natively there.
  private iframe: HTMLIFrameElement | null = null;
  private iframeReadyPromise: Promise<Window> | null = null;
  private messageListener: ((event: MessageEvent) => void) | null = null;
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

  private resolveSandboxUrl(): string {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      return chrome.runtime.getURL('agent-sandbox.html');
    }
    return 'agent-sandbox.html';
  }

  private ensureIframe(): Promise<Window> {
    if (this.iframeReadyPromise) {
      return this.iframeReadyPromise;
    }

    if (typeof document === 'undefined') {
      return Promise.reject(
        new Error('Gemma4 sandbox requires a document context (offscreen or page).'),
      );
    }

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.src = this.resolveSandboxUrl();
    this.iframe = iframe;

    this.iframeReadyPromise = new Promise<Window>((resolve, reject) => {
      let settled = false;
      const onReady = (event: MessageEvent) => {
        if (event.source !== iframe.contentWindow) return;
        if (event.data?.type !== 'sandbox-ready') return;
        settled = true;
        window.removeEventListener('message', onReady);
        resolve(iframe.contentWindow as Window);
      };
      window.addEventListener('message', onReady);
      iframe.addEventListener('error', () => {
        if (settled) return;
        settled = true;
        window.removeEventListener('message', onReady);
        reject(new Error('Failed to load Gemma4 sandbox iframe.'));
      });
      (document.body ?? document.documentElement).appendChild(iframe);
    });

    this.attachIframeListener();
    return this.iframeReadyPromise;
  }

  private attachIframeListener() {
    if (!this.iframe || this.messageListener) return;
    const iframe = this.iframe;
    const listener = (event: MessageEvent<WorkerOutboundMessage>) => {
      if (event.source !== iframe.contentWindow) return;
      const message = event.data;
      if (!message || typeof message !== 'object') return;
      if (message.type !== 'response') return;
      const inflight = this.inflight.get(message.requestId);
      if (!inflight) return;
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
    };
    window.addEventListener('message', listener);
    this.messageListener = listener;
  }

  private ensureReady(): Promise<void> {
    this.bumpIdleTimer();
    if (this.initPromise) {
      return this.initPromise;
    }

    const epoch = this.epoch;

    this.initPromise = (async () => {
      const target = await this.ensureIframe();
      if (epoch !== this.epoch) {
        throw new Error('Gemma4 bridge torn down before init.');
      }

      return new Promise<void>((resolve, reject) => {
        const onInitMessage = (event: MessageEvent<WorkerOutboundMessage>) => {
          if (event.source !== this.iframe?.contentWindow) return;
          const message = event.data;
          if (!message || typeof message !== 'object') return;
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
            window.removeEventListener('message', onInitMessage);
            resolve();
            return;
          }
          if (message.type === 'init-error') {
            this.lastError = message.error;
            this.ready = false;
            window.removeEventListener('message', onInitMessage);
            reject(new Error(message.error));
          }
        };
        window.addEventListener('message', onInitMessage);
        target.postMessage({ type: 'init', modelId: this.modelId }, '*');
      });
    })().catch((error) => {
      if (epoch === this.epoch) {
        this.initPromise = null;
        this.ready = false;
        this.destroyIframe();
      }
      throw error;
    });

    return this.initPromise;
  }

  private destroyIframe() {
    if (this.messageListener) {
      window.removeEventListener('message', this.messageListener);
      this.messageListener = null;
    }
    if (this.iframe?.parentNode) {
      this.iframe.parentNode.removeChild(this.iframe);
    }
    this.iframe = null;
    this.iframeReadyPromise = null;
  }

  async complete(request: Gemma4Request): Promise<Gemma4CompletionResult> {
    await this.ensureReady();
    this.bumpIdleTimer();
    const target = this.iframe?.contentWindow;
    if (!target) {
      throw new Error('Gemma4 sandbox iframe is not available.');
    }

    const requestId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    return new Promise<Gemma4CompletionResult>((resolve, reject) => {
      this.inflight.set(requestId, { resolve, reject });
      this.postSandboxMessage({ type: 'request', requestId, request });
    });
  }

  private postSandboxMessage(message: WorkerInboundMessage) {
    this.iframe?.contentWindow?.postMessage(message, '*');
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
      inflight.reject(new Error('Gemma4 sandbox torn down before completion.'));
    }
    this.inflight.clear();
    this.destroyIframe();
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

// Hand-rolled JSON Schemas keyed by SkillOutputSchemaRef. Gemma 4 reads these
// in `apply_chat_template`'s `tools:` slot and emits a `<tool_call>` payload
// the bridge parses back into a structured argument object. Keeping these
// declarative (rather than auto-generated from Zod) avoids a dependency bump
// and keeps the function-call surface small enough to audit by eye.
const SKILL_TOOL_SCHEMAS: Record<
  string,
  { name: string; description: string; parameters: Record<string, unknown> }
> = {
  'opportunity-extractor-output': {
    name: 'extract_opportunity',
    description:
      'Extract grant, funding, or coordination opportunities from the captured material. Always return at least one candidate when the source contains funding, deadline, or eligibility language.',
    parameters: {
      type: 'object',
      required: ['candidates'],
      properties: {
        candidates: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'title', 'summary', 'rationale', 'priority', 'recommendedNextStep'],
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              summary: { type: 'string' },
              rationale: { type: 'string' },
              regionTags: { type: 'array', items: { type: 'string' } },
              ecologyTags: { type: 'array', items: { type: 'string' } },
              fundingSignals: { type: 'array', items: { type: 'string' } },
              priority: { type: 'number', minimum: 0, maximum: 1 },
              recommendedNextStep: { type: 'string' },
            },
          },
        },
      },
    },
  },
  'grant-fit-scorer-output': {
    name: 'score_grant_fit',
    description:
      'Score how well each opportunity candidate fits this coop. Use the coop purpose, recent decisions, and any attached audio/image context as fit signal. Score is a number between 0 and 1.',
    parameters: {
      type: 'object',
      required: ['scores'],
      properties: {
        scores: {
          type: 'array',
          items: {
            type: 'object',
            required: ['candidateId', 'candidateTitle', 'score', 'reasons'],
            properties: {
              candidateId: { type: 'string' },
              candidateTitle: { type: 'string' },
              score: { type: 'number', minimum: 0, maximum: 1 },
              reasons: { type: 'array', items: { type: 'string' } },
              recommendedTargetCoopId: { type: 'string' },
            },
          },
        },
      },
    },
  },
  'tab-router-output': {
    name: 'route_tab',
    description:
      'Decide which coops the captured tabs should land in and which downstream skill should consume each.',
    parameters: {
      type: 'object',
      required: ['routings'],
      properties: {
        routings: {
          type: 'array',
          items: {
            type: 'object',
            required: ['extractId', 'targetCoopId', 'status'],
            properties: {
              extractId: { type: 'string' },
              targetCoopId: { type: 'string' },
              suggestedSkillIds: { type: 'array', items: { type: 'string' } },
              status: {
                type: 'string',
                enum: ['routed', 'drafted', 'dismissed', 'published'],
              },
              rationale: { type: 'string' },
            },
          },
        },
      },
    },
  },
  'theme-clusterer-output': {
    name: 'cluster_themes',
    description:
      'Cluster recent captures, drafts, and observations into themes the coop is paying attention to.',
    parameters: {
      type: 'object',
      required: ['themes'],
      properties: {
        themes: {
          type: 'array',
          items: {
            type: 'object',
            required: ['name', 'summary'],
            properties: {
              name: { type: 'string' },
              summary: { type: 'string' },
              memberArtifactIds: { type: 'array', items: { type: 'string' } },
              memberDraftIds: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    },
  },
  'review-digest-output': {
    name: 'review_digest',
    description:
      'Compose a short review digest summarizing the coop activity since the last review ritual.',
    parameters: {
      type: 'object',
      required: ['title', 'summary', 'whyItMatters', 'suggestedNextStep', 'highlights'],
      properties: {
        title: { type: 'string' },
        summary: { type: 'string' },
        whyItMatters: { type: 'string' },
        suggestedNextStep: { type: 'string' },
        highlights: { type: 'array', items: { type: 'string' } },
        tags: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  'grant-action-planner-output': {
    name: 'draft_application_outline',
    description:
      'Plan the next concrete action on a top-scored grant opportunity. Returns one of: draft an application outline, add to coop calendar, or request input from a member.',
    parameters: {
      type: 'object',
      required: ['action', 'opportunityTitle', 'rationale'],
      properties: {
        action: {
          type: 'string',
          enum: ['draft_application_outline', 'add_to_coop_calendar', 'request_member_input'],
        },
        opportunityTitle: { type: 'string' },
        deadlineIso: { type: 'string' },
        outlineSections: { type: 'array', items: { type: 'string' } },
        memberIds: { type: 'array', items: { type: 'string' } },
        rationale: { type: 'string' },
      },
    },
  },
};

export function buildGemma4ToolForSkill(schemaRef: string): Gemma4ToolDefinition | undefined {
  const tool = SKILL_TOOL_SCHEMAS[schemaRef];
  if (!tool) return undefined;
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}

export function getGemma4ToolNameForSkill(schemaRef: string): string | undefined {
  return SKILL_TOOL_SCHEMAS[schemaRef]?.name;
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
