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

  const order = JSON.parse(req.body.toString("utf8"));

  // Await the whole chain before responding -- Vercel can suspend the
  // function the instant a response is sent, so a "respond fast, keep
  // working after" pattern isn't reliable here (confirmed: a prior version
  // that responded early never actually ran this code on Vercel).
  try {
    const { trackingNumber, labelBase64, labelContentType } = await createShipment(order);
    await addTrackingToOrder(order.id, trackingNumber);
    await printLabel(labelBase64, labelContentType);
    console.log(`Order ${order.name}: label printed, tracking ${trackingNumber}`);
    res.status(200).send("ok");
  } catch (err) {
    // Non-2xx makes Shopify retry the webhook -- desirable for transient
    // failures, though it risks a duplicate label on retry after a partial
    // success. TODO: real alerting (email/Slack) instead of just logs.
    console.error(`Order ${order.name}: shipping automation failed`, err);
    res.status(500).send("shipping automation failed");
  }
});
