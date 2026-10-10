-- Compile a tree-sitter parser of this repository into
-- editors/neovim/parser/<lang>.so, where Neovim finds it (editors/neovim is on
-- 'runtimepath').
-- Needs a C compiler (`cc`, or $CC) and the generated <grammar>/src/parser.c.
--   lang: a grammar of tree-sitter.json (see grammars.lua)
local grammars = require("anubis.grammars")

return function(lang)
  local root = grammars.root
  local sources = grammars.by_name[lang].sources
  local out_dir = root .. "/editors/neovim/parser"
  local out = out_dir .. "/" .. lang .. ".so"
  local tmp = out .. ".tmp"
  vim.fn.mkdir(out_dir, "p")

  local cmd = {
    vim.env.CC or "cc", "-shared", "-fPIC", "-O2",
    "-I", vim.fs.dirname(sources[1]),
  }
  vim.list_extend(cmd, sources)
  vim.list_extend(cmd, { "-o", tmp })
  local ok, res = pcall(function()
    return vim.system(cmd, { cwd = root, text = true }):wait()
  end)
  if not ok or res.code ~= 0 then
    local msg = ok and (res.stderr or "") or tostring(res)
    vim.notify(lang .. ": parser build failed\n" .. msg, vim.log.levels.ERROR)
    return false
  end

  -- Replace atomically: never overwrite a library a running Neovim has loaded.
  local renamed, err = vim.uv.fs_rename(tmp, out)
  if not renamed then
    vim.notify(lang .. ": could not install parser: " .. tostring(err), vim.log.levels.ERROR)
    return false
  end
  return true
end
