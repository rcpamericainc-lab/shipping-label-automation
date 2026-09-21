// One-off: registers the orders/create webhook against the deployed app.
// Usage: node src/scripts/register-webhook.js https://shipping-label-automation.vercel.app

import "dotenv/config";

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

async function main() {
  const baseUrl = process.argv[2];
  if (!baseUrl) {
    console.error("Usage: node src/scripts/register-webhook.js <deployed-base-url>");
    process.exit(1);
  }

  const callbackUrl = `${baseUrl.replace(/\/$/, "")}/webhooks/orders/create`;

  const mutation = `
    mutation ($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
      webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
        webhookSubscription { id callbackUrl topic }
        userErrors { field message }
      }
    }
  `;

  const variables = {
    topic: "ORDERS_CREATE",
    webhookSubscription: {
      callbackUrl,
      format: "JSON",
    },
  };

  const data = await shopifyGraphQL(mutation, variables);
  const errors = data.webhookSubscriptionCreate.userErrors;
  if (errors.length) {
    throw new Error(`Webhook registration failed: ${JSON.stringify(errors)}`);
  }

  console.log("Webhook registered:", data.webhookSubscriptionCreate.webhookSubscription);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
