/**
 * Single chokepoint for the WebExtension API.
 *
 * Keeps the rest of the codebase browser-agnostic and isolates the one import
 * that varies across browsers (Chrome vs Firefox) and WXT versions. Per the PRD,
 * browser-specific code is kept here so Firefox support is a later, contained change.
 *
 * WXT also exposes `browser` as a global auto-import; importing it explicitly
 * keeps non-WXT tooling (e.g. Vitest) type-checking cleanly.
 */
export { browser } from 'wxt/browser';
