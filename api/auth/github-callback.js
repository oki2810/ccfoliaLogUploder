// api/auth/github-callback.js
import cookie from "cookie";

export default async function handler(req, res) {
  const { code, state } = req.query;

  // --- デバッグログ出力 ---
  console.log("=== DEBUG STATE CHECK ===");
  console.log("  query.state:", state);
  console.log("  raw Cookie header:", req.headers.cookie);
  const parsedCookies = cookie.parse(req.headers.cookie || "");
  console.log("  parsed cookies:", parsedCookies);
  console.log("=========================");

  // 必須パラメータチェック
  if (!code || !state) {
    return res.status(400).send("Missing code or state");
  }
  // state照合
  if (state !== parsedCookies.oauth_state) {
    return res.status(403).send("Invalid state");
  }

  // 先に「undefined」などの古いaccess_tokenをクリア
  res.setHeader(
    "Set-Cookie",
    cookie.serialize("access_token", "", {
      maxAge: 0,
      path: "/",
    })
  );

  // GitHubからアクセストークンを取得
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

  // レスポンスステータスとボディをログ出力
  console.log("⏱ token fetch status:", tokenRes.status);
  const data = await tokenRes.json();
  console.log("⏱ token response payload:", data);

  const { access_token } = data;
  if (!access_token) {
    return res.status(500).send("Failed to obtain access token");
  }

  // 新しいaccess_tokenをセット、state用Cookieは破棄
  res.setHeader("Set-Cookie", [
    cookie.serialize("access_token", access_token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 7 * 24 * 3600,
    }),
    cookie.serialize("oauth_state", "", {
      maxAge: 0,
      path: "/",
    }),
  ]);

  return res.redirect("/");
}
