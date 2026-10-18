# AGENTS.md

Agent guidance for this repo. It ships one colour configuration per tool, all out of one set of
palettes: today **OpenCode** and **Ghostty**, with **web** alongside them because the CSS export
is free once the ramps exist. More targets are expected — a new one adds a top-level folder and
an exporter, nothing else.

```
opencode/        the OpenCode target — dist/<name>.json
ghostty/         the Ghostty target — dist/<Name>, dist/<Name> Light
web/             the web target — dist/tokens/ (CSS + JSON), dist/preview/
src/             contract → color → ramp → theme → validate → build, plus the exporters
src/palettes/    the four themes; hand-authored data, one file per theme
tools/           dev-only helpers, never imported by src
test/            node:test, zero dependencies
docs/reference/  the OpenCode theme contract extracted from the binary
```

Every target reads the same `src/`. `opencode/dist/` is built first and the rest follow from it:
`src/export-ghostty.mjs` reads the theme JSON `src/export.mjs` has already written rather than
building a second time, so a Ghostty palette is always the same bytes the OpenCode file carries.

## Commands (all from the repo root)

| command | good looks like |
|---|---|
| `npm test` | all tests pass, no warnings. Add a palette and the count does not change — the tests loop every file in `src/palettes/` |
| `npm run build` | one `<name>: ok` line per theme, exit 0 |
| `node src/build.mjs --install` | same, and copies to `~/.config/opencode/themes/` |
| `npm run check:loader` | `<file>: light OK` and `dark OK` for every `opencode/dist/*.json`. **Pipe it**: `npm run check:loader 2>&1 \| grep -E "OK\|FAIL\|could not\|Error:"` — on failure Node prints the whole extracted resolver source |
| `npm run export` | `opencode/dist/`, then `ghostty/dist/` and `web/dist/tokens/`. Both exporters, in order — which is why the `&&` in the script is load-bearing: the second reads what the first wrote |
| `npm run export:ghostty` | `ghostty/dist/` alone; it needs an `opencode/dist/` that is already built |
| `npm run preview` | `web/dist/preview/*.html`, after `npm run export` |

Run the first three together before calling any palette change done.

## Rules that are easy to get wrong

**The three value types.** A hue *alias* (`hue.accent`) must be **whole-hue** — `"$hue.cyan"`,
never `"$hue.cyan.400"`, which the loader rejects outright. A *colour* (in `text`, `background`,
`border`, `scrollbar`, `diff`) is `hex | "transparent" | $token.path | $hue.<name>.<step>`; a
bare `$hue.<name>` in a colour position is an error. `syntax.*` and `markdown.*` are stricter
still: `hex` or a step-qualified hue reference, nothing else. Details in
`docs/reference/opencode-theme-contract.md`.

A whole-hue alias means `hue.accent` is a *string* in the built file, not a ramp — anything
reading a built theme has to follow the alias before it can index a step.

**`base` must define every group.** Modes only override. A mode omitted from `base` is a
schema error, not a default.

**The steps flip per mode.** Dark `100` is lightest → `900` darkest; light is reversed. So
`gray.300` stays "roughly this light" in both modes, and a per-mode override is only needed when
a role genuinely differs. The Ghostty mapping leans on this: `300` is the normal ANSI colour and
`200` the bright one in *both* modes, which is why brights are darker than normals in light mode.

**Adding a theme is one file** in `src/palettes/` — copy a neighbour and change the data. The
tests pick it up automatically, and every target picks up the new theme on the next export.

**Never retune an approved anchor to make a test pass.** Change the *binding* instead. The
anchors were approved by the author; a failing contrast check means the role points at the
wrong step, not that the palette is wrong.

**Contrast floors** live in `src/validate.mjs` as `CONTRAST_RULES` (14 foregrounds × 5
surfaces): body text 4.5:1, muted text and every `syntax.*` / `diff.text.*` 3:1. Loosening one to
get green is not a fix.

**No orange in a terminal.** ANSI has sixteen slots and none of them is orange, so orange is the
one ramp that does not reach `ghostty/dist/`. That is the format's limit, not an omission — a test
pins it so orange cannot drift back in.

## The OpenCode binary

`tools/check-loader.mjs` extracts OpenCode's own theme resolver out of
`~/.opencode/bin/opencode` (by byte offset) and replays it against every `opencode/dist/*.json`.
It is **not** part of `npm test`: it needs the local binary, and the project stays
dependency-free.

- An OpenCode upgrade renames the minified functions and the extraction fails loudly by design.
  The header documents how to re-derive the offsets.
- **Never** run `strings <binary> | grep -F <common word>` on this 186 MB file — it dumps
  megabytes. Get an offset with `grep -a -b -o -F '<needle>' <binary>` first, then
  `dd if=<binary> bs=1 skip=<offset> count=<n> | strings -a`. `dd` needs the `if=`.
- Replaying the resolver does not exercise the schema, which is why the value types above are
  enforced by `src/validate.mjs` too.

## Committed build output

All three target folders **are committed**, because they are what people download: a TUI user
takes `opencode/dist/fjord.json`, a Ghostty user takes `ghostty/dist/Fjord`, a web dev takes
`web/dist/tokens/`. So a palette change is not finished until the output is regenerated and
committed — `npm run export` rebuilds all three, and `npm run preview` then refreshes the preview
pages.

The test `dist/ holds exactly what a fresh build writes` byte-compares every committed file
against a fresh build, so a forgotten `npm run export` fails the suite. Its `files` list is
repo-root-relative (`opencode/dist/…`, `ghostty/dist/…`, `web/dist/tokens/…`): new output that is
not added to that list is unwatched while the suite stays green.

## Do not touch

- `~/.config/opencode/cli.json` — the author's terminal config.
- `docs/superpowers/` — process material (design spec, plans), untracked on purpose. This repo is
  public; anything committed here is published.

## Versioning

One version for the pack in `package.json`. A colour change is a **patch** — consumers bind to
token names, not exact hex. Update `CHANGELOG.md` in the same commit as the change.

Regenerating the README screenshots is **not** one command: `npm run preview` renders the pages
and a browser captures them (`assets/screenshots/`). The project stays dependency-free, so
the capture is a manual step.
