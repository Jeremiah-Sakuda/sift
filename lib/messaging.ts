/**
 * Typed wrapper over runtime messaging between content script, popup, options,
 * and the background worker. Keeps every call site honest about request and
 * response shapes (see Message / MessageResponseMap in types).
 */

import { browser } from './browser';
import type { Message, MessageResponseMap } from './types';

export async function sendMessage<K extends Message['type']>(
  message: Extract<Message, { type: K }>,
): Promise<MessageResponseMap[K]> {
  return (await browser.runtime.sendMessage(message)) as MessageResponseMap[K];
}

export type MessageHandler = (
  message: Message,
  sender: chrome.runtime.MessageSender,
) => Promise<unknown> | unknown;

/**
 * Register a single async message router in the background worker. The polyfill
 * forwards a returned Promise back to the sender, so handlers can be async.
 */
export function addMessageListener(handler: MessageHandler): void {
  browser.runtime.onMessage.addListener((message, sender) => {
    // Returning a Promise tells the polyfill/Chrome to keep the channel open.
    return handler(message as Message, sender) as Promise<unknown>;
  });
}
