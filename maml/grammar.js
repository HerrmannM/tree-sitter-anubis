// MAML (Minimalist Anubis Markup Language), version 4
//
// Deliberately simple: close to a regexp colouring, plus paren grouping.
// Reference: library/MAML4/maml4_lexers.anubis (lexers) and
//            library/MAML4/maml4_parser.anubis (hand written parser).
//
// What is modelled:
//   - $begin ... $end regions; everything else is ignored (skip_text);
//   - marks `$name` with their operands `(...)`;
//   - escapes `$$ $( $) $[ $] $, $" $~ $ `, variables `$1`, line comments `$//`;
//   - verbatim operands of the primitives that have some ($latex, ...).
//
// What is NOT modelled (stays text):
//   - arities: a mark takes every operand that IMMEDIATELY follows it, i.e.
//     with nothing in between (`$em(a)(b)` takes two, `$MAML (a)` none);
//   - strings "..." and lists [a, b] inside operands.
//
// Outside operands, parentheses are text and need not be balanced. Inside an
// operand they must be (as for the MAML compiler).

/// <reference types="tree-sitter-cli/dsl" />

// Primitives with verbatim operands, from the arities in maml4_types.anubis:
// one letter per leading operand, 'm' (MAML) or 'v' (verbatim), up to the
// last verbatim one. Operands beyond the list are ordinary operands.
const VERBATIM = {
  '$latex':             'v',
  '$latexsvg':          'v',
  '$mfpic':             'v',
  '$raildiag':          'v',
  '$quote':             'v',
  '$verbatim':          'v',
  '$treediag':          'mv',
  '$colorrule':         'mv',
  '$colorruleback':     'mv',
  '$colorizerdontcall': 'mv',
  '$colorizercall':     'mmvmv',
  '$colorizercallback': 'mmvmv',
  '$displaylatex':      'vv',
  '$displaysvg':        'vv',
};

// Operands of a mark, following `modes` ('m'/'v'), then ordinary ones.
// Each operand is optional, but only in order.
function operands($, modes) {
  if (modes.length === 0) return repeat($.operand);
  const first = modes[0] === 'v' ? $.verbatim : $.operand;
  return optional(seq(first, operands($, modes.slice(1))));
}

module.exports = grammar({
  name: 'maml',

  // Whitespace is text: this is what makes the "immediately follows" rule.
  extras: $ => [],

  rules: {

    document: $ => repeat(choice($.skip_text, $.region)),

    // Before $begin and after $end: ignored by MAML.
    // Mirrors the 'skip' lexer: `$$` never starts `$begin`.
    // Lowest lexical precedence: where a region may end (no `$end` yet), the
    // tokens of the region win, so an unterminated region runs to the end.
    skip_text: $ => token(prec(-1, choice(
      /([^$]|\$\$|\$[^$b]|\$b[^e]|\$be[^g]|\$beg[^i]|\$begi[^n])+/,
      '$',
    ))),

    // A missing $end runs to the end of the input (prec.right: greedy).
    region: $ => prec.right(seq('$begin', repeat($._out_item), optional('$end'))),

    // --- Between $begin and $end, outside any operand
    _out_item: $ => choice(
      $._common,
      alias('(', $.text),
      alias(')', $.text),
    ),

    // --- Inside an operand: parentheses are balanced
    _in_item: $ => choice(
      $._common,
      $._group,
    ),

    _group: $ => seq(alias('(', $.text), repeat($._in_item), alias(')', $.text)),

    _common: $ => choice(
      $.text,
      $.mark,
      $.escape,
      $.variable,
      $.line_comment,
      alias('$', $.text),
    ),

    // A newline is a token of its own: no token ever crosses a line end. In an
    // Anubis file, the MAML document is made of comment pieces (one range per
    // comment, each ending with its newline): a token crossing two pieces
    // would also cover the code between them.
    text: $ => token(choice(/[^$()\n]+/, '\n')),

    // prec.right: an operand right after a mark belongs to it.
    mark: $ => prec.right(choice(
      seq(field('name', $.mark_name), repeat($.operand)),
      ...Object.entries(VERBATIM).map(([name, modes]) =>
        seq(field('name', alias(name, $.mark_name)), operands($, modes))),
    )),

    mark_name: $ => /\$[A-Za-z_][A-Za-z0-9_]*/,

    operand: $ => seq('(', repeat($._in_item), ')'),

    // Verbatim operand: only parentheses (balanced) and $lpar / $rpar matter.
    verbatim: $ => seq('(', repeat($._verb_item), ')'),
    _verb_item: $ => choice(
      alias(/[^$()\n]+/, $.text),
      alias('\n', $.text),
      alias('$', $.text),
      alias(choice('$lpar', '$rpar'), $.escape),
      seq(alias('(', $.text), repeat($._verb_item), alias(')', $.text)),
    ),

    escape: $ => /\$[$()\[\],"~ ]/,
    variable: $ => /\$[0-9]+/,
    line_comment: $ => /\$\/\/[^\n]*\n?/,
  },
});
