let handler: { onmessage(event: MessageEvent): void } | null = null;

self.onmessage = async (event: MessageEvent) => {
  if (!handler) {
    const { WebWorkerMLCEngineHandler } = await import('@mlc-ai/web-llm');
    handler = new WebWorkerMLCEngineHandler();
  }
  handler.onmessage(event);
};
