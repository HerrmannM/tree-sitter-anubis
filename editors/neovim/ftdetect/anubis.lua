-- Give files ending in .anubis the filetype `anubis`.
--
-- Neovim runs ftdetect files only for folders on 'runtimepath' at startup.
-- If this folder is added later (e.g. in a lazy.nvim `config` function),
-- this file is skipped, so require("anubis").setup() registers the same rule.
vim.filetype.add({ extension = { anubis = "anubis" } })
