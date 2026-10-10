; ============================================================================
; tree-sitter-apg2 -- injections
; ============================================================================

; The Anubis code before and after the grammar. Each block is injected on its
; own (not combined): each is a sequence of whole paragraphs, and a combined
; injection would let a multi-line Anubis comment at the end of the first
; block cover the grammar in between.
((anubis_block) @injection.content
 (#set! injection.language "anubis"))

; MAML documentation: the MAML compiler reads the whole file as text. One
; MAML document made of everything but the grammar items: the prelude, the
; comments and the Anubis code. The items are left out for speed: full of
; parentheses, they make big flat MAML operands, slow to query (each cursor
; move, matchparen queries the captures at every parenthesis on screen).
; Their parentheses are balanced, so leaving them out changes no region.
; Outside $begin...$end nothing is captured, so a file without MAML is
; untouched. Each piece takes the character that follows it (#offset!, as
; in the Anubis injections): a comment piece then ends with its newline, and
; no MAML token runs from one piece into the next.
; The comments of the Anubis code also get MAML from the Anubis injections
; (a partial document): without $begin it colours nothing, with one it
; gives the same colours.
; One single pattern: combined injections are grouped by pattern.
([(prelude) (comment) (anubis_block)] @injection.content
 (#offset! @injection.content 0 0 0 1)
 (#set! injection.language "maml")
 (#set! injection.combined))
