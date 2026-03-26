import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import { startInferenceWorker } from '../src/runtime/inference-worker';

export default defineUnlistedScript(() => {
  startInferenceWorker();
});
