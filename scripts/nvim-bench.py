#!/usr/bin/env python3
"""Per-key response time of Neovim on a file, as felt in a terminal.

Runs the real `nvim` (your config, unless told otherwise) in a pseudo-terminal,
sends a key repeatedly as when it is held down, and measures for each key the
time until Neovim has finished drawing its effect on the screen.

  python3 scripts/nvim-bench.py FILE                     held <Down>, your config
  python3 scripts/nvim-bench.py FILE --key wheel         mouse wheel down
  python3 scripts/nvim-bench.py FILE --key ctrl-e        <C-e>
  python3 scripts/nvim-bench.py FILE --key j -n 300      any string, 300 times
  python3 scripts/nvim-bench.py FILE -- -u NONE          extra nvim arguments (after --)

Compare with `-- -u NONE` (no config, no plugin) or with the same file renamed
to .txt to see what the highlighting costs. Keys that change nothing on the
screen (e.g. <Down> on the last line) are not counted.
Python 3 standard library only; Linux / macOS (needs a pty).
"""

import argparse
import fcntl
import os
import pty
import select
import struct
import sys
import termios
import time

KEYS = {
    "down": b"\x1b[B",
    "wheel": b"\x1b[<65;20;10M",   # SGR mouse: wheel down at column 20, row 10
    "ctrl-e": b"\x05",
}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("file")
    ap.add_argument("--key", default="down", help="down (default), wheel, ctrl-e, or a literal string")
    ap.add_argument("-n", type=int, default=500, help="number of keys (default 500)")
    ap.add_argument("--size", default="50x160", help="window ROWSxCOLS (default 50x160)")
    ap.add_argument("--slow", type=float, default=25.0, help="count keys slower than this, in ms (default 25)")
    ap.add_argument("nvim_args", nargs="*", help="extra nvim arguments, after --")
    a = ap.parse_args()

    key = KEYS.get(a.key, a.key.encode())
    rows, cols = (int(x) for x in a.size.lower().split("x"))

    pid, fd = pty.fork()
    if pid == 0:
        os.environ.setdefault("TERM", "xterm-256color")
        # -n: no swap file; shortmess+=A: no prompt if the file is open elsewhere
        os.execvp("nvim", ["nvim", "-n", "-i", "NONE", "--cmd", "set shortmess+=A", *a.nvim_args, a.file])
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))

    def read_until_quiet(quiet, limit):
        """Read the screen output until nothing comes for `quiet` seconds."""
        last, start = None, time.perf_counter()
        while time.perf_counter() - start < limit:
            ready, _, _ = select.select([fd], [], [], quiet)
            if not ready:
                break
            try:
                os.read(fd, 1 << 20)
            except OSError:
                break
            last = time.perf_counter()
        return last

    read_until_quiet(1.5, 10)             # startup: config, parsers, first screen
    lat = []
    for _ in range(a.n):
        t = time.perf_counter()
        os.write(fd, key)
        last = read_until_quiet(0.004, 2)  # end of this key's screen update
        if last:
            lat.append((last - t) * 1000)
    os.write(fd, b"\x1b:qa!\r")
    read_until_quiet(0.2, 2)

    if not lat:
        sys.exit("no screen update measured (did nvim start?)")
    lat.sort()
    pct = lambda q: lat[min(len(lat) - 1, int(len(lat) * q))]
    slow = sum(x > a.slow for x in lat)
    print(f"{os.path.basename(a.file)}  key={a.key}  {len(lat)} keys  {rows}x{cols}"
          f"{'  nvim ' + ' '.join(a.nvim_args) if a.nvim_args else ''}")
    print(f"  median {pct(0.5):.1f}  p95 {pct(0.95):.1f}  p99 {pct(0.99):.1f}  max {lat[-1]:.1f} ms"
          f"   slower than {a.slow:g} ms: {slow}")


if __name__ == "__main__":
    main()
