import fs from "fs";
import * as nodePath from "path";
import applyCors from "../lib/cors.js";
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

function loadDefaultIndex() {
  const p = nodePath.join(process.cwd(), "templates", "index.html");
  return fs.readFileSync(p, "utf8");
}

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
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
    html = loadDefaultIndex();
  }
} catch (err) {
  if (err.status === 404) {
    // ファイル自体がないときはテンプレートをまるっと流用
    html = loadDefaultIndex();
  } else {
    throw err;
  }
}

  const newItem = `<li class="list-group-item"><span class="text-muted">${scenarioName}</span><a href="${path}" class="ms-2">${linkText}</a><button class="btn btn-sm btn-danger ms-2 delete-btn">削除</button></li>`;
  if (html.match(/<ul[^>]+id="(?:generatedList|log-list)"/)) {
    html = html.replace(
      /(<ul[^>]+id="(?:generatedList|log-list)"[^>]*>)/,
      `$1\n  ${newItem}`
    );
  } else {
    html = html.replace(
      /<\/body>/i,
      `  <ul id="log-list" class="list-group">\n    ${newItem}\n  </ul>\n</body>`
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
