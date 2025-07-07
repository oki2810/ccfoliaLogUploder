import { Octokit } from "@octokit/rest";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  const cookies = Object.fromEntries(
    (req.headers.cookie || "").split("; ").map(c => c.split("="))
  );
  const token = cookies.access_token;
  if (!token) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const { owner, repo } = req.body || {};
  if (!owner || !repo) {
    return res.status(400).json({ ok: false, error: "Missing owner or repo" });
  }

  const octokit = new Octokit({ auth: token });

  const INIT_INDEX = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>GitHub Pages</title>
</head>
<body>
  <h1>It works!</h1>
</body>
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
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./public
`;

  const PACKAGE_JSON = JSON.stringify(
    {
      name: "coc-github-io",
      version: "1.0.0",
      private: true,
      description: "GitHub Pages site for coc.github.io",
      scripts: {
        build: "echo \"No build step\""
      },
      dependencies: {}
    },
    null,
    2
  );

  const { data: repoInfo } = await octokit.repos.get({ owner, repo });
  const branch = repoInfo.default_branch;
  const { data: refData } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });
  const baseCommitSha = refData.object.sha;
  const { data: baseCommit } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: baseCommitSha,
  });

  const files = [
    { path: "index.html", content: INIT_INDEX },
    { path: ".github/workflows/pages.yml", content: WORKFLOW_YAML },
    { path: "package.json", content: PACKAGE_JSON },
  ];

  const treeItems = [];
  for (const file of files) {
    const { data: blob } = await octokit.git.createBlob({
      owner,
      repo,
      content: Buffer.from(file.content, "utf8").toString("base64"),
      encoding: "base64",
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
    ref: `heads/${branch}`,
    sha: newCommit.sha,
  });

  res.json({ ok: true });
}
