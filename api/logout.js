import cookie from "cookie";

export default function handler(req, res) {
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
