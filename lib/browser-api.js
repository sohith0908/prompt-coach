/**
 * Cross-browser WebExtensions API.
 * Firefox exposes `browser` (Promise-based). Chromium exposes `chrome`
 * (Promise-based in MV3 when no callback is passed).
 */
const root = globalThis;

export const ext =
  root.browser && root.browser.runtime && root.browser.runtime.id
    ? root.browser
    : root.chrome;

if (!ext?.runtime) {
  throw new Error("Prompt Coach: WebExtensions API not found.");
}

export function isFirefox() {
  try {
    return Boolean(ext.runtime.getBrowserInfo) || /firefox/i.test(navigator.userAgent || "");
  } catch {
    return false;
  }
}
