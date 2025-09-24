/**
 * Lighthouse CI configuration for the Next.js web app.
 */
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'pnpm -F @transcriptorai/web start --hostname 127.0.0.1 --port 3310',
      startServerReadyPattern: 'started server on',
      startServerReadyTimeout: 120000,
      url: ['http://127.0.0.1:3310/'],
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        formFactor: 'desktop',
        screenEmulation: {
          mobile: false,
          width: 1365,
          height: 1024,
          deviceScaleFactor: 1,
          disabled: false,
        },
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        'categories:performance': ['warn', { minScore: 0.85 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
      },
    },
  },
}
