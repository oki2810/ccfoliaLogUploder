// api/auth/github-callback.js
import cookie from "cookie";

export default async function handler(req, res) {
  const { code, state } = req.query;
  if (!code || !state) {
    return res.status(400).send("Missing code or state");
  }

  // --- DEBUG ログ出力（変数名が重複しないように注意） ---
  console.log("=== DEBUG STATE CHECK ===");
  console.log("  query.state:", state);
  console.log("  raw Cookie header:", req.headers.cookie);

  // ここで一度だけクッキーをパース
  const parsedCookies = cookie.parse(req.headers.cookie || "");
  console.log("  parsed cookies:", parsedCookies);
  console.log("=========================");

  // state 照合
  if (state !== parsedCookies.oauth_state) {
    return res.status(403).send("Invalid state");
  }

  // --- 以下、アクセストークン取得以降の処理 ---
  const tokenRes = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method:  "POST",
      headers: { Accept: "application/json" },
      body:    JSON.stringify({
        client_id:     process.env.GH_CLIENT_ID,
        client_secret: process.env.GH_CLIENT_SECRET,
        code,
      }),
    }
  );
  const { access_token } = await tokenRes.json();

  res.setHeader("Set-Cookie", [
    cookie.serialize("access_token", access_token, {
      httpOnly: true,
      secure:   true,
      sameSite: "none",
      path:     "/",
      maxAge:   7 * 24 * 3600,
    }),
    cookie.serialize("oauth_state", "", { maxAge: 0, path: "/" }),
  ]);

  return res.redirect("/");
}
