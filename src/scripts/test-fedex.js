// Standalone FedEx Ship API connectivity test -- confirms OAuth + label creation
// work against the sandbox before wiring FedEx into the real webhook flow.
//
// Usage: npm run test-fedex
// Requires FEDEX_* and SHIPPER_* values set in .env (sandbox credentials).

import "dotenv/config";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createShipment } from "../lib/fedex.js";

// A fake order shaped like the Shopify orders/create payload we'll get for real.
const testOrder = {
  name: "#TEST1001",
  shipping_address: {
    first_name: "Jane",
    last_name: "Doe",
    address1: "1550 Bryant St",
    address2: "",
    city: "San Francisco",
    province_code: "CA",
    zip: "94103",
    country_code: "US",
    phone: "4155550123",
  },
};

async function main() {
  const { trackingNumber, labelBase64, labelContentType } = await createShipment(testOrder);
  console.log("Tracking number:", trackingNumber);

  const ext = labelContentType === "application/pdf" ? "pdf" : "bin";
  const outPath = fileURLToPath(new URL(`../../test-label.${ext}`, import.meta.url));
  fs.writeFileSync(outPath, Buffer.from(labelBase64, "base64"));
  console.log("Label saved to:", outPath);
}

main().catch((err) => {
  console.error("FedEx test failed:", err);
  process.exit(1);
});
