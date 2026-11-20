# Millet House ordering site

A mobile-friendly menu and WhatsApp ordering starter for Millet House. Customers can scan the menu QR, browse breakfast/lunch/dinner, add items to a bag, and send their order details through WhatsApp.

The owner dashboard is available at `admin.html`. You manually enter orders received in WhatsApp; the dashboard then analyzes the records saved in the current browser.

## Run it locally

This is a static site: no build step or package installation is required. From this folder, run a local web server:

```powershell
py -m http.server 8000
```

Then open `http://localhost:8000` in a browser. Opening `index.html` directly as a file will not generate a QR code.
Open `http://localhost:8000/admin.html` for the owner dashboard.

## Set up your business details

1. The business WhatsApp number is currently set to `+91 90103 00789` in `config.js`. Change it there if needed; store it with country code and digits only.
2. The menu in `products.js` uses the items and sample prices you approved for now. Edit descriptions, categories, or prices there as needed.
3. Replace the sample food illustrations or business copy in `index.html` if you want to personalize the storefront.
4. Publish the storefront with GitHub Pages. Open the live site URL and download its QR code from the “How it works” section. Print that QR only after deployment; a QR made on localhost points to your local computer and will not work for customers.

## Publish the storefront with GitHub Pages

The GitHub Actions workflow builds and publishes only `index.html`, `styles.css`, `app.js`, `config.js`, and `products.js`. The admin dashboard and its order data files are excluded from the deployed site.

1. Push this project to a GitHub repository.
2. In the repository, open **Settings → Pages** and set the source to **GitHub Actions**.
3. Push to the `main` branch, or run the **Deploy storefront to GitHub Pages** workflow from the **Actions** tab.
4. Open the Pages URL and test the menu and WhatsApp checkout. Download the menu QR from the live page after deployment.

This repository is public, so its source files—including the dashboard files—are visible to everyone. The dashboard itself is not deployed. Customer orders still open in WhatsApp; the storefront does not save orders to a shared database.

## Ordering and payment

The checkout opens a WhatsApp chat with the order summary, customer name, customer phone, delivery location, preferred delivery time, and payment preference. The customer phone country code defaults to India (+91), with a selector and a custom-code option. Select “UPI or cash on delivery” or “Request a payment link”; the latter asks you to send a payment link manually in the WhatsApp conversation. This starter does not process payments or automatically reply to “Hi.”

The printable [WhatsApp order QR](./millet-house-whatsapp-qr.png) opens a chat with “Hi” prefilled. It does not send the message or show the menu automatically. The QR generated on the storefront instead points to the deployed menu.

The kitchen is in Indresham. Delivery zones, minimum orders, charges, and cut-off times are intentionally not configured yet; confirm those details before adding them.

An automated WhatsApp conversation (such as replying to “Hi” with meal choices) requires a WhatsApp Business Platform/Cloud API integration, a hosted webhook, and Meta business credentials. This browser-only starter deliberately does not collect or store those credentials.

## Local order dashboard

- Add each order received in WhatsApp on the dashboard. Update order and payment status as the order progresses.
- The dashboard analyzes paid revenue, order counts, average order value, best sellers, category sales, payment/order status, repeat customers, requested delivery times, and locations.
- Records are stored in the browser's local storage on this device and browser profile. They are not automatically captured from a customer's device, shared between devices, or sent to a server.
- Use **Export CSV** for a backup and **Import CSV** to restore or merge it. CSV backups contain customer details in plain text; keep them private.
- Anyone with access to this browser profile can see the records saved in that browser. This is a local-first starter, not a protected multi-user admin system. A future database migration can replace the storage helper in `order-store.js`; automatic website order capture and secure admin sign-in should be added with that backend.
