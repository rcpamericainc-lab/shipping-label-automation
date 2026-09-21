// Vercel serverless entry point. Env vars (SHOPIFY_*, FEDEX_*, PRINTNODE_*,
// SHIPPER_*) are configured in the Vercel project dashboard, not via .env here.
import { app } from "../src/expressApp.js";

// Webhook routes verify the raw request body (HMAC signature), so Vercel must
// not pre-parse it -- that's what this disables.
export const config = {
  api: {
    bodyParser: false,
  },
};

export default app;
