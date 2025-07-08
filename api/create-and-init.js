import { Octokit } from "@octokit/rest";

export default async function handler(req, res) {
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

  const { repo: name, description } = req.body || {};
  if (!name) {
    return res.status(400).json({ ok: false, error: "Missing repository name" });
  }

  const octokit = new Octokit({ auth: token });

  try {
    const { data: created } = await octokit.rest.repos.createForAuthenticatedUser({
      name,
      description: description || "CCUログ用GitHub Pagesリポジトリ",
      private: false,
      auto_init: false,
    });
    const owner = created.owner.login;
    const repo = created.name;

    const branch = "main";
    let baseCommitSha = null;
    let baseTreeSha = null;
    try {
      const { data: refData } = await octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${branch}`,
      });
      baseCommitSha = refData.object.sha;
      const { data: baseCommit } = await octokit.git.getCommit({
        owner,
        repo,
        commit_sha: baseCommitSha,
      });
      baseTreeSha = baseCommit.tree.sha;
    } catch (err) {
      if (err.status === 404 || err.status === 422) {
        const { data: readmeBlob } = await octokit.git.createBlob({
          owner,
          repo,
          content: "# \u521d\u671f\u5316",
          encoding: "utf-8",
        });

        const { data: tree } = await octokit.git.createTree({
          owner,
          repo,
          tree: [
            { path: "README.md", mode: "100644", type: "blob", sha: readmeBlob.sha },
          ],
        });

        const { data: commit } = await octokit.git.createCommit({
          owner,
          repo,
          message: "\u521d\u56de\u30b3\u30df\u30c3\u30c8: README\u8ffd\u52a0",
          tree: tree.sha,
          parents: [],
        });

        await octokit.git.createRef({
          owner,
          repo,
          ref: `refs/heads/${branch}`,
          sha: commit.sha,
        });

        baseCommitSha = commit.sha;
        baseTreeSha = tree.sha;
      } else {
        throw err;
      }
    }

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
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Build
        run: npm run build --if-present

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: \${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./public`;
    const PACKAGE_JSON = JSON.stringify({
      name: repo,
      version: "1.0.0",
      private: true,
      description: "GitHub Pages site for " + repo,
      scripts: { build: "echo \"No build step\"" },
      dependencies: {},
    }, null, 2);
    const README_MD = `# ${repo}\n\nCreated by CCU for GitHub Pages.`;

    const files = [
      { path: "index.html", content: INIT_INDEX },
      { path: ".github/workflows/pages.yml", content: WORKFLOW_YAML },
      { path: "package.json", content: PACKAGE_JSON },
      { path: "README.md", content: README_MD },
    ];

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
      base_tree: baseTreeSha || undefined,
      tree: treeItems,
    });

    const { data: newCommit } = await octokit.git.createCommit({
      owner,
      repo,
      message: "Initial setup for GitHub Pages",
      tree: newTree.sha,
      parents: baseCommitSha ? [baseCommitSha] : [],
    });

    if (baseCommitSha) {
      await octokit.git.updateRef({
        owner,
        repo,
        ref: `heads/${branch}`,
        sha: newCommit.sha,
      });
    } else {
      await octokit.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branch}`,
        sha: newCommit.sha,
      });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("create-and-init error:", err);
    return res.status(err.status || 500).json({ ok: false, error: err.message });
  }
}
