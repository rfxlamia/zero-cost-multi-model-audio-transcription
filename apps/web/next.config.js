/** @type {import('next').NextConfig} */
const nextConfig = {
  // React strict mode for better development
  reactStrictMode: true,

  // SWC minify for better performance
  swcMinify: true,

  // Remove powered by header
  poweredByHeader: false,

  // Environment variables
  env: {
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE,
    NEXT_PUBLIC_ENV: process.env.NEXT_PUBLIC_ENV,
    NEXT_PUBLIC_ENABLE_TRANSFORMERS: process.env.NEXT_PUBLIC_ENABLE_TRANSFORMERS,
  },

  // Basic security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "media-src 'self' blob:",
              "connect-src 'self' http://localhost:8787 https://*.workers.dev",
              "worker-src 'self' blob:",
            ].join('; '),
          },
        ],
      },
    ]
  },

  // API proxy in development
  async rewrites() {
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/:path*',
          destination: `${process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8787'}/api/:path*`,
        },
      ]
    }
    return []
  },

  // TypeScript and ESLint
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
}

module.exports = nextConfig
