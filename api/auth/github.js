import crypto from "crypto";
import { saveState } from "../state-store.js";

export default function handler(req, res) {
  const state = crypto.randomBytes(8).toString("hex");
  // Save state server-side to verify after redirect
  saveState(state);
  res.setHeader(
    "Set-Cookie",
    `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax`
  );
  const params = new URLSearchParams({
    client_id: process.env.GH_CLIENT_ID,
    scope: "repo",
    state,
  });
  if (process.env.AUTH_CALLBACK_URL) {
    params.set("redirect_uri", process.env.AUTH_CALLBACK_URL);
  }
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
}
