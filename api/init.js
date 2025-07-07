import { Octokit } from "@octokit/rest";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });

  // 認証トークン取得
  const cookies = Object.fromEntries(
    (req.headers.cookie || "").split("; ").map(c => c.split("="))
  );
  const token = cookies.access_token;
  if (!token) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const { owner, repo } = req.body || {};
  if (!owner || !repo)
    return res.status(400).json({ ok: false, error: "Missing owner or repo" });

  const octokit = new Octokit({ auth: token });

  try {
    // リポジトリ情報取得
    const { data: repoInfo } = await octokit.repos.get({ owner, repo });
    const branch = repoInfo.default_branch;
    const { data: refData } = await octokit.git.getRef({
      owner,
      repo,
      ref: `refs/heads/${branch}`,
    });
    const baseCommitSha = refData.object.sha;
    const { data: baseCommit } = await octokit.git.getCommit({
      owner,
      repo,
      commit_sha: baseCommitSha,
    });

    // ファイル定義
    const INIT_INDEX = `<!DOCTYPE html>
    <html lang="ja">
    <head><meta charset="utf-8"><title>GitHub Pages</title></head>
    <body><h1>It works!</h1></body>
    </html>`;
    const WORKFLOW_YAML = `name: Deploy to GitHub Pages
    on:
      push:
        branches:
          - main
      workflow_dispatch:
    jobs:
      …`;
    const PACKAGE_JSON = JSON.stringify({
      name: "coc-github-io",
      version: "1.0.0",
      private: true,
      description: "GitHub Pages site for coc.github.io",
      scripts: { build: "echo \"No build step\"" },
      dependencies: {},
    }, null, 2);

    const files = [
      { path: "index.html", content: INIT_INDEX },
      { path: ".github/workflows/pages.yml", content: WORKFLOW_YAML },
      { path: "package.json", content: PACKAGE_JSON },
    ];

    // ブロブ→ツリー→コミット→参照更新
    const treeItems = [];
    for (const file of files) {
      const { data: blob } = await octokit.git.createBlob({
        owner,
        repo,
        content: file.content,
        encoding: "utf-8",
      });
      treeItems.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
    }
    const { data: newTree } = await octokit.git.createTree({
      owner,
      repo,
      base_tree: baseCommit.tree.sha,
      tree: treeItems,
    });
    const { data: newCommit } = await octokit.git.createCommit({
      owner,
      repo,
      message: "Initial setup for GitHub Pages",
      tree: newTree.sha,
      parents: [baseCommitSha],
    });
    await octokit.git.updateRef({
      owner,
      repo,
      ref: `refs/heads/${branch}`,
      sha: newCommit.sha,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("init error:", err);
    return res.status(500).json({ ok: false, error: "Internal Server Error" });
  }
}
