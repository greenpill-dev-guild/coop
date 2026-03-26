import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import { startAgentWebLlmWorker } from '../src/runtime/agent-webllm-worker';

export default defineUnlistedScript(() => {
  startAgentWebLlmWorker();
});
