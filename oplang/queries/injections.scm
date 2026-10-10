; ============================================================================
; tree-sitter-oplang -- injections
; ============================================================================

; The preambule and the postambule: Anubis code. Each block is injected on its
; own (not combined): a combined injection would let a multi-line Anubis
; comment at the end of the preambule cover the sentences that follow.
((anubis_block) @injection.content
 (#set! injection.language "anubis"))

; MAML documentation: the MAML compiler reads the whole file as text. One
; MAML document made of everything but the sentences: the comments and the
; Anubis code. The sentences are left out for speed: with their parentheses,
; they make big flat MAML operands, slow to query (each cursor move,
; matchparen queries the captures at every parenthesis on screen).
; Outside $begin...$end nothing is captured, so a file without MAML is
; untouched. Each piece takes the character that follows it (#offset!, as
; in the Anubis injections): a comment piece then ends with its newline, and
; no MAML token runs from one piece into the next.
; The comments of the Anubis code also get MAML from the Anubis injections
; (a partial document): without $begin it colours nothing, with one it
; gives the same colours.
; One single pattern: combined injections are grouped by pattern.
([(comment) (anubis_block)] @injection.content
 (#offset! @injection.content 0 0 0 1)
 (#set! injection.language "maml")
 (#set! injection.combined))
