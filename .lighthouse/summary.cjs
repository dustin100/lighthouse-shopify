// Prints the representative Lighthouse results as Markdown (for $GITHUB_STEP_SUMMARY).
// When LHCI_BASELINE_DIR points at a previous run's reports, each value shows the change since then.
const { loadResults } = require('./results.cjs');

const CATEGORIES = [
  ['performance', 'Performance'],
  ['accessibility', 'Accessibility'],
  ['best-practices', 'Best practices'],
  ['seo', 'SEO'],
];
const METRICS = [
  ['largest-contentful-paint', 'LCP'],
  ['cumulative-layout-shift', 'CLS'],
  ['total-blocking-time', 'TBT'],
  ['first-contentful-paint', 'FCP'],
  ['speed-index', 'Speed Index'],
];

// Lighthouse's own colour bands: 90+ good, 50–89 needs improvement, below 50 poor.
const dot = (score) => (score == null ? '⚪' : score >= 0.9 ? '🟢' : score >= 0.5 ? '🟠' : '🔴');
const signed = (n, text) => `${n > 0 ? '+' : '−'}${text}`;

const formatMetric = (value, unit) => {
  const abs = Math.abs(value);
  if (unit === 'unitless') return String(Number(abs.toFixed(3)));
  return abs >= 1000 ? `${(abs / 1000).toFixed(1)} s` : `${Math.round(abs)} ms`;
};

function scoreCell(lhr, baseline, id) {
  const score = lhr.categories[id]?.score;
  if (score == null) return '⚪ –';
  const value = Math.round(score * 100);
  const before = baseline?.categories[id]?.score;
  const delta = before == null ? 0 : value - Math.round(before * 100);
  return `${dot(score)} ${value}${delta ? ` (${signed(delta, Math.abs(delta))})` : ''}`;
}

function metricCell(lhr, baseline, id) {
  const audit = lhr.audits[id];
  if (audit?.numericValue == null) return '–';
  const value = formatMetric(audit.numericValue, audit.numericUnit);
  const before = baseline?.audits[id]?.numericValue;
  if (before == null) return `${dot(audit.score)} ${value}`;
  const delta = audit.numericValue - before;
  const deltaText = formatMetric(delta, audit.numericUnit);
  // Skip changes that round to zero, e.g. "+0 ms".
  const changed = !/^0(\.0)?( m?s)?$/.test(deltaText);
  return `${dot(audit.score)} ${value}${changed ? ` (${signed(delta, deltaText)})` : ''}`;
}

const table = (headers, rows) =>
  [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');

const label = process.env.LHCI_LABEL || 'local';
const pages = loadResults();

if (!pages) {
  console.log(`### Lighthouse (${label})\n\nNo Lighthouse results were produced. Check the **Run Lighthouse CI** step log.`);
  process.exit(0);
}

const baselinePages = process.env.LHCI_BASELINE_DIR ? loadResults(process.env.LHCI_BASELINE_DIR) : null;
const baselineUrl = process.env.LHCI_BASELINE_URL;
const formFactor = pages.values().next().value?.configSettings.formFactor ?? 'mobile';

const comparedWith = baselinePages
  ? `Changes are compared with the ${baselineUrl ? `[previous successful run](${baselineUrl})` : 'previous successful run'}.`
  : 'No previous run to compare with.';

const rows = (columns, cell) =>
  [...pages].map(([pathname, lhr]) => [
    `\`${pathname}\``,
    ...columns.map(([id]) => cell(lhr, baselinePages?.get(pathname), id)),
  ]);

console.log(`### Lighthouse (${label}, ${formFactor})

${comparedWith}

#### Scores

${table(['Page', ...CATEGORIES.map(([, name]) => name)], rows(CATEGORIES, scoreCell))}

#### Metrics

${table(['Page', ...METRICS.map(([, name]) => name)], rows(METRICS, metricCell))}

🟢 good · 🟠 needs improvement · 🔴 poor. For metrics, a minus means faster (better). Full HTML reports are in the **Artifacts** section of this run.`);
