// Prints the representative Lighthouse results as Markdown (for $GITHUB_STEP_SUMMARY).
// When LHCI_BASELINE_DIR points at a previous run's reports, the summary lists what changed since then
// and the tables mark meaningful changes. LHCI_BASELINE_{URL,SHA,TITLE,DATE} describe that run.
const { loadResults } = require('./results.cjs');

// Changes smaller than these are run-to-run noise, not real regressions or improvements.
const NOISE = { score: 3, ms: 100, unitless: 0.01 };

const CATEGORIES = [
  ['performance', 'Performance'],
  ['accessibility', 'Accessibility'],
  ['best-practices', 'Best practices'],
  ['seo', 'SEO'],
].map(([id, name]) => ({
  name,
  unit: 'score',
  higherIsBetter: true,
  read: (lhr) => {
    const score = lhr?.categories[id]?.score;
    return score == null ? null : { value: Math.round(score * 100), score };
  },
}));

const METRICS = [
  ['largest-contentful-paint', 'LCP', 'ms'],
  ['cumulative-layout-shift', 'CLS', 'unitless'],
  ['total-blocking-time', 'TBT', 'ms'],
  ['first-contentful-paint', 'FCP', 'ms'],
  ['speed-index', 'Speed Index', 'ms'],
].map(([id, name, unit]) => ({
  name,
  unit,
  higherIsBetter: false,
  read: (lhr) => {
    const audit = lhr?.audits[id];
    return audit?.numericValue == null ? null : { value: audit.numericValue, score: audit.score };
  },
}));

// Lighthouse's own colour bands: 90+ good, 50–89 needs improvement, below 50 poor.
const dot = (score) => (score == null ? '⚪' : score >= 0.9 ? '🟢' : score >= 0.5 ? '🟠' : '🔴');

function format(value, unit) {
  const abs = Math.abs(value);
  if (unit === 'score') return String(abs);
  if (unit === 'unitless') return String(Number(abs.toFixed(3)));
  return abs >= 1000 ? `${(abs / 1000).toFixed(1)} s` : `${Math.round(abs)} ms`;
}
const formatDelta = (delta, unit) => `${delta > 0 ? '+' : '−'}${format(delta, unit)}`;

function compare(column, lhr, baselineLhr) {
  const after = column.read(lhr);
  const before = column.read(baselineLhr);
  if (!after || !before) return { after, before };
  const delta = after.value - before.value;
  return {
    after,
    before,
    delta,
    significant: Math.abs(delta) >= NOISE[column.unit],
    improved: column.higherIsBetter ? delta > 0 : delta < 0,
  };
}

// Current value only; the change is shown just when it's meaningful (details are in "What changed").
function cell(column, { after, delta, significant }) {
  if (!after) return '–';
  const now = `${dot(after.score)} ${format(after.value, column.unit)}`;
  return significant ? `${now} (${formatDelta(delta, column.unit)})` : now;
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
const formFactor = pages.values().next().value?.configSettings.formFactor ?? 'mobile';

function comparedWith() {
  if (!baselinePages) return 'No previous run to compare with, so this run is the starting point.';

  const { LHCI_BASELINE_URL, LHCI_BASELINE_SHA, LHCI_BASELINE_TITLE, LHCI_BASELINE_DATE } = process.env;
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_SHA } = process.env;
  const repoUrl = `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}`;

  const parts = [];
  if (LHCI_BASELINE_SHA) parts.push(`[\`${LHCI_BASELINE_SHA.slice(0, 7)}\`](${repoUrl}/commit/${LHCI_BASELINE_SHA})`);
  if (LHCI_BASELINE_TITLE) parts.push(`“${LHCI_BASELINE_TITLE}”`);
  if (LHCI_BASELINE_DATE) {
    const date = new Date(LHCI_BASELINE_DATE).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC',
    });
    parts.push(`(${date} UTC)`);
  }

  const links = [];
  if (LHCI_BASELINE_URL) links.push(`[previous run](${LHCI_BASELINE_URL})`);
  if (LHCI_BASELINE_SHA && GITHUB_SHA && LHCI_BASELINE_SHA !== GITHUB_SHA) {
    links.push(`[code changes since then](${repoUrl}/compare/${LHCI_BASELINE_SHA}...${GITHUB_SHA})`);
  }

  const what = parts.length ? parts.join(' ') : 'the previous successful run';
  return `Compared with ${what}${links.length ? ` · ${links.join(' · ')}` : ''}`;
}

function whatChanged() {
  if (!baselinePages) return '';

  const changes = [];
  for (const [pathname, lhr] of pages) {
    for (const column of [...CATEGORIES, ...METRICS]) {
      const c = compare(column, lhr, baselinePages.get(pathname));
      if (!c.significant) continue;
      const before = format(c.before.value, column.unit);
      const after = format(c.after.value, column.unit);
      changes.push({
        improved: c.improved,
        line: `- ${c.improved ? '✅' : '⚠️'} \`${pathname}\` **${column.name}**: ${before} → ${after} (${formatDelta(c.delta, column.unit)})`,
      });
    }
  }

  const noise = `changes under ${NOISE.score} points or ${NOISE.ms} ms are treated as normal run-to-run variation`;
  if (!changes.length) return `#### What changed\n\n✅ No meaningful changes (${noise}).\n\n`;

  // Regressions first.
  changes.sort((a, b) => a.improved - b.improved);
  return `#### What changed\n\n${changes.map((c) => c.line).join('\n')}\n\n<sub>Only meaningful changes are listed; ${noise}.</sub>\n\n`;
}

const rows = (columns) =>
  [...pages].map(([pathname, lhr]) => [
    `\`${pathname}\``,
    ...columns.map((column) => cell(column, compare(column, lhr, baselinePages?.get(pathname)))),
  ]);

console.log(`### Lighthouse (${label}, ${formFactor})

${comparedWith()}

${whatChanged()}#### Scores

${table(['Page', ...CATEGORIES.map((c) => c.name)], rows(CATEGORIES))}

#### Metrics

${table(['Page', ...METRICS.map((c) => c.name)], rows(METRICS))}

🟢 good · 🟠 needs improvement · 🔴 poor${baselinePages ? ' · (±n) = meaningful change since the compared run' : ''}. Full HTML reports are in the **Artifacts** section of this run.`);
