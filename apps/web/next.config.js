const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // React strict mode for better development
  reactStrictMode: true,

  // Remove powered by header
  poweredByHeader: false,

  // Ensure Next traces files from the monorepo root to avoid lockfile warnings
  outputFileTracingRoot: path.join(__dirname, '../../'),

  // Environment variables
  env: {
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE,
    NEXT_PUBLIC_ENV: process.env.NEXT_PUBLIC_ENV,
    NEXT_PUBLIC_ENABLE_TRANSFORMERS: process.env.NEXT_PUBLIC_ENABLE_TRANSFORMERS,
    NEXT_PUBLIC_TURNSTILE_SITEKEY: process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY,
  },

  // Basic security headers
  async headers() {
    const connectSources = [
      "'self'",
      'http://localhost:8787',
      'https://*.workers.dev',
      'https://cdn.jsdelivr.net',
      'https://challenges.cloudflare.com',
      'https://huggingface.co',
      'https://*.huggingface.co',
      'https://*.hf.co',
      'https://cas-bridge.xethub.hf.co',
      'https://cdn-lfs.huggingface.co',
    ]
    const apiBase = process.env.NEXT_PUBLIC_API_BASE
    if (apiBase && !connectSources.includes(apiBase)) {
      connectSources.push(apiBase)
    }
    const scriptSources = [
      "'self'",
      "'unsafe-inline'",
      "'unsafe-eval'",
      "'wasm-unsafe-eval'",
      'https://cdn.jsdelivr.net',
      'https://challenges.cloudflare.com',
    ]
    const styleSources = ["'self'", "'unsafe-inline'"]
    const frameSources = ["'self'", 'https://challenges.cloudflare.com']
    if (process.env.NODE_ENV !== 'production') {
      scriptSources.push("'unsafe-eval'")
    }
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
              `script-src ${scriptSources.join(' ')}`,
              `style-src ${styleSources.join(' ')}`,
              `frame-src ${frameSources.join(' ')}`,
              "img-src 'self' data: https: blob:",
              "media-src 'self' blob:",
              `connect-src ${connectSources.join(' ')}`,
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
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
