import axios from "axios";

export default async function handler(req, res) {
  const { code, state } = req.query;
  // Cookie から state を検証
  const cookies = Object.fromEntries(
    (req.headers.cookie || "").split("; ").map(c => c.split("="))
  );
  if (state !== cookies.oauth_state) {
    return res.status(403).send("Invalid state");
  }

  const tokenRes = await axios.post(
    "https://github.com/login/oauth/access_token",
    {
      client_id: process.env.GH_CLIENT_ID,
      client_secret: process.env.GH_CLIENT_SECRET,
      code
    },
    { headers: { Accept: "application/json" } }
  );
  // Cookie にトークンを保存
  res.setHeader(
    "Set-Cookie",
    `accessToken=${tokenRes.data.access_token}; Path=/; HttpOnly; SameSite=Lax`
  );
  res.redirect("/");
}
