# Anubis for Neovim

Highlighting, syntax diagnostics (errors, missing end dots, stray column-0
text), folding and spell checking for Anubis files.

Requires Neovim 0.12 and a C compiler (`cc`, or `$CC`): the parser is compiled
automatically the first time an `.anubis` file is opened, and again whenever
its sources change.

## Install

The Neovim files live in `editors/neovim/` of the repository, so that folder
is what goes on the runtime path.

From GitHub, in `init.lua`:

```lua
vim.pack.add({ "https://github.com/HerrmannM/tree-sitter-anubis" }, {
  load = function(p) vim.opt.rtp:append(p.path .. "/editors/neovim") end,
})
require("anubis").setup()   -- also registers the .anubis filetype
```

From a local clone (to work on the grammar), instead:

```lua
vim.opt.rtp:prepend(vim.fn.expand("~/dev/tree-sitter-anubis/editors/neovim"))
require("anubis").setup()
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
require("anubis").setup()
```

## Update

- From GitHub: `:lua vim.pack.update()` updates all your `vim.pack` plugins.
  Review the changes, `:write` to apply, then restart Neovim.
- Local clone: `git pull` (or `tree-sitter generate` after editing the
  grammar), then restart Neovim.

The parser is recompiled on the next start whenever it is older than its
sources.

## Options

Passed to `setup()`; all optional. Defaults:

```lua
require("anubis").setup({
  auto_build = true,   -- compile the parser when missing or outdated
  dev = false,         -- warn when generated files are stale (grammar work)
  folding = false,     -- one fold per paragraph
  highlight = true,    -- start tree-sitter highlighting
  diagnostics = {
    enabled = true,
    syntax = vim.diagnostic.severity.ERROR,     -- false to disable
    stray_text = vim.diagnostic.severity.WARN,  -- false to disable
  },
  emphasis = {         -- bold/italic on top of your colorscheme; false to disable
    ["@keyword.function"] = { bold = true },    -- full list in lua/anubis/init.lua
  },
})
```

Anubis buffers use 2-space indentation. To change that, or anything else
per buffer, use `~/.config/nvim/after/ftplugin/anubis.lua`, which runs after
the plugin:

```lua
vim.opt_local.shiftwidth = 4
```

## Troubleshooting

- `:lua =vim.api.nvim_get_runtime_file("parser/anubis.*", true)` must list only
  this plugin's parser: an older one elsewhere (e.g. in `~/.config/nvim/parser/`)
  would be used instead. Same for `queries/anubis/*`.
- `:lua require("anubis").build()` recompiles the parser by hand.
- `:InspectTree` shows the tree; `:Inspect` shows the capture under the cursor.

## Editing the queries

`editors/neovim/queries/anubis/` is generated from the repository's
`queries/*.scm` plus the Neovim-only `editors/neovim/queries-overlay/`.
Never edit it; after changing the queries, run from the repository root:

```sh
node scripts/sync-queries.js
```
