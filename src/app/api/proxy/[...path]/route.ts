import { NextRequest } from 'next/server';

const API_TARGET = process.env.ANCHOR_API_URL || 'http://localhost:4203/DataService/anchor/v1';

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(req, params);
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(req, params);
}

export async function PUT(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(req, params);
}

export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(req, params);
}

async function proxyRequest(req: NextRequest, params: { path: string[] }) {
  const path = params.path.join('/');
  // Utilise la query string brute pour préserver le +
  const url = new URL(req.url || '', 'http://localhost');
  const search = url.search || '';
  const targetUrl = `${API_TARGET}/${path}${search}`;
  console.log('Proxying to:', targetUrl);

  // Forward uniquement les headers essentiels
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if ([
      'authorization',
      'accept',
      'content-type',
    ].includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  // Préparer l'init de la requête
  const init: RequestInit = {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req.body,
    // mode: 'cors' // inutile côté serveur
  };

  // Forward la requête
  const response = await fetch(targetUrl, init);

  // Forward la réponse telle quelle
  const resHeaders = new Headers();
  response.headers.forEach((value, key) => {
    resHeaders.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: resHeaders,
  });
} 