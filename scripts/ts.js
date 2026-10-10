#!/usr/bin/env node
// Development commands for all the grammars of this repository (listed in
// tree-sitter.json, see grammars.js). Needs `tree-sitter` on the PATH.
//
//   node scripts/ts.js generate [grammar...]      tree-sitter generate, in each grammar folder
//   node scripts/ts.js test     [grammar...]      tree-sitter test, in each grammar folder
//   node scripts/ts.js sync                       generate the editor queries (sync-queries.js)
//   node scripts/ts.js check                      the editor queries are up to date
//   node scripts/ts.js all      [grammar...]      generate + test + sync
//   node scripts/ts.js parse <dir> [grammar...]   parse every file of <dir> with a grammar's
//                                                 file type; list the files with ERROR or
//                                                 MISSING nodes, and a total per grammar
//
// No grammar given: all of them.
// Time per key in Neovim (held key, scrolling): python3 scripts/nvim-bench.py <file>

"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { ROOT, select } = require("./grammars");

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit" });
  if (r.error) { console.error(`${cmd}: ${r.error.message}`); process.exit(1); }
  return r.status === 0;
}

const title = (s) => console.log(`\x1b[1;36m== ${s}\x1b[0m`);

function forEach(names, label, args) {
  let ok = true;
  for (const g of select(names)) {
    title(`${label} ${g.name}`);
    ok = run("tree-sitter", args, g.dir) && ok;
  }
  return ok;
}

const generate = (names) => forEach(names, "generate", ["generate"]);
const test = (names) => forEach(names, "test", ["test"]);
const sync = (check) =>
  run("node", [path.join(__dirname, "sync-queries.js"), ...(check ? ["--check"] : [])], ROOT);

// Files under `dir` (recursively) whose extension is in `exts`.
function findFiles(dir, exts) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return findFiles(p, exts);
    return exts.includes(path.extname(e.name).slice(1)) ? [p] : [];
  }).sort();
}

function parse(dir, names) {
  if (!dir || !fs.existsSync(dir)) {
    console.error("usage: node scripts/ts.js parse <dir> [grammar...]");
    process.exit(2);
  }
  for (const g of select(names)) {
    const files = findFiles(path.resolve(dir), g.fileTypes);
    let bad = 0, nodes = 0;
    for (const f of files) {
      const r = spawnSync("tree-sitter", ["parse", f], { cwd: g.dir, encoding: "utf8" });
      const n = (r.stdout.match(/\((ERROR|MISSING)\b/g) || []).length;
      if (n > 0) { bad++; nodes += n; console.log(`  ${String(n).padStart(4)}  ${path.relative(dir, f)}`); }
    }
    title(`${g.name}: ${files.length} file(s), ${bad} with errors, ${nodes} ERROR/MISSING node(s)`);
  }
  return true;
}

const [cmd, ...rest] = process.argv.slice(2);
let ok;
switch (cmd) {
  case "generate": ok = generate(rest); break;
  case "test":     ok = test(rest); break;
  case "sync":     ok = sync(false); break;
  case "check":    ok = sync(true); break;
  case "all":      ok = generate(rest) && test(rest) && sync(false); break;
  case "parse":    ok = parse(rest[0], rest.slice(1)); break;
  default:
    console.error(fs.readFileSync(__filename, "utf8").split("\n").slice(1, 15)
      .map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
    process.exit(2);
}
process.exit(ok ? 0 : 1);
