import { SiftController } from '@/lib/content/controller';

/**
 * Runs on every page so Sift can find AI surfaces wherever they appear
 * (including embeddable widgets like OpenAI ChatKit). The controller bails
 * immediately on non-http(s) pages and does nothing when the level is "off".
 */
export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    const controller = new SiftController();
    void controller.start();
  },
});
