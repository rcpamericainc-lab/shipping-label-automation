// Entry point for both local dev and Vercel. Vercel auto-detects src/server.js
// as a Node.js server entrypoint (via its app.listen() call) and captures the
// whole thing as one Vercel Function -- no api/ directory or vercel.json
// rewrites needed. Locally this is just a normal persistent Node process.
import "dotenv/config";
import { app } from "./expressApp.js";

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`shipping-label-automation listening on port ${port}`);
});
