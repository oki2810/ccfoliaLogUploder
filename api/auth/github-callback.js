import axios from "axios";
import cookie from "cookie";

export default async function handler(req, res) {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.status(400).send("Missing code or state");
    }

    // ← ここが旧来の split/map/Object.fromEntries ではなく…
    const cookies = cookie.parse(req.headers.cookie || "");

    if (state !== cookies.oauth_state) {
      return res.status(403).send("Invalid state");
    }

    const tokenRes = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: process.env.GH_CLIENT_ID,
        client_secret: process.env.GH_CLIENT_SECRET,
        code,
      },
      { headers: { Accept: "application/json" } }
    );

    res.setHeader(
      "Set-Cookie",
      cookie.serialize("accessToken", tokenRes.data.access_token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      })
    );
    return res.redirect("/");
  } catch (err) {
    console.error("github-callback error:", err);
    return res.status(500).send("Internal Server Error");
  }
}
