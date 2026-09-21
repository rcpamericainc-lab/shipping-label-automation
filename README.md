# Shipping Label Automation

Shopify order webhook → FedEx Ship API label → tracking written back to Shopify → label printed automatically to the warehouse D450BT via PrintNode.

See the project doc for full context: `13-projects/active/shipping-label-automation.md` in the Marketing Brain vault.

## What's built here

- `src/expressApp.js` — the Express app itself (routes mounted). Not named `app.js` because Vercel's zero-config detection specifically searches for that filename (or `index`/`server`) and tries to treat it as an entrypoint on its own, which caused a production crash before this was renamed.
- `src/server.js` — the one entry point, used both locally and on Vercel. Vercel auto-detects this file (via its `app.listen()` call) and captures the whole Express app as a single Vercel Function with real Node request/response objects -- no `api/` directory or `vercel.json` rewrites needed.
- `src/routes/webhooks.js` — `POST /webhooks/orders/create`. Verifies the Shopify HMAC signature, then runs FedEx → Shopify → PrintNode.
- `src/lib/fedex.js` — OAuth2 + shipment/label creation against the FedEx Ship API.
- `src/lib/shopify.js` — writes the tracking number back via `fulfillmentCreate`.
- `src/lib/printnode.js` — sends the label to the D450BT through PrintNode.
- `src/lib/verifyShopifyWebhook.js` — HMAC verification so the public endpoint can't be spoofed.

## Setup steps that need your Shopify/FedEx/PrintNode accounts

These can't be scripted — they need your login and account-specific choices.

### 1. Create the custom app in Shopify
Shopify Admin → Settings → Apps and sales channels → **Develop apps** → Create an app.
- Configure Admin API scopes: `read_orders`, `write_orders` (fulfillments require order write access).
- Install the app on your store, then copy the **Admin API access token** into `.env` as `SHOPIFY_ADMIN_ACCESS_TOKEN`.
- Copy the **API secret key** into `.env` as `SHOPIFY_API_SECRET` (used for webhook verification).

### 2. Register the webhook
Once this app is deployed somewhere with a public URL (see Deployment below), register the webhook either:
- In the same Develop-apps screen under Webhooks → subscribe `orders/create` → point at `https://<your-deployed-host>/webhooks/orders/create`, **or**
- Via the Admin API (`webhookSubscriptionCreate` mutation) if you'd rather manage it in code.

### 3. FedEx Developer Portal
Finish enabling the Ship API on your existing project (per the project doc, this was in progress). Get:
- Client ID / Secret → `FEDEX_CLIENT_ID` / `FEDEX_CLIENT_SECRET`
- Your FedEx account number → `FEDEX_ACCOUNT_NUMBER`
- **Before going live**, confirm with FedEx/your contract which `serviceType` and `packagingType` values are valid for your account — `src/lib/fedex.js` has placeholder values marked `TODO`.
- Confirm whether the D450BT needs labels in **ZPL** rather than PDF (common for thermal label printers) — if so, change `labelSpecification.imageType` in `src/lib/fedex.js` to `"ZPLII"` and update `contentType` handling in `src/lib/printnode.js`.

### 4. PrintNode
- Sign up at printnode.com, get an API key → `PRINTNODE_API_KEY`.
- Install the PrintNode client/agent on the warehouse computer (the one the D450BT is plugged into via USB-C).
- Once installed, call `GET https://api.printnode.com/printers` (Basic auth, API key as username) to find the D450's printer ID → `PRINTNODE_PRINTER_ID`.

### 5. Shipper info
Fill in `SHIPPER_*` values in `.env` with your warehouse's return address — this is the "ships from" address FedEx puts on every label.

## Running locally

```
npm install
cp .env.example .env   # then fill in real values
npm run dev
```

Shopify webhooks need a public URL even for local testing — use a tunnel (e.g. `ngrok http 3000`) and register that tunnel URL as the webhook endpoint temporarily.

## Deployment

This is a small persistent Node server — order webhooks can arrive any time, so it needs to stay running (unlike a one-off script). Any small Node host works: Render, Fly.io, Railway, a small VPS, etc. Point the Shopify webhook and this app's `PORT` accordingly, and keep `.env` values on the host as environment variables (never commit `.env`).

## Known gaps / not yet built

- No retry/alerting if a step fails mid-flow (FedEx succeeds but Shopify write-back fails, etc.) — currently just logs to console. Worth adding real alerting (email/Slack) before relying on this for real orders.
- Package weight is hardcoded as a placeholder in `fedex.js` — needs real per-order weight logic.
- 5g multi-package labeling and packing slip generation are explicitly out of scope for this build (see project doc).
