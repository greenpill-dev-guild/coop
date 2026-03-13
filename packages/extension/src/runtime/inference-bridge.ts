import type { LocalInferenceCapability, RefineRequest, RefineResult } from '@coop/shared';
import {
  buildRefinePrompt,
  createHeuristicProvider,
  detectLocalInferenceCapability,
  parseRefineOutput,
} from '@coop/shared';
import type { InferenceWorkerRequest, InferenceWorkerResponse } from './inference-worker';

const REFINE_TIMEOUT_MS = 60_000;

export interface InferenceBridgeState {
  capability: LocalInferenceCapability;
  workerReady: boolean;
  initProgress: number;
  initMessage: string;
}

type StatusListener = (state: InferenceBridgeState) => void;

export class InferenceBridge {
  private worker: Worker | null = null;
  private userOptIn = false;
  private hasWebGpu = false;
  private modelReady = false;
  private modelLoading = false;
  private error: string | undefined;
  private initProgress = 0;
  private initMessage = '';
  private pendingResolves = new Map<
    string,
    {
      resolve: (response: InferenceWorkerResponse) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private listeners = new Set<StatusListener>();
  private heuristicProvider = createHeuristicProvider();

  constructor() {
    this.hasWebGpu = typeof navigator !== 'undefined' && 'gpu' in navigator;
  }

  getState(): InferenceBridgeState {
    return {
      capability: detectLocalInferenceCapability({
        userOptIn: this.userOptIn,
        hasWorker: this.worker !== null,
        hasWebGpu: this.hasWebGpu,
        modelReady: this.modelReady,
        modelLoading: this.modelLoading,
        error: this.error,
      }),
      workerReady: this.modelReady,
      initProgress: this.initProgress,
      initMessage: this.initMessage,
    };
  }

  subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  setOptIn(enabled: boolean) {
    this.userOptIn = enabled;
    if (enabled && !this.worker) {
      this.spawnWorker();
    }
    if (!enabled) {
      this.teardown();
    }
    this.notify();
  }

  private spawnWorker() {
    try {
      // Worker file is built as a separate rollup entry (inference-worker.js in dist).
      // In the Chrome extension context, we reference it via chrome.runtime.getURL.
      // In other contexts (tests), the Worker constructor may throw and we fall back.
      const workerUrl =
        typeof chrome !== 'undefined' && chrome.runtime?.getURL
          ? chrome.runtime.getURL('inference-worker.js')
          : 'inference-worker.js';
      this.worker = new Worker(workerUrl, {
        type: 'module',
      });

      this.worker.onmessage = (event: MessageEvent<InferenceWorkerResponse>) => {
        this.handleWorkerMessage(event.data);
      };

      this.worker.onerror = (event) => {
        this.error = event.message || 'Worker error';
        this.modelReady = false;
        this.modelLoading = false;
        this.notify();
      };
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to create worker';
      this.notify();
    }
  }

  private handleWorkerMessage(msg: InferenceWorkerResponse) {
    switch (msg.type) {
      case 'status':
        this.modelReady = msg.status === 'ready';
        this.modelLoading = msg.status === 'loading';
        this.error = msg.error;
        this.notify();
        break;

      case 'init-progress':
        this.initProgress = msg.progress;
        this.initMessage = msg.message;
        this.notify();
        break;

      case 'refine-result': {
        const pending = this.pendingResolves.get(msg.id);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingResolves.delete(msg.id);
          pending.resolve(msg);
        }
        break;
      }

      case 'refine-error': {
        const pending = this.pendingResolves.get(msg.id);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingResolves.delete(msg.id);
          pending.reject(new Error(msg.error));
        }
        break;
      }
    }
  }

  async refine(request: RefineRequest): Promise<RefineResult> {
    const state = this.getState();

    // If model not ready, fall back to heuristics
    if (state.capability.status !== 'ready' || !this.worker) {
      return this.heuristicProvider.refine(request);
    }

    const prompt = buildRefinePrompt(request);
    const id = `refine-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return new Promise<RefineResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingResolves.delete(id);
        const cancelMsg: InferenceWorkerRequest = { type: 'cancel' };
        this.worker?.postMessage(cancelMsg);
        // Fall back to heuristic on timeout
        this.heuristicProvider.refine(request).then(resolve).catch(reject);
      }, REFINE_TIMEOUT_MS);

      this.pendingResolves.set(id, {
        resolve: (response) => {
          if (response.type === 'refine-result') {
            resolve(
              parseRefineOutput(
                request,
                response.output,
                'local-model',
                'Qwen2.5-0.5B-Instruct',
                response.durationMs,
              ),
            );
          }
        },
        reject: (_error) => {
          // Fall back to heuristic on error
          this.heuristicProvider.refine(request).then(resolve).catch(reject);
        },
        timer,
      });

      const workerMsg: InferenceWorkerRequest = {
        type: 'refine',
        id,
        prompt,
      };
      this.worker?.postMessage(workerMsg);
    });
  }

  /** Eagerly initialize the model without running inference. */
  initModel() {
    if (!this.worker) {
      this.spawnWorker();
    }
    const msg: InferenceWorkerRequest = { type: 'init' };
    this.worker?.postMessage(msg);
  }

  cancel() {
    const msg: InferenceWorkerRequest = { type: 'cancel' };
    this.worker?.postMessage(msg);
    for (const [id, pending] of this.pendingResolves) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Cancelled'));
    }
    this.pendingResolves.clear();
  }

  teardown() {
    this.cancel();
    this.worker?.terminate();
    this.worker = null;
    this.modelReady = false;
    this.modelLoading = false;
    this.error = undefined;
    this.initProgress = 0;
    this.initMessage = '';
    this.notify();
  }
}
