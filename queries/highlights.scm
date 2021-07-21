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



(lit_integer)@Number
(lit_float)@Float
(lit_char)@Character
(lit_string)@String

(binary_op bop:_@Operator)
(unary_op uop:_@Operator)

(list  ["tok"]@Structure)
(tuple ["tok"]@Structure)

(lambda [(mapsto) "tok"]@Structure)
(lambda (mapsto (identifier)@Function))
(apply ["tok"]@Function)
(apply fun:(term (identifier)@Function))

(conditional ["if" "is" "{" "}" "then" "else"]@Conditional)
(conditional (case ["then" ","]@Conditional))

(typecast "typecast"@Typedef)

(conditional ["since" ","]@Statement)
(delegate ["delegate" "tok"]@Statement)
(with ["with" "tok"]@Statement)
(checking_every ["tok"]@Statement)
(cross_rec ["tok"]@Statement)

(snh "tok"@Exception)
(todo "tok"@Todo)


(comment)@Comment
(out_comment)@Comment



((_)  (par_end)@Define .)


(par_read ["read" "transmit"]@Define "path"@Include)
(par_execute ["execute"]@Define "command"@Include)


(par_def ["define" "="]@Define)
(par_def ((identifier)@function["fun"]@Function))


(par_type ["type" "tok"]@Define)
(par_type_alt ["tok"]@Function)

(apg2 "tok"@StorageClass)
(apg2 "tok_token"@Identifier)
(apg2 "tok_ignore"@Default)
(apg2 "tok_prec"@Delimiter)
(apg2 "tok_lexer"@String)
(apg2 "tok_type"@Type)
