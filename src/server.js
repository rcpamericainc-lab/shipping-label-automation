// The one entry point, used both locally and on Vercel. Vercel's Express
// zero-config detection specifically requires the entrypoint file itself to
// import "express" directly (static analysis, not just app.listen()) -- an
// earlier version that imported the app from a separate module failed with
// "No entrypoint found which imports express".
import "dotenv/config";
import express from "express";
import { webhooksRouter } from "./routes/webhooks.js";

const app = express();

// Webhook routes need the raw body for HMAC verification, so mount them with
// express.raw() before any global JSON body parser touches the request.
app.use("/webhooks", express.raw({ type: "application/json" }), webhooksRouter);

app.get("/health", (req, res) => res.send("ok"));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`shipping-label-automation listening on port ${port}`);
});
