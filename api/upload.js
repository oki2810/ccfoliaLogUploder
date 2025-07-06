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
  linkText: Joi.string().max(100).required()
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

  const { owner, repo, path, linkText } = await schema.validateAsync(req.body);
  const octokit = new Octokit({ auth: token });

  // 1) 新規ログを追加
  const fileB64 = req.file.buffer.toString("base64");
  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message: `Add ${path}`,
    content: fileB64
  });

  // 2) index.html を取得（空ならテンプレートで置き換え）
  const idx = await octokit.repos.getContent({ owner, repo, path: "index.html" });
  let sha  = idx.data.sha;
  let html = Buffer.from(idx.data.content, "base64").toString("utf8");
  if (!html.trim()) {
    html = DEFAULT_INDEX;
  }

  const newItem = `<li class="list-group-item"><a href="${path}">${linkText}</a></li>`;
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

  // 3) index.html コミット
  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: "index.html",
    message: sha ? `Update index.html` : `Add index.html`,
    content: Buffer.from(html, "utf8").toString("base64"),
    ...(sha ? { sha } : {})
  });

  // norobot.js が無ければ追加
  let needNorobot = false;
  try {
    await octokit.repos.getContent({ owner, repo, path: "norobot.js" });
  } catch (err) {
    if (err.status === 404) needNorobot = true; else throw err;
  }

  if (needNorobot) {
    const scriptPath = nodePath.join(process.cwd(), "public", "norobot.js");
    const scriptB64 = fs.readFileSync(scriptPath).toString("base64");
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: "norobot.js",
      message: "Add norobot.js",
      content: scriptB64
    });
  }

  res.json({ ok: true });
}
