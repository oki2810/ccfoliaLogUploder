// api/auth/github.js
import crypto from "crypto";
import cookie from "cookie";

export default function handler(req, res) {
  // 16 バイト乱数を hex 文字列に変換
  const state = crypto.randomBytes(16).toString("hex");

  // OAuth state をクッキーに保存（本番HTTPSのみ・クロスサイトでも送らせる）
  res.setHeader(
    "Set-Cookie",
    cookie.serialize("oauth_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 10 * 60, // 10 分で自動破棄
    })
  );

  // GitHub 認可画面へリダイレクト
  const redirectUri =
    process.env.AUTH_CALLBACK_URL ||
    `${process.env.BASE_URL}/api/auth/github-callback`;

  const params = new URLSearchParams({
    client_id: process.env.GH_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: "repo",
    state,
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
}
