export const ORDER_STORAGE_KEY = "milletHouse.orders.v1";

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

export const PAYMENT_STATUSES = ["pending", "paid", "refunded"];

const CSV_HEADERS = [
  "id",
  "createdAt",
  "customerName",
  "customerPhone",
  "location",
  "deliveryTime",
  "paymentMethod",
  "paymentStatus",
  "orderStatus",
  "subtotal",
  "deliveryFee",
  "total",
  "items",
  "notes",
];

function assertOrder(order, index = 0) {
  const label = `Order ${index + 1}`;
  if (!order || typeof order !== "object" || Array.isArray(order)) {
    throw new Error(`${label} is not a valid order record.`);
  }
  if (!String(order.id || "").trim()) throw new Error(`${label} is missing an ID.`);
  if (!String(order.createdAt || "").trim() || Number.isNaN(Date.parse(order.createdAt))) {
    throw new Error(`${label} has an invalid creation date.`);
  }
  if (!String(order.customerName || "").trim()) throw new Error(`${label} is missing a customer name.`);
  if (!String(order.customerPhone || "").trim()) throw new Error(`${label} is missing a customer phone.`);
  if (!String(order.location || "").trim()) throw new Error(`${label} is missing a delivery location.`);
  if (!ORDER_STATUSES.includes(order.orderStatus)) throw new Error(`${label} has an invalid order status.`);
  if (!PAYMENT_STATUSES.includes(order.paymentStatus)) throw new Error(`${label} has an invalid payment status.`);
  if (!Array.isArray(order.items) || order.items.length === 0) throw new Error(`${label} must contain at least one item.`);

  const items = order.items.map((item, itemIndex) => {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    if (!String(item.productId || "").trim() || !String(item.name || "").trim()) {
      throw new Error(`${label}, item ${itemIndex + 1} is missing a product or name.`);
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error(`${label}, item ${itemIndex + 1} has an invalid quantity.`);
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error(`${label}, item ${itemIndex + 1} has an invalid price.`);
    }
    return {
      productId: String(item.productId),
      name: String(item.name),
      category: String(item.category || ""),
      quantity,
      unitPrice,
    };
  });

  const subtotal = Number(order.subtotal);
  const deliveryFee = Number(order.deliveryFee);
  const total = Number(order.total);
  if (![subtotal, deliveryFee, total].every(Number.isFinite) || subtotal < 0 || deliveryFee < 0 || total < 0) {
    throw new Error(`${label} has invalid totals.`);
  }
  const calculatedSubtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  if (Math.round(calculatedSubtotal * 100) !== Math.round(subtotal * 100)) {
    throw new Error(`${label} subtotal does not match its items.`);
  }
  if (Math.round((subtotal + deliveryFee) * 100) !== Math.round(total * 100)) {
    throw new Error(`${label} total does not match its subtotal and delivery fee.`);
  }

  return {
    id: String(order.id),
    createdAt: new Date(order.createdAt).toISOString(),
    customerName: String(order.customerName).trim(),
    customerPhone: String(order.customerPhone).trim(),
    location: String(order.location).trim(),
    deliveryTime: String(order.deliveryTime || ""),
    paymentMethod: String(order.paymentMethod || "UPI or cash on delivery"),
    paymentStatus: order.paymentStatus,
    orderStatus: order.orderStatus,
    subtotal,
    deliveryFee,
    total,
    items,
    notes: String(order.notes || ""),
  };
}

export function readOrders() {
  let serialized;
  try {
    serialized = localStorage.getItem(ORDER_STORAGE_KEY);
  } catch (error) {
    throw new Error(`Could not read local orders: ${error.message}`);
  }
  if (!serialized) return [];

  let parsed;
  try {
    parsed = JSON.parse(serialized);
  } catch (error) {
    throw new Error(`Saved orders are not valid JSON: ${error.message}. Import a CSV backup to restore them.`);
  }
  if (!Array.isArray(parsed)) throw new Error("Saved order data has an unexpected format.");
  return parsed.map((order, index) => assertOrder(order, index));
}

export function writeOrders(orders) {
  if (!Array.isArray(orders)) throw new Error("Orders must be a list.");
  const validated = orders.map((order, index) => assertOrder(order, index));
  try {
    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(validated));
  } catch (error) {
    throw new Error(`Could not save orders in this browser: ${error.message}. Export a CSV backup and free some storage.`);
  }
  return validated;
}

function csvEscape(value) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function ordersToCsv(orders) {
  const rows = [
    CSV_HEADERS,
    ...orders.map((order) => [
      order.id,
      order.createdAt,
      order.customerName,
      order.customerPhone,
      order.location,
      order.deliveryTime,
      order.paymentMethod,
      order.paymentStatus,
      order.orderStatus,
      order.subtotal,
      order.deliveryFee,
      order.total,
      JSON.stringify(order.items),
      order.notes,
    ]),
  ];
  return `\uFEFF${rows.map((row) => row.map(csvEscape).join(",")).join("\r\n")}\r\n`;
}

function parseCsvRows(csv) {
  const source = csv.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error("The CSV has an unclosed quoted field.");
  row.push(field);
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  return rows;
}

export function parseOrdersCsv(csv) {
  const rows = parseCsvRows(csv);
  if (rows.length === 0) throw new Error("The CSV is empty.");
  const headers = rows[0].map((header) => header.trim());
  const missing = CSV_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length) throw new Error(`The CSV is missing required columns: ${missing.join(", ")}.`);
  if (rows.length === 1) return [];
  const positions = Object.fromEntries(headers.map((header, index) => [header, index]));

  return rows.slice(1).map((cells, rowIndex) => {
    const get = (column) => cells[positions[column]] ?? "";
    let items;
    try {
      items = JSON.parse(get("items"));
    } catch (error) {
      throw new Error(`CSV row ${rowIndex + 2} has invalid item data: ${error.message}`);
    }
    const order = {
      id: get("id"),
      createdAt: get("createdAt"),
      customerName: get("customerName"),
      customerPhone: get("customerPhone"),
      location: get("location"),
      deliveryTime: get("deliveryTime"),
      paymentMethod: get("paymentMethod"),
      paymentStatus: get("paymentStatus"),
      orderStatus: get("orderStatus"),
      subtotal: get("subtotal"),
      deliveryFee: get("deliveryFee"),
      total: get("total"),
      items,
      notes: get("notes"),
    };
    try {
      return assertOrder(order, rowIndex + 1);
    } catch (error) {
      throw new Error(`CSV row ${rowIndex + 2}: ${error.message}`);
    }
  });
}
