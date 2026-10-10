// APG2 (Anubis Parser Generator, version 2) source files: .apg2
//
// Deliberately simple: line based, close to a regexp colouring.
// Reference: library/APG/apg2_grammar.apg2 (APG2 written in APG2).
//
// A file is:
//
//   <prelude>        free text, ignored by APG2 (often MAML documentation)
//   #APG2            column 0
//   <Anubis code>    copied at the beginning of the generated file
//   #name            column 0: the name of the parser, starts the grammar
//   <grammar>        items, and comments (anything else)
//   #                column 0: end of the grammar
//   <Anubis code>    copied at the end of the generated file
//
// In the grammar, an item starts with a word at column 0 and ends with a dot:
//   lexer token ignore type left right nonassoc macro list apply function
//   @name = (...).            macro definition
//   NAME(...): ... [prec].    grammar rule (non terminal at column 0)
//   name(...).                macro expansion (other lowercase word)
// Everything else (indented text, `$...` at column 0) is ignored by APG2,
// hence a comment.
//
// Within an item, a line break must be followed by an indentation: an item
// never continues on a non blank line at column 0. A forgotten dot or `)`
// then stays an error local to its item.
//
// Parenthesized expressions `(...)` are balanced, `#x` escapes a character
// (`(#().` is the regexp of a `(`). Their content is not analysed: regexps,
// Anubis types and Anubis expressions.

/// <reference types="tree-sitter-cli/dsl" />

const KEYWORDS = [
  'lexer', 'type', 'left', 'right', 'nonassoc',
  'macro', 'list', 'apply', 'function',
];

module.exports = grammar({
  name: 'apg2',

  // Line based: whitespace and newlines are explicit.
  extras: $ => [],

  word: $ => $.symbol,

  rules: {

    source_file: $ => seq(
      optional($.prelude),
      optional(seq(
        $.apg2_marker,
        optional($.anubis_block),
        optional(seq(
          $.grammar_name,
          repeat($._main_item),
          optional(seq($.end_marker, optional($.anubis_block))),
        )),
      )),
    ),

    // --- Verbatim parts: whole lines
    prelude: $ => repeat1($._line),
    anubis_block: $ => repeat1($._line),
    _line: $ => /[^\n]+\n?|\n/,

    // Markers beat a whole line (lexical precedence).
    apg2_marker: $ => token(prec(1, /#APG2[^\n]*\n?/)),
    grammar_name: $ => token(prec(1, /#[a-z][A-Za-z0-9_]*/)),
    end_marker: $ => '#',

    // --- The grammar
    _main_item: $ => choice(
      '\n',
      $.comment,
      $.token_declaration,
      $.ignore_declaration,
      $.declaration,
      $.macro_definition,
      $.rule,
      $.expansion,
    ),

    // Not a letter, `@` or `#` at column 0 (or the rest of a line after an
    // item's dot).
    comment: $ => /[^A-Za-z@#\n][^\n]*/,

    token_declaration: $ => seq('token', repeat($._body), '.'),
    ignore_declaration: $ => seq('ignore', repeat($._body), '.'),
    declaration: $ => seq(field('keyword', choice(...KEYWORDS)), repeat($._body), '.'),
    macro_definition: $ => seq($.macro_name, repeat($._body), '.'),
    rule: $ => seq($.nonterminal, repeat($._body), '.'),
    expansion: $ => seq(alias($.symbol, $.macro_name), repeat($._body), '.'),

    _body: $ => choice(
      $._space,
      $._newline,
      $.symbol,
      $.nonterminal,
      $.switch,
      $.precedence,
      $.paren,
      ':', ',', '=', '@',
      $._other,
    ),

    symbol: $ => /[a-z][A-Za-z0-9_]*/,
    nonterminal: $ => /[A-Z][A-Za-z0-9_]*/,
    macro_name: $ => /@[A-Za-z_][A-Za-z0-9_]*/,
    switch: $ => /-[a-z][A-Za-z0-9_]*/,       // change of lexer: -main
    precedence: $ => seq('[', repeat($._space), $.symbol, repeat($._space), ']'),

    paren: $ => seq('(', repeat(choice(
      $._newline,
      $.paren,
      $.escape,
      alias(/[^()#\n]+/, $.text),
      alias('#', $.text),
    )), ')'),
    escape: $ => /#[^\n]/,

    _space: $ => /[ \t\r]+/,
    // A line break within an item: the next non blank line is indented.
    _newline: $ => /\n([ \t\r]*\n)*[ \t\r]+/,
    _other: $ => choice(/[^\sA-Za-z0-9_()\[\].:,=@#\-]+/, /[0-9_]+/, '-', '#'),
  },
});
