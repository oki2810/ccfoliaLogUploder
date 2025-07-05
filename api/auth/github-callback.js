import axios from 'axios';

export default async function handler(req, res) {
  const { code, state } = req.query;
  // TODO: state の検証を実装
  const tokenRes = await axios.post(
    'https://github.com/login/oauth/access_token',
    {
      client_id: process.env.GH_CLIENT_ID,
      client_secret: process.env.GH_CLIENT_SECRET,
      code,
    },
    { headers: { Accept: 'application/json' } }
  );
  const accessToken = tokenRes.data.access_token;
  // HTTP-only Cookie に保存
  res.setHeader('Set-Cookie', `accessToken=${accessToken}; HttpOnly; Path=/; SameSite=Lax`);
  res.redirect('/');
}
