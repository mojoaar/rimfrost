// Replay OpenCode's own theme resolver against the built theme file.
//
// The installed binary is a bun single-file executable, but its modules are
// embedded as readable JS (not bytecode), so the loader's resolver can be lifted
// straight out and run here. This extracts the contiguous source slice from
// `function ae(e)` to the next `function ZI(` — the segment holding `_1`, `de`,
// `_r`, `Jr`, `Wr`, `Xr` (the per-mode resolve the loader runs at theme load) —
// stubs the four imports the resolver path never touches, and calls the
// loader's own `_1(file, mode)` for each mode. Per-mode OK or the thrown message
// is printed, and any failure exits non-zero.
//
// NOT wired into `npm test`. It needs `~/.opencode/bin/opencode` (a 186 MB
// binary) and a fixed-string grep over it, which the CI-less, dependency-free
// test suite must not depend on. Run `npm run check:loader` instead.
//
// The extraction is anchored on source text, and minified names change between
// OpenCode releases (v2.0.29 had `function XI(`, v2.0.32 has `function ZI(`), so
// the slice is checked for the resolver's own error strings before it is run: a
// rename fails loudly here instead of silently checking nothing. To re-derive
// the anchors:
//
//   grep -a -b -o -F 'function ae(e)' ~/.opencode/bin/opencode
//   grep -a -b -o -F 'is not a color' ~/.opencode/bin/opencode   # pick the offset in the same chunk
//   dd bs=1 skip=<that offset> count=3000 if=~/.opencode/bin/opencode | strings -a
//
// Trace forward from `$e(e)` (the resolver's last function) to the next
// `function <name>(` — that name is the new end anchor.

import { execFileSync } from "node:child_process";
import { openSync, readSync, closeSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const BIN = join(homedir(), ".opencode", "bin", "opencode");
const DIST = fileURLToPath(new URL("../opencode/dist", import.meta.url));
const MODES = ["light", "dark"];

/** The resolver segment, bounded by two distinctive neighbouring functions. */
const SLICE_START = "function ae(e)";
const SLICE_END = "function ZI(e)";

/** Strings the real resolver must contain; a renamed anchor yields a shorter slice. */
const SLICE_REQUIRES = ['references a missing hue', "is not a color"];

/** Byte offsets of a fixed string in the binary. `grep -a -b -o -F` is cheap. */
function offsets(anchor) {
  const out = execFileSync("grep", ["-a", "-b", "-o", "-F", anchor, BIN], {
    encoding: "utf8",
    maxBuffer: 1 << 20,
  });
  return out.trim().split("\n").filter(Boolean).map((line) => Number(line.split(":")[0]));
}

/** Read `length` bytes at `offset` as latin1, so every byte maps to one char. */
function readAt(offset, length) {
  const fd = openSync(BIN, "r");
  try {
    const buf = Buffer.alloc(length);
    readSync(fd, buf, 0, length, offset);
    return buf.toString("latin1");
  } finally {
    closeSync(fd);
  }
}

/**
 * The resolver slice, or `undefined`. The binary holds several copies (string
 * tables and duplicate chunks); the first candidate whose bytes are all
 * printable JS is the embedded module source.
 */
function extractResolverSource() {
  const ends = offsets(SLICE_END);
  const known = offsets("is not a color");
  for (const start of offsets(SLICE_START)) {
    const end = ends.find((offset) => offset > start);
    if (end === undefined) continue;
    // Only accept a slice that reaches past the colour check; otherwise the
    // end anchor is stale and the check would pass without testing colours.
    if (!known.some((offset) => offset > start && offset < end)) continue;
    const text = readAt(start, end - start);
    if (/[^\t\n\r\x20-\x7e]/.test(text)) continue;
    if (!SLICE_REQUIRES.every((needle) => text.includes(needle))) continue;
    return text;
  }
  return undefined;
}

/**
 * Evaluate the extracted slice and return the loader's per-mode resolve.
 *
 * The slice imports `Be` and the three leaf-record helpers, and defines a
 * schema validator (`Mr`) and an error wrapper (`Tp`) it never reaches on the
 * resolver path; those are stubbed. `Be` only has to satisfy `instanceof` and
 * carry the values around — the contrast maths is not part of loading, so it is
 * not reproduced here.
 */
function evaluateResolver(text) {
  class Be {
    static fromHex(hex) { return new Be(hex); }
    static fromInts(...channels) { return new Be(channels.join(",")); }
    static clone(color) { return color; }
  }
  const z = (literals) => ({ literals });
  const factory = new Function(
    "Be", "b", "v", "Q", "Mr", "re", "te", "Tp", "Fr",
    `${text}\nreturn { resolveMode: _1 };`,
  );  return factory(
    Be,
    z([100, 200, 300, 400, 500, 600, 700, 800, 900]),
    z(["disabled", "pressed", "focused", "selected", "hovered"]),
    z(["primary", "secondary", "destructive"]),
    () => () => {},
    {},
    {},
    () => false,
    () => () => {},
  );
}

const source = extractResolverSource();
if (source === undefined) {
  console.error(`check-loader: could not extract the theme resolver from ${BIN}`);
  process.exit(1);
}

const { resolveMode } = evaluateResolver(source);
const files = readdirSync(DIST).filter((f) => f.endsWith(".json")).sort();
if (files.length === 0) {
  console.error(`check-loader: no theme files in ${DIST} — run \`node src/build.mjs\` first`);
  process.exit(1);
}

let failed = false;
for (const file of files) {
  const path = join(DIST, file);
  const theme = JSON.parse(readFileSync(path, "utf8"));
  for (const mode of MODES) {
    if (theme[mode] === undefined) {
      console.error(`${path}: FAIL ${mode} mode is missing`);
      failed = true;
      continue;
    }
    try {
      resolveMode(theme, mode);
      console.log(`${path}: ${mode} OK`);
    } catch (error) {
      console.error(`${path}: ${mode} FAIL ${error.message}`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
