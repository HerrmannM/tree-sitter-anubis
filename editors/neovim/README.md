# Anubis for Neovim

Highlighting, syntax diagnostics (errors, missing end dots), folding and
spell checking for Anubis files, and highlighting of their MAML documentation
(also in `.maml` files), and highlighting of `.apg2` and `.oplang` files.

Requires Neovim 0.12 and a C compiler (`cc`, or `$CC`): the parsers (Anubis,
MAML, APG2 and OpLang) are compiled automatically the first time an
`.anubis`, `.maml`, `.apg2` or `.oplang` file is opened, and again whenever
their sources change.

## Install

The Neovim files live in `editors/neovim/` of the repository, so that folder
is what goes on the runtime path.

From GitHub, in `init.lua`:

```lua
vim.pack.add({ "https://github.com/HerrmannM/tree-sitter-anubis" }, {
  load = function(p) vim.opt.rtp:append(p.path .. "/editors/neovim") end,
})
require("anubis").setup()   -- optional: only needed to change options
```

From a local clone (to work on the grammar), instead:

```lua
vim.opt.rtp:prepend(vim.fn.expand("~/dev/tree-sitter-anubis/editors/neovim"))
```

Or both: the local clone when present, GitHub otherwise:

```lua
local anubis = vim.fn.expand("~/dev/tree-sitter-anubis")
if vim.uv.fs_stat(anubis) then
  vim.opt.rtp:prepend(anubis .. "/editors/neovim")
else
  vim.pack.add({ "https://github.com/HerrmannM/tree-sitter-anubis" }, {
    load = function(p) vim.opt.rtp:append(p.path .. "/editors/neovim") end,
  })
end
```

## Update

- From GitHub: `:lua vim.pack.update()` updates all your `vim.pack` plugins.
  Review the changes, `:write` to apply, then restart Neovim.
- Local clone: `git pull` (or `node scripts/ts.js generate` after editing a
  grammar), then restart Neovim.

The parser is recompiled on the next start whenever it is older than its
sources.

## Options

Passed to `setup()`, which is optional: without it, the defaults apply.

```lua
require("anubis").setup({
  auto_build = true,   -- compile the parser when missing or outdated
  dev = false,         -- warn when generated files are stale (grammar work);
                       -- after a checkout, `node scripts/ts.js sync` resets the times
  folding = false,     -- one fold per paragraph
  highlight = true,    -- start tree-sitter highlighting
  diagnostics = {
    enabled = true,
    syntax = vim.diagnostic.severity.ERROR,     -- false to disable
  },
})
```

Anubis buffers use 2-space indentation. To change that, or anything else
per buffer, use `~/.config/nvim/after/ftplugin/anubis.lua`, which runs after
the plugin:

```lua
vim.opt_local.shiftwidth = 4
```

## Colours

Colours come from your colorscheme: the queries use the standard tree-sitter
capture names (`@keyword`, `@type`, `@constructor`, `@function.call`, ...).

A few captures are specific to Anubis and linked by default:

| Group                          | Default link      |
|--------------------------------|-------------------|
| `@constructor.success.anubis`  | `DiagnosticOk`    |
| `@constructor.failure.anubis`  | `DiagnosticError` |

To change any of them, or any capture for Anubis buffers only (add `.anubis`
to its name), use your colorscheme's override option, or:

```lua
vim.api.nvim_create_autocmd("ColorScheme", {
  callback = function()
    vim.api.nvim_set_hl(0, "@constructor.success.anubis", { fg = "#98c379", bold = true })
    vim.api.nvim_set_hl(0, "@constructor.failure.anubis", { link = "ErrorMsg" })
  end,
})
```

That autocmd must be defined before your `:colorscheme` line, or followed
by `vim.cmd.doautocmd("ColorScheme")`.

## MAML

MAML, the documentation language of the Anubis library, is highlighted:

- in `.maml` files; the Anubis code in `$acode(...)` and `$adcode(...)` is
  highlighted as Anubis;
- in Anubis files, inside the comments (between paragraphs, `//` and `/* */`),
  only between `$begin` and `$end`, as the MAML compiler reads them: all the
  comments of a file form one MAML document, so a `$begin ... $acode(` before a
  paragraph and its `)$end` after it belong together.

Marks are coloured by name (`$section`, `$bold`, `$att`, ...). The lists of
names are in `maml/queries/highlights.scm`: add a library macro there to give
it a colour.

## APG2

`.apg2` files (the APG2 parser generator) are highlighted: the grammar, the
Anubis code before and after it (as Anubis), and the MAML documentation of the
whole file (as the MAML compiler reads it).

## OpLang

`.oplang` files (OpLang operator languages) are highlighted: the sentences,
the preambule and postambule (as Anubis), and the MAML documentation of the
whole file (as the MAML compiler reads it).

## Performance

Holding a key or scrolling should stay fluid: on the largest files of the
library and of A2S, every key is handled in under 7 ms (median 2 to 3 ms;
without any plugin: about 1 ms), well below a key repeat (25 to 40 ms).

What can happen:

- **`~@k` (or similar) in the bottom right corner** while holding an arrow:
  this is Neovim's `showcmd` showing a `<Down>` that is waiting to be handled,
  when two key repeats arrive together. It happens without any plugin, even
  on a plain text file, and does not mean Neovim is slow.
- **Lag when holding a key or scrolling.** Each key costs, on top of Neovim
  itself:
  - highlighting the lines that come into view (only those: tree-sitter
    parses once, then incrementally);
  - **matchparen** (built in): on every cursor move, it asks tree-sitter for
    the highlight at each parenthesis on screen, to skip those in strings and
    comments. That is the most expensive part. Its time limit is
    `vim.g.matchparen_timeout` (300 ms by default); `:NoMatchParen` turns it off;
  - the injected languages: MAML in Anubis comments, Anubis in `.maml`
    `$acode(...)`, Anubis and MAML in `.apg2` / `.oplang` files. Each one adds
    a tree to query;
  - `relativenumber`: the whole number column changes on every move, so more
    is sent to the terminal; the terminal's own drawing speed then matters.
- **Lag after an edit in a big file**: the injected MAML of a file is a single
  document (as for the MAML compiler), parsed again as a whole after an edit.

To measure, from the repository root (Python 3, standard library only):

```sh
python3 scripts/nvim-bench.py FILE                  # held <Down>, your config
python3 scripts/nvim-bench.py FILE --key wheel      # mouse wheel
python3 scripts/nvim-bench.py FILE -- -u NONE       # the same without config
```

It runs your real Neovim in a pseudo-terminal and prints the median, p95,
p99 and max time per key. `:Inspect` and `:InspectTree` show the captures and
the trees (one per injected language) under the cursor.

## Troubleshooting

- `:lua =vim.api.nvim_get_runtime_file("parser/anubis.*", true)` must list only
  this plugin's parser: an older one elsewhere (e.g. in `~/.config/nvim/parser/`)
  would be used instead. Same for `queries/anubis/*`, and for `maml`, `apg2`
  and `oplang`.
- `:lua require("anubis").build()` recompiles the parsers by hand.
- `:InspectTree` shows the tree; `:Inspect` shows the captures under the cursor
  (the last one listed wins) and the group each one links to.

## Editing the queries

`editors/neovim/queries/<grammar>/` is generated from the grammar's
`<grammar>/queries/*.scm` plus the Neovim-only
`editors/neovim/overlays/<grammar>/*.scm` (folds, MAML injections into
`$acode`, ...). Never edit it; after changing the queries, run from the
repository root:

```sh
node scripts/ts.js sync
```

## Grammars and paths

The plugin reads the list of grammars from the repository's `tree-sitter.json`
(`lua/anubis/grammars.lua`): their folders, the C files to compile into
`editors/neovim/parser/<grammar>.so`, and their file extensions (each one a
filetype, see `ftdetect/anubis.lua`). A new grammar needs no Lua change, only
an `ftplugin/<filetype>.lua` that calls `require("anubis").attach(0)`.
