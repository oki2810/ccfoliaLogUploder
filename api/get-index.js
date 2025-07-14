import { Octokit } from '@octokit/rest';
import applyCors from '../lib/cors.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const cookies = Object.fromEntries((req.headers.cookie || '').split('; ').map(c => c.split('=')));
  const token = cookies.access_token;
  if (!token) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const { owner, repo } = req.body || {};
  if (!owner || !repo) {
    return res.status(400).json({ ok: false, error: 'Missing owner or repo' });
  }

  const octokit = new Octokit({ auth: token });
  try {
    const idx = await octokit.repos.getContent({ owner, repo, path: 'index.html' });
    const html = Buffer.from(idx.data.content, 'base64').toString('utf8');

    const items = [];
    const regex = /<li[^>]*>\s*<span[^>]*>([^<]*)<\/span>\s*<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
    let m;
    while ((m = regex.exec(html))) {
      items.push({
        scenarioName: m[1],
        path: m[2],
        linkText: m[3]
      });
    }

    res.json({ ok: true, items });
  } catch (err) {
    console.error('get-index error:', err);
    res.status(err.status || 500).json({ ok: false, error: err.message });
  }
}
