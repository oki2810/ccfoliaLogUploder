import rawBody from 'raw-body';
import { createHmac, timingSafeEqual } from 'crypto';
import { Octokit } from '@octokit/rest';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const buf = await rawBody(req);
  const sig = req.headers['x-hub-signature-256'] || '';

  // 署名検証
  const hmac = createHmac('sha256', process.env.WEBHOOK_SECRET);
  hmac.update(buf);
  const digest = 'sha256=' + hmac.digest('hex');
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(digest))) {
    return res.status(401).send('Invalid signature');
  }

  const event = req.headers['x-github-event'];
  if (event === 'push') {
    const payload = JSON.parse(buf.toString());
    // TODO: push イベントの payload を解析し、logs/ 以下の HTML 追加を検知
    // その後、Octokit で index.html を再生成してコミットする処理を呼び出す
  }

  res.status(200).send('OK');
}
