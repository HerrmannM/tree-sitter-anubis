// Updated on 24/09/2026

// --- --- --- Helpers --- --- ---
// Type completion for tree sitter DSL like 'prec'
/// <reference types="tree-sitter-cli/dsl" />

// Match a possibly empty 'sep' separated list
// If specified, delimiters (lp and rp) must be match even when the list is empty (e.g. '()' or '[]').
function sep0(rule, lp=null, rp=null, sep=","){
  body = optional(seq(rule, repeat(seq(sep, rule)), optional(sep)))
  if(lp != null){ body=seq(lp, body) }
  if(rp != null){ body=seq(body, rp) }
  return body
}

/// Match a non empty list of 'sep' separated list
function sep1(rule, lp=null, rp=null, sep=","){
  body = seq(rule, repeat(seq(sep, rule)), optional(sep))
  if(lp != null){ body=seq(lp, body) }
  if(rp != null){ body=seq(body, rp) }
  return body
}

// --- --- --- Aliases --- --- ---

// 'prec' provided by tree-sitter
const right = prec.right;
const left = prec.left;


// --- --- --- Tokens database --- --- ---
// One row per precedence level, from loosest (first) to tightest (last):
// the row index IS the precedence level (precedence is changed by moving rows).
// Each row is [associativity, entries].
//
// Entry fields (all optional):
//   tok:    $ => rule     The token. Generates a grammar rule with the entry's name.
//   binary: true          `a <tok> b` is an expression, at this row's precedence.
//   unary:  "entry name"  `<tok> a` is an expression, at the precedence of the
//                         named entry (its own name for its own row).
// An entry without `tok` only defines a precedence level: PREC.name(rule).
//
// Mirrors the %left/%right table of grammar.y.
const TOKS = [
  // low precedence
  [right, {low:{}} ],
  // Keywords, literals
  [right, {
    if:{},
    builtin:{},
    lit_integer:{ tok: $=>choice( /[0-9]+/, /0[Xx][0-9A-Fa-f]+/) },
    lit_float:{tok: $=> /[0-9]+\.[0-9]+/},
    lit_char:{ tok: $ => /'([^'\\\n]|\\[^\n])'/ },
    lit_string:{ tok: $ => /"(?:[^"\\]|\\.)*"/ }
    }
  ],
  // Separators
  [right, { comma:{} }],
  [right, { doublecolon:{tok: $=>"::", binary:true} } ],
  // Mapsto
  [right, {
    // The ')' is folded into this token so the lexer can tell a lambda from a
    // parenthesised term (beyond LR(1) otherwise).
    // grammar.y:783 (`sym |-> Term`) is unreachable: ok, parens are mandatory
    mapsto:{tok: $=>/\)\s*\|->/},
    mapstorec:{tok: $=>seq(/\)\s*\|-/, $.identifier, "->")},
    }
  ],
  [right, { colon:{tok: $=>":", binary:true} } ],
  // Separator
  [right, { semicolon:{tok: $=>";", binary:true} }],
  // Identifier: just the precedence
  [right, { identifier:{} }],
  // Other
  [right, {prec_of_term:{}}],
  [right, {prec_of_type:{}}],
  [right, {prec_sym_type:{}}],
  // Logical operators
  [right, { vbar:{tok: $=>"|", binary:true} }],
  [right, { ampersand:{tok: $=>"&", binary:true} }],
  [right, {
    leftshift:{tok: $=>"<<", binary:true},
    rightshift:{tok: $=>">>", binary:true},
  }],
  // grammar.y: `~ Term` has no %prec, so it uses tilde's own (low) level:
  // `~a = b` is `~(a = b)`
  [right, { tilde:{tok: $=>"~", unary:"tilde"} }],
  [right, {
    equals:{tok: $=>"=", binary:true},
    eqlike:{tok: $=>choice("!=", "/=", ">=<", ">=+", "+=<", ">+", "+<", ">=-", "-=<", ">-", "-<", ">=", "=<", ">", "<"), binary:true},
    exchange:{tok: $=>"<->", binary:true},
    write:{tok: $=>"<-", binary:true}
  }],
  // Arithmetic operators
  // grammar.y: unary + and - use `%prec unaryminus` (the `unary` row below)
  [right, {
    plus:{tok: $=>"+", binary:true, unary:"unary"},
    plusplus:{tok: $=>"++", binary:true}
  }],
  [left, {
    minus:{tok: $=>"-", binary:true, unary:"unary"},
    absminus:{tok: $=>"|-|", binary:true},
  }],
  // grammar.y: `* Term` (Var read) has no %prec, so it uses star's own level:
  // `*v.x` is `*(v.x)`
  [right, { star:{tok: $=>"*", binary:true, unary:"star" } }],
  [right, { percent:{tok: $=>"%", binary:true } }],
  [left, {
    slash:{tok: $=>"/", binary:true },
    backslash:{tok: $=>"\\", binary:true },
    dot:{tok: $=>$._dot, binary:true },
  }],
  [right, { carret:{tok: $=>"^", binary:true } }],
  // grammar.y `unaryminus`: prefix + and -
  [right, { unary:{} }],
  // Type level, not a binary operator of terms
  [right, { arrow:{tok: $=>"->"} }],
  // Paired delimiters () [] {}
  [right, { pdelim:{} }],
  // Other dots
  [left, {
    dotdot:{tok: $=>$._dotdot, binary:true },
    dotsup:{tok: $=>".>", binary:true },
  }],
  // high precedence
  [right, {high:{}}]
];
 
 
/// Generate precedences, tokens, and rules from TOKS
///
///   PREC.name(rule)        precedence + associativity of entry `name`
///   TOKRULES               one grammar rule per entry with `tok`
///   mkChoiceBinaryOp($,l,r)  choice of all `l <op> r`, each with its precedence
///   mkChoiceBinaryTok($)     choice of the bare binary operator tokens
///   mkChoiceUnaryOp($,r)     choice of all `<op> r`, each with its precedence
///   mkChoiceUnaryTok($)      choice of the bare unary operator tokens
///
/// Token rules are registered WITHOUT precedence: outside token(), a prec on a
/// one-token rule is a parse precedence that can never apply. (And it must not
/// become lexical precedence: that would beat longest match, e.g. `+<` would
/// lex as `+` then `<`.) Precedence only matters on the operator expressions.
const [PREC, TOKRULES, mkChoiceBinaryOp, mkChoiceBinaryTok, mkChoiceUnaryOp, mkChoiceUnaryTok] = (() => {
  const precOf = {};    // name -> (rule) => assoc(level, rule)
  const tokRules = {};  // name -> $ => rule
  const binary = [];    // [name]
  const unary = [];     // [name, name of the entry giving the precedence]
 
  TOKS.forEach(([assoc, entries], level) => {
    for (const [name, info] of Object.entries(entries)) {
      if (name in precOf) throw new Error(`TOKS: duplicate entry '${name}'`);
      precOf[name] = (rule) => assoc(level, rule);
 
      if (!info.tok) {
        if (info.binary || info.unary) throw new Error(`TOKS: operator '${name}' has no 'tok'`);
        continue;
      }
      tokRules[name] = info.tok;
      if (info.binary) binary.push(name);
      if (info.unary) unary.push([name, info.unary]);
    }
  });
 
  // Unary precedences may name a later row: check once every row is known.
  for (const [name, precName] of unary) {
    if (!(precName in precOf)) throw new Error(`TOKS: unary '${name}' uses unknown precedence '${precName}'`);
  }
 
  const mkChoiceBinaryOp = ($, left, right) => choice(...binary.map(name =>
    precOf[name](seq(field('left', left), field('bop', $[name]), field('right', right)))));
 
  const mkChoiceBinaryTok = ($) => choice(...binary.map(name => field('bop', $[name])));
 
  const mkChoiceUnaryOp = ($, operand) => choice(...unary.map(([name, precName]) =>
    precOf[precName](seq(field('uop', $[name]), field('rule', operand)))));
 
  const mkChoiceUnaryTok = ($) => choice(...unary.map(([name]) => field('uop', $[name])));
 
  return [precOf, tokRules, mkChoiceBinaryOp, mkChoiceBinaryTok, mkChoiceUnaryOp, mkChoiceUnaryTok];
})();








module.exports = grammar({
  name: 'anubis',
 
  // `block_comment` is external: being an extra, it is valid in every state,
  // so the external scanner runs before every token. That is what lets it
  // emit column-0 paragraph keywords even inside an unterminated paragraph.
  extras: $ => [
    /\s|\\\r?\n/,
    $.comment,
    $.block_comment,
  ],
 
  word: $ => $._identifier,
 
  // ORDER MUST MATCH `enum TokenType` in src/scanner.c
  externals: $ => [
    $._dot,
    $._dotdot,
    $._dotdotdot,
    $._enddot,
    $.block_comment,
    // Outside paragraphs
    $.out_comment,      // blank / indented lines: free text
    $.stray_text,       // column-0 text that is not a paragraph keyword
    $.todo_line,        // ^to do: ...
    // Paragraph keywords: only ever produced at column 0
    $.kw_type,          // [Tt]ype | [Pp]ublic type
    $.kw_type_alias,    // [Tt]ype alias | [Pp]ublic type alias
    $.kw_define,        // [Dd]efine [macro|inline] | [Pp]ublic define [macro|inline] | [Oo]peration
    $.kw_module,        // [Gg]lobal define | [Mm]odule
    $.kw_describe,      // [Dd]escribe
    $.kw_c_constructors,// C constructors for
    $.kw_read,          // [Rr]ead | [Tt]ransmit
    $.kw_execute,       // [Ee]xecute
    // Sentinels, never produced
    $._apg2_guard,      // valid only inside an APG2 block
    $._error_sentinel,  // valid only during error recovery
  ],
 
  rules: {
 
    // --- --- --- Entry point
    anubis_source: $ => seq(
      repeat($._top_item),
      optional(seq($.apg2, repeat($._top_item)))
    ),
 
    _top_item: $ => choice(
      $.out_comment,
      $.stray_text,
      $.todo_line,
      $.par_read,
      $.par_execute,
      $.par_def,
      $.par_type,
      $.par_type_alias,
      $.par_describe,
      $.par_c_constructors,
    ),
 
    apg2: $ => seq(
      alias("#APG2", $.apg2_marker),
      repeat($._top_item),
      alias(/#[a-z_]\w+/, $.apg2_name),
      repeat(choice(
        alias(/\ntoken.*/,    $.apg2_token),
        alias(/\nignore.*/,   $.apg2_ignore),
        alias(/\nlexer.*/,    $.apg2_lexer),
        alias(/\nleft.*/,     $.apg2_prec),
        alias(/\nright.*/,    $.apg2_prec),
        alias(/\ntype .*/,    $.apg2_type),
        alias(/\n@.*/,        $.apg2_macro),
        alias(/\n[a-zA-Z]+.*/, $.apg2_other),
        alias(/\n.*/,         $.out_comment),
        $._apg2_guard,
      )),
      alias("\n#", $.apg2_marker),
    ),
 
 
    // --- Expands generated rules
    ...TOKRULES,
 
    // `//` line comment (block comments are handled by the scanner: they nest)
    comment: $ => token(seq('//', /[^\n]*/)),
 
    // End of paragraph. Also used for `...` at the end of an open type.
    par_end: $ => $._enddot,
 
 
    // --- --- --- Small paragraphs
 
    // read path | transmit path  -- no end dot, ends with the path
    par_read: $ => seq(
      $.kw_read,
      field('path', choice(alias(/[^"\s]\S*/, $.path), $.lit_string))
    ),
 
    // execute <rest of the line>
    par_execute: $ => seq(
      $.kw_execute,
      field('command', alias(/[^\n]+/, $.command))
    ),
 
    // Describe T1, T2, ... .
    par_describe: $ => seq(
      $.kw_describe,
      sep1(field('type', $.type)),
      $.par_end
    ),
 
    // C constructors for Symbol = Type .
    par_c_constructors: $ => seq(
      $.kw_c_constructors,
      field('name', $.ty_name),
      "=",
      field('type', $.type),
      $.par_end
    ),
 
 
    // --- --- --- DEFINE
    par_def: $ => seq(
      choice(
        $.kw_define,
        seq($.kw_module, optional(field('destination', $.adm_dest)))
      ),
      field('type', $.type),
      choice(
        // name, name(), name(args)
        seq(field('name', $.identifier), optional(seq("(", optional($.opargs), ")"))),
        // operator definitions: a + b, ~a
        seq($.operand, field('operator', $.binary_tok), $.operand),
        seq(field('operator', $.unary_tok), $.operand)
      ),
      optional(seq("=", field('body', $.term))),
      $.par_end
    ),
 
    // Module destination: "dir" | @"dir" | @@"dir"
    adm_dest: $ => seq(optional(choice("@", "@@")), $.lit_string),
 
 
    // --- --- --- TYPE
    par_type: $ => seq(
      $.kw_type,
      $.type_decl, ":",
      optional(seq(
        $.par_type_alt,
        repeat(seq(optional(","), $.par_type_alt))
      )),
      choice($.par_end, alias($._dotdotdot, $.par_end))
    ),
 
    par_type_alias: $ => seq(
      $.kw_type_alias,
      $.type_decl, "=", field('type', $.type), $.par_end
    ),
 
 
    type_decl: $ => seq(
      field('name', $.ty_name),
      optional(sep1($.ty_pname, "(", ")", ","))
    ),
 
    // --- Declaration of a type: body is a list of alternatives terminated by 'par_end'
    par_type_alt: $ => PREC.high(
      choice(
        seq(field('name', $.identifier), optional(sep0($.par_type_alt_factor, "(", ")", ","))),
        seq($.par_type_alt_factor, field('operator', $.binary_tok), $.par_type_alt_factor)
      )),
 
    par_type_alt_factor: $ => PREC.comma(seq(field('type', $.type), optional(field('name', $.identifier)))),
 
    // --- --- --- TYPE EXPRESSIONS
 
    ty_name: $ => PREC.prec_sym_type(/[A-Z]\w*/),
 
    ty_pname: $ => PREC.prec_sym_type(/\$[A-Z]\w*/),
 
    // `)->` is a single glued token (as in lexer.l): aliased to `arrow` so that
    // every function-type arrow is the same node for highlighting.
    type: $ => PREC.prec_of_type(choice(
      seq("(", $.type, ")"),
 
      seq(choice($.ty_name, $.ty_pname), optional(seq("(", $._types1,
        choice(
          ")",
          seq(alias(/\)\s*->/, $.arrow), $.type)
        )
      ))),
 
      seq("(", $._typesargs1, alias(/\)\s*->/, $.arrow), $.type),
      seq("(", $._types2, ")"),
 
      seq($.type, $.arrow, $.type)
    )),
 
    _types1: $ => sep1($.type, null, null, ","),
 
    // Names inside function/tuple types are cosmetic (discarded by the compiler)
    _typesargs1: $ => choice(
      $.type,
      seq($.type, field('name', $.identifier)),
      seq($.type, ",", $._typesargs1),
      seq($.type, field('name', $.identifier), ",", $._typesargs1),
    ),
 
    _types2: $ => choice(
      seq($.type, ",", $.type),
      seq($.type, field('name', $.identifier), ",", $.type),
      seq($.type, ",", $.type, field('name', $.identifier)),
      seq($.type, field('name', $.identifier), ",", $.type, field('name', $.identifier)),
      seq($.type, ",", $._types2),
      seq($.type, field('name', $.identifier), ",", $._types2),
    ),
 
 
    // --- --- --- TERM
    term: $ => choice(
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
      $.builtin,
      $.checking_every,
      PREC.high(seq("(", $.term, ")"),)
    ),
 
 
    // yy__serialize | yy__unserialize | yy__cover | yy__uncover  lpar Term rpar
    builtin_kw: $ => choice("serialize", "unserialize", "cover", "uncover"),
 
    builtin: $ => PREC.builtin(seq(
      $.builtin_kw, "(", $.term, ")"
    )),
 
 
    // Identifier: in two rules so we can have _identifier in the "words"
    identifier: $ => PREC.identifier(choice($._identifier, $._jocker)),
    _identifier: $ => /([a-z]|_[a-zA-Z0-9_])[a-zA-Z0-9_]*/,
    _jocker: $ => '_',
 
    // Binary op: this function generate a choice
    // We also generate the list of tokens (used when defining symbols)
    binary_op: $ => mkChoiceBinaryOp($, $.term, $.term),
    binary_tok: $ => mkChoiceBinaryTok($),
 
 
    // Unary op: this function generate a choice
    unary_op: $ => mkChoiceUnaryOp($, $.term),
    unary_tok: $ => mkChoiceUnaryTok($),
 
 
    // Product (a, b, c)
    tuple: $ => PREC.pdelim(sep1($.term, "(", ")", ",")),
 
    // List. The cons dot is an end-dot (must be followed by a white).
    // [], [h . t], [a,...,z] and [a,b,c... . t]
    list: $ => seq(
      "[",
      sep0($.term, null, null, ","),
      optional(seq(alias($._enddot, $.cons_dot), $.term)),
      "]"
    ),
 
    // Explicit typing (cast)
    typecast: $ => PREC.pdelim(seq("(", field('type', $.type), ")", $.term)),
 
    // delegate term, term
    // delegate (term) term, term
    delegate: $ => PREC.comma(seq($._delegate, $.term, ",", $.term)),
    _delegate: $ => PREC.high(seq("delegate", optional(seq("(", $.term, ")")))),
 
    // with name = term, ..., term
    with: $ => PREC.comma(seq(
      "with",
      repeat1(PREC.comma(seq(field('name', $.identifier), "=", $.term, ","))),
      $.term
    )),
 
 
    // <function>(<args>)
    // <function>[<args>]
    apply: $ => PREC.pdelim(seq(
      field("fun", $.term),
      choice(
        sep0(field("arg", $.term), "(", ")", ","),
        sep0(field("arg", $.term), "[", "]", ",")
      )
    )),
 
    // <term>[<name> <- <term>]
    replace: $ => PREC.pdelim(seq(
      field("target", $.term),
      "[", field("field", $.identifier), $.write, field("value", $.term), "]"
    )),
 
 
    // Closure
    lambda: $ => choice(
      $._lambda_simple,
      $._lambda_rec
    ),
 
    // (<function arguments>) |-> <term>
    // The ')' is folded into the `mapsto` token (see TOKS).
    _lambda_simple: $ => PREC.mapsto(seq(
      "(", $.fargs, $.mapsto, field('body', $.term)
    )),
 
    // (<function arguments>) |-f-> <term>
    _lambda_rec: $ => PREC.mapsto(seq(
      "(", $.fargs, alias($.mapstorec, $.mapsto), field('body', $.term)
    )),
 
    // Cross recursive closure
    cross_rec: $ => seq(
      "cross_recursive",
      sep0(alias($._lambda_rec, $.lambda), "{", "}", ",")
    ),
 
    // FArg: Type sym | _ sym
    farg: $ => PREC.comma(seq(
      field("type", choice($.type, alias("_", $.type_joker))),
      field("arg", $.identifier)
    )),

 
    // FArgs1: one or more, comma OPTIONAL between, none trailing
    fargs: $ => seq(
      $.farg,
      repeat(seq(optional(","), $.farg))
    ),
 
 
    // Lazy node:
    lazy: $ => "lazy",
 
    // OpArg: lazy? Type sym ( '[' Term ']' )?   -- collapses all four productions
    operand: $ => seq(
      optional(field("lazy", $.lazy)),
      field("type", $.type),
      field("arg", $.identifier),
      optional(seq("[", field("size", $.term), "]"))
    ),
 
    // OpArgs1: same shape as FArgs1
    opargs: $ => seq(
      $.operand,
      repeat(seq(optional(","), $.operand))
    ),
 
 
    // Conditional
    // 1 if <test> then <term> else <term>
    // 2 if <test> is not <term> then <term> else <term>
    // 3 if <test> is <case>
    // 4 if <test> is <case> else <term>
    // 5 if <term> is { <cases> }
    // 6 if <term> is { <cases> else <term> }
    // 7 since <test> is <term>, <term>
    conditional: $ => PREC.if(choice(
      seq("if", field("subject", $.term),
        choice(
          seq("then", $.term, "else", $.term),                                          // 1
          seq("is", choice(
            seq("not", field("pattern", $.term), "then", $.term, "else", $.term),      // 2
            seq($.case, optional(seq("else", $.term))),                                // 3 & 4
            seq("{", repeat($.case), optional(seq("else", $.term)), "}"),              // 5 & 6
          )),
        )
      ),
 
      PREC.comma(seq("since",                                                           // 7
        field("subject", $.term), "is",
        field("pattern", $.term), ",",
        field("body", $.term)))
    )),
 
 
    case: $ => PREC.comma(seq(field("pattern", $.term), "then", field("body", $.term), optional(","))),
 
 
    // Should not happen
    snh: $ => seq("should_not_happen", "(", $.term, optional(seq(",", $.term)), ")"),
 
 
    // Todo
    todo: $ => PREC.high(seq("todo", optional(choice(
      $.lit_string,
      seq("(", $.lit_string, ")")
    )))),
 
    // checking every <term> milliseconds, wait for <term> then <term>
    checking_every: $ => seq(
      alias(/checking\s+every/, "checking every"), $.term,
      alias(/milliseconds\s*,\s+wait\s+for/, "milliseconds, wait for"), $.term,
      "then", $.term
    )
 
  }
 
});
