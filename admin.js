import { config } from "./config.js";
import { categories, products } from "./products.js";
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  ordersToCsv,
  parseOrdersCsv,
  readOrders,
  writeOrders,
} from "./order-store.js";

const state = {
  orders: [],
  storageReady: true,
};

const elements = {
  notice: document.querySelector("#notice"),
  toast: document.querySelector("#toast"),
  period: document.querySelector("#period-filter"),
  search: document.querySelector("#search-orders"),
  statusFilter: document.querySelector("#status-filter"),
  table: document.querySelector("#orders-table"),
  tableEmpty: document.querySelector("#table-empty"),
  dialog: document.querySelector("#order-dialog"),
  form: document.querySelector("#order-form"),
  lines: document.querySelector("#order-lines"),
  formTotal: document.querySelector("#form-total"),
  importFile: document.querySelector("#import-file"),
  metrics: {
    revenue: document.querySelector("#metric-revenue"),
    orders: document.querySelector("#metric-orders"),
    ordersNote: document.querySelector("#metric-orders-note"),
    average: document.querySelector("#metric-average"),
    pending: document.querySelector("#metric-pending"),
    pendingNote: document.querySelector("#metric-pending-note"),
  },
};

const money = new Intl.NumberFormat(config.locale, {
  style: "currency",
  currency: config.currency,
  maximumFractionDigits: 0,
});

const statusNames = {
  pending: "Pending",
  confirmed: "Confirmed",
  preparing: "Preparing",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const paymentNames = {
  pending: "Pending",
  paid: "Paid",
  refunded: "Refunded",
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function showNotice(message, type = "success") {
  elements.notice.textContent = message;
  elements.notice.className = `notice ${type}`;
  elements.notice.hidden = false;
}

function hideNotice() {
  elements.notice.hidden = true;
  elements.notice.textContent = "";
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  window.setTimeout(() => elements.toast.classList.remove("visible"), 2800);
}

function loadOrders() {
  try {
    state.orders = readOrders();
    state.storageReady = true;
    hideNotice();
  } catch (error) {
    state.orders = [];
    state.storageReady = false;
    showNotice(`${error.message} Import a valid CSV backup to restore your order book.`, "error");
  }
  renderDashboard();
}

function commitOrders(nextOrders) {
  if (!state.storageReady) {
    showNotice("Order storage is not ready. Import a valid CSV backup before making changes.", "error");
    return false;
  }
  try {
    state.orders = writeOrders(nextOrders);
    return true;
  } catch (error) {
    showNotice(error.message, "error");
    return false;
  }
}

function filteredOrders() {
  const search = elements.search.value.trim().toLowerCase();
  const status = elements.statusFilter.value;
  const period = elements.period.value;
  const earliest = period === "all" ? 0 : Date.now() - Number(period) * 24 * 60 * 60 * 1000;

  return state.orders
    .filter((order) => Date.parse(order.createdAt) >= earliest)
    .filter((order) => status === "all" || order.orderStatus === status)
    .filter((order) => {
      if (!search) return true;
      return [
        order.id,
        order.customerName,
        order.customerPhone,
        order.location,
        ...order.items.map((item) => item.name),
      ].some((value) => String(value).toLowerCase().includes(search));
    })
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

function nonCancelled(orders) {
  return orders.filter((order) => order.orderStatus !== "cancelled");
}

function renderMetrics(orders) {
  const active = nonCancelled(orders);
  const paid = active.filter((order) => order.paymentStatus === "paid");
  const awaitingPayment = active.filter((order) => order.paymentStatus === "pending");
  const paidRevenue = paid.reduce((sum, order) => sum + order.total, 0);
  const grossValue = active.reduce((sum, order) => sum + order.total, 0);
  const pendingValue = awaitingPayment.reduce((sum, order) => sum + order.total, 0);
  const delivered = active.filter((order) => order.orderStatus === "delivered").length;

  elements.metrics.revenue.textContent = money.format(paidRevenue);
  elements.metrics.orders.textContent = String(active.length);
  elements.metrics.ordersNote.textContent = `${delivered} delivered · ${orders.length - active.length} cancelled`;
  elements.metrics.average.textContent = money.format(active.length ? grossValue / active.length : 0);
  elements.metrics.pending.textContent = money.format(pendingValue);
  elements.metrics.pendingNote.textContent = `${awaitingPayment.length} orders awaiting payment`;
}

function renderDailyChart() {
  const days = [];
  const today = new Date();
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const value = state.orders
      .filter((order) => order.paymentStatus === "paid" && order.orderStatus !== "cancelled")
      .filter((order) => {
        const orderDate = new Date(order.createdAt);
        return orderDate.getFullYear() === date.getFullYear()
          && orderDate.getMonth() === date.getMonth()
          && orderDate.getDate() === date.getDate();
      })
      .reduce((sum, order) => sum + order.total, 0);
    days.push({ key, label: new Intl.DateTimeFormat(config.locale, { weekday: "short" }).format(date), value });
  }
  const max = Math.max(...days.map((day) => day.value), 1);
  document.querySelector("#sales-chart").innerHTML = days
    .map(
      (day) => `
        <div class="daily-column" title="${escapeHtml(day.key)}: ${escapeHtml(money.format(day.value))}">
          <strong>${day.value ? escapeHtml(money.format(day.value)) : ""}</strong>
          <div class="daily-track"><span style="height:${day.value ? Math.max(5, (day.value / max) * 100) : 0}%"></span></div>
          <small>${escapeHtml(day.label)}</small>
        </div>
      `,
    )
    .join("");
}

function renderBreakdown(target, rows, emptyText, options = {}) {
  const container = document.querySelector(target);
  if (!rows.length) {
    container.innerHTML = `<p class="chart-empty">${escapeHtml(emptyText)}</p>`;
    return;
  }
  const max = Math.max(...rows.map((row) => row.value), 1);
  container.innerHTML = rows
    .map((row) => `
      <div class="breakdown-row">
        <div class="breakdown-label"><span>${escapeHtml(row.label)}</span><strong>${options.currency ? escapeHtml(money.format(row.value)) : row.value}</strong></div>
        <div class="breakdown-track"><span style="width:${Math.max(3, (row.value / max) * 100)}%"></span></div>
      </div>
    `)
    .join("");
}

function renderOrderStatus(orders) {
  const counts = ORDER_STATUSES.map((status) => ({
    label: statusNames[status],
    value: orders.filter((order) => order.orderStatus === status).length,
  })).filter((row) => row.value > 0);
  renderBreakdown("#status-chart", counts, "Add orders to see workflow status.");
}

function renderPaymentStatus(orders) {
  const counts = PAYMENT_STATUSES.map((status) => ({
    label: paymentNames[status],
    value: orders.filter((order) => order.paymentStatus === status).length,
  })).filter((row) => row.value > 0);
  renderBreakdown("#payment-chart", counts, "Payment status will appear here.");
}

function renderProducts(orders) {
  const totals = new Map();
  for (const order of nonCancelled(orders)) {
    for (const item of order.items) {
      const current = totals.get(item.productId) || { label: item.name, value: 0 };
      current.value += item.quantity;
      totals.set(item.productId, current);
    }
  }
  const best = [...totals.values()].sort((left, right) => right.value - left.value).slice(0, 5);
  renderBreakdown("#product-chart", best, "Best sellers will appear after you add orders.");
}

function renderCategories(orders) {
  const productCategory = new Map(products.map((product) => [product.id, product.category]));
  const totals = new Map(categories.map((category) => [category.id, 0]));
  for (const order of nonCancelled(orders)) {
    for (const item of order.items) {
      const category = item.category || productCategory.get(item.productId);
      if (category) totals.set(category, totals.get(category) + item.quantity * item.unitPrice);
    }
  }
  const rows = categories
    .map((category) => ({ label: category.name, value: totals.get(category.id) }))
    .filter((row) => row.value > 0);
  renderBreakdown("#category-chart", rows, "Meal category sales will appear here.", { currency: true });
}

function renderPatterns(orders) {
  const active = nonCancelled(orders);
  const hours = new Map();
  const locations = new Map();
  for (const order of active) {
    if (order.deliveryTime) {
      const hour = order.deliveryTime.slice(0, 2);
      hours.set(hour, (hours.get(hour) || 0) + 1);
    }
    const location = order.location.trim();
    if (location) {
      const key = location.toLowerCase();
      const current = locations.get(key) || { label: location, value: 0 };
      current.value += 1;
      locations.set(key, current);
    }
  }

  const popularHour = [...hours.entries()].sort((left, right) => right[1] - left[1])[0];
  const popularLocation = [...locations.values()].sort((left, right) => right.value - left.value)[0];
  document.querySelector("#peak-time").textContent = popularHour ? `${popularHour[0]}:00–${popularHour[0]}:59` : "—";
  document.querySelector("#peak-time-note").textContent = popularHour ? `${popularHour[1]} requested deliveries` : "No orders yet";
  document.querySelector("#top-location").textContent = popularLocation?.label || "—";
  document.querySelector("#top-location-note").textContent = popularLocation ? `${popularLocation.value} orders` : "No orders yet";
}

function renderRepeatCustomers(orders) {
  const customers = new Map();
  for (const order of nonCancelled(orders)) {
    const key = order.customerPhone.replace(/\D/g, "") || order.customerName.toLowerCase().trim();
    customers.set(key, (customers.get(key) || 0) + 1);
  }
  const unique = customers.size;
  const repeat = [...customers.values()].filter((count) => count > 1).length;
  const rate = unique ? Math.round((repeat / unique) * 100) : 0;
  document.querySelector("#repeat-rate").textContent = `${rate}%`;
  document.querySelector("#repeat-count").textContent = `${repeat} repeat customer${repeat === 1 ? "" : "s"}`;
  document.querySelector("#unique-count").textContent = `${unique} unique customer${unique === 1 ? "" : "s"}`;
  document.querySelector("#repeat-progress").style.width = `${rate}%`;
}

function renderOrdersTable(orders) {
  const body = elements.table;
  document.querySelector("#orders-summary").textContent = `${orders.length} order${orders.length === 1 ? "" : "s"} shown · ${state.orders.length} saved on this browser`;
  elements.tableEmpty.hidden = orders.length > 0;
  body.closest("table").hidden = orders.length === 0;
  body.innerHTML = orders
    .map((order) => {
      const items = order.items.map((item) => `${item.quantity}× ${item.name}`).join(", ");
      const orderDate = new Intl.DateTimeFormat(config.locale, { day: "numeric", month: "short", year: "numeric" }).format(new Date(order.createdAt));
      const statusOptions = ORDER_STATUSES.map(
        (status) => `<option value="${status}"${status === order.orderStatus ? " selected" : ""}>${statusNames[status]}</option>`,
      ).join("");
      return `
        <tr>
          <td><strong class="order-id">${escapeHtml(order.id)}</strong><small>${escapeHtml(order.deliveryTime || "Time not set")}</small></td>
          <td><strong>${escapeHtml(order.customerName)}</strong><small>${escapeHtml(order.customerPhone)}</small></td>
          <td class="items-cell" title="${escapeHtml(items)}">${escapeHtml(items)}</td>
          <td><strong>${escapeHtml(money.format(order.total))}</strong><small>${escapeHtml(order.paymentMethod)}</small></td>
          <td><select class="table-payment ${escapeHtml(order.paymentStatus)}" data-payment-status="${escapeHtml(order.id)}" aria-label="Update payment status for ${escapeHtml(order.id)}">
            ${PAYMENT_STATUSES.map((status) => `<option value="${status}"${status === order.paymentStatus ? " selected" : ""}>${paymentNames[status]}</option>`).join("")}
          </select></td>
          <td><select class="table-status ${escapeHtml(order.orderStatus)}" data-order-status="${escapeHtml(order.id)}" aria-label="Update status for ${escapeHtml(order.id)}">${statusOptions}</select></td>
          <td>${escapeHtml(orderDate)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderDashboard() {
  const orders = filteredOrders();
  renderMetrics(orders);
  renderDailyChart();
  renderOrderStatus(orders);
  renderPaymentStatus(orders);
  renderProducts(orders);
  renderCategories(orders);
  renderPatterns(orders);
  renderRepeatCustomers(orders);
  renderOrdersTable(orders);
}

function addItemLine(productId = products[0]?.id) {
  if (!productId) {
    showNotice("Add products to products.js before recording an order.", "error");
    return;
  }
  const row = document.createElement("div");
  row.className = "order-line";
  row.innerHTML = `
    <select aria-label="Product">
      ${products.map((product) => `<option value="${escapeHtml(product.id)}">${escapeHtml(product.name)} · ${escapeHtml(money.format(product.price))}</option>`).join("")}
    </select>
    <input type="number" aria-label="Quantity" min="1" max="99" step="1" value="1" required />
    <strong class="line-total"></strong>
    <button class="remove-line" type="button" aria-label="Remove item">×</button>
  `;
  row.querySelector("select").value = productId;
  elements.lines.append(row);
  updateFormTotal();
}

function getFormItems() {
  return [...elements.lines.querySelectorAll(".order-line")].map((row) => {
    const product = products.find((item) => item.id === row.querySelector("select").value);
    const quantity = Number(row.querySelector("input").value);
    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw new Error("Choose a menu item and a quantity from 1 to 99.");
    }
    return {
      productId: product.id,
      name: product.name,
      category: product.category,
      quantity,
      unitPrice: product.price,
    };
  });
}

function updateFormTotal() {
  try {
    const total = getFormItems().reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    elements.formTotal.textContent = money.format(total);
    for (const row of elements.lines.querySelectorAll(".order-line")) {
      const product = products.find((item) => item.id === row.querySelector("select").value);
      const quantity = Number(row.querySelector("input").value);
      row.querySelector(".line-total").textContent = product && Number.isInteger(quantity) && quantity > 0
        ? money.format(product.price * quantity)
        : "—";
    }
  } catch {
    elements.formTotal.textContent = "—";
  }
}

function newOrderId() {
  return `MH-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function handleNewOrder(event) {
  event.preventDefault();
  if (!state.storageReady || !elements.form.reportValidity()) return;

  let items;
  try {
    items = getFormItems();
  } catch (error) {
    showNotice(error.message, "error");
    return;
  }
  const formData = new FormData(elements.form);
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const order = {
    id: newOrderId(),
    createdAt: new Date().toISOString(),
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone"),
    location: formData.get("location"),
    deliveryTime: formData.get("deliveryTime"),
    paymentMethod: formData.get("paymentMethod"),
    paymentStatus: formData.get("paymentStatus"),
    orderStatus: "pending",
    subtotal,
    deliveryFee: 0,
    total: subtotal,
    items,
    notes: formData.get("notes"),
  };

  if (!commitOrders([...state.orders, order])) return;
  elements.dialog.close();
  elements.form.reset();
  elements.lines.innerHTML = "";
  addItemLine();
  renderDashboard();
  showToast("Order saved to this browser.");
}

function downloadCsv() {
  if (!state.storageReady) {
    showNotice("Restore your order data from a valid CSV backup before exporting.", "error");
    return;
  }
  const csv = ordersToCsv(state.orders);
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `millet-house-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showToast(`${state.orders.length} orders exported.`);
}

async function importCsv(file) {
  if (!file) return;
  try {
    const imported = parseOrdersCsv(await file.text());
    const existing = state.storageReady ? state.orders : [];
    const byId = new Map(existing.map((order) => [order.id, order]));
    for (const order of imported) byId.set(order.id, order);
    const merged = [...byId.values()].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
    const verb = state.storageReady ? "merge" : "restore";
    if (!window.confirm(`${verb === "restore" ? "Restore" : "Import"} ${imported.length} order${imported.length === 1 ? "" : "s"} from this CSV? Matching IDs will be replaced.`)) {
      elements.importFile.value = "";
      return;
    }
    state.storageReady = true;
    if (!commitOrders(merged)) {
      state.storageReady = false;
      return;
    }
    hideNotice();
    renderDashboard();
    showToast(`${imported.length} orders imported.`);
  } catch (error) {
    showNotice(`CSV import failed: ${error.message}`, "error");
  } finally {
    elements.importFile.value = "";
  }
}

function updateOrderStatus(orderId, status) {
  if (!ORDER_STATUSES.includes(status)) {
    showNotice("That order status is not supported.", "error");
    renderDashboard();
    return;
  }
  const updated = state.orders.map((order) => order.id === orderId ? { ...order, orderStatus: status } : order);
  if (!commitOrders(updated)) return;
  renderDashboard();
  showToast("Order status updated.");
}

function updatePaymentStatus(orderId, status) {
  if (!PAYMENT_STATUSES.includes(status)) {
    showNotice("That payment status is not supported.", "error");
    renderDashboard();
    return;
  }
  const updated = state.orders.map((order) => order.id === orderId ? { ...order, paymentStatus: status } : order);
  if (!commitOrders(updated)) return;
  renderDashboard();
  showToast("Payment status updated.");
}

document.querySelector("#new-order-button").addEventListener("click", () => {
  if (!state.storageReady) {
    showNotice("Import a valid CSV backup before adding orders.", "error");
    return;
  }
  elements.form.reset();
  elements.lines.innerHTML = "";
  addItemLine();
  elements.dialog.showModal();
});
document.querySelector("#close-dialog").addEventListener("click", () => elements.dialog.close());
document.querySelector("#cancel-order").addEventListener("click", () => elements.dialog.close());
document.querySelector("#add-item-line").addEventListener("click", () => addItemLine());
elements.lines.addEventListener("click", (event) => {
  const remove = event.target.closest(".remove-line");
  if (!remove) return;
  remove.closest(".order-line").remove();
  updateFormTotal();
});
elements.lines.addEventListener("input", updateFormTotal);
elements.lines.addEventListener("change", updateFormTotal);
elements.form.addEventListener("submit", handleNewOrder);
document.querySelector("#export-button").addEventListener("click", downloadCsv);
document.querySelector("#import-button").addEventListener("click", () => elements.importFile.click());
elements.importFile.addEventListener("change", () => importCsv(elements.importFile.files[0]));
elements.period.addEventListener("change", renderDashboard);
elements.search.addEventListener("input", renderDashboard);
elements.statusFilter.addEventListener("change", renderDashboard);
elements.table.addEventListener("change", (event) => {
  const select = event.target.closest("[data-order-status]");
  const payment = event.target.closest("[data-payment-status]");
  if (select) updateOrderStatus(select.dataset.orderStatus, select.value);
  if (payment) updatePaymentStatus(payment.dataset.paymentStatus, payment.value);
});
window.addEventListener("storage", (event) => {
  if (event.key === "milletHouse.orders.v1") loadOrders();
});

loadOrders();
