/* IM Collections global product views. Requires supabaseClient and product-views.sql.txt. */
(() => {
  const base = 1000000;
  const db = typeof supabaseClient !== "undefined" ? supabaseClient : null;
  const localKey = "imCollectionsLocalProductViewsV1";
  let busy = false;

  function catalogId(displayId) {
    const n = Number(displayId);
    return Number.isSafeInteger(n) && n >= base + 1 ? n - base : null;
  }

  function setCount(displayId, count) {
    const text = `${Number(count).toLocaleString()} views`;
    document.querySelectorAll(`[data-product-view-count][data-product-id="${CSS.escape(String(displayId))}"]`)
      .forEach((node) => { node.textContent = text; });
    const modal = document.getElementById("modalViews");
    if (modal && Number(window.imCurrentProductViewId) === Number(displayId)) modal.textContent = text;
  }

  function readLocal() {
    try { return JSON.parse(localStorage.getItem(localKey) || "{}"); }
    catch { return {}; }
  }

  async function refresh() {
    if (!db || busy) return;
    const nodes = [...document.querySelectorAll("[data-product-view-count]")];
    const local = readLocal();
    for (const node of nodes) {
      if (!catalogId(node.dataset.productId)) {
        const count = Math.max(521, Number(local[String(node.dataset.productId)]) || 521);
        setCount(node.dataset.productId, count);
      }
    }
    const ids = [...new Set(nodes.map((node) => catalogId(node.dataset.productId)).filter(Boolean))];
    if (!ids.length) return;
    busy = true;
    try {
      const { data, error } = await db.rpc("im_product_view_counts", { p_product_ids: ids });
      if (error) throw error;
      const map = new Map((data || []).map((row) => [Number(row.product_id), Number(row.view_count)]));
      for (const node of document.querySelectorAll("[data-product-view-count]")) {
        const id = catalogId(node.dataset.productId);
        if (id) setCount(node.dataset.productId, map.get(id) || 521);
      }
    } catch (error) {
      console.warn("Product view counts could not be refreshed:", error);
    } finally { busy = false; }
  }

  async function record(displayId) {
    const id = catalogId(displayId);
    if (id && db) {
      try {
        const { data, error } = await db.rpc("im_record_product_view", { p_product_id: id });
        if (error) throw error;
        setCount(displayId, Number(data) || 522);
        return;
      } catch (error) {
        console.warn("Global product view could not be saved:", error);
      }
    }
    // Fallback for built-in demo products without a Supabase catalog ID; this count is device-local.
    const counts = readLocal();
    const key = String(displayId);
    counts[key] = Math.max(521, Number(counts[key]) || 521) + 1;
    localStorage.setItem(localKey, JSON.stringify(counts));
    setCount(displayId, counts[key]);
  }

  window.recordProductView = record;
  const observer = new MutationObserver(() => {
    clearTimeout(window.__imProductViewsRefreshTimer);
    window.__imProductViewsRefreshTimer = setTimeout(refresh, 100);
  });
  if (document.body) observer.observe(document.body, {childList:true,subtree:true});
  refresh();
})();
