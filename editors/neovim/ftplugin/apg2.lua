-- Buffer-local setup for APG2 files.
-- Override any of this in ~/.config/nvim/after/ftplugin/apg2.lua
if vim.b.did_ftplugin then return end
vim.b.did_ftplugin = 1

-- Anubis line comment (the Anubis code before and after the grammar)
vim.opt_local.commentstring = "// %s"

vim.b.undo_ftplugin = "setlocal commentstring<"

-- Tree-sitter highlighting (see lua/anubis/init.lua).
require("anubis").attach(0)
