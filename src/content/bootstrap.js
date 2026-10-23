// Classic content-script entry. Chrome does not support static import/export
// in manifest content_scripts, so we dynamically load the ES module graph.
(async () => {
  try {
    await import(chrome.runtime.getURL("content/content.js"));
  } catch (err) {
    console.error("[canada-qbank] failed to load content module:", err);
  }
})();
