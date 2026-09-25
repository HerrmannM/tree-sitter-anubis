; ============================================================================
; Neovim-specific highlights, appended AFTER queries/highlights.scm by
; scripts/sync-queries.js. Later patterns win: this can refine captures.
; ============================================================================

; --- Spell checking (Neovim-only captures) ----------------------------------
; Check the prose between paragraphs and comments, never code.

[(out_comment) (comment) (block_comment) (todo_line)] @spell
(stray_text) @nospell


; --- Standard library -------------------------------------------------------
; Name-based captures for well-known constructors. Without a colour of their
; own, they fall back to @constructor. lua/anubis/init.lua links them to
; DiagnosticOk / DiagnosticError by default; a colorscheme or the user can
; override `@constructor.success.anubis` etc.

((identifier) @constructor.success (#eq? @constructor.success "success"))
((identifier) @constructor.failure (#eq? @constructor.failure "failure"))
((identifier) @boolean (#any-of? @boolean "true" "false"))
; ((ty_name) @type.builtin (#any-of? @type.builtin "Maybe" "List" "Bool" "One"))
