import { config } from "./config.js";
import { categories, products } from "./products.js";

const state = {
  activeCategory: categories[0].id,
  cart: new Map(),
};

const elements = {
  tabs: document.querySelector("#category-tabs"),
  grid: document.querySelector("#menu-grid"),
  count: document.querySelector("#cart-count"),
  drawer: document.querySelector("#cart-drawer"),
  backdrop: document.querySelector("#cart-backdrop"),
  content: document.querySelector("#cart-content"),
  total: document.querySelector("#cart-total"),
  checkout: document.querySelector("#checkout-button"),
  checkoutForm: document.querySelector("#checkout-form"),
  countryCode: document.querySelector("#country-code"),
  customCode: document.querySelector("#custom-code"),
  toast: document.querySelector("#toast"),
  qr: document.querySelector("#store-qr"),
  qrFallback: document.querySelector("#qr-fallback"),
  downloadQr: document.querySelector("#download-qr"),
};

const money = new Intl.NumberFormat(config.locale, {
  style: "currency",
  currency: config.currency,
  maximumFractionDigits: 0,
});

function renderCategories() {
  elements.tabs.innerHTML = categories
    .map(
      (category) => `
        <button class="category-tab${category.id === state.activeCategory ? " active" : ""}"
          type="button" role="tab" aria-selected="${category.id === state.activeCategory}"
          data-category="${category.id}">
          <span aria-hidden="true">${category.icon}</span>${category.name}
        </button>
      `,
    )
    .join("");
}

function renderProducts() {
  const visibleProducts = products.filter((product) => product.category === state.activeCategory);
  elements.grid.innerHTML = visibleProducts
    .map(
      (product) => `
        <article class="product-card">
          <div class="product-art ${product.tone}">
            <span class="product-tag">${product.tag}</span>
            <span class="product-emoji" aria-hidden="true">${product.emoji}</span>
            <span class="product-art-mark" aria-hidden="true">✳</span>
          </div>
          <div class="product-info">
            <div class="product-title-row">
              <h3>${product.name}</h3>
              <strong>${money.format(product.price)}</strong>
            </div>
            <p>${product.description}</p>
            <button class="add-button" type="button" data-add="${product.id}">
              <span aria-hidden="true">+</span> Add to bag
            </button>
          </div>
        </article>
      `,
    )
    .join("");
}

function cartItems() {
  return [...state.cart.entries()]
    .map(([id, quantity]) => ({ product: products.find((item) => item.id === id), quantity }))
    .filter((item) => item.product);
}

function cartTotal() {
  return cartItems().reduce((total, item) => total + item.product.price * item.quantity, 0);
}

function renderCart() {
  const items = cartItems();
  const count = items.reduce((total, item) => total + item.quantity, 0);
  elements.count.textContent = String(count);
  elements.total.textContent = money.format(cartTotal());
  elements.checkout.disabled = count === 0;

  if (items.length === 0) {
    elements.content.innerHTML = `
      <div class="empty-cart">
        <span aria-hidden="true">🥣</span>
        <h3>Your bag is taking a break.</h3>
        <p>Add a feel-good meal and it’ll show up here.</p>
        <button class="text-button" type="button" data-close-cart>Back to the menu <span aria-hidden="true">↗</span></button>
      </div>
    `;
    return;
  }

  elements.content.innerHTML = items
    .map(
      ({ product, quantity }) => `
        <div class="cart-item">
          <div class="cart-item-art ${product.tone}" aria-hidden="true">${product.emoji}</div>
          <div class="cart-item-info">
            <strong>${product.name}</strong>
            <span>${money.format(product.price * quantity)}</span>
            <div class="quantity-control" aria-label="Quantity for ${product.name}">
              <button type="button" data-quantity="${product.id}" data-change="-1" aria-label="Remove one ${product.name}">−</button>
              <span>${quantity}</span>
              <button type="button" data-quantity="${product.id}" data-change="1" aria-label="Add one ${product.name}">+</button>
            </div>
          </div>
        </div>
      `,
    )
    .join("");
}

function setCartOpen(isOpen) {
  elements.drawer.classList.toggle("open", isOpen);
  elements.drawer.setAttribute("aria-hidden", String(!isOpen));
  elements.drawer.inert = !isOpen;
  elements.backdrop.hidden = !isOpen;
  document.body.classList.toggle("drawer-open", isOpen);
  if (isOpen) document.querySelector("#close-cart").focus();
  else document.querySelector("#open-cart").focus();
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  window.setTimeout(() => elements.toast.classList.remove("visible"), 2800);
}

function makeOrderMessage(form) {
  const formData = new FormData(form);
  const countryCode = formData.get("countryCode") === "other"
    ? formData.get("customCountryCode")
    : formData.get("countryCode");
  const phone = String(formData.get("phone")).replace(/\D/g, "");
  const lines = cartItems().map(
    ({ product, quantity }) => `• ${product.name} × ${quantity} — ${money.format(product.price * quantity)}`,
  );
  return [
    "Hi Millet House! I'd like to place an order:",
    "",
    ...lines,
    "",
    `Total: ${money.format(cartTotal())}`,
    `Name: ${formData.get("name")}`,
    `Customer phone: +${countryCode}${phone}`,
    `Delivery location: ${formData.get("location")}`,
    `Preferred delivery time: ${formData.get("time")}`,
    `Payment: ${formData.get("payment")}`,
  ].join("\n");
}

function initializeQr() {
  const destination = `${window.location.origin}${window.location.pathname}`;
  if (window.location.protocol === "file:" || !window.QRCode) {
    elements.qrFallback.hidden = false;
    return;
  }

  new window.QRCode(elements.qr, {
    text: destination,
    width: 176,
    height: 176,
    colorDark: "#173d32",
    colorLight: "#ffffff",
    correctLevel: window.QRCode.CorrectLevel.H,
  });
  elements.qrFallback.hidden = true;
  elements.downloadQr.disabled = false;
}

elements.tabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  state.activeCategory = button.dataset.category;
  renderCategories();
  renderProducts();
});

elements.grid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-add]");
  if (!button) return;
  const product = products.find((item) => item.id === button.dataset.add);
  if (!product) return;
  state.cart.set(product.id, (state.cart.get(product.id) || 0) + 1);
  renderCart();
  showToast(`${product.name} added to your bag`);
});

elements.content.addEventListener("click", (event) => {
  const quantityButton = event.target.closest("[data-quantity]");
  if (quantityButton) {
    const id = quantityButton.dataset.quantity;
    const next = (state.cart.get(id) || 0) + Number(quantityButton.dataset.change);
    if (next > 0) state.cart.set(id, next);
    else state.cart.delete(id);
    renderCart();
    return;
  }
  if (event.target.closest("[data-close-cart]")) setCartOpen(false);
});

document.querySelector("#open-cart").addEventListener("click", () => setCartOpen(true));
document.querySelector("#close-cart").addEventListener("click", () => setCartOpen(false));
elements.backdrop.addEventListener("click", () => setCartOpen(false));

elements.checkoutForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (state.cart.size === 0 || !elements.checkoutForm.reportValidity()) return;

  const message = makeOrderMessage(elements.checkoutForm);
  const phone = config.whatsappNumber.replace(/\D/g, "");
  if (!phone) {
    showToast("Add your WhatsApp number in config.js to send orders directly to your business.");
    return;
  }
  const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  window.location.assign(whatsappUrl);
});

elements.countryCode.addEventListener("change", () => {
  const customCodeInput = elements.customCode.querySelector("input");
  const isCustom = elements.countryCode.value === "other";
  elements.customCode.hidden = !isCustom;
  customCodeInput.required = isCustom;
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && elements.drawer.classList.contains("open")) setCartOpen(false);
});

elements.downloadQr.addEventListener("click", () => {
  const canvas = elements.qr.querySelector("canvas");
  const image = elements.qr.querySelector("img");
  const dataUrl = canvas ? canvas.toDataURL("image/png") : image?.src;
  if (!dataUrl) {
    showToast("The QR code is not ready yet.");
    return;
  }

  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = "millet-house-menu-qr.png";
  link.click();
});

document.querySelector("#current-year").textContent = String(new Date().getFullYear());
renderCategories();
renderProducts();
renderCart();
initializeQr();
