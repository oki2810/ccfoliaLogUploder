export default function handler(req, res) {
  const cookies = Object.fromEntries(
    (req.headers.cookie || "").split("; ").map(c => c.split("="))
  );
  res.json({ authenticated: Boolean(cookies.accessToken) });
}
