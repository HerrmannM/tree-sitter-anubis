; ============================================================================
; tree-sitter-anubis -- highlight queries
;
; Capture names follow the Neovim standard set (:h treesitter-highlight-groups).
; Later patterns win over earlier ones, so generic rules come first and are
; progressively refined below.
; ============================================================================


; --- Punctuation ------------------------------------------------------------

["(" ")"] @punctuation.bracket
[","]     @punctuation.delimiter


; --- Identifiers (generic; refined by later patterns) -----------------------

(identifier) @variable


; --- Operators --------------------------------------------------------------

(binary_tok bop: _ @operator)
(unary_tok  uop: _ @operator)

(binary_op  bop: _ @operator)
(unary_op   uop: _ @operator)


; --- Literals ---------------------------------------------------------------

(lit_integer) @number
(lit_float)   @number.float
(lit_char)    @character
(lit_string)  @string


; --- Types ------------------------------------------------------------------

(type (ty_name)  @type)
(type (ty_pname) @type)
(type "tok"      @type)

(type_decl (ty_name)  @type)
(type_decl (ty_pname) @type)

; Named arguments inside function types -- dimmed, as in the original file.
; Change to @variable.parameter if you would rather see them as parameters.
(type (identifier) @comment)

; Built-in type names. Extend the list as needed; these are ordinary ty_name
; nodes, so this is purely cosmetic and costs nothing in the grammar.
((ty_name) @type.builtin
 (#any-of? @type.builtin
   "Int" "Float" "String" "ByteArray" "Omega" "Covered"
   "Var" "QueueIn" "QueueOut" "StructPtr" "Opaque"
   "RStream" "WStream" "RWStream"
   "FunctionFamily" "Listener"))


; --- Operation arguments (OpArg / OpArgs) -----------------------------------

(operand arg: (identifier) @variable.parameter)
(operand (lazy) @keyword.modifier)


; --- Lambda arguments (FArg / FArgs) ----------------------------------------

(farg arg:  (identifier) @variable.parameter)
(farg type: "_" @type)


; --- Construction -----------------------------------------------------------

(list  ["tok"] @punctuation.bracket)
(tuple ["tok"] @punctuation.bracket)

(lambda "tok"    @punctuation.bracket)
(lambda (mapsto) @keyword.function)
(lambda (mapsto (identifier) @function))

(apply ["tok"] @punctuation.bracket)
(apply fun: (term (identifier) @function.call))

(replace ["tok"] @constructor)
(replace target: (term (identifier) @constructor))

(typecast "typecast" @type.definition)


; --- Conditionals -----------------------------------------------------------

(conditional ["if" "is" "{" "}" "then" "else"] @keyword.conditional)
(conditional (case ["then" ","] @keyword.conditional))
(conditional ["since" "tok"] @keyword.conditional)


; --- Keywords and built-in operations ---------------------------------------

(with ["with" "tok"] @keyword)

(delegate ["delegate" "tok"] @keyword)
(checking_every ["tok"] @keyword)
(cross_rec ["tok"] @keyword)

(builtin_kw) @function.builtin
(builtin "tok" @punctuation.bracket)

(snh  "tok" @keyword.exception)
(todo "tok" @comment.todo)


; --- Comments ---------------------------------------------------------------

(comment)     @comment
(out_comment) @comment


; --- Paragraph structure ----------------------------------------------------

(par_end) @punctuation.delimiter

(par_read ["read" "transmit"] @keyword.import)
(par_read "path" @string.special.path)

(par_execute ["execute"] @keyword.directive)
(par_execute "command" @string.special)

(par_def ["define" "="] @keyword)
(par_def (identifier) @function)
(par_def "fun" @punctuation.bracket)

(par_type ["type" "tok"] @keyword.type)
(par_type_alt ["tok"] @constructor)


; --- APG2 blocks ------------------------------------------------------------

(apg2 "tok"       @keyword.modifier)
(apg2 "tok_token" @variable)
(apg2 "tok_ignore" @variable)
(apg2 "tok_prec"  @punctuation.delimiter)
(apg2 "tok_lexer" @string)
(apg2 "tok_type"  @type)
(apg2 "tok_macro" @function.macro)
