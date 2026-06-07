import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Sift',
    description:
      "Tag, verify, or block AI features on the pages you visit. Verify checks whether an AI answer's claims are actually backed by its sources.",
    // 'storage'   — all settings + verify cache live in chrome.storage.local.
    // 'activeTab' — read the active tab's URL in the popup for the per-site toggle.
    permissions: ['storage', 'activeTab'],
    // Required so the background worker can call the Anthropic API for Verify.
    // (Separate from the API's own CORS opt-in header — both are needed.)
    host_permissions: ['https://api.anthropic.com/*'],
    // Fetching arbitrary cited sources during a Verify is requested at runtime,
    // only when the user opts into Verify — keeps the default install privacy-light.
    optional_host_permissions: ['*://*/*'],
    action: {
      default_title: 'Sift',
    },
  },
});
