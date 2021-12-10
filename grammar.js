/// Helper: match a possibly empty 'sep' separated list
/// If specified, delimiters (lp and rp) must be match even when the list is empty (e.g. '()' or '[]').
function sep0(rule, lp=null, rp=null, sep=","){
    body = optional(seq(rule, repeat(seq(sep, rule)), optional(sep)))
    if(lp != null){ body=seq(lp, body) }
    if(rp != null){ body=seq(body, rp) }
    return body
}

/// Helper: match a on empty list of 'sep' separated list
function sep1(rule, lp=null, rp=null, sep=","){
    body = seq(rule, repeat(seq(sep, rule)), optional(sep))
    if(lp != null){ body=seq(lp, body) }
    if(rp != null){ body=seq(body, rp) }
    return body
}

/// Aliases
const right = prec.right;
const left = prec.left;


/// Tokens database, used to generate precedences, tokens and grammar rules
const TOKS = [
    // low precedence
    [right, {low:{}} ],
    // Keywords, literals
    [right, {
            if:{tok: $=>"if"},
            lit_integer:{ tok: $=>choice( /[0-9]+/, /0[Xx][0-9A-Fa-f]+/) },
            lit_float:{tok: $=> /[0-9]+\.[0-9]+/},
            // '_escape_sequence' defined in main grammar
            lit_char:{ tok: $ => /'([^'\\\n]|\\[^\n])'/ },
            lit_string:{ tok: $ => /"([^"])*"/ }
    }],
    // Separators
    [right, { comma:{} }],
    [right, { doublecolon:{tok: $=>"::", binary:true} } ],
    // Mapsto
    [right, {
        mapsto:{tok: $=>/\)\s*\|->/},
        mapstorec:{tok: $=>seq(/\)\s*\|-/, $.identifier, "->")},
    }],
    [right, { colon:{tok: $=>":", binary:true} } ],
    // Keywords
    [right, {
        is:{tok: $=>"is"},
        with:{tok: $=>"with"}
    }],
    [right, {
        else:{tok: $=>"else"},
        then:{tok: $=>"then"}
    }],
    // Separator
    [right, { semicolon:{tok: $=>";", binary:true} }],
    // Indentifier: just the precedence
    [right, { identifier:{} }],
    // Logical operators
    [right, { vbar:{tok: $=>"|", binary:true} }],
    [right, { ampersand:{tok: $=>"&", binary:true} }],
    [right, {
        leftshift:{tok: $=>"<<", binary:true},
        rightshift:{tok: $=>">>", binary:true},
    }],
    [right, { tilde:{tok: $=>"~", unary:true} }],
    [right, {
        equals:{tok: $=>"=", binary:true},
        eqlike:{tok: $=>choice("!=", "/=", ">=<", ">=+", "+=<", ">+", "+<", ">=-", "-=<", ">-", "-<", ">=", "=<", ">", "<"), binary:true},
        exchange:{tok: $=>"<->", binary:true},
        write:{tok: $=>"<-", binary:true}
    }],
    // Arithmetic operators
    [right, {
      plus:{tok: $=>"+", binary:true, unary:true},
      plusplus:{tok: $=>"++", binary:true}
    }],
    [left, {
        minus:{tok: $=>"-", binary:true, unary: true},
        absminus:{tok: $=>"|-|", binary:true},
    }],
    [right, { star:{tok: $=>"*", binary:true, unary: true } }],
    [right, { percent:{tok: $=>"%", binary:true } }],
    [left, {
        slash:{tok: $=>"/", binary:true },
        backslash:{tok: $=>"\\", binary:true },
        dot:{tok: $=>$._dot, binary:true },
    }],
    [right, { carret:{tok: $=>"^", binary:true } }],
        // Unary precedence used by all unary operators
    [right, { unary:{}, }],
    // Type level, do not add in binary operators
    [right, { arrow:{tok: $=>"->"} }],
    // Precedence for paired delimiters () [] {}
    [right, { pdelim:{} }],
    // Other dots
    [left, {
        dotdot:{tok: $=>$._dotdot, binary:true },
        dotsup:{tok: $=>".>", binary:true },
    }],
    // high precedence
    [right, {high:{}}]
];


/// Generate precedences, tokens, and rules based on TOKS
const [PREC, TOKRULES, mkChoiceBinaryOp, mkChoiceBinaryTok, mkChoiceUnaryOp, mkChoiceUnaryTok] = function(){
    // Init for return
    let prec = {}
    let result = {};
    let binaryOp = [];
    let binaryTok = [];
    let unaryOp = [];
    let unaryTok = [];

    // Loop through the toks by index, providing the level of precedence
    const top=TOKS.length;

    // Create unary prec
    for(let i=0; i<top; ++i){
        let [assoc, dic] = TOKS[i];
        for(const [rule_name, info] of Object.entries(dic)){ //console.error(rule_name, i)
            if(rule_name === "unary"){
                let pfun = (rule)=>assoc(i, rule);
                prec[rule_name] = pfun;
            }
        }
    }
    let unary_pfun = prec["unary"]

    // Create other rules
    for(let i=0; i<top; ++i){
        let [assoc, dic] = TOKS[i];
        // precedence function, using both associativity and a precedence level
        let pfun = (rule)=>assoc(i, rule);
        // for each rule, generate:
        for(const [rule_name, info] of Object.entries(dic)){ //console.error(rule_name, i)
            // a) An associate precedence function
            prec[rule_name] = pfun;
            // b) A rule suitable for the grammar
            if(info.tok){
                let tokfun = ($)=>pfun(info.tok($));
                result[rule_name] = tokfun;
                // c) Binary rules
                if(info.binary){ //console.error("Binary " + rule_name + " " + info.tok + " with prec " + i)
                    binaryOp.push( ($, left, right)=> pfun(seq(field('left',left), field('bop', $[rule_name]), field('right', right)) ))
                    binaryTok.push( $=>field('bop', $[rule_name]))
                }
                // d) Unary rules
                if(info.unary){ // console.error("Unary " + rule_name + " " + info.tok )
                    unaryOp.push( ($, rule)=> unary_pfun(seq(field('uop', $[rule_name]), field('rule', rule)) ))
                    unaryTok.push( $=>field('uop', $[rule_name]))
                }
            }
        }
    }

    // Create a function generating the binary ops
    let mkChoiceBinaryOp = ($, left, right)=>choice( ...binaryOp.map( (op)=> op($, left, right)));
    let mkChoiceBinaryTok = ($)=>choice( ...binaryTok.map( (op)=> op($)));

    // Create a function generating the unary ops
    let mkChoiceUnaryOp = ($, r)=>choice( ...unaryOp.map( (op)=> op($, r)));
    let mkChoiceUnaryTok = ($)=>choice( ...unaryTok.map( (op)=> op($)));

    return [prec, result, mkChoiceBinaryOp, mkChoiceBinaryTok, mkChoiceUnaryOp, mkChoiceUnaryTok];
}();



module.exports = grammar({
    name: 'anubis',

    extras: $ => [
        /\s|\\\r?\n/,
        $.comment,
    ],

    word: $ => $._identifier,

    externals: $=>[
        $._dot,
        $._dotdot,
        $._dotdotdot,
        $._enddot
    ],

    rules: {

        // --- --- --- First rule: entry point
        anubis_source: $=> seq(
            repeat(PREC.high($.out_comment)),
            choice(
                repeat($._anubis_par),
                $.apg2
            )
        ),

        _anubis_par: $=> choice(
            $.out_comment,
            $.par_read,
            $.par_execute,
            $.par_def,
            $.par_type
        ),

        apg2:$=>seq(
            alias("#APG2", "tok"),
            repeat($._anubis_par),
            alias(/#[a-z_]\w+/, "tok"),
            repeat(choice(
                alias(/\ntoken.*/, "tok_token"),
                alias(/\nignore.*/, "tok_ignore"),
                alias(/\nlexer.*/, "tok_lexer"),
                alias(/\nleft.*/, "tok_prec"),
                alias(/\nright.*/, "tok_prec"),
                alias(/\ntype .*/, "tok_type"),
                alias(/\n@.*/, "tok_macro"),
                alias(/\n[a-zA-Z]+.*/, "tok_other"),
                alias(/\n.*/, $.out_comment)
            )),
            alias("\n#", "tok"),
            repeat($._anubis_par),
        ),





        // --- --- --- Small paragraphs & misc

        // --- Expands generated rules
        ...TOKRULES,

        // http://stackoverflow.com/questions/13014947/regex-to-match-a-c-style-multiline-comment/36328890#36328890
        comment: $ => token(choice(
            seq('//', /(\\(.|\r?\n)|[^\\\n])*/),
            seq( '/*', /[^*]*\*+([^/*][^*]*\*+)*/, '/')
        )),


        par_end: $=> $._enddot,


        // --- Out of paragraph comment
        // Matching '\n' allows to read a comment block spanning several lines, including blank lines
        out_comment: $ => token(repeat1(( /[ \t]+.*\n+/  ))),


        // --- READ paragraph - no end dot, finishes when a white is encoutered
        par_read: $ => seq(choice(alias(/[Rr]ead/, "read"), alias(/[Tt]ransmit/, "transmit")), /[ \t\r]+/, alias(choice(/[^"]\S*/,$.lit_string), "path")),

        // --- EXECUTE paragraph [Ee]xecute[\ \t]+(.+)
        par_execute: $ => seq(alias(/[Ee]xecute/, "execute"),/\s+/, alias(/.*/, "command")),


        // --- --- --- TYPE
        /*
        type: $=> PREC.arrow(choice(
            seq($.ty_name, optional(sep1($.type, alias("(", "fun"), alias(")", "fun"), alias(",", "fun")))),
            $.ty_pname,
            $.ty_prod,
            $.ty_fun,
            PREC.high(seq("(", $.type, ")"))
        )),*/

        // ty_prod: $ => sep1(seq($.type, optional($.identifier)), alias("(", "tok"), alias(")", "tok"), alias(",", "tok")),

        ty_name: $ => /[A-Z]\w*/,

        ty_pname: $ => /\$[A-Z]\w*/,

        ty_fun: $ => PREC.arrow(seq($.type, $.arrow, $.type)),

        // Redo
        type: $=>PREC.arrow(choice(
            seq("(", $.type, ")"),
            seq($.ty_name, optional(seq(alias("(", "tok"), $._types1, alias(")", "tok")))),
            $.ty_pname,
            // Functional
            $.ty_fun,
            seq($.ty_name, alias("(", "fun"), $._types1, alias(/\)\s*->/, "fun"), $.type),
            seq(alias("(", "fun"), $._typeargs1, alias(/\)\s*->/, "fun"), $.type),
            // Product
            seq(alias("(", "tok"), $._types2, alias(")", "tok"))
        )),

        _types1: $=>sep1($.type),

        _typeargs1: $=>sep1(PREC.arrow(seq($.type, optional($.identifier)))),

        _types2: $=> seq(
            $.type, optional($.identifier), alias(",", "tok"),
            sep1(seq($.type, optional($.identifier)), null, null, alias(",", "tok"))
        ),



        // --- --- --- TERM
        term: $=> choice(
            $.identifier,
            $.lit_integer,
            $.lit_float,
            $.lit_char,
            $.lit_string,
            // Operators
            $.binary_op,
            $.unary_op,
            $.typecast,
            $.delegate,
            // Construction
            $.tuple,
            $.apply,
            $.replace,
            $.list,
            $.lambda,
            $.cross_rec,
            // Structure & Conditional
            $.with,
            $.conditional,
            // Other: Should not happen, todo,...
            $.snh,
            $.todo,
            $.checking_every,
            PREC.high(seq("(", $.term, ")"),)
        ),

        // Identifier: in two rules so we can have _identifier in the "words"
        identifier: $=>PREC.identifier(choice($._identifier, $._jocker)),  // change "word:" to _identifier if uncommented
        _identifier: $=>/([a-z]|_[a-zA-Z0-9_])[a-zA-Z0-9_]*/,
        _jocker: $=> '_',

        // Binary op: this function generate a choice
        // We also generate the list of tokens (used when defining symbols)
        binary_op: $=> mkChoiceBinaryOp($, $.term, $.term),
        binary_tok: $=> mkChoiceBinaryTok($),


        // Unary op: this function generate a choice
        unary_op: $=> mkChoiceUnaryOp($, $.term),
        unary_tok: $=> mkChoiceUnaryTok($),


        // Product (a, b, c)
        tuple: $=> PREC.pdelim(sep1($.term,
            alias("(", "tok"),
            alias(")", "tok"),
            alias(",", "tok")
        )),

        // List. Final 'enddot' is used (must be followed by a white).
        // [], [h . t], [a,...,z] and [a,b,c... . t]
        list: $=> (seq(
            alias("[", "tok"),
            sep0($.term, null, null, alias(",", "tok")),
            optional(seq( alias($._enddot, "tok"), $.term)),
            alias("]", "tok")
        )),

        // Explicit typing (cast). Rename parentheses so we can change their color.
        typecast: $=> PREC.pdelim(seq(alias("(", "typecast"), $.type, alias(")", "typecast"), $.term)),

        // Delegate contstruct
        // delegate term, term
        // delegate (term) term, term
        delegate: $=> PREC.comma(seq($._delegate, $.term, alias(",", "tok"), $.term)),
        _delegate: $=> PREC.high(seq("delegate", optional(seq(alias("(", "tok"), $.term, alias(")", "tok"))))),

        // with term, term
        with: $=> PREC.comma(seq(
            "with",
            repeat1(PREC.comma(seq($.identifier, alias("=", "tok"), $.term, alias(",", "tok")))),
            $.term
        )),


        // <function>(<args>)
        // <function>[<args>]
        apply: $=>PREC.pdelim(seq(
            field("fun", $.term),
            field("arg", choice(
                    sep0($.term, alias("(", "tok"), alias(")", "tok"), alias(",", "tok")),
                    sep0($.term, alias("[", "tok"), alias("]", "tok"), alias(",", "tok"))
                )
            )
        )),

        // <term>[<name> <- <terms>]
        replace: $=>PREC.pdelim(seq(
            field("target", $.term),
            field("body", seq(alias("[", "tok"), $.identifier, alias($.write, "tok"), $.term, alias("]", "tok") ))
        )),


        // Closure
        lambda: $=> choice(
          $._lambda_simple,
          $._lambda_rec
        ),


        // (<function arguments>) |-> <term>
        _lambda_simple: $=> PREC.mapsto(seq(
          alias("(", "tok"), $.fargs, $.mapsto, alias(",", "tok"),
          $.term
        )),

        // (<function arguments>) |-f-> <term>
        _lambda_rec: $=> PREC.mapsto(seq(
          alias("(", "tok"), $.fargs, alias($.mapstorec, $.mapsto), alias(",", "tok"),
          $.term
        )),

        // Cross recursive closure
        cross_rec: $=> seq(
            alias("cross_recursive", "tok"),
            sep0(alias($._lambda_rec, $.lambda), alias("{", "tok"), alias("}", "tok"), alias(",", "tok"))
        ),

        fargs:$=>sep1(PREC.mapsto(
            seq(choice($.type, alias($._jocker, '_')), $.identifier)
            )
        ),



        // An operand
        operand: $=> seq(field("type", choice($.type, alias($._jocker, '_'))), field("arg", $.identifier)),


        // Conditional
        // 1 if <test> then <term> else <term>
        // 2 if <test> is not <term> then <term> else <term>
        // 3 if <test> is <case>
        // 4 if <test> is <case> else <term>
        // 5 if <term> is { <cases> }
        // 6 if <term> is { <cases> else <term> }
        // 7 since <test> is <term>, <term>
        conditional: $=>PREC.if(choice(
            seq("if", $.term,
                choice(
                    seq( "then", $.term, "else", $.term ),                                      // 1
                    seq( "is", choice(
                        seq( alias("not","is"), $.term, "then", $.term, "else", $.term ),       // 2
                        seq($.case, optional(seq("else", $.term))),                             // 3 & 4
                        seq("{", repeat($.case), optional(seq("else", $.term)), "}"),           // 5 & 6
                    )),
                )
            ),
            PREC.comma(seq("since", $.term, alias("is", "tok"), $.term, alias(",", "tok"), $.term))                         // 7
        )),

        case: $=> PREC.comma(seq($.term, "then", $.term, optional(","))),


        // Should not happen
        snh: $=> seq(alias("should_not_happen", "tok"), alias("(", "tok"), $.term, optional(seq(alias(",", "tok"), $.term)), alias(")", "tok")),


        // Todo
        todo: $=>PREC.high(seq(alias("todo", "tok"), optional(choice(
            alias($.lit_string, "tok"),
            seq(alias("(", "tok"), alias($.lit_string, "tok"), alias(")", "tok"))
        )))),

        // Checking every...
        checking_every: $=>seq(
            alias(/checking\s+every/, "tok"), $.term,
            alias(/milliseconds\s*,\s+wait\s+for/, "tok"), $.term,
            alias("then", "tok"), $.term
        ),


        // --- --- --- --- --- --- PARAGRAPGHS


        // --- --- --- DEFINE
        par_def: $=> seq(
            choice(
                // Private
                alias(/[Dd]efine/,"define"),
                alias(/[Dd]efine\s+macro/,"define"),
                alias(/[Dd]efine\s+inline/,"define"),
                // Public
                alias(/[Pp]ublic\s+define/,"define"),
                alias(/[Pp]ublic\s+define\s+macro/,"define"),
                alias(/[Pp]ublic\s+define\s+inline/,"define"),
                // Module
                alias(/[Gg]lobal\s+define/,"define"),
                alias(/[Mm]odule/,"define")
            ),
            $.type,
            choice(
                seq($.identifier, optional(sep1($.operand, alias("(", "fun"), alias(")", "fun"), alias(",", "fun")))),
                seq($.operand, $.binary_tok, $.operand),
                seq($.unary_tok, $.operand)
            ), optional(seq("=", $.term)), $.par_end
        ),


        // --- --- --- TYPE
        par_type: $ => choice(
            // Type definition, with alternaties
            seq(
                choice(
                    alias(/[Tt]ype/, "type"),
                    alias(/[Pp]ublic\s+type/, "type"),
                ),
                $.type_decl, alias(":", "tok"),
                sep0($.par_type_alt, null, null, alias(",", "tok")),
                choice($.par_end, alias($._dotdotdot, $.par_end))
            ),
            // Alias = OtherType
            seq(
                choice(
                    alias(/[Tt]ype\s+alias/, "type"),
                    alias(/[Pp]ublic\s+type\s+alias/, "type"),
                ),
                seq($.type_decl, alias('=', "tok"), $.type, $.par_end)
            ),
        ),

        type_decl: $=> seq($.ty_name, optional(sep1($.ty_pname, alias("(", "fun"), alias(")", "fun"), alias(",", "fun")))),

        // --- Declaration of a type: body is a list of alternatives terminated by 'par_end'
        par_type_alt: $ => PREC.high(
            choice(
                seq($.identifier, optional(sep0($.par_type_alt_factor,  alias("(", "tok"), alias(")", "tok"), alias(",", "tok")))),
                seq($.par_type_alt_factor, $.binary_tok, $.par_type_alt_factor)
        )),

        par_type_alt_factor: $ => seq($.type, optional($.identifier)),
    }

});





