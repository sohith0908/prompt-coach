(() => {
  const params = new URLSearchParams(location.search);
  const reason = params.get("reason");
  const reasonEl = document.getElementById("reason");
  if (reason && reasonEl) {
    reasonEl.textContent = reason;
  }

  const closeBtn = document.getElementById("close");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      window.close();
    });
  }
})();
