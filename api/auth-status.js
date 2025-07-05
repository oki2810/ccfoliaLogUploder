export default function handler(req, res) {
  const authenticated = Boolean(req.cookies && req.cookies.accessToken);
  res.json({ authenticated });
}
