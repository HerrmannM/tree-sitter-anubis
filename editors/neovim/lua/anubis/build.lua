-- Compile the Anubis tree-sitter parser into editors/neovim/parser/anubis.so,
-- where Neovim finds it (editors/neovim is on 'runtimepath').
-- Needs a C compiler (`cc`, or $CC) and the generated src/parser.c.
return function(root)
  local out_dir = root .. "/editors/neovim/parser"
  local out = out_dir .. "/anubis.so"
  local tmp = out .. ".tmp"
  vim.fn.mkdir(out_dir, "p")

  local cmd = {
    vim.env.CC or "cc", "-shared", "-fPIC", "-O2", "-I", "src",
    "src/parser.c", "src/scanner.c", "-o", tmp,
  }
  local ok, res = pcall(function()
    return vim.system(cmd, { cwd = root, text = true }):wait()
  end)
  if not ok or res.code ~= 0 then
    local msg = ok and (res.stderr or "") or tostring(res)
    vim.notify("anubis: parser build failed\n" .. msg, vim.log.levels.ERROR)
    return false
  end

  -- Replace atomically: never overwrite a library a running Neovim has loaded.
  local renamed, err = vim.uv.fs_rename(tmp, out)
  if not renamed then
    vim.notify("anubis: could not install parser: " .. tostring(err), vim.log.levels.ERROR)
    return false
  end
  return true
end
