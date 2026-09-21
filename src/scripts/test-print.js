// Standalone PrintNode connectivity test -- confirms the D450BT actually prints
// before wiring PrintNode into the real FedEx/Shopify webhook flow.
//
// Usage: npm run test-print
// Requires PRINTNODE_API_KEY and PRINTNODE_PRINTER_ID set in .env.

import "dotenv/config";
import PDFDocument from "pdfkit";
import { printLabel } from "../lib/printnode.js";

function buildTestPdf() {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [288, 432] }); // 4x6" at 72dpi
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc
      .fontSize(20)
      .text("PrintNode Test", { align: "center" })
      .moveDown()
      .fontSize(14)
      .text("D450BT connectivity check", { align: "center" })
      .moveDown()
      .fontSize(10)
      .text(new Date().toISOString(), { align: "center" });

    doc.end();
  });
}

async function main() {
  if (!process.env.PRINTNODE_API_KEY || !process.env.PRINTNODE_PRINTER_ID) {
    console.error("Set PRINTNODE_API_KEY and PRINTNODE_PRINTER_ID in .env first.");
    process.exit(1);
  }

  const pdfBuffer = await buildTestPdf();
  const result = await printLabel(pdfBuffer.toString("base64"), "application/pdf");
  console.log("Print job submitted:", result);
  console.log("Check the D450 -- a test page should print within a few seconds.");
}

main().catch((err) => {
  console.error("Test print failed:", err);
  process.exit(1);
});
