import express from "express";
import { webhooksRouter } from "./routes/webhooks.js";

export const app = express();

// Webhook routes need the raw body for HMAC verification, so mount them with
// express.raw() before any global JSON body parser touches the request.
app.use("/webhooks", express.raw({ type: "application/json" }), webhooksRouter);

app.get("/health", (req, res) => res.send("ok"));
