// Lighthouse CI config. Run with `npm run lighthouse`.
// LHCI_THEME_ID selects a preview theme; leave it unset to audit the live theme.
const STORE = 'https://test-lighthouse-heattaoe.myshopify.com';
const PATHS = [
  '/',
  '/collections/frontpage',
  '/products/the-collection-snowboard-liquid',
];

const themeId = process.env.LHCI_THEME_ID;
// pb=0 hides the Shopify preview bar so it doesn't skew the scores.
const query = themeId ? `?preview_theme_id=${themeId}&pb=0` : '';

module.exports = {
  ci: {
    collect: {
      url: PATHS.map((path) => `${STORE}${path}${query}`),
      numberOfRuns: 3,
      puppeteerScript: '.lighthouse/login.cjs',
      puppeteerLaunchOptions: { args: ['--no-sandbox'] },
      settings: { disableStorageReset: true },
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.5 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.9 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: '.lighthouseci/reports',
    },
  },
};
