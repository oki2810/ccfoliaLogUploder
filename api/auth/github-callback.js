// api/auth/github-callback.js
import cookie from "cookie";
import applyCors from "../../lib/cors.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  const { code, state } = req.query;

  // ——— デバッグログ: Cookie ヘッダを丸ごと出す ———
  console.log("=== DEBUG STATE CHECK ===");
  console.log("  query.state:", state);
  console.log("  raw Cookie header:", req.headers.cookie);
  const parsed = cookie.parse(req.headers.cookie || "");
  console.log("  parsed cookies:", parsed);
  console.log("================================");

  // 必須チェック
  if (!code || !state) {
    return res.status(400).send("Missing code or state");
  }
  // state が届いているはず！
  if (state !== parsed.oauth_state) {
    return res.status(403).send("Invalid state");
  }

  // アクセストークン取得
  const tokenRes = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        Accept:         "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id:     process.env.GH_CLIENT_ID,
        client_secret: process.env.GH_CLIENT_SECRET,
        code,
      }),
    }
  );
  console.log("⏱ token fetch status:", tokenRes.status);
  const { access_token } = await tokenRes.json();
  console.log("⏱ access_token:", access_token);

  if (!access_token) {
    return res.status(500).send("Failed to obtain access token");
  }

  // state 用 Cookie をクリア & access_token をセット
  res.setHeader("Set-Cookie", [
    cookie.serialize("oauth_state", "",  { maxAge: 0,  path: "/" }),
    cookie.serialize("access_token", access_token, {
      httpOnly: true,
      secure:   true,
      sameSite: "none",
      path:     "/",
      maxAge:   7 * 24 * 3600,
    }),
  ]);

  return res.redirect("/");
}
