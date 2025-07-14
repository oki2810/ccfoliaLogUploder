import { Octokit } from "@octokit/rest";
import applyCors from "../lib/cors.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  const cookies = Object.fromEntries(
    (req.headers.cookie || "").split("; ").map(c => c.split("="))
  );
  const token = cookies.access_token;
  if (!token) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const { owner, repo } = req.body || {};
  if (!owner || !repo) {
    return res.status(400).json({ ok: false, error: "Missing owner or repo" });
  }

  const octokit = new Octokit({ auth: token });

  try {
    await octokit.repos.get({ owner, repo });
    return res.json({ ok: true });
  } catch (err) {
    console.error("check-repo error:", err);
    const status = err.status || 500;
    const error = status === 404 ? "Repository not found" : err.message;
    return res.status(status).json({ ok: false, error });
  }
}
