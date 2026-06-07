/**
 * Selector-list access seam. v0 returns the bundled list; v2 will layer a
 * remotely-fetched list on top (ad-block style) without changing callers.
 */

import { BUNDLED_SELECTOR_LIST } from './list';
import type { SelectorList } from '../types';

export { BUNDLED_SELECTOR_LIST } from './list';
export * from './engine';

export async function getSelectorList(): Promise<SelectorList> {
  // v2: check chrome.storage for a cached remote list newer than the bundled one.
  return BUNDLED_SELECTOR_LIST;
}
