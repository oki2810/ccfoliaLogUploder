// ccfoliaLogUploader/pages/api/reorder-logs.js
import { Octokit } from '@octokit/rest';

export default async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  // Cookie からトークン取得
  const cookies = Object.fromEntries(
    (req.headers.cookie || '').split('; ').map(c => c.split('='))
  );
  const token = cookies.access_token;
  if (!token) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const { owner, repo, order } = req.body || {};
  if (!owner || !repo || !Array.isArray(order))
    return res.status(400).json({ ok: false, error: 'Missing parameters' });

  const octokit = new Octokit({ auth: token });

  try {
    // 1) index.html を取得
    const idx = await octokit.repos.getContent({ owner, repo, path: 'index.html' });
    const sha = idx.data.sha;
    let html = Buffer.from(idx.data.content, 'base64').toString('utf8');

    // 2) すべての <li> ブロックを抽出し、data-path 毎にマップ化
    const liMatches = [...html.matchAll(/<li[\s\S]*?<\/li>/g)];
    const liMap = {};
    liMatches.forEach(m => {
      const block = m[0];
      const dm = block.match(/data-path="([^"]+)"/);
      if (dm) liMap[dm[1]] = block;
    });

    // 3) 新しい並び順で innerHTML を組み直し
    const newInner = order.map(p => liMap[p] || '').join('\n');

    // 4) <ul id="log-list">…</ul> の中身を差し替え
    html = html.replace(
      /<ul[^>]*id=["']log-list["'][^>]*>[\s\S]*?<\/ul>/,
      match => match.replace(
        />[\s\S]*(?=<\/ul>)/,
        '>\n' + newInner + '\n'
      )
    );

    // 5) GitHub に再コミット
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: 'index.html',
      message: 'Reorder logs via drag-and-drop',
      content: Buffer.from(html, 'utf8').toString('base64'),
      sha
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
