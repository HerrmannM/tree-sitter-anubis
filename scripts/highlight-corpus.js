#!/usr/bin/env node
// Show every corpus test input with syntax colours (no trees).
//
//   node scripts/highlight-corpus.js                 all tests
//   node scripts/highlight-corpus.js var             tests whose file or name matches /var/i
//   node scripts/highlight-corpus.js var -- --grammar-path .   extra args for `tree-sitter highlight`
//
// Pipe through `less -R` for long output. Tests whose input has ERROR or
// MISSING nodes get a warning in their header.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const argv = process.argv.slice(2);
const dd = argv.indexOf('--');
const own = dd >= 0 ? argv.slice(0, dd) : argv;
const tsArgs = dd >= 0 ? argv.slice(dd + 1) : [];
const filter = own[0] ? new RegExp(own[0], 'i') : null;

const CORPUS = 'test/corpus';
const HEADER = /^={3,}\S*\s*$/;
const DIVIDER = /^-{3,}\S*\s*$/;

function corpusFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.name.startsWith('.')) return [];
    return e.isDirectory() ? corpusFiles(p) : [p];
  }).sort();
}

// Returns [{ name, input }] for one corpus file.
function parseCorpus(text) {
  const lines = text.split('\n');
  const tests = [];
  let i = 0;
  while (i < lines.length) {
    if (!HEADER.test(lines[i])) { i++; continue; }
    i++;
    const head = [];
    while (i < lines.length && !HEADER.test(lines[i])) head.push(lines[i++]);
    i++; // closing ===
    const input = [];
    while (i < lines.length && !DIVIDER.test(lines[i])) input.push(lines[i++]);
    while (i < lines.length && !HEADER.test(lines[i])) i++; // skip expected tree
    tests.push({ name: head[0] || '(unnamed)', input: input.join('\n').replace(/\n+$/, '') + '\n' });
  }
  return tests;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'anubis-corpus-'));
const file = path.join(tmp, 'case.anubis');
const bold = s => `\x1b[1;36m${s}\x1b[0m`;
const warn = s => `\x1b[1;31m${s}\x1b[0m`;
let shown = 0;

try {
  for (const f of corpusFiles(CORPUS)) {
    for (const t of parseCorpus(fs.readFileSync(f, 'utf8'))) {
      const label = `${path.relative(CORPUS, f)} › ${t.name}`;
      if (filter && !filter.test(label)) continue;
      fs.writeFileSync(file, t.input);

      const check = spawnSync('tree-sitter', ['parse', '--quiet', ...tsArgs, file], { encoding: 'utf8' });
      const broken = check.status !== 0;

      console.log('\n' + bold(`── ${label} `.padEnd(78, '─')) + (broken ? '  ' + warn('⚠ parse errors') : ''));
      const r = spawnSync('tree-sitter', ['highlight', ...tsArgs, file], { stdio: 'inherit' });
      if (r.error) { console.error(r.error.message); process.exit(1); }
      shown++;
    }
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(`\n${shown} test(s) shown.`);
if (shown === 0) {
  const files = fs.existsSync(CORPUS) ? corpusFiles(CORPUS) : [];
  console.log(files.length
    ? `Scanned ${files.length} file(s) in ${CORPUS}, but found no test headers (or none matched the filter).`
    : `No files found in ${path.resolve(CORPUS)}.`);
}
