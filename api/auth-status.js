import { Octokit } from "@octokit/rest";
import applyCors from "../lib/cors.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  const cookies = Object.fromEntries(
    (req.headers.cookie || "").split("; ").map(c => c.split("="))
  );
  const token = cookies.access_token;
  if (!token) return res.json({ authenticated: false });

  try {
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.rest.users.getAuthenticated();
    return res.json({ authenticated: true, username: data.login });
  } catch (err) {
    console.error("Failed to fetch user info", err);
    return res.json({ authenticated: true, username: null });
  }
}
