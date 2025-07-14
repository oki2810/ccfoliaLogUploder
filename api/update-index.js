import fs from 'fs';
import * as path from 'path';
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

  const { owner, repo, items, deletePaths = [] } = req.body || {};
  if (!owner || !repo || !Array.isArray(items)) {
    return res.status(400).json({ ok: false, error: 'Invalid payload' });
  }

  const octokit = new Octokit({ auth: token });

  const idx = await octokit.repos.getContent({ owner, repo, path: 'index.html' });
  let html = Buffer.from(idx.data.content, 'base64').toString('utf8');

  const listHtml = items
    .map(i => `<li class="list-group-item"><span class="text-muted">${i.scenarioName}</span><a href="${i.path}" class="ms-2">${i.linkText}</a><button class="btn btn-sm btn-danger ms-2 delete-btn">削除</button></li>`)
    .join('\n');

  if (html.match(/<ul[^>]+id="(?:generatedList|log-list)"/)) {
    html = html.replace(/(<ul[^>]+id="(?:generatedList|log-list)"[^>]*>)[\s\S]*?(?=<\/ul>)/, `$1\n${listHtml}`);
  }

  const { data: indexBlob } = await octokit.git.createBlob({
    owner,
    repo,
    content: Buffer.from(html, 'utf8').toString('base64'),
    encoding: 'base64',
  });

  const { data: repoInfo } = await octokit.repos.get({ owner, repo });
  const branch = repoInfo.default_branch;
  const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
  const baseCommitSha = refData.object.sha;
  const { data: baseCommit } = await octokit.git.getCommit({ owner, repo, commit_sha: baseCommitSha });

  const treeItems = [{ path: 'index.html', mode: '100644', type: 'blob', sha: indexBlob.sha }];
  for (const p of deletePaths) {
    treeItems.push({ path: p, mode: '100644', type: 'blob', sha: null });
  }

  const { data: newTree } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: baseCommit.tree.sha,
    tree: treeItems,
  });

  const message = `Update index.html${deletePaths.length ? ' and delete logs' : ''}`;
  const { data: newCommit } = await octokit.git.createCommit({
    owner,
    repo,
    message,
    tree: newTree.sha,
    parents: [baseCommitSha],
  });

  await octokit.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: newCommit.sha });

  res.json({ ok: true });
}
