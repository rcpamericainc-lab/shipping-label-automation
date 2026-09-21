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
