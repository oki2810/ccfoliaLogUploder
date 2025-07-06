// api/auth/github.js
import crypto from "crypto";
import cookie from "cookie";

export default function handler(req, res) {
  // 16バイトのランダム state を生成
  const state = crypto.randomBytes(16).toString("hex");

  // クッキーに state を保存（本番HTTPS環境のみ secure）
  res.setHeader(
    "Set-Cookie",
    cookie.serialize("oauth_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
    })
  );

  // GitHub OAuth 認可画面へリダイレクト
  const params = new URLSearchParams({
    client_id: process.env.GH_CLIENT_ID,
    redirect_uri: process.env.AUTH_CALLBACK_URL || `${process.env.BASE_URL}/api/auth/github-callback`,
    scope: "repo",
    state,
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
}
