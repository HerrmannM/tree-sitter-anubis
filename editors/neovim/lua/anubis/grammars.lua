-- The grammars of this repository, from tree-sitter.json (the one list of
-- grammars: the Node scripts and the editors read it, nothing else lists
-- them). Adding a grammar = its folder + its entry in tree-sitter.json (+ an
-- ftplugin for its filetype).
--
--   local G = require("anubis.grammars")
--   G.root                   repository root
--   G.list                   { grammar... } in tree-sitter.json order
--   G.by_name[name]          one grammar
--
-- Each grammar: { name, path, grammar, sources, filetypes, queries, overlay }
--   path       its folder, relative to the root ("anubis", "maml", ...)
--   grammar    "<path>/grammar.js"
--   sources    C files to compile: "<path>/src/parser.c" (+ "src/scanner.c")
--   filetypes  file extensions, also used as Neovim filetypes
--   queries    canonical query folder "<path>/queries"
--   overlay    Neovim-only queries "editors/neovim/overlays/<name>"
-- Paths are relative to G.root.

local M = {}

-- <root>/editors/neovim/lua/anubis/grammars.lua (symlinks resolved)
local function repo_root()
  local src = debug.getinfo(1, "S").source:sub(2)
  src = vim.uv.fs_realpath(src) or src
  return vim.fn.fnamemodify(src, ":h:h:h:h:h")
end

M.root = repo_root()
M.list = {}
M.by_name = {}

local function read(file)
  local f = io.open(file, "r")
  if not f then return nil end
  local text = f:read("*a")
  f:close()
  return text
end

local text = read(M.root .. "/tree-sitter.json")
local ok, config = pcall(vim.json.decode, text or "")
if not ok or type(config) ~= "table" then
  vim.notify("anubis: cannot read " .. M.root .. "/tree-sitter.json", vim.log.levels.ERROR)
  config = { grammars = {} }
end

for _, g in ipairs(config.grammars or {}) do
  local path = g.path or "."
  local sources = { path .. "/src/parser.c" }
  if vim.uv.fs_stat(M.root .. "/" .. path .. "/src/scanner.c") then
    sources[#sources + 1] = path .. "/src/scanner.c"
  end
  local grammar = {
    name = g.name,
    path = path,
    grammar = path .. "/grammar.js",
    sources = sources,
    filetypes = g["file-types"] or {},
    queries = path .. "/queries",
    overlay = "editors/neovim/overlays/" .. g.name,
  }
  M.list[#M.list + 1] = grammar
  M.by_name[g.name] = grammar
end

return M
