// Sends the FedEx label to the D450BT via the PrintNode agent installed on the
// warehouse computer. PrintNode auth is HTTP Basic with the API key as the username
// and an empty password.

export async function printLabel(labelBase64, contentType) {
  const auth = Buffer.from(`${process.env.PRINTNODE_API_KEY}:`).toString("base64");

  const res = await fetch("https://api.printnode.com/printjobs", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      printerId: Number(process.env.PRINTNODE_PRINTER_ID),
      title: "FedEx shipping label",
      contentType: contentType === "application/pdf" ? "pdf_base64" : "raw_base64",
      content: labelBase64,
      source: "shipping-label-automation",
    }),
  });

  if (!res.ok) {
    throw new Error(`PrintNode print job failed: ${res.status} ${await res.text()}`);
  }

  return res.json();
}
