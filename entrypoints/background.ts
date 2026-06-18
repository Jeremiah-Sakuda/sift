import { browser } from '@/lib/browser';
import { addMessageListener } from '@/lib/messaging';
import {
  ensureInitialized,
  getSettings,
  getCachedVerify,
  putCachedVerify,
  resolveLevel,
} from '@/lib/storage';
import { getSelectorList } from '@/lib/selectors';
import { runVerify } from '@/lib/verify/pipeline';
import type { Message, VerifyResult, VerifyRequest } from '@/lib/types';

/** Origins we must hold to fetch arbitrary cited sources during a Verify. */
const SOURCE_ORIGINS: { origins: string[] } = { origins: ['*://*/*'] };

export default defineBackground(() => {
  // First run: write a complete settings object so every context reads a full shape.
  browser.runtime.onInstalled.addListener(() => {
    void ensureInitialized();
  });

  addMessageListener(async (message: Message, sender) => {
    switch (message.type) {
      case 'PING':
        return { ok: true } as const;

      case 'GET_SETTINGS':
        return getSettings();

      case 'GET_SELECTOR_LIST':
        return getSelectorList();

      case 'GET_EFFECTIVE_LEVEL':
        return resolveLevel(await getSettings(), message.hostname);

      case 'GET_CACHED_VERIFY':
        return getCachedVerify(message.answerHash);

      case 'VERIFY_ANSWER':
        return handleVerify(message.request, sender.tab?.id);

      default:
        return undefined;
    }
  });
});

async function handleVerify(request: VerifyRequest, tabId?: number): Promise<VerifyResult> {
  const settings = await getSettings();

  const base = {
    surfaceId: request.surfaceId,
    answerHash: request.answerHash,
    model: settings.verify.model,
    createdAt: new Date().toISOString(),
    claims: [],
    citations: [],
    assessments: [],
  };

  if (settings.verify.provider === 'anthropic' && !settings.verify.apiKey) {
    return { ...base, verdict: 'error', summary: 'Add an Anthropic API key in Sift options to use Verify.', error: 'missing_api_key' };
  }

  // Reuse a cached verdict for this exact answer.
  const cached = await getCachedVerify(request.answerHash);
  if (cached) return cached;

  // Source fetching needs broad host access, which the user grants explicitly
  // from the options page (a user-gesture context). REFUSE cleanly if absent.
  const canFetchSources = await browser.permissions.contains(SOURCE_ORIGINS);
  if (!canFetchSources) {
    return {
      ...base,
      verdict: 'error',
      summary: 'Enable "fetch cited sources" in Sift options to verify answers.',
      error: 'permission_needed',
    };
  }

  const result = await runVerify(request, settings.verify, (stage, detail) => {
    if (tabId == null) return;
    void browser.tabs
      .sendMessage(tabId, { type: 'VERIFY_PROGRESS', answerHash: request.answerHash, stage, detail })
      .catch(() => {
        /* tab may have navigated away; progress is best-effort */
      });
  });

  if (result.verdict !== 'error') await putCachedVerify(result);
  return result;
}
