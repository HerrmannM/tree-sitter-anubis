-- Filetypes of the grammars of this repository, from tree-sitter.json:
-- each file extension is its own filetype (.anubis -> anubis, .maml -> maml, ...).
local extension = {}
for _, g in ipairs(require("anubis.grammars").list) do
  for _, ft in ipairs(g.filetypes) do extension[ft] = ft end
end
vim.filetype.add({ extension = extension })
