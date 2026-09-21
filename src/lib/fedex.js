// FedEx Ship API (developer.fedex.com). OAuth2 client-credentials auth, then a single
// create-shipment call that returns both the label and the tracking number.
//
// TODO before going live: the requestedShipment body below is a minimal skeleton.
// Confirm against your actual FedEx account: service type (e.g. FEDEX_GROUND vs
// STANDARD_OVERNIGHT), packaging type, and default package weight/dimensions for a
// typical order -- these are account/contract-specific and FedEx will reject the
// request if they don't match what your account is provisioned for.

let cachedToken = null;
let cachedTokenExpiresAt = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiresAt) {
    return cachedToken;
  }

  const res = await fetch(`${process.env.FEDEX_API_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.FEDEX_CLIENT_ID,
      client_secret: process.env.FEDEX_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    throw new Error(`FedEx OAuth failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  // Refresh a little early rather than exactly at expiry.
  cachedTokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

function buildRequestedShipment(order) {
  const address = order.shipping_address;

  return {
    shipper: {
      contact: {
        personName: process.env.SHIPPER_NAME,
        phoneNumber: process.env.SHIPPER_PHONE,
      },
      address: {
        streetLines: [process.env.SHIPPER_STREET],
        city: process.env.SHIPPER_CITY,
        stateOrProvinceCode: process.env.SHIPPER_STATE,
        postalCode: process.env.SHIPPER_ZIP,
        countryCode: process.env.SHIPPER_COUNTRY,
      },
    },
    recipients: [
      {
        contact: {
          personName: `${address.first_name} ${address.last_name}`,
          phoneNumber: address.phone || process.env.SHIPPER_PHONE,
        },
        address: {
          streetLines: [address.address1, address.address2].filter(Boolean),
          city: address.city,
          stateOrProvinceCode: address.province_code,
          postalCode: address.zip,
          countryCode: address.country_code,
        },
      },
    ],
    shipDatestamp: new Date().toISOString().slice(0, 10),
    // TODO: confirm service type against your FedEx contract.
    serviceType: "FEDEX_GROUND",
    packagingType: "YOUR_PACKAGING",
    pickupType: "USE_SCHEDULED_PICKUP",
    shippingChargesPayment: {
      paymentType: "SENDER",
      payor: {
        responsibleParty: {
          accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER },
        },
      },
    },
    labelSpecification: {
      // TODO: confirm the D450BT's supported format (ZPL is common for thermal
      // printers). If it needs ZPL, change imageType to "ZPLII" here.
      imageType: "PDF",
      labelStockType: "PAPER_4X6",
    },
    requestedPackageLineItems: [
      {
        // TODO: replace with real per-order weight once available, or compute
        // from line-item weights.
        weight: { units: "LB", value: 1 },
      },
    ],
  };
}

export async function createShipment(order) {
  const token = await getAccessToken();

  const res = await fetch(`${process.env.FEDEX_API_BASE}/ship/v1/shipments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-locale": "en_US",
    },
    body: JSON.stringify({
      // "LABEL" returns the encoded label bytes inline (what we need to hand
      // straight to PrintNode) -- "URL_ONLY" returns a link instead, which
      // left encodedLabel undefined.
      labelResponseOptions: "LABEL",
      requestedShipment: buildRequestedShipment(order),
      accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER },
    }),
  });

  if (!res.ok) {
    throw new Error(`FedEx shipment creation failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const piece = data.output.transactionShipments[0].pieceResponses[0];

  return {
    trackingNumber: piece.trackingNumber,
    labelBase64: piece.packageDocuments[0].encodedLabel,
    labelContentType: "application/pdf",
  };
}
