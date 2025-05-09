/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api-proxy/:path*',
        destination: 'http://localhost:4203/:path*', // Proxy to your IIH API
      },
    ]
  },
};

module.exports = nextConfig; 