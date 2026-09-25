-- Highlight the definition of the identifier under the cursor and all its
-- uses, LOCAL to the current paragraph (par_def).
--
-- Driven by queries/locals.scm:
--   @local.scope          a node that opens a scope
--   @local.definition.*   an identifier that binds a name in its scope
--                         (#set! definition.<kind>.scope "parent": one scope up)
--   @local.reference      an identifier that uses a name
--
-- Resolution: from the identifier, walk up the scopes; the first scope holding
-- a definition of that name wins. Within a scope, a definition is visible only
-- AFTER its own position (so in `if x is success(x), ...` the subject `x` is
-- not the pattern's `x`), except hoisted ones (cross_recursive names).

local M = {}

local ns = vim.api.nvim_create_namespace("anubis_refs")

local function start_byte(node)
  return select(3, node:start())
end

-- Nearest enclosing paragraph, or nil (outside any par_def).
local function paragraph_of(node)
  while node and node:type() ~= "par_def" do node = node:parent() end
  return node
end

-- Innermost scope strictly above `node`, skipping `skip` extra scopes.
local function scope_of(node, scopes, skip)
  node = node:parent()
  while node do
    if scopes[node:id()] then
      if skip == 0 then return node end
      skip = skip - 1
    end
    node = node:parent()
  end
end

-- Run locals.scm over one paragraph. Returns a resolver and the references.
local function analyse(buf, par)
  local query = vim.treesitter.query.get("anubis", "locals")
  if not query then return end

  local scopes = {}        -- scope node id -> true
  local raw_defs = {}      -- { node, hoist }
  local is_def = {}        -- def node id -> true
  local refs = {}          -- reference nodes

  for id, node, meta in query:iter_captures(par, buf) do
    local cap = query.captures[id]
    if cap == "local.scope" then
      scopes[node:id()] = true
    elseif cap:find("^local%.definition") then
      if not is_def[node:id()] then       -- a node can match several patterns
        is_def[node:id()] = true
        local key = (cap:gsub("^local%.", "")) .. ".scope"
        raw_defs[#raw_defs + 1] = { node = node, hoist = meta and meta[key] == "parent" }
      end
    elseif cap == "local.reference" then
      refs[#refs + 1] = node
    end
  end

  -- scope id -> name -> list of defs, in document order
  local by_scope = {}
  for _, d in ipairs(raw_defs) do
    local s = scope_of(d.node, scopes, d.hoist and 1 or 0)
    if s then
      local name = vim.treesitter.get_node_text(d.node, buf)
      local t = by_scope[s:id()] or {}
      by_scope[s:id()] = t
      t[name] = t[name] or {}
      table.insert(t[name], d)
    end
  end

  -- Definition node that `node` (an identifier) refers to, or nil.
  local function resolve(node)
    if is_def[node:id()] then return node end
    local name = vim.treesitter.get_node_text(node, buf)
    local pos = start_byte(node)
    local s = node:parent()
    while s do
      local list = by_scope[s:id()] and by_scope[s:id()][name]
      if list then
        local best
        for _, d in ipairs(list) do
          if d.hoist or start_byte(d.node) < pos then best = d.node end
        end
        if best then return best end
      end
      s = s:parent()
    end
  end

  return resolve, refs
end

-- Definition + uses of the identifier under the cursor, or nil.
function M.find(buf)
  buf = (buf == nil or buf == 0) and vim.api.nvim_get_current_buf() or buf
  local ok, parser = pcall(vim.treesitter.get_parser, buf, "anubis")
  if not ok or not parser then return end
  parser:parse()

  local node = vim.treesitter.get_node({ bufnr = buf, ignore_injections = true })
  if not node or node:type() ~= "identifier" then return end
  local par = paragraph_of(node)
  if not par then return end

  local resolve, refs = analyse(buf, par)
  if not resolve then return end
  local def = resolve(node)
  if not def then return end

  local uses = {}
  for _, r in ipairs(refs) do
    local d = resolve(r)
    if d and d:id() == def:id() then uses[#uses + 1] = r end
  end
  return def, uses
end

local function mark(buf, node, group)
  local sr, sc, er, ec = node:range()
  vim.api.nvim_buf_set_extmark(buf, ns, sr, sc,
    { end_row = er, end_col = ec, hl_group = group, priority = 200 })
end

function M.clear(buf)
  vim.api.nvim_buf_clear_namespace(buf, ns, 0, -1)
end

function M.update(buf)
  M.clear(buf)
  local def, uses = M.find(buf)
  if not def then return end
  mark(buf, def, "AnubisDefinition")
  for _, u in ipairs(uses) do mark(buf, u, "AnubisReference") end
end

-- Jump to the local definition (bonus: same resolution).
function M.goto_definition()
  local def = M.find(0)
  if not def then return end
  local r, c = def:start()
  vim.cmd("normal! m'")          -- jumplist: <C-o> comes back
  vim.api.nvim_win_set_cursor(0, { r + 1, c })
end

function M.attach(buf)
  local group = vim.api.nvim_create_augroup("anubis_refs_" .. buf, { clear = true })
  vim.api.nvim_create_autocmd({ "CursorMoved", "TextChanged" }, {
    group = group, buffer = buf,
    callback = function() M.update(buf) end,
  })
  vim.api.nvim_create_autocmd({ "InsertEnter", "BufLeave" }, {
    group = group, buffer = buf,
    callback = function() M.clear(buf) end,
  })
end

return M