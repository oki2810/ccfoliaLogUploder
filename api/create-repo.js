import { Octokit } from "@octokit/rest";

export default async function handler(req, res) {
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
    const { data: repo } = await octokit.rest.repos.createForAuthenticatedUser({
      name,
      description: description || "CCUログ用GitHub Pagesリポジトリ",
      private: false,
      auto_init: false,
    });
    return res.json({ ok: true, repo: repo.full_name });
  } catch (err) {
    console.error("create-repo error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to create repository" });
  }
}
