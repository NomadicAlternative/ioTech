// Vercel Serverless Function — proxies /api/* → Railway
// Avoids CORS issues since requests come from same origin (Vercel domain).
// Must be placed at frontend/api/proxy/[...path].js

export default async function handler(req, res) {
  const { path } = req.query;
  const targetPath = Array.isArray(path) ? path.join('/') : path || '';

  const backendUrl = process.env.VITE_API_URL || 'https://iotech-production.up.railway.app';
  const target = `${backendUrl}/api/${targetPath}`;

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

    // Forward cookies from backend (refresh token)
    const setCookie = fetchRes.headers.get('set-cookie');
    if (setCookie) {
      res.setHeader('Set-Cookie', setCookie);
    }

    res.status(fetchRes.status).json(data);
  } catch (err) {
    res.status(502).json({ error: { code: 'PROXY_ERROR', message: 'Backend unreachable', status: 502 } });
  }
}
