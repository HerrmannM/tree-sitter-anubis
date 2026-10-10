// OpLang (operator languages) source files: .oplang
//
// Deliberately simple: line based, close to a regexp colouring.
// Reference: library/OpLang/grammar.apg2 (the OpLang parser, in APG2), and
// version1/ and version2/ for the older dialects still used by examples.
//
// The OpLang compiler only recognises leading keywords at column 0, and
// ignores anything else (comments, often MAML documentation):
//
//   preambule ... end      Anubis code copied at the beginning of the
//   postambule ... end     generated file (resp. the end); `end` at column 0,
//                          the rest of its line is ignored ("end of preambule")
//   name typing primitive definable ... sentences, ended by a dot followed by
//                          a blank (as the MAML colorizer of OpLang does)
//
// Within a sentence, a line break must be followed by an indentation: a
// sentence never continues on a non blank line at column 0. A forgotten dot
// then stays an error local to its sentence.
// Parentheses are not grouped: an unmatched one does no harm.

/// <reference types="tree-sitter-cli/dsl" />

// Leading keywords of sentences, all dialects. `rewrite` may be abbreviated.
const SENTENCE_KEYWORDS = [
  'name', 'options', 'typing', 'primitive',
  'definable', 'definable+', 'definable++',
  /rewri?t?e?/, 'unify', 'format',
  // older dialects (version1/)
  'oop', 'dop', 'dec', 'ord', 'declare', 'infos', 'host', 'control',
];

// A keyword at column 0 beats a comment line (lexical precedence).
const kw = (k) => token(prec(1, k));

module.exports = grammar({
  name: 'oplang',

  // Line based: whitespace and newlines are explicit.
  extras: $ => [],

  rules: {

    source_file: $ => repeat(choice(
      '\n',
      $.comment,
      $.sentence,
      $.ambule,
      $.read,
    )),

    // Anything the compiler ignores: a line that does not start with a
    // keyword, or the rest of a line after a sentence or `end`.
    comment: $ => token(prec(-1, /[^\n]+/)),

    // --- Preambule, postambule: Anubis code up to `end` at column 0.
    // The block starts with the rest of the keyword line. `end` is required:
    // within the block, only a line or `end` can follow, so the block cannot
    // stop early. A missing `end` is a MISSING node at the end of the file.
    ambule: $ => seq(
      field('keyword', alias(choice(kw('preambule'), kw('postambule')), $.keyword)),
      $.anubis_block,
      alias(kw('end'), $.keyword),
    ),
    anubis_block: $ => repeat1($._line),
    _line: $ => token(prec(-1, /[^\n]+\n?|\n/)),

    // `read file` (older dialects): no ending dot.
    read: $ => seq(alias(kw('read'), $.keyword), optional(alias(/[^\n]+/, $.path))),

    // --- Sentences
    sentence: $ => seq(
      alias(choice(...SENTENCE_KEYWORDS.map(kw)), $.keyword),
      repeat($._body),
      '.',
    ),

    _body: $ => choice(
      $._space,
      $._newline,
      $.identifier,
      $.layer,
      $.host_type,
      $.defined_name,
      $.number,
      $.string,
      $.line_comment,
      'where', 'as', 'with', 'lazy', 'reduce', 'control', 'no_type_of_error',
      '(', ')', '[', ']', ':', ',', '/', '-',
      $._other,
    ),

    identifier: $ => /[a-z][A-Za-z0-9_]*/,     // operator, or a variable
    layer: $ => /[A-Z][A-Za-z0-9_]*/,          // layer, metavariable
    host_type: $ => /-[A-Z][A-Za-z0-9_]*/,     // -String: an Anubis type
    defined_name: $ => /@[A-Za-z_][A-Za-z0-9_]*/,
    number: $ => /[0-9]+(\.[0-9]+)?/,
    string: $ => /"([^"\\\n]|\\.)*"/,
    line_comment: $ => /\/\/[^\n]*/,

    _space: $ => /[ \t\r]+/,
    // A line break within a sentence: the next non blank line is indented.
    _newline: $ => /\n([ \t\r]*\n)*[ \t\r]+/,
    // Anything else. A dot followed by a non blank does not end a sentence.
    _other: $ => choice(/[^\sA-Za-z0-9_()\[\]:,\/@"\-.]+/, /\.[^\s]/, /_[A-Za-z0-9_]*/, '@', '"'),
  },
});
