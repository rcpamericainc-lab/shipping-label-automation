import crypto from "node:crypto";
import express from "express";
import { verifyShopifyWebhook } from "../lib/verifyShopifyWebhook.js";
import { createShipment } from "../lib/fedex.js";
import { addTrackingToOrder } from "../lib/shopify.js";
import { printLabel } from "../lib/printnode.js";

export const webhooksRouter = express.Router();

// Shopify signs the raw, unparsed body -- keep this route on express.raw()
// (wired up in server.js) rather than the global JSON parser.
webhooksRouter.post("/orders/create", async (req, res) => {
  const hmac = req.get("X-Shopify-Hmac-Sha256");

  // TEMPORARY debug logging -- remove once webhook verification is confirmed
  // working. Logs lengths/prefixes only, never the secret or full HMAC values.
  const computedDigest = Buffer.isBuffer(req.body)
    ? crypto
        .createHmac("sha256", process.env.SHOPIFY_API_SECRET || "")
        .update(req.body)
        .digest("base64")
    : null;
  console.log("[webhook debug]", {
    isBuffer: Buffer.isBuffer(req.body),
    bodyType: typeof req.body,
    bodyLength: Buffer.isBuffer(req.body) ? req.body.length : undefined,
    bodyFirst20: Buffer.isBuffer(req.body) ? req.body.toString("utf8", 0, 20) : undefined,
    bodyLast20: Buffer.isBuffer(req.body)
      ? req.body.toString("utf8", Math.max(0, req.body.length - 20))
      : undefined,
    hasHmacHeader: Boolean(hmac),
    hmacHeaderLength: hmac ? hmac.length : 0,
    computedDigestLength: computedDigest ? computedDigest.length : 0,
    digestsMatch: computedDigest === hmac,
    hasSecretConfigured: Boolean(process.env.SHOPIFY_API_SECRET),
    secretLength: (process.env.SHOPIFY_API_SECRET || "").length,
    contentType: req.get("Content-Type"),
  });

  const valid = verifyShopifyWebhook(req.body, hmac, process.env.SHOPIFY_API_SECRET);

  if (!valid) {
    return res.status(401).send("Invalid webhook signature");
  }

  // Acknowledge quickly -- Shopify retries if it doesn't get a fast 200.
  res.status(200).send("ok");

  const order = JSON.parse(req.body.toString("utf8"));

  try {
    const { trackingNumber, labelBase64, labelContentType } = await createShipment(order);
    await addTrackingToOrder(order.id, trackingNumber);
    await printLabel(labelBase64, labelContentType);
    console.log(`Order ${order.name}: label printed, tracking ${trackingNumber}`);
  } catch (err) {
    // TODO: replace with real alerting (email/Slack) so a failed label doesn't
    // silently strand an order -- for now this only surfaces in server logs.
    console.error(`Order ${order.name}: shipping automation failed`, err);
  }
});
