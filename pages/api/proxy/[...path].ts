import { createProxyMiddleware } from 'http-proxy-middleware';

export const config = { api: { bodyParser: false } };

const API_TARGET = process.env.ANCHOR_API_URL || 'http://localhost:4203/DataService/anchor/v1';

export default createProxyMiddleware({
  target: API_TARGET,
  changeOrigin: true,
  pathRewrite: { '^/api/proxy': '' },
  onProxyReq: (proxyReq, req, res) => {
    // Forward Authorization header if present
    if (req.headers.authorization) {
      proxyReq.setHeader('authorization', req.headers.authorization);
    }
  }
}); 