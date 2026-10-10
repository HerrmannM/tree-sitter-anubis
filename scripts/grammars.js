// The grammars of this repository, from tree-sitter.json (the one list of
// grammars: tools and editors read it, nothing else lists them).
//
//   const { ROOT, grammars, select } = require("./grammars");
//
// Each grammar: { name, dir, path, fileTypes, scanner, queries }
//   dir      absolute path of its folder (grammar.js, src/, queries/, test/)
//   path     the same, relative to the repository root ("anubis", "maml", ...)
//   scanner  true if it has an external scanner (src/scanner.c)
//   queries  query file names present in <dir>/queries ("highlights.scm", ...)

"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const config = JSON.parse(fs.readFileSync(path.join(ROOT, "tree-sitter.json"), "utf8"));

const grammars = config.grammars.map((g) => {
  const rel = g.path || ".";
  const dir = path.join(ROOT, rel);
  const qdir = path.join(dir, "queries");
  return {
    name: g.name,
    dir,
    path: rel,
    fileTypes: g["file-types"] || [],
    scanner: fs.existsSync(path.join(dir, "src", "scanner.c")),
    queries: fs.existsSync(qdir)
      ? fs.readdirSync(qdir).filter((f) => f.endsWith(".scm")).sort()
      : [],
  };
});

// Grammars named in `names` (all of them if empty); exits on an unknown name.
function select(names) {
  if (!names || names.length === 0) return grammars;
  return names.map((n) => {
    const g = grammars.find((x) => x.name === n);
    if (!g) {
      console.error(`unknown grammar: ${n} (known: ${grammars.map((x) => x.name).join(", ")})`);
      process.exit(2);
    }
    return g;
  });
}

module.exports = { ROOT, grammars, select };
