import crypto from 'crypto';

export default function handler(req, res) {
  const state = crypto.randomBytes(8).toString('hex');
  // TODO: stateはストレージやCookieに一時保存して検証
  const params = new URLSearchParams({
    client_id: process.env.GH_CLIENT_ID,
    scope: 'repo',
    state,
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
}
