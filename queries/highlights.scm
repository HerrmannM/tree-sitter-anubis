["(" ")" ","]@punctuation
(identifier)@variable
(binary_tok bop:_@operator)
(unary_tok uop:_@operator)



(type (ty_name)@type)
(type (ty_pname)@type)
(type (identifier)@comment)

(type_decl (ty_name)@type)
(type_decl (ty_pname)@type)

(type "tok"@type)


(operand type:"_"@type)
(operand (identifier)@variable)



(lit_integer)@number
(lit_float)@float
(lit_char)@character
(lit_string)@string

(binary_op bop:_@operator)
(unary_op uop:_@operator)

(list  ["tok"]@structure)
(tuple ["tok"]@structure)

(lambda [(mapsto) "tok"]@structure)
(lambda (mapsto (identifier)@function))
(apply ["tok"]@function)
(apply fun:(term (identifier)@function))

(replace ["tok"]@constructor)
(replace target:(term (identifier)@constructor))

(conditional ["if" "is" "{" "}" "then" "else"]@conditional)
(conditional (case ["then" ","]@conditional))
(conditional ["since" "tok"]@constructor)

(typecast "typecast"@type.definition)

(with ["with" "tok"]@constructor)

(delegate ["delegate" "tok"]@keyword)
(checking_every ["tok"]@keyword)
(cross_rec ["tok"]@keyword)

(snh "tok"@exception)
(todo "tok"@text.todo)


(comment)@comment
(out_comment)@comment



((_)  (par_end)@define .)


(par_read ["read" "transmit"]@include "path"@normal)
(par_execute ["execute"]@preproc "command"@normal)


(par_def ["define" "="]@define)
(par_def ((identifier)@function["fun"]@function))


(par_type ["type" "tok"]@define)
(par_type_alt ["tok"]@function)

(apg2 "tok"@storageclass)
(apg2 "tok_token"@variable)
(apg2 "tok_ignore"@variable)
(apg2 "tok_prec"@punctuation)
(apg2 "tok_lexer"@string)
(apg2 "tok_type"@type)
(apg2 "tok_macro"@macro)
