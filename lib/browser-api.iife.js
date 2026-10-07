/* Shared IIFE helper — Chrome, Edge, Brave, Opera, Vivaldi, Firefox */
function getExtApi() {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  if (root.browser && root.browser.runtime && root.browser.runtime.id) return root.browser;
  if (root.chrome && root.chrome.runtime) return root.chrome;
  throw new Error("Prompt Coach: WebExtensions API not found.");
}
