# tree-sitter-anubis

Tree-sitter grammars for Anubis and the languages around it:

| Grammar | Folder | Files | Injects |
|---|---|---|---|
| Anubis | `anubis/` | `.anubis` | MAML into the comments |
| MAML (documentation language of the library) | `maml/` | `.maml` | Anubis into `$acode(...)` / `$adcode(...)` (Neovim) |
| APG2 (parser generator) | `apg2/` | `.apg2` | Anubis into the code before and after the grammar, MAML into the whole file |
| OpLang (operator languages) | `oplang/` | `.oplang` | Anubis into the preambule and postambule, MAML into the whole file |

Each folder is a complete tree-sitter grammar: `grammar.js`, the generated
`src/` (committed), `queries/` and `test/corpus/`. `tree-sitter.json` lists
them; it is the only list of grammars: the scripts and the editor support
read it.

```
anubis/ maml/ apg2/ oplang/   the grammars
tree-sitter.json              the list of grammars (path, file types, queries)
scripts/                      development commands (Node, no dependencies)
editors/neovim/               Neovim support (see editors/neovim/README.md)
```

## Editors

- **Neovim**: `editors/neovim/` is a plugin (parsers compiled automatically,
  filetypes, diagnostics, MAML everywhere). See
  [editors/neovim/README.md](editors/neovim/README.md).
- **Other editors** (Helix, Zed, nvim-treesitter, ...) take a grammar as
  "this repository + a sub-folder" (`anubis`, `maml`, `apg2`, `oplang`) and
  compile its `src/parser.c` (+ `src/scanner.c` for Anubis). Their queries can
  be generated like Neovim's: add the editor to `EDITORS` in
  `scripts/sync-queries.js` (output folder, overlay folder, capture renaming).

There are no language bindings (node, rust, C) for now: no consumer needs
them. `tree-sitter init` regenerates them, for all the grammars, when one does.

## Development

**Prerequisites:** [`tree-sitter-cli`](https://github.com/tree-sitter/tree-sitter)
0.26, Node.js (to run `grammar.js` and the scripts), a C compiler.

```sh
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cargo install cargo-binstall
cargo binstall tree-sitter-cli
tree-sitter --version # Currently 0.26.x
```

All commands run from the repository root. Without a grammar name, they apply
to all of them.

```sh
node scripts/ts.js generate [grammar...]       # <grammar>/src/ from <grammar>/grammar.js
node scripts/ts.js test     [grammar...]       # <grammar>/test/corpus
node scripts/ts.js sync                        # editor queries (editors/*/queries/)
node scripts/ts.js check                       # editor queries up to date?
node scripts/ts.js all      [grammar...]       # generate + test + sync
node scripts/ts.js parse <dir> [grammar...]    # ERROR/MISSING counts on real files, e.g.
                                               #   node scripts/ts.js parse ~/anubis_dev/library
node scripts/highlight-corpus.js <grammar> [filter]   # corpus inputs, coloured
```

Inside a grammar folder, the usual `tree-sitter generate`, `tree-sitter test`
and `tree-sitter parse <file>` work too. `tree-sitter highlight <file>` must
run from the root (where `tree-sitter.json` maps file types to grammars); for
the same reason, highlight tests (`test/highlight/`) cannot be used in a
grammar folder: `anubis/examples/` holds sample files instead.

### Quick reference

| Change | Edit | Then run |
|---|---|---|
| Syntax of a language | `<grammar>/grammar.js` (+ `test/corpus/`) | `node scripts/ts.js all <grammar>` |
| Colours, injections | `<grammar>/queries/*.scm` | `node scripts/ts.js sync` |
| Neovim-only queries | `editors/neovim/overlays/<grammar>/*.scm` | `node scripts/ts.js sync` |
| A new grammar | a new folder + its entry in `tree-sitter.json` (+ `editors/neovim/ftplugin/<filetype>.lua`) | `node scripts/ts.js all <grammar>` |

Neovim recompiles a parser when its `src/` is newer; restart Neovim after a
grammar change (a loaded parser cannot be replaced). Query changes only need
`:e!`. In Neovim, `:InspectTree` and `:EditQuery <language>` help writing
queries.
