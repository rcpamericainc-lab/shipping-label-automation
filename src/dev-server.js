// Local/dev entry point only -- a persistent process that listens on a port.
// Vercel doesn't use this file; see api/index.js for the serverless entry.
import "dotenv/config";
import { app } from "./app.js";

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`shipping-label-automation listening on port ${port}`);
});
