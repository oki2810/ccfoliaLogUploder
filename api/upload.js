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

// テンプレートHTML（CCU_template と同じ構造）
// UL の id を "log-list" に変更してあります
const DEFAULT_INDEX = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>アップロード済みログ</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet" />
</head>
<body>
  <div class="container py-5">
    <h1 class="mb-4">アップロード済みログ</h1>
    <ul id="log-list" class="list-group"></ul>
  </div>
  <script src="norobot.js"></script>
</body>
</html>`;

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  // 認証トークン取得
  const cookies = Object.fromEntries(
    (req.headers.cookie || "").split("; ").map(c => c.split("="))
  );
  const token = cookies.access_token;
  if (!token) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  // マルチパート解析
  await new Promise((ok, ng) => {
    upload.single("htmlFile")(req, res, err => (err ? ng(err) : ok()));
  });
  if (!req.file) {
    return res.status(400).json({ ok: false, error: "No file" });
  }

  // パラメータ検証
  const { owner, repo, path, linkText, scenarioName } = req.body;
  const { error } = schema.validate({ owner, repo, path, linkText, scenarioName });
  if (error) {
    return res.status(400).json({ ok: false, error: error.message });
  }

  const octokit = new Octokit({ auth: token });

  try {
    // 1) 新規ログファイルを Blob 化
    const fileB64 = req.file.buffer.toString("base64");
    const { data: logBlob } = await octokit.git.createBlob({
      owner,
      repo,
      content: fileB64,
      encoding: "base64",
    });

    // 2) index.html を取得 → 空ならテンプレートを使う
    let html;
    let idx;
    try {
      idx = await octokit.repos.getContent({ owner, repo, path: "index.html" });
      html = Buffer.from(idx.data.con
