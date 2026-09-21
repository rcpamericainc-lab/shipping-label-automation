// Writes the FedEx tracking number back onto the Shopify order by creating a
// fulfillment against the order's (first) fulfillment order.

const API_VERSION = "2024-10";

async function shopifyGraphQL(query, variables) {
  const res = await fetch(
    `https://${process.env.SHOPIFY_SHOP}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
      },
      body: JSON.stringify({ query, variables }),
    }
  );

  const data = await res.json();
  if (!res.ok || data.errors) {
    throw new Error(`Shopify GraphQL error: ${JSON.stringify(data.errors || data)}`);
  }
  return data.data;
}

async function getFulfillmentOrderId(orderGid) {
  const query = `
    query ($id: ID!) {
      order(id: $id) {
        fulfillmentOrders(first: 1) {
          nodes { id }
        }
      }
    }
  `;
  const data = await shopifyGraphQL(query, { id: orderGid });
  const node = data.order?.fulfillmentOrders?.nodes?.[0];
  if (!node) throw new Error(`No open fulfillment order found for ${orderGid}`);
  return node.id;
}

export async function addTrackingToOrder(orderId, trackingNumber) {
  const orderGid = `gid://shopify/Order/${orderId}`;
  const fulfillmentOrderId = await getFulfillmentOrderId(orderGid);

  const mutation = `
    mutation ($fulfillment: FulfillmentInput!) {
      fulfillmentCreate(fulfillment: $fulfillment) {
        fulfillment { id status }
        userErrors { field message }
      }
    }
  `;

  const variables = {
    fulfillment: {
      lineItemsByFulfillmentOrder: [{ fulfillmentOrderId }],
      trackingInfo: {
        number: trackingNumber,
        company: "FedEx",
      },
      notifyCustomer: true,
    },
  };

  const data = await shopifyGraphQL(mutation, variables);
  const errors = data.fulfillmentCreate.userErrors;
  if (errors.length) {
    throw new Error(`Shopify fulfillmentCreate error: ${JSON.stringify(errors)}`);
  }
  return data.fulfillmentCreate.fulfillment;
}
