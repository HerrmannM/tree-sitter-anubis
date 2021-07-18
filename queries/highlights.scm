["(" ")" ","]@Delimiter
(identifier)@Identifier
(binary_tok bop:_@Operator)
(unary_tok uop:_@Operator)



(type (ty_name)@Type)
(type (ty_pname)@Type)
(type "fun"@Function)

(type_decl (ty_name)@Type)
(type_decl (ty_pname)@Type)
(type_decl "fun"@Function)

(type (ty_fun (arrow)@Type))

(type (ty_prod "tok"@Type))



(operand type:"_"@Type)
(operand (identifier)@Identifier)



(term (lit_integer)@Number)
(term (lit_float)@Float)
(term (lit_char)@Character)
(term (lit_string)@String)

(term (binary_op bop:_@Operator))
(term (unary_op uop:_@Operator))

(term (list  ["tok"]@Structure))
(term (tuple ["tok"]@Structure))

(term (lambda [(mapsto) "tok"]@Structure))
(term (lambda (mapsto (identifier)@Function)))
(term (apply ["tok"]@Function))
(term (apply fun:(term (identifier)@Function)))

(term (conditional ["if" "is" "{" "}" "then" "else"]@Conditional))
(term (conditional (case ["then" ","]@Conditional)))

(term (typecast "typecast"@Typedef))

(term (conditional ["since" ","]@Statement))
(term (delegate ["delegate" "tok"]@Statement))
(term (with ["with" "tok"]@Statement))
(term (checking_every ["tok"]@Statement))

(term (snh "tok"@Exception))
(term (todo "tok"@Todo))


(comment)@Comment
(out_comment)@Comment



((_)  (par_end)@Define .)


(par_read ["read" "transmit"]@Define "path"@Include)
(par_execute ["execute"]@Define "command"@Include)


(par_def ["define" "="]@Define)
(par_def ((identifier)@function["fun"]@Function))


(par_type ["type" "tok"]@Define)
(par_type_alt ["tok"]@Function)

