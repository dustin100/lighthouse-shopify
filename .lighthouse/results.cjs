// Shared helpers for reading Lighthouse CI output (used by summary.cjs and status.cjs).
const fs = require('fs');
const path = require('path');

const LHCI_DIR = path.join(__dirname, '../.lighthouseci');

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

// Representative Lighthouse result per page, keyed by pathname.
// Returns null when the directory has no manifest (e.g. Lighthouse never ran).
function loadResults(dir = path.join(LHCI_DIR, 'reports')) {
  const manifestPath = path.join(dir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return null;

  const pages = new Map();
  for (const run of readJson(manifestPath).filter((r) => r.isRepresentativeRun)) {
    // jsonPath is absolute on the machine that ran Lighthouse, so resolve it inside `dir`.
    const lhr = readJson(path.join(dir, path.basename(run.jsonPath)));
    pages.set(new URL(run.url).pathname, lhr);
  }
  return pages;
}

// Failed assertions grouped by pathname, as Map<pathname, Array<{level, auditId}>>.
function loadFailedAssertions() {
  const file = path.join(LHCI_DIR, 'assertion-results.json');
  const failed = new Map();
  if (!fs.existsSync(file)) return failed;

  for (const result of readJson(file).filter((r) => !r.passed)) {
    const { pathname } = new URL(result.url);
    if (!failed.has(pathname)) failed.set(pathname, []);
    failed.get(pathname).push(result);
  }
  return failed;
}

module.exports = { loadResults, loadFailedAssertions };
