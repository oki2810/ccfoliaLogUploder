import nextConnect from 'next-connect';
import multer from 'multer';
import { Octokit } from '@octokit/rest';
import Joi from 'joi';

// multer 設定: 最大ファイルサイズ 2MB
const upload = multer({ limits: { fileSize: 2 * 1024 * 1024 } });

// 入力バリデーション
const schema = Joi.object({
  owner: Joi.string().alphanum().required(),
  repo: Joi.string().alphanum().required(),
  path: Joi.string().pattern(/^logs\/[a-zA-Z0-9-_]+\.html$/).required(),
});

export const config = { api: { bodyParser: false } };

const handler = nextConnect();
handler.use(upload.single('htmlFile'));

handler.post(async (req, res) => {
  // 認証確認
  const token = req.cookies && req.cookies.accessToken;
  if (!token) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  // フィールド検証
  const { owner, repo, path } = await schema.validateAsync(req.body);
  if (!req.file) return res.status(400).json({ ok: false, error: 'No file uploaded' });

  // Base64 エンコード
  const content = req.file.buffer.toString('base64');
  const octokit = new Octokit({ auth: token });

  // ファイルをコミット
  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message: `Add ${path} via web`,
    content,
  });

  res.json({ ok: true });
});

export default handler;
