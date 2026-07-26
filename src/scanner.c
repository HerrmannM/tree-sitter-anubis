#include <tree_sitter/parser.h>

// #include <stdio.h>   // uncomment if you re-enable the debug fprintf calls below

// Token types. THE ORDER MUST MATCH the `externals` array in grammar.js:
//     externals: $ => [ $._dot, $._dotdot, $._dotdotdot, $._enddot ]
enum TokenType {
    DOT,
    DOTDOT,
    DOTDOTDOT,
    ENDDOT
};


// --- --- --- Helpers
//
// NOTE: all helpers are `static`. Tree-sitter links many grammars into a single
// binary (e.g. nvim-treesitter); non-static helpers with generic names like
// `commit` will collide at link time.

// Whitespace test.
// We cannot use isspace() from <ctype.h>: lexer->lookahead is an int32_t Unicode
// code point, and isspace() is only defined for values representable as
// `unsigned char` (plus EOF). Anything else is undefined behaviour.
static inline bool is_ws(int32_t c) {
    return c == ' ' || c == '\t' || c == '\r' || c == '\n' || c == '\f' || c == '\v';
}

// End of input. Tree-sitter reports EOF as a lookahead of 0.
static inline bool is_eof(int32_t c) {
    return c == 0;
}

// Read the current lookahead character without consuming it.
static inline int32_t get_la(TSLexer *lexer) {
    int32_t c = lexer->lookahead;
    // fprintf(stderr, "  Read at %d: '%c'\n", lexer->get_column(lexer), (char)c);
    return c;
}

// Consume the current character and include it in the token being built.
static inline void commit(TSLexer *lexer) {
    lexer->advance(lexer, false);
    lexer->mark_end(lexer);
}


// --- --- --- The five functions required by the external scanner interface

// Create the scanner object. Called once when the language is set on a parser.
// This scanner is stateless, so there is nothing to allocate.
void *tree_sitter_anubis_external_scanner_create(void) {
    return NULL;
}

// Free any memory used by the scanner. Nothing was allocated, so this is a noop.
void tree_sitter_anubis_external_scanner_destroy(void *payload) {
    (void)payload;
}

// Serialize the complete scanner state into `buffer`, returning the number of
// bytes written (max TREE_SITTER_SERIALIZATION_BUFFER_SIZE). Stateless: 0 bytes.
unsigned tree_sitter_anubis_external_scanner_serialize(
    void *payload,
    char *buffer
) {
    (void)payload;
    (void)buffer;
    return 0;
}

// Restore the scanner state from bytes previously written by serialize().
// Stateless: nothing to restore.
void tree_sitter_anubis_external_scanner_deserialize(
    void *payload,
    const char *buffer,
    unsigned length
) {
    (void)payload;
    (void)buffer;
    (void)length;
}

// Recognize external tokens. Returns true if a token was recognized.
//
// Dot disambiguation, mirroring grammar.y:
//   ".<space>" or ".<EOF>"  -> ENDDOT   (end of paragraph; cf. `EndDot: yy__enddot | yy__dot yy__eof`)
//   "..."                   -> DOTDOTDOT
//   ".."                    -> DOTDOT
//   ".>"                    -> not ours; let the main lexer take `dotsup`
//   "."                     -> DOT      (binary field-access operator)
bool tree_sitter_anubis_external_scanner_scan(
    void *payload,
    TSLexer *lexer,
    const bool *valid_symbols
) {
    (void)payload;

    // Nothing we produce is expected here.
    if (!(valid_symbols[DOT]
          || valid_symbols[DOTDOT]
          || valid_symbols[DOTDOTDOT]
          || valid_symbols[ENDDOT])) {
        return false;
    }

    // fprintf(stderr, "Lexer called at %d with LA '%c'\n", lexer->get_column(lexer), (char)lexer->lookahead);

    // Skip leading whitespace (passing `true` marks it as extra, not part of the token).
    while (is_ws(lexer->lookahead)) {
        lexer->advance(lexer, true);
    }

    int32_t c = get_la(lexer);

    // Everything we produce starts with a dot.
    if (c != '.') {
        return false;
    }

    // Consume the first dot, then look at what follows.
    commit(lexer);
    c = get_la(lexer);

    // ".<space>" or ".<EOF>" -> ENDDOT.
    // The EOF case matters: a file whose final paragraph ends with '.' and has no
    // trailing newline must still terminate. grammar.y spells this out explicitly
    // as `EndDot: yy__enddot | yy__dot yy__eof`.
    if ((is_ws(c) || is_eof(c)) && valid_symbols[ENDDOT]) {
        // fprintf(stderr, "returns ENDDOT\n");
        lexer->result_symbol = ENDDOT;
        return true;
    }

    // ".." or "..."
    if (c == '.') {
        commit(lexer);
        c = get_la(lexer);

        if (c == '.' && valid_symbols[DOTDOTDOT]) {
            // fprintf(stderr, "returns DOTDOTDOT\n");
            commit(lexer);
            lexer->result_symbol = DOTDOTDOT;
            return true;
        }

        if (valid_symbols[DOTDOT]) {
            // fprintf(stderr, "returns DOTDOT\n");
            lexer->result_symbol = DOTDOT;
            return true;
        }

        // We consumed ".." but neither token is valid here.
        return false;
    }

    // ".>" is the `dotsup` operator, handled by the main lexer -- back off.
    if (c == '>') {
        return false;
    }

    // Plain "." -> DOT.
    if (valid_symbols[DOT]) {
        // fprintf(stderr, "returns DOT\n");
        lexer->result_symbol = DOT;
        return true;
    }

    // A dot was consumed but DOT is not valid in this state.
    return false;
}

