-- Anubis support for Neovim.
--
--   require("anubis").setup(opts)   optional, call once at startup
--   require("anubis").attach(buf)   called by ftplugin/anubis.lua
--   require("anubis").build()       compile the parser now (normally automatic)
--
-- Features:
--   * tree-sitter highlighting (optional, if no other plugin starts it)
--   * syntax diagnostics from the tree: ERROR nodes, MISSING tokens (e.g. a
--     forgotten end dot), stray column-0 text outside paragraphs
--   * emphasis: bold / italic / undercurl added on top of the colorscheme

local M = {}

local S = vim.diagnostic.severity
local ns = vim.api.nvim_create_namespace("anubis")

local function hl_get(name)
  return vim.api.nvim_get_hl(0, { name = name, link = false })
end

M.defaults = {
  -- Compile the parser automatically when it is missing or older than its
  -- sources (src/parser.c, src/scanner.c), before it is first loaded.
  auto_build = true,

  -- Developer warnings: grammar.js newer than src/parser.c (run
  -- `tree-sitter generate`), queries newer than their generated Neovim copies
  -- (run `node scripts/sync-queries.js`). Off by default: based on file
  -- times, which a fresh git checkout does not order meaningfully.
  dev = false,

  -- Fold each paragraph and each block of prose (files open unfolded).
  folding = false,

  -- Start tree-sitter highlighting in Anubis buffers. Set to false if another
  -- plugin already does it (e.g. nvim-treesitter's highlight module).
  highlight = true,

  diagnostics = {
    enabled = true,
    syntax = S.ERROR,       -- ERROR / MISSING nodes; false to disable
    stray_text = S.WARN,    -- column-0 text outside paragraphs; false to disable
  },

  -- capture -> attributes added on top of the colorscheme's colours
  -- (or a function returning them). Set `emphasis = false` to disable all,
  -- or one capture to false to skip it.
  emphasis = {
    ["@keyword.function"]    = { bold = true },    -- define, module
    ["@keyword.type"]        = { bold = true },    -- type, type alias
    ["@punctuation.special"] = { bold = true },    -- end dot
    ["@type.parameter"]      = { italic = true },  -- $T
    ["@keyword.operator"]    = { bold = true },    -- <-  <->  *x
    ["@comment.warning"]     = function()          -- stray text
      return { undercurl = true, sp = hl_get("DiagnosticWarn").fg }
    end,
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

-- stray_text is valid syntax: it only appears at top level (or in an APG2 block).
local function collect_stray(node, severity, out)
  for child in node:iter_children() do
    local t = child:type()
    if t == "stray_text" then
      out[#out + 1] = node_diag(child, severity,
        "ignored: column-0 text that is not a paragraph keyword")
    elseif t == "apg2" then
      collect_stray(child, severity, out)
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
  if cfg.stray_text then collect_stray(root, cfg.stray_text, out) end
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
-- Emphasis
-- --------------------------------------------------------------------------

local legacy = {
  keyword = "Keyword", type = "Type", punctuation = "Delimiter",
  comment = "Comment", operator = "Operator", ["function"] = "Function",
  variable = "Identifier", string = "String", constructor = "Special",
}

-- Resolve a capture like Neovim does (@a.b.c -> @a.b -> @a), then a legacy group.
local function resolve(capture)
  local name = capture
  while name do
    local hl = hl_get(name)
    if next(hl) then return hl end
    name = name:match("^(.*)%.[^.]+$")
  end
  return hl_get(legacy[capture:match("^@([^.]+)")] or "Normal")
end

local function apply_emphasis()
  local em = M.config.emphasis
  if not em then return end
  for capture, attrs in pairs(em) do
    if type(attrs) == "function" then attrs = attrs() end
    if attrs then
      -- `@x.anubis` overrides `@x` in Anubis buffers only
      vim.api.nvim_set_hl(0, capture .. ".anubis",
        vim.tbl_extend("force", resolve(capture), attrs))
    end
  end
end

local emphasis_ready = false
local function ensure_emphasis()
  if emphasis_ready then return end
  emphasis_ready = true
  apply_emphasis()
  vim.api.nvim_create_autocmd("ColorScheme", {
    group = vim.api.nvim_create_augroup("anubis_emphasis", { clear = true }),
    callback = apply_emphasis,
  })
end


-- --------------------------------------------------------------------------
-- Public API
-- --------------------------------------------------------------------------

function M.setup(opts)
  M.config = vim.tbl_deep_extend("force", vim.deepcopy(M.defaults), opts or {})
  vim.filetype.add({ extension = { anubis = "anubis" } })
  if emphasis_ready then apply_emphasis() end
end

-- Repository root, from this file's real path:
-- <root>/editors/neovim/lua/anubis/init.lua (symlinks resolved)
local function repo_root()
  local src = debug.getinfo(1, "S").source:sub(2)
  src = vim.uv.fs_realpath(src) or src
  return vim.fn.fnamemodify(src, ":h:h:h:h:h")
end

-- Compile the parser into editors/neovim/parser/ (see build.lua).
function M.build()
  return require("anubis.build")(repo_root())
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

local parser_loaded = false   -- the .so is loaded: a rebuild needs a restart

-- Rebuild the parser if needed. Runs before the parser is first loaded, so
-- the fresh one is used right away.
local function ensure_parser()
  if not M.config.auto_build then return end
  local root = repo_root()
  local so = root .. "/editors/neovim/parser/anubis.so"
  if not older(so, { root .. "/src/parser.c", root .. "/src/scanner.c" }) then return end
  if mtime(root .. "/src/parser.c") == nil then return end   -- nothing to build from

  vim.notify("anubis: compiling the tree-sitter parser...", vim.log.levels.INFO)
  vim.cmd.redraw()
  if M.build() and parser_loaded then
    vim.notify("anubis: parser rebuilt, restart Neovim to use it", vim.log.levels.WARN)
  end
end

local dev_checked = false
local function dev_checks()
  if not M.config.dev or dev_checked then return end
  dev_checked = true
  local root = repo_root()
  local msgs = {}
  if older(root .. "/src/parser.c", { root .. "/grammar.js" }) then
    msgs[#msgs + 1] = "grammar.js is newer than src/parser.c: run `tree-sitter generate`"
  end
  for _, name in ipairs({ "highlights.scm", "locals.scm", "folds.scm" }) do
    local gen = root .. "/editors/neovim/queries/anubis/" .. name
    if older(gen, { root .. "/queries/" .. name,
                    root .. "/editors/neovim/queries-overlay/" .. name }) then
      msgs[#msgs + 1] = name .. " changed: run `node scripts/sync-queries.js`"
    end
  end
  if #msgs > 0 then
    vim.notify("anubis:\n" .. table.concat(msgs, "\n"), vim.log.levels.WARN)
  end
end

-- Parsers already attached to (weak keys: a reloaded buffer gets a new parser).
local attached = setmetatable({}, { __mode = "k" })

function M.attach(buf)
  if buf == nil or buf == 0 then buf = vim.api.nvim_get_current_buf() end

  dev_checks()
  ensure_parser()

  local ok, parser = pcall(vim.treesitter.get_parser, buf, "anubis")
  if not ok or not parser then
    vim.notify_once("anubis: tree-sitter parser not available"
      .. " (needs src/parser.c and a C compiler, see editors/neovim/README.md)",
      vim.log.levels.WARN)
    return
  end
  parser_loaded = true
  if attached[parser] then return end
  attached[parser] = true

  if M.config.highlight and not vim.treesitter.highlighter.active[buf] then
    vim.treesitter.start(buf, "anubis")
  end

  ensure_emphasis()

  if M.config.diagnostics.enabled then
    parser:register_cbs({
      on_changedtree = function() schedule_refresh(buf) end,
    })
    schedule_refresh(buf)
  end
end

return M
