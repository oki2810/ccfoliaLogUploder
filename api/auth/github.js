import crypto from "crypto";

export default function handler(req, res) {
  const state = crypto.randomBytes(8).toString("hex");
  // Vercel などの環境で state を一時保存する仕組みを用意してください
  res.setHeader("Set-Cookie", `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax`);
  const params = new URLSearchParams({
    client_id: process.env.GH_CLIENT_ID,
    scope: "repo",
    state
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
}
