; ============================================================================
; Neovim-specific MAML highlights, appended AFTER maml/queries/highlights.scm
; by scripts/sync-queries.js. Later patterns win.
; ============================================================================

; Text outside $begin...$end: a comment, but only in .maml files. In an
; Anubis file it keeps the colour of the Anubis comment it belongs to.
; (#maml-file? is defined in lua/anubis/init.lua)
((skip_text) @comment (#maml-file?))


; --- Spell checking ---------------------------------------------------------
; In Anubis files, the comments are already @spell: only exclude the marks.

((skip_text) @spell (#maml-file?))
((text) @spell (#maml-file?))
(line_comment) @spell
[(mark_name) (escape) (variable) (verbatim)] @nospell

; Anubis code injected in .maml files: never spell checked.
((mark name: (mark_name) @_n (operand (text) @nospell))
 (#any-of? @_n "$acode" "$adcode"))
