# tree-sitter-anubis

A tree-sitter grammar for Anubis


# July 2026 migration to TS 0.26

## Rust

```sh
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cargo install cargo-binstall
cargo binstall tree-sitter-cli
tree-sitter --version # Currently 0.26.11
```

## Node

- Updated package.json
- then `npm install`


---

# Using with Neomvim 0.12+ (no plugins required)


**Requirements:** [`tree-sitter-cli`](https://github.com/tree-sitter/tree-sitter) and a C compiler (`cc`/`gcc`/`clang`) on your `PATH`.

```bash
npm install -g tree-sitter-cli   # or: cargo install tree-sitter-cli
```

**1. Clone and build the parser:**
```bash
git clone https://github.com/HerrmannM/tree-sitter-anubis
cd tree-sitter-anubis
mkdir -p ~/.config/nvim/parser
tree-sitter build --output ~/.config/nvim/parser/anubis.so
```

**2. Install the highlight query:**
```bash
mkdir -p ~/.config/nvim/queries/anubis
cp queries/highlights.scm ~/.config/nvim/queries/anubis/highlights.scm
```

**3. Register the `.anubis` filetype**, in your `init.lua` (~/.config/nvim/init.lua):
```lua
vim.filetype.add({ extension = { anubis = "anubis" } })
```

**4. Enable highlighting on that filetype**, also in `init.lua`:
```lua
vim.api.nvim_create_autocmd('FileType', {
  pattern = 'anubis',
  callback = function() vim.treesitter.start() end,
})
```

Open any `.anubis` file — it should now be highlighted. Run `:checkhealth vim.treesitter` if it isn't.

**To update later:** pull the repo, re-run step 1 and step 2, then restart Neovim.

---

## Development

**Prerequisites:** `tree-sitter-cli`, a C compiler, and (only if you touch the respective bindings) Node.js for `binding.gyp` or a Rust toolchain for `Cargo.toml`.

### Iterating on the grammar (`grammar.js`) — no Neovim needed

```bash
tree-sitter generate                      # regenerate src/parser.c from grammar.js
tree-sitter parse test/some_file.anubis   # dump the parse tree as text
tree-sitter test                          # run test/corpus/*.txt
```

This is the fast loop — check the tree shape and corpus tests before ever opening Neovim.

### Iterating on highlighting (`queries/highlights.scm`) — no rebuild needed

Symlink the queries folder into your Neovim config once, so edits are live immediately:
```bash
mkdir -p ~/.config/nvim/queries
ln -s /path/to/tree-sitter-anubis/queries ~/.config/nvim/queries/anubis
```

Then, inside Neovim on a `.anubis` buffer:
- `:InspectTree` — live parse tree of the buffer, to find node names to query against
- `:EditQuery anubis` — live query editor; matches highlight in the source buffer as you type, no save/restart needed

Once a query works in `:EditQuery`, copy it into `queries/highlights.scm` — it's symlinked, so reopening the buffer (`:e!`) picks it up. No rebuild required for query-only changes.

### After a grammar change — rebuilding for real end-to-end testing

```bash
tree-sitter generate
tree-sitter build --output ~/.config/nvim/parser/anubis.so
```
Then **restart Neovim** — a loaded parser `.so` can't be hot-swapped mid-session; only a fresh `nvim` process picks up the rebuilt binary.

### Quick reference

| Change you want | Edit | Then run |
|---|---|---|
| Language syntax/rules | `grammar.js` | `tree-sitter generate`, `tree-sitter test` |
| Highlighting only | `queries/highlights.scm` | nothing — reopen the buffer |
| Both, tested live in Neovim | `grammar.js` + `queries/highlights.scm` | `tree-sitter generate`, `tree-sitter build --output ~/.config/nvim/parser/anubis.so`, restart Neovim |

