-- Buffer-local setup for Anubis files.
-- Override any of this in ~/.config/nvim/after/ftplugin/anubis.lua
if vim.b.did_ftplugin then return end
vim.b.did_ftplugin = 1

local anubis = require("anubis")

-- Anubis convention: 2-space indentation
vim.opt_local.shiftwidth = 2
vim.opt_local.softtabstop = 2
vim.opt_local.expandtab = true

-- `//` comments are valid inside paragraphs (outside, any indented line is a comment).
vim.opt_local.commentstring = "// %s"

local undo = "setlocal shiftwidth< softtabstop< expandtab< commentstring<"

-- One fold per paragraph (setup option `folding`)
if anubis.config.folding then
  vim.opt_local.foldmethod = "expr"
  vim.opt_local.foldexpr = "v:lua.vim.treesitter.foldexpr()"
  vim.opt_local.foldlevel = 99   -- open files unfolded
  undo = undo .. " foldmethod< foldexpr< foldlevel<"
end

vim.b.undo_ftplugin = undo

-- Map go to definition
vim.keymap.set("n", "gd", require("anubis.refs").goto_definition, { buffer = true })

-- Tree-sitter highlighting and syntax diagnostics (see lua/anubis/init.lua).
anubis.attach(0)
