-- Buffer-local setup for MAML files.
-- Override any of this in ~/.config/nvim/after/ftplugin/maml.lua
if vim.b.did_ftplugin then return end
vim.b.did_ftplugin = 1

-- MAML line comment
vim.opt_local.commentstring = "$// %s"

vim.b.undo_ftplugin = "setlocal commentstring<"

-- Tree-sitter highlighting (see lua/anubis/init.lua).
require("anubis").attach(0)
