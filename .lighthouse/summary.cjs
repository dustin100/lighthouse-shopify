// Prints the representative Lighthouse scores as a Markdown table (for $GITHUB_STEP_SUMMARY).
const manifest = require('../.lighthouseci/reports/manifest.json');

const pct = (n) => (n == null ? '–' : Math.round(n * 100));
const rows = manifest
  .filter((run) => run.isRepresentativeRun)
  .map(({ url, summary: s }) => {
    const { pathname } = new URL(url);
    return `| ${pathname} | ${pct(s.performance)} | ${pct(s.accessibility)} | ${pct(s['best-practices'])} | ${pct(s.seo)} |`;
  });

console.log(`### Lighthouse (${process.env.LHCI_LABEL || 'local'})

| Page | Performance | Accessibility | Best practices | SEO |
| --- | --- | --- | --- | --- |
${rows.join('\n')}`);
