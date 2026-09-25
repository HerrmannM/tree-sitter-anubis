-- Buffer-local setup for Anubis files.
if vim.b.did_ftplugin then return end
vim.b.did_ftplugin = 1

-- `//` comments are valid inside paragraphs (outside, any indented line is a comment).
vim.bo.commentstring = "// %s"
vim.b.undo_ftplugin = "setlocal commentstring<"

-- Tree-sitter highlighting, syntax diagnostics, emphasis (see lua/anubis/init.lua).
require("anubis").attach(0)