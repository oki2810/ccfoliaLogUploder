import cookie from "cookie";
import applyCors from "../lib/cors.js";

export default function handler(req, res) {
  if (applyCors(req, res)) return;
  res.setHeader("Set-Cookie", [
    cookie.serialize("access_token", "", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 0,
    }),
    cookie.serialize("oauth_state", "", { path: "/", maxAge: 0 }),
  ]);
  res.status(200).json({ ok: true });
}
