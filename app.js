(function () {
  "use strict";

  const STORAGE_KEY = "cart_v1";
  /** Destino wa.me (DDI+DDD+número, sem +). Não exibir na UI. */
  const WA_NUMBER = "5571991981871";

  const money = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  const products = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
  const productById = new Map(products.map((p) => [p.id, p]));

  /** Quando false, o carrinho funciona só na sessão (sem persistir). */
  let storageOk = true;

  try {
    const probe = "__storage_probe__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
  } catch (_) {
    storageOk = false;
  }

  /** @type {Record<string, number>} */
  let cart = loadCart();

  function loadCart() {
    if (!storageOk) return {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const out = {};
        for (const [id, qty] of Object.entries(parsed)) {
          const n = Number(qty);
          if (productById.has(id) && Number.isFinite(n) && n > 0) {
            out[id] = Math.floor(n);
          }
        }
        return out;
      }
    } catch (_) {
      /* ignore */
    }
    return {};
  }

  function saveCart() {
    if (!storageOk) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch (_) {
      storageOk = false;
    }
  }

  function getQty(id) {
    return cart[id] || 0;
  }

  function setQty(id, qty) {
    const prev = getQty(id);
    const n = Math.max(0, Math.floor(Number(qty) || 0));
    if (n === 0) {
      delete cart[id];
    } else {
      cart[id] = n;
    }
    saveCart();
    renderAll();
    if (n > prev) {
      onCartQuantityIncreased(productById.get(id), n - prev);
    }
  }

  function addOne(id) {
    setQty(id, getQty(id) + 1);
  }

  let toastHideTimer = 0;
  let toastCleanupTimer = 0;
  let pulseTimer = 0;

  function pulseCartPanel() {
    const el = document.getElementById("cartPanelInner");
    if (!el) return;
    el.classList.remove("cart-panel__inner--pulse");
    void el.offsetWidth;
    el.classList.add("cart-panel__inner--pulse");
    clearTimeout(pulseTimer);
    pulseTimer = setTimeout(function () {
      el.classList.remove("cart-panel__inner--pulse");
    }, 700);
  }

  function showCartToast(message) {
    const toast = document.getElementById("cartToast");
    if (!toast) return;
    clearTimeout(toastHideTimer);
    clearTimeout(toastCleanupTimer);
    toast.hidden = false;
    toast.textContent = message;
    requestAnimationFrame(function () {
      toast.classList.add("cart-toast--visible");
    });
    toastHideTimer = setTimeout(function () {
      toast.classList.remove("cart-toast--visible");
      toastCleanupTimer = setTimeout(function () {
        toast.hidden = true;
        toast.textContent = "";
      }, 400);
    }, 2600);
  }

  function scrollCartIntoViewIfNeeded() {
    if (!window.matchMedia("(max-width: 899px)").matches) return;
    const panel = document.querySelector(".cart-panel");
    if (panel) {
      panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function onCartQuantityIncreased(product, delta) {
    pulseCartPanel();
    scrollCartIntoViewIfNeeded();
    const name = product && product.name ? product.name : "Produto";
    const suffix = delta > 1 ? " (+" + delta + ")" : "";
    showCartToast("Adicionado ao carrinho: " + name + suffix);
  }

  function cartLines() {
    const lines = [];
    for (const [id, qty] of Object.entries(cart)) {
      const p = productById.get(id);
      if (!p || qty <= 0) continue;
      lines.push({
        id,
        name: p.name,
        qty,
        storePrice: p.storePrice,
        unitFinal: p.finalPrice,
        subtotalLoja: p.storePrice * qty,
        subtotalAtual: p.finalPrice * qty,
      });
    }
    return lines;
  }

  function cartTotal() {
    return cartLines().reduce((s, l) => s + l.subtotalAtual, 0);
  }

  function imgOnError(img) {
    img.removeAttribute("src");
    img.classList.add("hidden");
    const wrap = img.parentElement;
    if (wrap && !wrap.querySelector(".img-placeholder")) {
      const ph = document.createElement("div");
      ph.className = "img-placeholder";
      ph.textContent = "Imagem indisponível";
      wrap.appendChild(ph);
    }
  }

  function renderCatalog() {
    const grid = document.getElementById("product-grid");
    if (!grid) return;
    grid.innerHTML = "";

    if (products.length === 0) {
      const msg = document.createElement("p");
      msg.className = "catalog-error";
      msg.textContent =
        "Nenhum produto carregado. Confira se o arquivo data.js está na mesma pasta do index.html e se o navegador não bloqueou o script.";
      grid.appendChild(msg);
      return;
    }

    for (const p of products) {
      const card = document.createElement("article");
      card.className = "card";
      card.setAttribute("data-product-id", p.id);

      const media = document.createElement("div");
      media.className = "card__media";
      const img = document.createElement("img");
      img.src = p.imageUrl || "";
      img.alt = p.name;
      img.loading = "lazy";
      img.decoding = "async";
      img.onerror = function () {
        imgOnError(img);
      };
      if (!p.imageUrl) {
        img.dispatchEvent(new Event("error"));
      }
      media.appendChild(img);

      const body = document.createElement("div");
      body.className = "card__body";

      if (p.category) {
        const cat = document.createElement("span");
        cat.className = "card__category";
        cat.textContent = p.category;
        body.appendChild(cat);
      }

      const title = document.createElement("h2");
      title.className = "card__title";
      title.textContent = p.name;

      const prices = document.createElement("div");
      prices.className = "card__prices";

      const labFinal = document.createElement("span");
      labFinal.className = "price-label";
      labFinal.textContent = "Preço atual";

      const fin = document.createElement("span");
      fin.className = "price-final";
      fin.textContent = money.format(p.finalPrice);

      const finalBox = document.createElement("div");
      finalBox.className = "price-final-highlight";
      finalBox.append(labFinal, fin);

      const refBlock = document.createElement("div");
      refBlock.className = "price-ref-block";

      const labStore = document.createElement("span");
      labStore.className = "price-label";
      labStore.textContent = "Preço na loja";

      const store = document.createElement("span");
      store.className = "price-store";
      store.textContent = money.format(p.storePrice);

      refBlock.append(labStore, store);
      prices.append(finalBox, refBlock);

      const actions = document.createElement("div");
      actions.className = "card__actions";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn--primary";
      btn.textContent = "Adicionar ao carrinho";
      btn.addEventListener("click", () => addOne(p.id));

      actions.appendChild(btn);
      body.append(title, prices, actions);
      card.append(media, body);
      grid.appendChild(card);
    }
  }

  function renderCart() {
    const list = document.getElementById("cart-items");
    const empty = document.getElementById("cart-empty");
    const footer = document.getElementById("cart-footer");
    const totalEl = document.getElementById("cart-total-value");
    if (!list || !empty || !footer || !totalEl) return;

    const lines = cartLines();
    list.innerHTML = "";

    if (lines.length === 0) {
      empty.classList.remove("hidden");
      footer.classList.add("hidden");
      return;
    }

    empty.classList.add("hidden");
    footer.classList.remove("hidden");

    for (const line of lines) {
      const li = document.createElement("li");
      li.className = "cart-item";

      const name = document.createElement("span");
      name.className = "cart-item__name";
      name.textContent = line.name;

      const meta = document.createElement("span");
      meta.className = "cart-item__meta";
      meta.textContent =
        "Preço atual: " +
        money.format(line.unitFinal) +
        " · Preço na loja: " +
        money.format(line.storePrice);

      const controls = document.createElement("div");
      controls.className = "cart-item__controls";

      const minus = document.createElement("button");
      minus.type = "button";
      minus.className = "btn btn--ghost btn--small";
      minus.textContent = "−";
      minus.setAttribute("aria-label", "Diminuir quantidade");
      minus.addEventListener("click", () => setQty(line.id, line.qty - 1));

      const plus = document.createElement("button");
      plus.type = "button";
      plus.className = "btn btn--ghost btn--small";
      plus.textContent = "+";
      plus.setAttribute("aria-label", "Aumentar quantidade");
      plus.addEventListener("click", () => setQty(line.id, line.qty + 1));

      controls.append(minus, plus);

      const sub = document.createElement("span");
      sub.className = "cart-item__sub";
      sub.textContent =
        "Subtotal (preço atual): " +
        money.format(line.subtotalAtual) +
        " · Ref. loja: " +
        money.format(line.subtotalLoja);

      li.append(name, meta, controls, sub);
      list.appendChild(li);
    }

    totalEl.textContent = money.format(cartTotal());
  }

  function renderAll() {
    renderCart();
  }

  function init() {
    renderCatalog();
    renderCart();
  }

  function buildWhatsAppMessage() {
    const lines = cartLines();
    if (lines.length === 0) return "";

    const parts = [
      "Olá! Pedido pelo catálogo EletroExpress:",
      "",
      ...lines.map((l) => {
        const loja = money.format(l.storePrice);
        const atual = money.format(l.unitFinal);
        const subAtual = money.format(l.subtotalAtual);
        const subLoja = money.format(l.subtotalLoja);
        return (
          l.name +
          "\nPreço atual (un.): " +
          atual +
          "\nPreço na loja — ref. (un.): " +
          loja +
          "\nQuantidade: " +
          l.qty +
          "\nSubtotal (preço atual): " +
          subAtual +
          "\nSubtotal ref. loja: " +
          subLoja
        );
      }),
      "",
      "Total (preço atual): " + money.format(cartTotal()),
    ];
    return parts.join("\n");
  }

  function openWhatsApp() {
    const text = buildWhatsAppMessage();
    if (!text) return;
    const url =
      "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(text);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function openWhatsAppBlank() {
    window.open("https://wa.me/" + WA_NUMBER, "_blank", "noopener,noreferrer");
  }

  function clearCart() {
    cart = {};
    saveCart();
    renderAll();
  }

  function bindControls() {
    document.getElementById("btn-whatsapp")?.addEventListener("click", openWhatsApp);
    document.getElementById("btn-clear")?.addEventListener("click", clearCart);
    document.querySelectorAll(".js-open-whatsapp").forEach(function (el) {
      el.addEventListener("click", function () {
        openWhatsAppBlank();
      });
    });
  }

  function start() {
    bindControls();
    init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
