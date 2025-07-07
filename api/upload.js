import fs from "fs";
import * as nodePath from "path";
import multer from "multer";
import { Octokit } from "@octokit/rest";
import Joi from "joi";

const upload = multer({ limits: { fileSize: 2 * 1024 * 1024 } });
const schema = Joi.object({
  owner: Joi.string().required(),
  repo: Joi.string().required(),
  // log/ 以下へのアップロードのみ許可
  path: Joi.string().pattern(/^log\/.+\.html$/).required(),
  linkText: Joi.string().max(100).required(),
  scenarioName: Joi.string().max(100).required(),
});

const DEFAULT_INDEX = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>ログ一覧</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet" />
</head>
<body>
  <div class="container py-5">
    <h1 class="mb-4">アップロード済みログ</h1>
    <ul id="generatedList" class="list-group"></ul>
  </div>
  <script src="norobot.js"></script>
</body>
</html>`;

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  // CSRF は Vercel Functions では自前実装になるので省略
  const cookies = Object.fromEntries(
    (req.headers.cookie || "").split("; ").map(c => c.split("="))
  );
  const token = cookies.access_token;
  if (!token) return res.status(401).json({ ok: false, error: "Unauthorized" });

  // マルチパート解析
  await new Promise((ok, ng) => {
    upload.single("htmlFile")(req, res, err => (err ? ng(err) : ok()));
  });
  if (!req.file) return res.status(400).json({ ok: false, error: "No file" });

const { owner, repo, path, linkText, scenarioName } = await schema.validateAsync(req.body);
  const octokit = new Octokit({ auth: token });

  // 1) 新規ログデータ
  const fileB64 = req.file.buffer.toString("base64");
  const { data: logBlob } = await octokit.git.createBlob({
    owner,
    repo,
    content: fileB64,
    encoding: "base64",
  });

// 2) index.html を取得（無ければテンプレート作成、空ならテンプレート置換）
let html;

try {
  const idx = await octokit.repos.getContent({ owner, repo, path: "index.html" });
  html = Buffer.from(idx.data.content, "base64").toString("utf8");

  // ファイルはあるけど空っぽ（スペースだけ）だったらテンプレートに切り替え
  if (!html.trim()) {
    html = DEFAULT_INDEX;
  }
} catch (err) {
  if (err.status === 404) {
    // ファイル自体がないときはテンプレートをまるっと流用
    html = DEFAULT_INDEX;
  } else {
    throw err;
  }
}

  const newItem = `<li class="list-group-item"><a href="${path}">${linkText}</a><span class="ms-2 text-muted">${scenarioName}</span></li>`;
  if (html.match(/<ul[^>]+id="generatedList"/)) {
    html = html.replace(
      /(<ul[^>]+id="generatedList"[^>]*>)/,
      `$1\n  ${newItem}`
    );
  } else {
    html = html.replace(
      /<\/body>/i,
      `  <ul id="generatedList" class="list-group">\n    ${newItem}\n  </ul>\n</body>`
    );
  }

  // 3) index.html ブロブ作成
  const { data: indexBlob } = await octokit.git.createBlob({
    owner,
    repo,
    content: Buffer.from(html, "utf8").toString("base64"),
    encoding: "base64",
  });

  // norobot.js が無ければブロブ作成
  let needNorobot = false;
  let norobotBlob = null;
  try {
    await octokit.repos.getContent({ owner, repo, path: "norobot.js" });
  } catch (err) {
    if (err.status === 404) {
      needNorobot = true;
      const scriptPath = nodePath.join(process.cwd(), "public", "norobot.js");
      const scriptB64 = fs.readFileSync(scriptPath).toString("base64");
      const { data } = await octokit.git.createBlob({
        owner,
        repo,
        content: scriptB64,
        encoding: "base64",
      });
      norobotBlob = data;
    } else {
      throw err;
    }
  }

  // 4) 単一コミットとしてアップロード
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

  const treeItems = [
    { path, mode: "100644", type: "blob", sha: logBlob.sha },
    { path: "index.html", mode: "100644", type: "blob", sha: indexBlob.sha },
  ];
  if (needNorobot && norobotBlob) {
    treeItems.push({
      path: "norobot.js",
      mode: "100644",
      type: "blob",
      sha: norobotBlob.sha,
    });
  }

  const { data: newTree } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: baseCommit.tree.sha,
    tree: treeItems,
  });

  let commitMessage = `Add ${path}`;
  if (needNorobot) commitMessage += ", add norobot.js";
  commitMessage += " and update index.html";
  const { data: newCommit } = await octokit.git.createCommit({
    owner,
    repo,
    message: commitMessage,
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
