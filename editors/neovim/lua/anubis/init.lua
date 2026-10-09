-- Anubis (and MAML) support for Neovim.
--
--   require("anubis").setup(opts)   optional: override the defaults below
--   require("anubis").attach(buf)   called by ftplugin/anubis.lua and ftplugin/maml.lua
--   require("anubis").build()       compile the parsers now (normally automatic)
--
-- Features:
--   * tree-sitter highlighting (optional, if no other plugin starts it), with
--     MAML documentation highlighted inside Anubis comments
--   * .maml files, with Anubis highlighted inside `$acode(...)` / `$adcode(...)`
--   * syntax diagnostics from the tree: ERROR nodes, MISSING tokens (e.g. a
--     forgotten end dot)
--
-- Colours belong to the colorscheme: the queries use standard capture names.
-- The plugin only adds `default` links for its own captures (HIGHLIGHTS).

local M = {}

local S = vim.diagnostic.severity
local ns = vim.api.nvim_create_namespace("anubis")

M.defaults = {
  references = true,   -- highlight local definition + uses under the cursor

  -- Compile the parser automatically when it is missing or older than its
  -- sources (src/parser.c, src/scanner.c), before it is first loaded.
  auto_build = true,

  -- Developer warnings: grammar.js newer than src/parser.c (run
  -- `tree-sitter generate`), queries newer than their generated Neovim copies
  -- (run `node scripts/sync-queries.js`). Off by default: based on file
  -- times, which a fresh git checkout does not order meaningfully.
  dev = false,

  -- Fold each paragraph and each block of prose (files open unfolded).
  -- Applied by ftplugin/anubis.lua.
  folding = false,

  -- Start tree-sitter highlighting in Anubis buffers. Set to false if another
  -- plugin already does it (e.g. nvim-treesitter's highlight module).
  highlight = true,

  diagnostics = {
    enabled = true,
    syntax = S.ERROR,       -- ERROR / MISSING nodes; false to disable
  },
}

M.config = vim.deepcopy(M.defaults)


-- --------------------------------------------------------------------------
-- Diagnostics
-- --------------------------------------------------------------------------

local function node_diag(node, severity, message)
  local sr, sc, er, ec = node:range()
  if sr == er and sc == ec then ec = sc + 1 end -- zero-width (MISSING): make it visible
  return {
    lnum = sr, col = sc, end_lnum = er, end_col = ec,
    severity = severity, message = message, source = "anubis",
  }
end

-- Only descends where something is wrong: healthy paragraphs are skipped.
local function collect_errors(node, severity, out, inside_error)
  for child in node:iter_children() do
    local t = child:type()
    if child:missing() then
      local what = t:find("enddot", 1, true) and "end dot '.'" or ("'" .. t .. "'")
      out[#out + 1] = node_diag(child, severity, "missing " .. what)
    elseif t == "ERROR" then
      if not inside_error then
        out[#out + 1] = node_diag(child, severity, "syntax error")
      end
      collect_errors(child, severity, out, true)
    elseif child:has_error() then
      collect_errors(child, severity, out, inside_error)
    end
  end
end

local function refresh(buf)
  if not vim.api.nvim_buf_is_valid(buf) then return end
  local ok, parser = pcall(vim.treesitter.get_parser, buf, "anubis")
  if not ok or not parser then return end
  local tree = parser:parse()[1]
  if not tree then return end

  local root = tree:root()
  local cfg = M.config.diagnostics
  local out = {}
  if cfg.syntax and root:has_error() then
    if root:type() == "ERROR" then
      out[#out + 1] = node_diag(root, cfg.syntax, "syntax error")
    end
    collect_errors(root, cfg.syntax, out, root:type() == "ERROR")
  end
  vim.diagnostic.set(ns, buf, out)
end

-- Several tree changes in a row produce a single refresh.
local pending = {}
local function schedule_refresh(buf)
  if pending[buf] then return end
  pending[buf] = true
  vim.schedule(function()
    pending[buf] = nil
    refresh(buf)
  end)
end


-- --------------------------------------------------------------------------
-- Highlights
-- --------------------------------------------------------------------------

-- Captures specific to Anubis (queries-overlay/highlights.scm), linked to
-- standard groups. `default = true`: a definition of the same group by the
-- colorscheme or the user wins. Set again on ColorScheme (`:hi clear` drops them).
local HIGHLIGHTS = {
  ["AnubisDefinition"] = "LspReferenceWrite",
  ["AnubisReference"]  = "LspReferenceRead",
  --
  ["@constructor.success.anubis"] = "DiagnosticOk",
  ["@constructor.failure.anubis"] = "DiagnosticError",
  ["@keyword.todo.anubis"] = "DiagnosticWarn",
  ["@type.parameter.anubis"] = "TypeDef",
  ["@type.jocker.anubis"] = "TypeDef",
}

local function set_highlights()
  for group, target in pairs(HIGHLIGHTS) do
    vim.api.nvim_set_hl(0, group, { link = target, default = true })
  end
end

set_highlights()
vim.api.nvim_create_autocmd("ColorScheme", {
  group = vim.api.nvim_create_augroup("anubis_highlights", { clear = true }),
  callback = set_highlights,
})


-- --------------------------------------------------------------------------
-- Query predicates
-- --------------------------------------------------------------------------

-- `(#maml-file?)`: the buffer is a .maml file (not MAML injected into the
-- comments of an Anubis file). Used by queries-overlay-maml/.
vim.treesitter.query.add_predicate("maml-file?", function(_, _, source)
  return type(source) == "number" and vim.bo[source].filetype == "maml"
end, { force = true })


-- --------------------------------------------------------------------------
-- Public API
-- --------------------------------------------------------------------------

-- The .anubis and .maml filetypes are registered by ftdetect/anubis.lua, not here.
function M.setup(opts)
  M.config = vim.tbl_deep_extend("force", vim.deepcopy(M.defaults), opts or {})
end

-- Repository root, from this file's real path:
-- <root>/editors/neovim/lua/anubis/init.lua (symlinks resolved)
local function repo_root()
  local src = debug.getinfo(1, "S").source:sub(2)
  src = vim.uv.fs_realpath(src) or src
  return vim.fn.fnamemodify(src, ":h:h:h:h:h")
end

-- The two parsers of this repository. Both are always built: MAML is
-- injected into Anubis comments, and Anubis into MAML `$acode(...)`.
local PARSERS = {
  anubis = {
    grammar = "grammar.js",
    sources = { "src/parser.c", "src/scanner.c" },
    queries = { "highlights.scm", "locals.scm", "folds.scm", "injections.scm" },
    canonical = "queries",
    overlay = "editors/neovim/queries-overlay",
  },
  maml = {
    grammar = "maml/grammar.js",
    sources = { "maml/src/parser.c" },
    queries = { "highlights.scm", "injections.scm" },
    canonical = "maml/queries",
    overlay = "editors/neovim/queries-overlay-maml",
  },
}

-- Compile the parsers into editors/neovim/parser/ (see build.lua).
-- `lang`: "anubis" or "maml"; nil builds both.
function M.build(lang)
  local build = require("anubis.build")
  if lang then return build(repo_root(), lang) end
  local ok = true
  for name in pairs(PARSERS) do ok = build(repo_root(), name) and ok end
  return ok
end

-- Modification time in seconds, or nil if the file does not exist.
local function mtime(file)
  local st = vim.uv.fs_stat(file)
  return st and (st.mtime.sec + st.mtime.nsec * 1e-9) or nil
end

-- True if `target` is missing or older than any existing source.
local function older(target, sources)
  local t = mtime(target)
  if not t then return true end
  for _, src in ipairs(sources) do
    local m = mtime(src)
    if m and m > t then return true end
  end
  return false
end

local parser_loaded = false   -- a .so is loaded: a rebuild needs a restart

-- Rebuild the parsers if needed. Runs before they are first loaded, so the
-- fresh ones are used right away.
local function ensure_parsers()
  if not M.config.auto_build then return end
  local root = repo_root()
  for lang, p in pairs(PARSERS) do
    local so = root .. "/editors/neovim/parser/" .. lang .. ".so"
    local sources = vim.tbl_map(function(f) return root .. "/" .. f end, p.sources)
    -- Rebuild when outdated, and only if there is something to build from.
    if older(so, sources) and mtime(sources[1]) ~= nil then
      vim.notify(lang .. ": compiling the tree-sitter parser...", vim.log.levels.INFO)
      vim.cmd.redraw()
      if M.build(lang) and parser_loaded then
        vim.notify(lang .. ": parser rebuilt, restart Neovim to use it", vim.log.levels.WARN)
      end
    end
  end
end

local dev_checked = false
local function dev_checks()
  if not M.config.dev or dev_checked then return end
  dev_checked = true
  local root = repo_root()
  local msgs = {}
  for lang, p in pairs(PARSERS) do
    if older(root .. "/" .. p.sources[1], { root .. "/" .. p.grammar }) then
      msgs[#msgs + 1] = p.grammar .. " is newer than " .. p.sources[1]
        .. ": run `tree-sitter generate`" .. (lang == "maml" and " in maml/" or "")
    end
    for _, name in ipairs(p.queries) do
      local gen = root .. "/editors/neovim/queries/" .. lang .. "/" .. name
      if older(gen, { root .. "/" .. p.canonical .. "/" .. name,
                      root .. "/" .. p.overlay .. "/" .. name }) then
        msgs[#msgs + 1] = lang .. "/" .. name .. " changed: run `node scripts/sync-queries.js`"
      end
    end
  end
  if #msgs > 0 then
    vim.notify("anubis:\n" .. table.concat(msgs, "\n"), vim.log.levels.WARN)
  end
end

-- Parsers already attached to (weak keys: a reloaded buffer gets a new parser).
local attached = setmetatable({}, { __mode = "k" })

-- Attach to an Anubis or a MAML buffer (language from the filetype).
function M.attach(buf)
  if buf == nil or buf == 0 then buf = vim.api.nvim_get_current_buf() end
  local lang = vim.bo[buf].filetype == "maml" and "maml" or "anubis"

  dev_checks()
  ensure_parsers()

  local ok, parser = pcall(vim.treesitter.get_parser, buf, lang)
  if not ok or not parser then
    vim.notify_once(lang .. ": tree-sitter parser not available"
      .. " (needs the generated parser.c and a C compiler, see editors/neovim/README.md)",
      vim.log.levels.WARN)
    return
  end
  parser_loaded = true
  if attached[parser] then return end
  attached[parser] = true

  if M.config.highlight and not vim.treesitter.highlighter.active[buf] then
    vim.treesitter.start(buf, lang)
  end

  if lang ~= "anubis" then return end   -- the rest is Anubis only

  if M.config.diagnostics.enabled then
    parser:register_cbs({
      on_changedtree = function() schedule_refresh(buf) end,
    })
    schedule_refresh(buf)
  end

  if M.config.references then
    require("anubis.refs").attach(buf)
  end

end

return M
