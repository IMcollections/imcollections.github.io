/* IM Collections update: OCT09-LOGIN-NAV-NEW */
/* Shared authenticated account navigation, wishlist and saved Square cards. */
(() => {
  const styles = document.createElement("style");
  styles.textContent = `
    [hidden]{display:none!important}
    .im-account-select{width:100%;max-width:520px;min-height:48px;padding:12px 42px 12px 16px;border:1px solid #ddd7c9;border-radius:10px;background:#eee9dc;color:#6f501b;font-size:16px;font-weight:600}
    .im-photo-thumbnail{padding:0!important;border:0!important;background:transparent!important;cursor:zoom-in;width:auto!important;margin:0!important}
    .im-photo-dialog{width:min(94vw,700px);max-height:90dvh;overflow:auto;border:0;border-radius:14px;padding:24px;margin:auto;color:#111;background:white}
    .im-photo-dialog::backdrop{background:rgba(0,0,0,.6)}
    .im-photo-heading{display:flex;align-items:start;justify-content:space-between;gap:12px;margin-bottom:18px}
    .im-photo-heading h2{font-size:22px;color:#8f681e;margin:0}
    .im-photo-close{flex:0 0 44px;width:44px!important;min-height:44px;border:0!important;background:transparent!important;color:#167cd3!important;font-size:32px!important;padding:0!important;margin:0!important;cursor:pointer}
    .im-photo-gallery{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;touch-action:pan-x pan-y;scrollbar-width:none}
    .im-photo-gallery::-webkit-scrollbar{display:none}
    .im-photo-gallery img{width:100%;min-width:100%;flex:0 0 100%;max-height:64dvh;object-fit:contain;scroll-snap-align:start}
    .im-photo-dialog p{margin:16px 0 0;line-height:1.6;white-space:pre-line}
    #paymentSection{margin-top:16px;padding:20px}
    #memberCards:empty{display:none}
    #memberCards p{margin:12px 0}
    #memberCardForm{margin-top:16px}
    .im-card-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
    .im-card-actions button{width:auto!important;margin:0!important;padding:12px 16px!important;min-height:44px}
    #memberCardConsent{width:20px;height:20px;vertical-align:middle;margin-right:6px}
    #memberCardForm .im-consent{text-transform:none;letter-spacing:0;font-weight:normal;line-height:1.5}
    #memberIdentity{margin:8px 0 18px;font-size:16px;color:#8f681e}
    #accountSectionTitle,#wishlistSection>h3,#paymentSection>h3,#collectionsHeading{display:none}
    #accountGreeting{margin:16px 0 0;font-weight:600}

    .im-member-nav{margin:14px 0 24px;color:#8f681e}
    .im-member-nav summary{padding:14px;background:#eee9dc;border-radius:8px;cursor:pointer;font-weight:bold}
    .im-member-nav nav{display:grid;background:white;border:1px solid #ddd;border-radius:8px}
    .im-member-nav a{display:block;padding:12px 16px;border-bottom:1px solid #eee;color:#8f681e}
    .wishlist.active svg{stroke:#167cd3!important;fill:#167cd3!important}
  `;
  document.head.append(styles);
  function productId(button) {
    if (button.dataset.productId) return Number(button.dataset.productId);
    const card = button.closest(".product-card");
    const action = card?.querySelector(
      '[onclick*="addToCart"], [onclick*="openQuickView"]',
    );
    const match = action
      ?.getAttribute("onclick")
      ?.match(/(?:addToCart|openQuickView)\((\d+)\)/);
    if (match) button.dataset.productId = match[1];
    return Number(match?.[1]);
  }
  // Extend the existing shop without replacing its current product/category markup.
  if (document.getElementById("headerLoggedIn")) {
    for (const [id, logoutId, dropdown] of [
      ["headerLoggedIn", "headerLogoutLink", false],
      ["loggedInAccount", "logoutLink", true],
    ]) {
      const host = document.getElementById(id);
      if (!host || host.querySelector("[data-member-links]")) continue;
      const logout = document.getElementById(logoutId);
      if (logout) logout.textContent = "Sign Out";
      host.replaceChildren();
      const nav = document.createElement("nav");
      nav.dataset.memberLinks = "";
      nav.dataset.memberLinkList = "";
      nav.setAttribute("aria-label", "My Account sections");
      host.append(nav);
      if (logout) host.append(logout);
    }
    window.toggleWishlist = (button) => window.imMember.toggle(button);
  }
  const db = typeof supabaseClient !== "undefined" ? supabaseClient : client;
  const el = (tag, text) => {
    const n = document.createElement(tag);
    if (text != null) n.textContent = text;
    return n;
  };
  if (
    document.querySelector("[data-member-links]") &&
    !document.getElementById("headerLoggedIn")
  ) {
    const header = document.querySelector("header");
    if (
      header &&
      !header.querySelector(
        'a[href="my-account.html"],a[href="my-account.html#summary"]',
      )
    ) {
      const link = el("a", "My Account");
      link.href = "my-account.html#summary";
      link.style.cssText = "font-weight:600;margin-left:12px";
      header.prepend(link);
    }
  }
  const routes = [
    ["Account Summary", "my-account.html#summary"],
    ["Wishlist", "my-account.html#wishlist"],
    ["Orders", "orders-returns.html#orders"],
    ["Returns", "returns.html"],
    ["Track Orders", "track-orders.html"],
    ["Payment", "my-account.html#payment"],
  ];
  let wishlistReady = false;
  let user = null,
    version = 0,
    wishlist = new Set(),
    cards = [],
    storeCard = null,
    pendingSave = null;
  const safeImage = (value) => {
    try {
      const u = new URL(value, location.href);
      return ["https:", "http:"].includes(u.protocol) ? u.href : "";
    } catch {
      return "";
    }
  };
  function navigation(container) {
    if (container.hasAttribute("data-member-link-list")) {
      const links =
        container.closest("footer") || container.closest("#loggedInAccount")
          ? [
              routes[0],
              routes[2],
              routes[3],
              ["Refer A Friend", "my-account.html#referral"],
            ]
          : routes;
      container.replaceChildren();
      for (const [label, href] of links) {
        const a = el("a", label);
        a.href = href;
        container.append(a);
      }
      return;
    }
    const select = el("select");
    select.className = "im-account-select";
    select.setAttribute("aria-label", "My Account sections");
    const current = location.pathname.split("/").pop() + location.hash;

    for (const [label, href] of routes) {
      const option = el("option", label);
      option.value = href;
      option.selected =
        href === current ||
        (href === "orders-returns.html#orders" &&
          current === "orders-returns.html") ||
        (href === "returns.html" && current.startsWith("returns.html")) ||
        (href === "my-account.html#summary" && current === "my-account.html");
      select.append(option);
    }
    select.addEventListener("change", () => {
      if (select.value) location.href = select.value;
    });
    const details = container.closest("details.im-member-nav");
    if (details) {
      const host = el("div");
      host.className = "im-member-nav";
      host.setAttribute("role", "heading");
      host.setAttribute("aria-level", "2");
      host.dataset.memberOnly = "";
      host.hidden = true;
      host.append(select);
      details.replaceWith(host);
    } else container.replaceChildren(select);
  }
  let photoDialog = null,
    photoVersion = 0;
  async function openProductPhoto(item, purchased = false) {
    const run = ++photoVersion;
    if (!photoDialog) {
      photoDialog = el("dialog");
      photoDialog.className = "im-photo-dialog";
      photoDialog.id = "memberProductPhoto";
      photoDialog.setAttribute("aria-labelledby", "memberProductPhotoTitle");
      photoDialog.addEventListener("close", () => {
        ++photoVersion;
      });
      photoDialog.addEventListener("click", (e) => {
        if (e.target !== photoDialog) return;
        const r = photoDialog.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
          photoDialog.close();
      });
      document.body.append(photoDialog);
    }
    function draw(product) {
      if (run !== photoVersion) return;
      const head = el("div");
      head.className = "im-photo-heading";
      const title = el("h2", item.name || product.name || "Product");
      title.id = "memberProductPhotoTitle";
      const close = el("button", "×");
      close.type = "button";
      close.className = "im-photo-close";
      close.setAttribute("aria-label", "Close product image");
      close.onclick = () => photoDialog.close();
      head.append(title, close);
      const gallery = el("div");
      gallery.className = "im-photo-gallery";
      const photos = [
        ...new Set(
          [
            item.image,
            ...(item.images || []),
            ...(product.image_urls || []),
          ].filter(Boolean),
        ),
      ];
      for (const src of photos) {
        const url = safeImage(src);
        if (!url) continue;
        const img = el("img");
        img.src = url;
        img.alt = title.textContent;
        gallery.append(img);
      }
      photoDialog.replaceChildren(head, gallery);
      const description = item.description || product.description;
      if (description) photoDialog.append(el("p", description));
      const size = purchased ? item.size : product.size;
      if (size)
        photoDialog.append(
          el("p", (purchased ? "Purchased size: " : "Available size: ") + size),
        );
      if (!purchased) {
        const shop = el("a", "Back to Shopping");
        shop.href = "index.html#featured";
        photoDialog.append(shop);
      }
      if (!photoDialog.open) photoDialog.showModal();
      gallery.scrollLeft = 0;
    }
    draw(item);
    // Old receipts retain their purchased name, price and size; catalog details only enrich the viewer.
    const id = purchased ? Number(item.id) - 1000000 : Number(item.id);
    if (
      purchased &&
      Number.isSafeInteger(id) &&
      id > 0 &&
      (!item.description || !item.images?.length)
    ) {
      const r = await db
        .from("products")
        .select("name,description,size,image_urls")
        .eq("id", id)
        .maybeSingle();
      if (!r.error && r.data && run === photoVersion) draw(r.data);
    }
  }
  function syncHearts() {
    for (const b of document.querySelectorAll(".wishlist")) {
      const active = wishlist.has(productId(b) - 1000000);
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", String(active));
      b.setAttribute(
        "aria-label",
        active ? "Remove from wishlist" : "Add to wishlist",
      );
      if (!b.querySelector("svg")) {
        const text = active ? "💙" : "♡";
        if (b.textContent !== text) b.textContent = text;
      }
    }
  }
  async function toggle(button) {
    if (!user) {
      if (confirm("Sign in to save products to your Wishlist?"))
        location.href = "my-account.html";
      return;
    }
    if (!wishlistReady) {
      alert("Wishlist could not be loaded. Refresh and try again.");
      return;
    }
    const owner = user.id,
      stamp = version,
      id = productId(button) - 1000000;
    if (!Number.isSafeInteger(id) || id < 1) return;
    button.disabled = true;
    try {
      const removing = wishlist.has(id);
      const r = removing
        ? await db
            .from("im_wishlist")
            .delete()
            .eq("user_id", owner)
            .eq("product_id", id)
        : await db
            .from("im_wishlist")
            .insert({ user_id: owner, product_id: id });
      if (r.error)
        throw Error("Your Wishlist could not be saved. Please try again.");
      if (stamp !== version) return;
      removing ? wishlist.delete(id) : wishlist.add(id);
      syncHearts();
      if (typeof showToast === "function")
        showToast(removing ? "Removed from wishlist" : "Added to wishlist");
    } catch (e) {
      alert(e.message);
    } finally {
      button.disabled = false;
    }
  }
  async function renderWishlist(stamp = version) {
    const target = document.getElementById("memberWishlist");
    if (!target || !user) return;
    if (!wishlistReady) {
      target.replaceChildren(
        el("p", "Wishlist could not be loaded. Refresh and try again."),
      );
      return;
    }
    target.replaceChildren(el("p", "Loading Wishlist…"));
    if (!wishlist.size) {
      target.replaceChildren(el("p", "Your Wishlist is empty."));
      return;
    }
    const r = await db
      .from("products")
      .select("id,name,price,size,image_urls,quantity,description")
      .in("id", [...wishlist]);
    if (stamp !== version) return;
    if (r.error) {
      target.replaceChildren(
        el("p", "Wishlist could not be loaded. Try refreshing."),
      );
      return;
    }
    target.replaceChildren();
    for (const p of r.data || []) {
      const row = el("article");
      row.className = "im-wish-item";
      const image = safeImage(p.image_urls?.[0]);
      if (image) {
        const a = el("button");
        a.type = "button";
        a.className = "im-photo-thumbnail";
        a.setAttribute("aria-label", "Enlarge " + p.name);
        a.onclick = () => openProductPhoto(p);
        const img = el("img");
        img.src = image;
        img.alt = p.name;
        a.append(img);
        row.append(a);
      }
      const copy = el("div");
      copy.append(el("h3", p.name), el("p", "$" + Number(p.price).toFixed(2)));
      if (p.size) copy.append(el("p", "Size: " + p.size));
      if (Number(p.quantity) === 0)
        copy.append(el("p", "Currently unavailable"));
      const shop = el("a", "Find Your Collections");
      shop.href = "index.html#featured";
      const remove = el("button", "Remove");
      remove.type = "button";
      remove.onclick = async () => {
        remove.disabled = true;
        const owner = user?.id;
        const r = await db
          .from("im_wishlist")
          .delete()
          .eq("user_id", owner)
          .eq("product_id", p.id);
        if (stamp !== version) return;
        if (r.error) {
          remove.disabled = false;
          alert("Could not remove this saved item.");
          return;
        }
        wishlist.delete(Number(p.id));
        syncHearts();
        renderWishlist();
      };
      copy.append(shop, remove);
      row.append(copy);
      target.append(row);
    }
  }
  async function cardAction(body) {
    const {
      data: { session },
    } = await db.auth.getSession();
    if (!session || session.user.id !== user?.id) throw Error("Sign in again.");
    const r = await db.functions.invoke("member-payment-methods", {
      body: { ...body, userAccessToken: session.access_token },
    });
    let data = r.data;
    if (r.error?.context?.json) {
      try {
        data = await r.error.context.json();
      } catch {}
    }
    if (r.error || !data?.success)
      throw Error(data?.error || "Saved payments could not be loaded.");
    return data.cards || [];
  }
  async function renderCards() {
    const target = document.getElementById("memberCards");
    if (!target || !user) return;
    const stamp = version;
    target.replaceChildren(el("p", "Loading saved payment methods…"));
    try {
      const result = await cardAction({ action: "list" });
      if (stamp !== version) return;
      cards = result;
      target.replaceChildren();
      if (!cards.length)
        target.append(el("p", "You don’t have a payment method stored yet."));
      for (const c of cards) {
        const row = el("article");
        row.className = "im-wish-item";
        row.append(
          el(
            "p",
            (c.label ? c.label + " — " : "") +
              c.brand +
              " •••• " +
              c.last_four +
              (c.is_default ? " (Default)" : ""),
          ),
          el("p", "Expires " + c.exp_month + "/" + c.exp_year),
        );
        const edit = el("button", "Edit");
        edit.type = "button";
        edit.onclick = async () => {
          const label = prompt("Card label", c.label || "");
          if (label === null) return;
          edit.disabled = true;
          try {
            await cardAction({
              action: "edit",
              cardId: c.id,
              label,
              makeDefault: confirm("Use this as your default card?"),
            });
            await renderCards();
          } catch (e) {
            alert(e.message);
            edit.disabled = false;
          }
        };
        const remove = el("button", "Remove");
        remove.type = "button";
        remove.onclick = async () => {
          if (!confirm("Remove this saved payment method?")) return;
          remove.disabled = true;
          try {
            await cardAction({ action: "remove", cardId: c.id });
            await renderCards();
          } catch (e) {
            alert(e.message);
            remove.disabled = false;
          }
        };
        row.append(edit, remove);
        target.append(row);
      }
    } catch (e) {
      if (stamp === version) target.replaceChildren(el("p", e.message));
    }
  }
  async function openCardForm() {
    const form = document.getElementById("memberCardForm");
    form.hidden = false;
    document.getElementById("memberAddCardHome").hidden = true;
    try {
      if (!storeCard) {
        storeCard = await Square.payments(
          "sandbox-sq0idb-c7snyR_ZJ25r9nRUu7ZvqA",
          "LG5NFQWF",
        ).card();
        await storeCard.attach("#member-card-container");
      }
    } catch {
      document.getElementById("memberCardMessage").textContent =
        "Secure card form could not load. Refresh and try again.";
    }
  }
  async function saveCard(event) {
    event.preventDefault();
    const button = document.getElementById("memberSaveCard"),
      status = document.getElementById("memberCardMessage");
    if (!user || !storeCard) return;
    button.disabled = true;
    try {
      if (!document.getElementById("memberCardConsent").checked)
        throw Error("Confirm permission to save your card.");
      if (!pendingSave) {
        const profile =
          typeof currentProfile !== "undefined" ? currentProfile : null;
        const result = await storeCard.tokenize({
          intent: "STORE",
          customerInitiated: true,
          sellerKeyedIn: false,
          billingContact: {
            givenName: profile?.first_name || "",
            familyName: profile?.last_name || "",
            email: user.email,
            countryCode: "US",
          },
        });
        if (result.status !== "OK")
          throw Error("Check your card details and try again.");
        pendingSave = {
          action: "add",
          requestId: crypto.randomUUID(),
          sourceId: result.token,
          cardholderName: document.getElementById("memberCardholder").value,
          label: document.getElementById("memberCardLabel").value,
          consent: true,
        };
      }
      await cardAction(pendingSave);
      pendingSave = null;
      status.textContent = "Card saved.";
      closeCardForm();
      await renderCards();
    } catch (e) {
      status.textContent =
        e.message +
        (pendingSave ? " Tap Save again to check the same request." : "");
    } finally {
      button.disabled = false;
    }
  }
  function closeCardForm() {
    document.getElementById("memberCardForm").hidden = true;
    document.getElementById("memberAddCardHome").hidden = false;
  }
  function accountSection() {
    const currentRoute =
      location.pathname.split("/").pop() +
      (location.hash ||
        (location.pathname.endsWith("my-account.html") ? "#summary" : ""));
    for (const select of document.querySelectorAll(".im-account-select")) {
      const href = routes.find((r) => r[1] === currentRoute)?.[1];
      if (href) select.value = href;
    }
    const summary = document.getElementById("memberSummary");
    if (!summary) return;
    const name = location.hash.slice(1);
    const tab = ["wishlist", "payment"].includes(name) ? name : "summary";
    summary.hidden = tab !== "summary";
    document.getElementById("wishlistSection").hidden = tab !== "wishlist";
    document.getElementById("paymentSection").hidden = tab !== "payment";
    document.getElementById("accountSectionTitle").textContent =
      routes.find((x) => x[1].endsWith("#" + tab))?.[0] || "Account Summary";
    if (user && tab === "wishlist") renderWishlist();
    if (user && tab === "payment") renderCards();
    if (name === "referral" && user) {
      document.getElementById("referFriendBtn")?.click();
      document
        .getElementById("referFriendBtn")
        ?.scrollIntoView({ block: "center" });
    }
  }
  async function loadMember() {
    const stamp = ++version;
    const { data, error } = await db.auth.getUser();
    if (stamp !== version) return;
    const previous = user?.id;
    user = error ? null : data.user;
    wishlist.clear();
    wishlistReady = false;
    cards = [];
    for (const id of ["headerLoggedIn", "loggedInAccount"]) {
      const n = document.getElementById(id);
      if (n) n.style.display = user ? "block" : "none";
    }
    for (const id of ["headerLoggedOut", "accountLinks"]) {
      const n = document.getElementById(id);
      if (n) n.style.display = user ? "none" : "block";
    }
    if (previous !== user?.id) {
      pendingSave = null;
      const form = document.getElementById("memberCardForm");
      if (form) {
        form.reset();
        closeCardForm();
      }
      if (storeCard) {
        storeCard.destroy();
        storeCard = null;
      }
    }
    for (const n of document.querySelectorAll("[data-member-only]"))
      n.hidden = !user;
    const authLink = document.getElementById("memberAuthLink");
    if (authLink) {
      authLink.textContent = user ? "Sign Out" : "Sign In";
      authLink.href = "my-account.html";
      authLink.onclick = async (event) => {
        if (!user) return;
        event.preventDefault();
        const { error } = await db.auth.signOut();
        if (error) {
          alert("Could not sign out. Try again.");
          return;
        }
        location.reload();
      };
    }
    if (!user) {
      if (photoDialog?.open) photoDialog.close();
      if (document.getElementById("accountDashboard")) {
        document.getElementById("accountDashboard").style.display = "none";
        document.getElementById("loginCard").style.display = "block";
      }
      document.getElementById("memberCards")?.replaceChildren();
      document.getElementById("memberWishlist")?.replaceChildren();
      if (document.getElementById("memberIdentity"))
        document.getElementById("memberIdentity").textContent = "";
      syncHearts();
      return;
    }
    const [id, saved, profile] = await Promise.all([
      db.rpc("im_my_member_id"),
      db.from("im_wishlist").select("product_id").eq("user_id", user.id),
      db.from("profiles").select("first_name").eq("id", user.id).maybeSingle(),
    ]);
    if (stamp !== version) return;
    const greeting = document.getElementById("accountGreeting");
    if (greeting)
      greeting.textContent =
        "Hello, " +
        (profile.data?.first_name ||
          user.user_metadata?.first_name ||
          "Member") +
        "!";
    const identity = document.getElementById("memberIdentity");
    if (identity)
      identity.textContent = id.error
        ? "Member ID could not be loaded."
        : "Member ID: " + (id.data || "Pending");
    const input = document.getElementById("returnMemberId");
    if (input && !id.error) input.value = id.data || "";
    if (saved.error) {
      const target = document.getElementById("memberWishlist");
      if (target)
        target.textContent =
          "Wishlist could not be loaded. Install the member setup and refresh.";
    }
    wishlistReady = !saved.error;
    wishlist = new Set((saved.data || []).map((x) => Number(x.product_id)));
    syncHearts();
    accountSection();
    if (["#orders", "#returnSection"].includes(location.hash))
      document
        .querySelector(location.hash)
        ?.scrollIntoView({ behavior: "smooth" });
  }
  for (const n of document.querySelectorAll("[data-member-links]"))
    navigation(n);
  window.imMember = {
    toggle,
    openProductPhoto,
    syncHearts,
    cardAction,
    get user() {
      return user;
    },
  };
  window.addEventListener("hashchange", accountSection);
  document
    .getElementById("memberAddCard")
    ?.addEventListener("click", openCardForm);
  document
    .getElementById("memberCardForm")
    ?.addEventListener("submit", saveCard);
  document.getElementById("memberCancelCard")?.addEventListener("click", () => {
    closeCardForm();
  });
  db.auth.onAuthStateChange((event) => {
    if (["SIGNED_IN", "SIGNED_OUT", "INITIAL_SESSION"].includes(event))
      setTimeout(loadMember, 0);
  });
  loadMember();
  // Product grids are rendered/replaced by the existing catalog functions.
  if (document.getElementById("headerLoggedIn")) {
    const observer = new MutationObserver((m) => {
      if (m.some((x) => x.addedNodes.length)) syncHearts();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
