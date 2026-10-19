// Posts one GitHub commit status per audited page, linking back to this run's summary.
// Statuses show next to the commit and on any PR whose head is that commit.
// Needs GITHUB_TOKEN with `statuses: write`; outside GitHub Actions it only prints what it would post.
const { loadResults, loadFailedAssertions } = require('./results.cjs');

const { GITHUB_ACTIONS, GITHUB_TOKEN, GITHUB_API_URL, GITHUB_REPOSITORY, GITHUB_SHA, GITHUB_SERVER_URL, GITHUB_RUN_ID } = process.env;
const label = process.env.LHCI_LABEL || 'local';

const SHORT_NAMES = { performance: 'Perf', accessibility: 'A11y', 'best-practices': 'BP', seo: 'SEO' };

async function postStatus(status) {
  if (!GITHUB_ACTIONS || !GITHUB_TOKEN) return console.log(JSON.stringify(status));

  const res = await fetch(`${GITHUB_API_URL}/repos/${GITHUB_REPOSITORY}/statuses/${GITHUB_SHA}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
    body: JSON.stringify(status),
  });
  if (!res.ok) throw new Error(`GitHub status for ${status.context} failed: ${res.status} ${await res.text()}`);
}

async function main() {
  const pages = loadResults();
  if (!pages) return console.log('No Lighthouse results, skipping status checks.');

  const failed = loadFailedAssertions();
  const targetUrl = GITHUB_RUN_ID && `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;

  for (const [pathname, lhr] of pages) {
    const scores = Object.entries(SHORT_NAMES)
      .map(([id, name]) => `${name} ${Math.round((lhr.categories[id]?.score ?? 0) * 100)}`)
      .join(' · ');
    const errors = (failed.get(pathname) ?? []).filter((r) => r.level === 'error');
    await postStatus({
      state: errors.length ? 'failure' : 'success',
      context: `lighthouse (${label}) ${pathname}`,
      description: errors.length ? `${errors.length} failed: ${scores}` : scores,
      target_url: targetUrl,
    });
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
