import { SiftController } from '@/lib/content/controller';

/**
 * Runs on every page so Sift can find AI surfaces wherever they appear
 * (including embeddable widgets like OpenAI ChatKit). The controller bails
 * immediately on non-http(s) pages and does nothing when the level is "off".
 */
export default defineContentScript({
  matches: ['<all_urls>'],
  // document_start so Block can inject a hiding CSS rule before the AI surface
  // ever paints (no flash-of-unblocked-content). Detection/Tag still work once
  // the surface appears via the MutationObserver.
  runAt: 'document_start',
  main() {
    const controller = new SiftController();
    void controller.start();
  },
});
