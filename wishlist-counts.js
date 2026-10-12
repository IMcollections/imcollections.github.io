/* Public, aggregate wishlist counts. Individual member identities stay private. */
(() => {
  const db = typeof supabaseClient !== "undefined" ? supabaseClient : null;
  if (!db) return;

  let refreshTimer = null;
  let active = false;

  function collectButtons() {
    return [...document.querySelectorAll(".wishlist [data-wishlist-count]")];
  }

  function databaseProductId(button) {
    const displayId = Number(button.dataset.productId);
    if (!Number.isSafeInteger(displayId) || displayId < 1000001) return null;
    return displayId - 1000000;
  }

  async function refreshCounts() {
    if (active || document.visibilityState === "hidden") return;
    const buttons = collectButtons();
    const ids = [...new Set(buttons.map(databaseProductId).filter(Boolean))];
    if (!ids.length) return;

    active = true;
    try {
      const { data, error } = await db.rpc("im_wishlist_counts", {
        p_product_ids: ids,
      });
      if (error) throw error;
      const counts = new Map(
        (data || []).map((row) => [Number(row.product_id), Number(row.saved_count)]),
      );
      for (const button of buttons) {
        const id = databaseProductId(button);
        if (!id) continue;
        const count = counts.get(id) || 0;
        const badge = button.querySelector("[data-wishlist-count]");
        if (!badge) continue;
        if (badge.textContent !== String(count)) badge.textContent = String(count);
        badge.setAttribute(
          "aria-label",
          `${count} ${count === 1 ? "member has" : "members have"} saved this item`,
        );
        button.dataset.savedCount = String(count);
        const active = button.classList.contains("active");
        button.setAttribute(
          "aria-label",
          `${active ? "Remove" : "Add"} from wishlist. ${count} ${count === 1 ? "member has" : "members have"} saved this item.`,
        );
      }
    } catch (error) {
      console.warn("Wishlist counts could not be refreshed:", error);
    } finally {
      active = false;
    }
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshCounts, 150);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshCounts();
  });
  window.addEventListener("im-wishlist-updated", refreshCounts);
  new MutationObserver(scheduleRefresh).observe(document.body, {
    childList: true,
    subtree: true,
  });
  setInterval(refreshCounts, 15000);
  refreshCounts();
})();
