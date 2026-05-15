import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import { startAgentGemma4Worker } from '../src/runtime/agent/gemma4-worker';

export default defineUnlistedScript(() => {
  startAgentGemma4Worker();
});
