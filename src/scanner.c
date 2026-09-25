#include "tree_sitter/parser.h"
#include <stddef.h>

// ============================================================================
// tree-sitter-anubis external scanner
//
// Responsibilities (everything that depends on column 0 or on more than one
// character of lookahead):
//
//   1. Paragraph keywords, ONLY at column 0 (`define`, `public type alias`, ...)
//   2. Text outside paragraphs: `out_comment` (indented/blank lines),
//      `stray_text` (column-0 text that is not a keyword), `todo_line`.
//   3. Nestable block comments /* ... /* ... */ ... */.
//   4. Dot disambiguation: `.` / `..` / `...` / end-dot.
//
// ERROR RECOVERY DESIGN
// A column-0 paragraph keyword is ALWAYS returned, even when the parser is in
// the middle of a paragraph and does not expect it. The parser then sees an
// unexpected token and recovers:
//   - body complete, only the end dot missing -> a MISSING end dot is inserted,
//     the paragraph node stays intact;
//   - body incomplete -> the partial paragraph is wrapped in ERROR.
// Either way the damage stops at the next paragraph. This mirrors the fact
// that in practice paragraphs start at column 0 and bodies are indented.
//
// `block_comment` is in `extras`, which makes it valid in every parse state,
// which in turn guarantees this scanner is called before every token (that is
// what makes the forced keyword possible).
// ============================================================================

// ORDER MUST MATCH `externals` in grammar.js.
enum TokenType {
    DOT,
    DOTDOT,
    DOTDOTDOT,
    ENDDOT,
    BLOCK_COMMENT,
    OUT_COMMENT,
    STRAY_TEXT,
    TODO_LINE,
    KW_TYPE,
    KW_TYPE_ALIAS,
    KW_DEFINE,
    KW_MODULE,
    KW_DESCRIBE,
    KW_C_CONSTRUCTORS,
    KW_READ,
    KW_EXECUTE,
    APG2_GUARD,      // never returned: marks "inside an APG2 block"
    ERROR_SENTINEL,  // never returned: valid only during error recovery
};

// Results of the keyword matcher that are not token types.
#define KW_NOT_STARTED (-1)  // nothing consumed: first char cannot start a keyword
#define KW_FAILED      (-2)  // some chars consumed, but no keyword matched


// --- --- --- Helpers (all static: grammars are linked together in editors)

static inline bool is_ws(int32_t c) {
    return c == ' ' || c == '\t' || c == '\r' || c == '\n' || c == '\f' || c == '\v';
}

static inline bool is_blank(int32_t c) { return c == ' ' || c == '\t'; }

static inline bool is_ident(int32_t c) {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_';
}

static inline void adv(TSLexer *l) { l->advance(l, false); }

// Consume `s` exactly. On mismatch, returns false (chars already matched stay consumed).
static bool eat(TSLexer *l, const char *s) {
    for (; *s; s++) {
        if (l->lookahead != (int32_t)(unsigned char)*s) return false;
        adv(l);
    }
    return true;
}

static inline bool word_end(TSLexer *l) { return !is_ident(l->lookahead); }

static bool skip_blanks(TSLexer *l) {
    bool any = false;
    while (is_blank(l->lookahead)) { adv(l); any = true; }
    return any;
}

// Consume up to (not including) the end of the line.
static void to_eol(TSLexer *l) {
    while (!l->eof(l) && l->lookahead != '\n' && l->lookahead != '\r') adv(l);
}

// After `define` has been matched and marked: optional ` macro` / ` inline`.
static void opt_define_modifier(TSLexer *l) {
    if (!skip_blanks(l)) return;
    bool ok = false;
    if (l->lookahead == 'm')      ok = eat(l, "macro");
    else if (l->lookahead == 'i') ok = eat(l, "inline");
    if (ok && word_end(l)) l->mark_end(l);
}

// After `type` has been matched and marked: optional ` alias`.
static int type_or_alias(TSLexer *l) {
    if (skip_blanks(l) && eat(l, "alias") && word_end(l)) {
        l->mark_end(l);
        return KW_TYPE_ALIAS;
    }
    return KW_TYPE;
}


// --- --- --- Paragraph keyword matcher (lexer is at column 0)
//
// Mirrors the `^`-anchored rules of lexer.l. As there, only the first letter
// is case-insensitive. Deviations (deliberate):
//   - a word boundary is required after each word (`Defined ...` at column 0
//     is stray text, not `Define` + `d`);
//   - words are separated by blanks only, not newlines.
// `Variable` and `Replaced by` are not recognised: the compiler rejects them,
// so they show up as stray text.
static int match_keyword(TSLexer *l, bool top_level) {
    int32_t c = l->lookahead;
    switch (c) {
    case 'T': case 't':
        adv(l);
        if (l->lookahead == 'y') {                       // type [alias]
            if (eat(l, "ype") && word_end(l)) { l->mark_end(l); return type_or_alias(l); }
        } else if (l->lookahead == 'r') {                // transmit
            if (eat(l, "ransmit") && word_end(l)) { l->mark_end(l); return KW_READ; }
        } else if (c == 't' && l->lookahead == 'o') {    // to do: ...   (lowercase only)
            adv(l);
            while (l->lookahead == ' ') adv(l);
            if (top_level && eat(l, "do:")) { to_eol(l); l->mark_end(l); return TODO_LINE; }
        }
        return KW_FAILED;

    case 'P': case 'p':                                  // public type [alias] | public define [...]
        adv(l);
        if (!(eat(l, "ublic") && word_end(l) && skip_blanks(l))) return KW_FAILED;
        if (l->lookahead == 't') {
            if (eat(l, "type") && word_end(l)) { l->mark_end(l); return type_or_alias(l); }
        } else if (l->lookahead == 'd') {
            if (eat(l, "define") && word_end(l)) { l->mark_end(l); opt_define_modifier(l); return KW_DEFINE; }
        }
        return KW_FAILED;

    case 'D': case 'd':                                  // define [...] | describe
        adv(l);
        if (!eat(l, "e")) return KW_FAILED;
        if (l->lookahead == 'f') {
            if (eat(l, "fine") && word_end(l)) { l->mark_end(l); opt_define_modifier(l); return KW_DEFINE; }
        } else if (l->lookahead == 's') {
            if (eat(l, "scribe") && word_end(l)) { l->mark_end(l); return KW_DESCRIBE; }
        }
        return KW_FAILED;

    case 'O': case 'o':                                  // operation
        adv(l);
        if (eat(l, "peration") && word_end(l)) { l->mark_end(l); return KW_DEFINE; }
        return KW_FAILED;

    case 'G': case 'g':                                  // global define
        adv(l);
        if (eat(l, "lobal") && word_end(l) && skip_blanks(l) && eat(l, "define") && word_end(l)) {
            l->mark_end(l);
            return KW_MODULE;
        }
        return KW_FAILED;

    case 'M': case 'm':                                  // module
        adv(l);
        if (eat(l, "odule") && word_end(l)) { l->mark_end(l); return KW_MODULE; }
        return KW_FAILED;

    case 'R': case 'r':                                  // read
        adv(l);
        if (eat(l, "ead") && word_end(l)) { l->mark_end(l); return KW_READ; }
        return KW_FAILED;

    case 'E': case 'e':                                  // execute
        adv(l);
        if (eat(l, "xecute") && word_end(l)) { l->mark_end(l); return KW_EXECUTE; }
        return KW_FAILED;

    case 'C':                                            // C constructors for
        adv(l);
        if (skip_blanks(l) && eat(l, "constructors") && skip_blanks(l) && eat(l, "for") && word_end(l)) {
            l->mark_end(l);
            return KW_C_CONSTRUCTORS;
        }
        return KW_FAILED;

    default:
        return KW_NOT_STARTED;
    }
}


// --- --- --- Out-of-paragraph comment (lexer is on a non-blank char, column > 0)
//
// Swallows this line and every following line that is blank or indented.
// Stops before the first column-0 non-blank character (keyword, stray text,
// APG2 marker...). The token never includes the final newline, so the next
// scan sees the newline and knows it is at column 0 without get_column().
static bool scan_out_comment(TSLexer *l) {
    bool more = true;
    while (more) {
        to_eol(l);
        l->mark_end(l);
        // Look at the following lines: skip empty ones, stop at column 0.
        more = false;
        while (l->lookahead == '\r' || l->lookahead == '\n') {
            adv(l);
            bool indented = false;
            while (is_blank(l->lookahead)) { adv(l); indented = true; }
            if (l->lookahead == '\r' || l->lookahead == '\n') continue;  // empty line
            more = indented && !l->eof(l);                               // indented text
            break;
        }
    }
    l->result_symbol = OUT_COMMENT;
    return true;
}


// --- --- --- Nested block comment (lexer is on '/')
static bool scan_block_comment(TSLexer *l) {
    adv(l);
    if (l->lookahead != '*') return false;
    adv(l);
    unsigned depth = 1;
    while (depth > 0) {
        if (l->eof(l)) break;                            // unterminated: runs to EOF
        if (l->lookahead == '*') {
            adv(l);
            if (l->lookahead == '/') { adv(l); depth--; }
        } else if (l->lookahead == '/') {
            adv(l);
            if (l->lookahead == '*') { adv(l); depth++; }
        } else {
            adv(l);
        }
    }
    l->mark_end(l);
    l->result_symbol = BLOCK_COMMENT;
    return true;
}


// --- --- --- Dots (lexer is on '.')
//
//   ".<ws>" / ".<EOF>" -> ENDDOT     (grammar.y: yy__enddot, purely lexical)
//   "..."              -> DOTDOTDOT
//   ".."               -> DOTDOT
//   ".>"               -> not ours (dotsup, internal lexer)
//   "."                -> DOT       (tight infix dot)
//
// Like the C lexer, the decision is lexical: a spaced dot is an end dot even
// where the grammar does not expect one (the parser then recovers on it).
static bool scan_dots(TSLexer *l, const bool *valid) {
    adv(l);
    l->mark_end(l);
    int32_t c = l->lookahead;

    if (is_ws(c) || l->eof(l)) { l->result_symbol = ENDDOT; return true; }

    if (c == '.') {
        adv(l);
        l->mark_end(l);
        if (l->lookahead == '.' && (valid[DOTDOTDOT] || !valid[DOTDOT])) {
            adv(l);
            l->mark_end(l);
            l->result_symbol = DOTDOTDOT;
            return true;
        }
        l->result_symbol = DOTDOT;
        return true;
    }

    if (c == '>') return false;

    l->result_symbol = DOT;
    return true;
}


// --- --- --- Scanner interface (stateless)

void *tree_sitter_anubis_external_scanner_create(void) { return NULL; }
void tree_sitter_anubis_external_scanner_destroy(void *p) { (void)p; }
unsigned tree_sitter_anubis_external_scanner_serialize(void *p, char *b) { (void)p; (void)b; return 0; }
void tree_sitter_anubis_external_scanner_deserialize(void *p, const char *b, unsigned n) { (void)p; (void)b; (void)n; }

bool tree_sitter_anubis_external_scanner_scan(void *payload, TSLexer *l, const bool *valid) {
    (void)payload;
    const bool recovery  = valid[ERROR_SENTINEL];
    // Inside an APG2 block, lines are handled by grammar.js regexes.
    if (!recovery && valid[APG2_GUARD]) return false;
    const bool top_level = !recovery && valid[OUT_COMMENT];
    const bool any_dot   = valid[DOT] || valid[DOTDOT] || valid[DOTDOTDOT] || valid[ENDDOT];

    // Skip whitespace, remembering whether we land at column 0.
    bool skipped = false, col0 = false;
    while (is_ws(l->lookahead)) {
        col0 = (l->lookahead == '\n');
        skipped = true;
        l->advance(l, true);
    }
    if (l->eof(l)) return false;
    // Nothing skipped: only possible at column 0 at the start of the file or
    // right after a paragraph (top level). Avoid get_column() in paragraphs.
    if (!skipped && top_level) col0 = (l->get_column(l) == 0);

    // --- Column 0: paragraph keyword (forced, see header), stray text, APG2
    if (col0) {
        int kw = match_keyword(l, top_level);
        if (kw >= 0) { l->result_symbol = kw; return true; }
        if (top_level) {
            if (kw == KW_NOT_STARTED && l->lookahead == '#') return false;  // #APG2 ...
            to_eol(l);
            l->mark_end(l);
            l->result_symbol = STRAY_TEXT;
            return true;
        }
        if (kw == KW_FAILED) return false;  // consumed part of a word: let the main lexer redo it
        // KW_NOT_STARTED inside a paragraph: fall through ('.', '/', ...)
    }

    // --- Top level, column > 0: out-of-paragraph comment
    if (top_level) return scan_out_comment(l);

    // --- Inside a paragraph (or error recovery)
    if (l->lookahead == '/' && valid[BLOCK_COMMENT]) return scan_block_comment(l);
    if (l->lookahead == '.' && (any_dot || recovery)) return scan_dots(l, valid);
    return false;
}
