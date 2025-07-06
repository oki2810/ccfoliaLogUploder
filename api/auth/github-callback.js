// api/auth/github-callback.js
import cookie from "cookie";

export default async function handler(req, res) {
  const { code, state } = req.query;
  if (!code || !state) {
    return res.status(400).send("Missing code or state");
  }

  // ブラウザが送ってきた oauth_state クッキーを読む
  const cookies = cookie.parse(req.headers.cookie || "");
  if (state !== cookies.oauth_state) {
    return res.status(403).send("Invalid state");
  }

  // GitHub にトークンをリクエスト
  const tokenRes = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: { 
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.GH_CLIENT_ID,
        client_secret: process.env.GH_CLIENT_SECRET,
        code,
      }),
    }
  );
  const { access_token } = await tokenRes.json();
  if (!access_token) {
    return res.status(500).send("Failed to obtain access token");
  }

  // 取得したトークンをクッキーにセットしつつ、state 用クッキーはクリア
  res.setHeader("Set-Cookie", [
    cookie.serialize("access_token", access_token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 7 * 24 * 3600, // 1週間有効
    }),
    cookie.serialize("oauth_state", "", {
      maxAge: 0,
      path: "/",
    }),
  ]);

  // 完了後はトップへリダイレクト
  return res.redirect("/");
}
