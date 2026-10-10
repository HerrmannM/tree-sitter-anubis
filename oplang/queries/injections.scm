; ============================================================================
; tree-sitter-oplang -- injections
; ============================================================================

; The preambule and the postambule: Anubis code. Each block is injected on its
; own (not combined): a combined injection would let a multi-line Anubis
; comment at the end of the preambule cover the sentences that follow.
((anubis_block) @injection.content
 (#set! injection.language "anubis"))

; MAML documentation: the MAML compiler reads the whole file as text. Outside
; $begin...$end nothing is captured, so a file without MAML is untouched.
; The comments of the Anubis code also get MAML from the Anubis injections
; (a partial document): without $begin it colours nothing, with one it
; gives the same colours.
((source_file) @injection.content
 (#set! injection.language "maml")
 (#set! injection.include-children))
