import { defineBackground } from 'wxt/utils/define-background';
import { startBackground } from '../src/background';

export default defineBackground({
  type: 'module',
  main() {
    startBackground();
  },
});
