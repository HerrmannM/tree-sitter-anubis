# Anubis for Neovim

Filetype detection, tree-sitter highlighting, syntax diagnostics (errors,
missing end dots, stray column-0 text) and emphasis for key tokens.

## Requirements

- Neovim 0.12+ for `vim.pack`; 0.10+ for the manual install
  (0.11+ if the parser was generated with tree-sitter ≥ 0.25, ABI 15)
- A C compiler (`cc`, or set `$CC`)

## Install with vim.pack (Neovim 0.12+)

In `init.lua`. The autocommand must come before `vim.pack.add`, so that it
also runs on the first install:

```lua
-- Build the parser on install and update
vim.api.nvim_create_autocmd("PackChanged", { callback = function(ev)
  local d = ev.data
  if d.spec.name == "tree-sitter-anubis" and (d.kind == "install" or d.kind == "update") then
    dofile(d.path .. "/editors/neovim/lua/anubis/build.lua")(d.path)
  end
end })

-- The Neovim files are in a subfolder: load it instead of the repository root
vim.pack.add({ "https://github.com/HerrmannM/tree-sitter-anubis" }, {
  load = function(p) vim.opt.rtp:append(p.path .. "/editors/neovim") end,
})

require("anubis").setup()   -- required here: it registers the .anubis filetype
```

Update with `:lua vim.pack.update()`, then restart Neovim to load the
rebuilt parser.

## Manual install (no plugin manager)

1. Clone the repository anywhere, e.g. `~/src/tree-sitter-anubis`.
2. Put `editors/neovim` on the runtime path, either way:
   - at the top of `init.lua`:
     `vim.opt.rtp:append(vim.fn.expand("~/src/tree-sitter-anubis/editors/neovim"))`
   - or symlink it as a package, loaded automatically at startup:
     `ln -s ~/src/tree-sitter-anubis/editors/neovim ~/.local/share/nvim/site/pack/anubis/start/anubis`
3. In Neovim, run `:lua require("anubis").build()`, then restart.

To update: `git pull`, then step 3 again. `setup()` is optional here.

## Other plugin managers

Add `editors/neovim` to the runtime path, call `require("anubis").setup()`,
and run `require("anubis").build()` as the plugin's build step.

## Configuration

`setup()` is optional. Defaults:

```lua
require("anubis").setup({
  highlight = true,                 -- start tree-sitter highlighting
  diagnostics = {
    enabled = true,
    syntax = vim.diagnostic.severity.ERROR,     -- false to disable
    stray_text = vim.diagnostic.severity.WARN,  -- false to disable
  },
  emphasis = {                      -- false to disable all
    ["@keyword.function"] = { bold = true },    -- set one to false to skip it
    -- see lua/anubis/init.lua for the full list
  },
})
```

Emphasis only adds bold, italic or undercurl; colours come from your
colorscheme. Diagnostics appear when you leave insert mode (Neovim's default,
see `update_in_insert` in `:h vim.diagnostic.config()`).

## Troubleshooting

- `:checkhealth vim.treesitter`: is the `anubis` parser found?
- `:InspectTree`: the syntax tree, including `ERROR` / `MISSING` nodes
- `:Inspect`: which capture colours the token under the cursor

## Folding

Each paragraph, and each block of prose between paragraphs, can be folded:

```lua
vim.api.nvim_create_autocmd("FileType", { pattern = "anubis", callback = function()
  vim.wo.foldmethod = "expr"
  vim.wo.foldexpr = "v:lua.vim.treesitter.foldexpr()"
end })
```

## Queries

`queries/anubis/` is generated: never edit it. Each file is the canonical
`queries/<name>.scm` of the repository followed by the Neovim-only
`queries-overlay/<name>.scm` (spell checking, folds, ...). The overlay comes
last, so its patterns win.

From the repository root:

```sh
node scripts/sync-queries.js           # regenerate after editing queries
node scripts/sync-queries.js --check   # CI: fails if out of date
```