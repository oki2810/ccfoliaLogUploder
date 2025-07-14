import { Octokit } from "@octokit/rest";
import applyCors from "../lib/cors.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST")
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });

  const cookies = Object.fromEntries(
    (req.headers.cookie || "").split("; ").map(c => c.split("="))
  );
  const token = cookies.access_token;
  if (!token) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const { name, description } = req.body || {};
  if (!name)
    return res.status(400).json({ ok: false, error: "Missing repository name" });

  const octokit = new Octokit({ auth: token });

  try {
    const { data: repo } = await octokit.rest.repos.createUsingTemplate({
      template_owner: process.env.TEMPLATE_OWNER,
      template_repo: process.env.TEMPLATE_REPO,
      name,
      description: description || "CCUログ用GitHub Pagesリポジトリ",
      private: false,
      include_all_branches: false,
    });
    return res.json({ ok: true, repo: repo.full_name });
  } catch (err) {
    console.error("create-repo error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to create repository" });
  }
}
