; Folding (Neovim only): one fold per paragraph and per block of prose.
; Enable with: foldmethod=expr foldexpr=v:lua.vim.treesitter.foldexpr()

[
  (par_def)
  (par_type)
  (par_type_alias)
  (par_describe)
  (par_c_constructors)
  (out_comment)
  (apg2)
  (conditional)
  (lambda)
  (with)
  (list)
] @fold