let handler: { onmessage(event: MessageEvent): void } | null = null;
let agentWebLlmWorkerStarted = false;

export function startAgentWebLlmWorker() {
  if (agentWebLlmWorkerStarted) {
    return;
  }

  agentWebLlmWorkerStarted = true;

  self.onmessage = async (event: MessageEvent) => {
    if (!handler) {
      const { WebWorkerMLCEngineHandler } = await import('@mlc-ai/web-llm');
      handler = new WebWorkerMLCEngineHandler();
    }
    handler.onmessage(event);
  };
}
