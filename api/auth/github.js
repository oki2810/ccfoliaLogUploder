// api/auth/github.js
import crypto from "crypto";
import cookie from "cookie";
import applyCors from "../../lib/cors.js";

export default function handler(req, res) {
  if (applyCors(req, res)) return;
  const state = crypto.randomBytes(16).toString("hex");
  res.setHeader(
    "Set-Cookie",
    cookie.serialize("oauth_state", state, {
      httpOnly: true,
      secure:   true,
      sameSite: "none",
      path:     "/",
      maxAge:   600,
    })
  );

  const redirectUri =
    process.env.AUTH_CALLBACK_URL ||
    `${req.headers["x-forwarded-proto"]}://${req.headers.host}/api/auth/github-callback`;
  const params = new URLSearchParams({
    client_id:    process.env.GH_CLIENT_ID,
    redirect_uri: redirectUri,
    scope:        "repo",
    state,
  });

  // ← 必ず “https://github.com/login/oauth/authorize” を先頭に！
  const gitHubUrl =
    `https://github.com/login/oauth/authorize?${params.toString()}`;
  console.log("🔗 Redirecting to GitHub:", gitHubUrl);
  return res.redirect(gitHubUrl);
}
