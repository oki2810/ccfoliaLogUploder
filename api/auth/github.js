// api/auth/github.js
import crypto from "crypto";
import cookie from "cookie";

export default function handler(req, res) {
  // 1) ランダム state を作成
  const state = crypto.randomBytes(16).toString("hex");

  // 2) oauth_state Cookie を発行（SameSite=None, Secure）
  res.setHeader(
    "Set-Cookie",
    cookie.serialize("oauth_state", state, {
      httpOnly: true,      // JS から読めないように
      secure: true,        // HTTPS 本番のみ
      sameSite: "none",    // クロスサイトリダイレクトで送信
      path: "/",
      maxAge: 10 * 60,     // 10 分有効
    })
  );

  // 3) GitHub 認可画面へリダイレクト
  const params = new URLSearchParams({
    client_id:    process.env.GH_CLIENT_ID,
    redirect_uri: process.env.AUTH_CALLBACK_URL,
    scope:        "repo",
    state,
  });
  return res.redirect(`https://github.com/login/oauth/authorize?${params}`);
}
