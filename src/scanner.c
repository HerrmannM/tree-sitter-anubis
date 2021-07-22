#include <stdio.h>
#include <tree_sitter/parser.h>

enum TokenType {
    DOT,
    ENDDOT
};

// --- --- --- Need to define 5 functions

// This function should create your scanner object.
// It will only be called once anytime your language is set on a parser.
// Often, you will want to allocate memory on the heap and return a pointer to it.
// If your external scanner doesn’t need to maintain any state, it’s ok to return NULL.
void * tree_sitter_anubis_external_scanner_create() {
    return NULL;
}

// This function should free any memory used by your scanner.
// It is called once when a parser is deleted or assigned a different language.
// It receives as an argument the same pointer that was returned from the create function.
// If your create function didn’t allocate any memory, this function can be a noop.
void tree_sitter_anubis_external_scanner_destroy(void *payload) { }


// This function should copy the complete state of your scanner into a given byte buffer,
// and return the number of bytes written.
// The function is called every time the external scanner successfully recognizes a token.
// It receives a pointer to your scanner and a pointer to a buffer.
// The maximum number of bytes that you can write is given by the TREE_SITTER_SERIALIZATION_BUFFER_SIZE constant,
// defined in the tree_sitter/parser.h header file.
//
// The data that this function writes will ultimately be stored in the syntax tree so
// that the scanner can be restored to the right state when handling edits or ambiguities.
// For your parser to work correctly, the serialize function must store its entire state,
// and deserialize must restore the entire state.
// For good performance, you should design your scanner
// so that its state can be serialized as quickly and compactly as possible.
unsigned tree_sitter_anubis_external_scanner_serialize(
    void *payload,
    char *buffer
) { return 0; }


// This function should restore the state of your scanner based the bytes
// that were previously written by the serialize function.
// It is called with a pointer to your scanner,
// a pointer to the buffer of bytes, and the number of bytes that should be read.
void tree_sitter_anubis_external_scanner_deserialize(
    void *payload,
    const char *buffer,
    unsigned length
) { }


// This function is responsible for recognizing external tokens.
// It should return true if a token was recognized, and false otherwise.
// It is called with a “lexer” struct with the following fields:
//
// int32_t lookahead
//  The current next character in the input stream, represented as a 32-bit unicode code point.
//
// TSSymbol result_symbol
//  The symbol that was recognized.
//  Your scan function should assign to this field one of the values from the TokenType enum, described above.
//
// void (*advance)(TSLexer *, bool skip)
//  A function for advancing to the next character.
//  If you pass true for the second argument, the current character will be treated as whitespace.
//
// void (*mark_end)(TSLexer *)
//  A function for marking the end of the recognized token.
//  This allows matching tokens that require multiple characters of lookahead.
//  By default (if you don’t call mark_end),
//  any character that you moved past using the advance function will be included in the size of the token.
//  But once you call mark_end, then any later calls to advance will not increase the size of the returned token.
//  You can call mark_end multiple times to increase the size of the token.
//
// uint32_t (*get_column)(TSLexer *)
//  (Experimental) A function for querying the current column position of the lexer.
//  It returns the number of unicode code points (not bytes) since the start of the current line.
//
// bool (*is_at_included_range_start)(TSLexer *)
//  A function for checking if the parser has just skipped some characters in the document.
//  When parsing an embedded document using the ts_parser_set_included_ranges function (described in the multi-language document section),
//  your scanner may want to apply some special behavior when moving to a disjoint part of the document.
//  For example, in EJS documents, the JavaScript parser uses this function to enable inserting automatic semicolon tokens in between the code directives, delimited by <% and %>.


bool tree_sitter_anubis_external_scanner_scan(
    void *payload,
    TSLexer *lexer,
    const bool *valid_symbols
) {
    if(valid_symbols[ENDDOT] || valid_symbols[DOT]){ //fprintf(stderr, "called at %d with LA '%c' ... ", lexer->get_column(lexer), (char)lexer->lookahead);
        // Skip spaces
        while(isspace(lexer->lookahead)){ lexer->advance(lexer, true); }

        if(lexer->lookahead == '.'){ //fprintf(stderr, "in... ", lexer->get_column(lexer), (char)lexer->lookahead);
            // We read a dot: advance and mark the end of the token.
            // If it is follow by a space, it is a "enddot", else it is a "dot" unless it is followed by punctuation
            lexer->advance(lexer, false);
            lexer->mark_end(lexer);

            int32_t c = lexer->lookahead;

            if( isspace(c) ){ //fprintf(stderr, "enddot %d\n", lexer->get_column(lexer));
                lexer->result_symbol = ENDDOT;
                return true;
            } else // Do not match dot if we are going to read .. or .>
                if(c != '.' || c!= '>') { //fprintf(stderr, "dot %d\n", lexer->get_column(lexer));
                lexer->result_symbol = DOT;
                return true;
            }
        } //else { fprintf(stderr, "out\n"); }
    }
    return false;
}
