-- Buffer-local setup for OpLang files.
-- Override any of this in ~/.config/nvim/after/ftplugin/oplang.lua
if vim.b.did_ftplugin then return end
vim.b.did_ftplugin = 1

-- Anubis line comment (the preambule and the postambule)
vim.opt_local.commentstring = "// %s"

vim.b.undo_ftplugin = "setlocal commentstring<"

-- Tree-sitter highlighting (see lua/anubis/init.lua).
require("anubis").attach(0)
