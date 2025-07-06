// api/auth/github.js
import crypto from "crypto";
import cookie from "cookie";

export default function handler(req, res) {
  // 16バイトのランダム state
  const state = crypto.randomBytes(16).toString("hex");

  // クロスサイトリダイレクトでも必ず送られるように SameSite=None, Secure を指定
  res.setHeader(
    "Set-Cookie",
    cookie.serialize("oauth_state", state, {
      httpOnly: true,
      secure: true,         // 本番 HTTPS 環境でのみ有効
      sameSite: "none",     // OAuth のリダイレクトでも送信させる
      path: "/",
      maxAge: 10 * 60,      // 10 分だけ有効
    })
  );

  const redirectUri = process.env.AUTH_CALLBACK_URL;
  const params = new URLSearchParams({
    client_id:    process.env.GH_CLIENT_ID,
    redirect_uri: redirectUri,
    scope:        "repo",
    state,
  });

  return res.redirect(`https://github.com/login/oauth/authorize?${params}`);
}
