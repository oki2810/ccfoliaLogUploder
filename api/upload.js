import multer from "multer";
import { Octokit } from "@octokit/rest";
import Joi from "joi";

const upload = multer({ limits: { fileSize: 2 * 1024 * 1024 } });
const schema = Joi.object({
  owner: Joi.string().required(),
  repo: Joi.string().required(),
  path: Joi.string().pattern(/^logs\/.+\.html$/).required(),
  linkText: Joi.string().max(100).required()
});

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  // CSRF は Vercel Functions では自前実装になるので省略
  const cookies = Object.fromEntries(
    (req.headers.cookie || "").split("; ").map(c => c.split("="))
  );
  const token = cookies.accessToken;
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

  // 2) index.html を取得してリンク追加
  const idx = await octokit.repos.getContent({ owner, repo, path: "index.html" });
  const sha = idx.data.sha;
  let html = Buffer.from(idx.data.content, "base64").toString("utf8");

  const newItem = `<li><a href="${path}">${linkText}</a></li>`;
  if (html.match(/<ul[^>]+id="generatedList"/)) {
    html = html.replace(
      /(<ul[^>]+id="generatedList"[^>]*>)/,
      `$1\n  ${newItem}`
    );
  } else {
    html = html.replace(
      /<\/body>/i,
      `  <ul id="generatedList">\n    ${newItem}\n  </ul>\n</body>`
    );
  }

  // 3) 更新コミット
  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: "index.html",
    message: `Update index.html`,
    content: Buffer.from(html, "utf8").toString("base64"),
    sha
  });

  res.json({ ok: true });
}
