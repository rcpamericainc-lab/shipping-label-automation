import crypto from "node:crypto";

// Shopify signs every webhook body with your app's API secret (HMAC-SHA256, base64).
// Reject anything that doesn't match -- this endpoint is public.
export function verifyShopifyWebhook(rawBody, hmacHeader, apiSecret) {
  if (!hmacHeader) return false;

  const digest = crypto
    .createHmac("sha256", apiSecret)
    .update(rawBody)
    .digest("base64");

  const a = Buffer.from(digest, "utf8");
  const b = Buffer.from(hmacHeader, "utf8");
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}
