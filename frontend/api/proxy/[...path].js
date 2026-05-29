// Vercel Serverless Function — proxies /api/* → Railway
// Avoids CORS issues since requests come from same origin (Vercel domain).

const BACKEND_URL = process.env.VITE_API_URL || 'https://iotech-production.up.railway.app';

module.exports = async function handler(req, res) {
  const path = req.query.path || '';
  const targetPath = Array.isArray(path) ? path.join('/') : path;
  const target = `${BACKEND_URL}/api/${targetPath}`;

  try {
    const fetchRes = await fetch(target, {
      method: req.method,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
        ...(req.headers.cookie ? { Cookie: req.headers.cookie } : {}),
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    const data = await fetchRes.json();

    const setCookie = fetchRes.headers.get('set-cookie');
    if (setCookie) {
      res.setHeader('Set-Cookie', setCookie);
    }

    res.status(fetchRes.status).json(data);
  } catch (err) {
    res.status(502).json({ error: { code: 'PROXY_ERROR', message: 'Backend unreachable', status: 502 } });
  }
};
