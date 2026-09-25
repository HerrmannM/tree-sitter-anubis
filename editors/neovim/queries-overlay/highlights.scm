; ============================================================================
; Neovim-specific highlights, appended AFTER queries/highlights.scm by
; scripts/sync-queries.js. Later patterns win: this can refine captures.
; ============================================================================

; --- Spell checking (Neovim-only captures) ----------------------------------
; Check the prose between paragraphs and comments, never code.

[(out_comment) (comment) (block_comment) (todo_line)] @spell
(stray_text) @nospell


; --- Standard library (example, disabled) -----------------------------------
; Name-based colours for library constructors. Uncomment to use, and define
; the colours in lua/anubis/init.lua (emphasis) or your colorscheme.
;
; ((identifier) @constructor.success (#eq? @constructor.success "success"))
; ((identifier) @constructor.failure (#eq? @constructor.failure "failure"))
; ((identifier) @boolean (#any-of? @boolean "true" "false"))
; ((ty_name) @type.builtin (#any-of? @type.builtin "Maybe" "List" "Bool" "One"))