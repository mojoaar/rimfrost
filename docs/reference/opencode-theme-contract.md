# OpenCode theme file contract

What a theme JSON file must contain, and how we know.

Source: OpenCode V2 docs at <https://opencode.ai/v2/docs/cli/theme>, plus the
token tree and validation rules extracted from the installed binary at
`~/.opencode/bin/opencode` (v2.0.29). The documented `$schema` URLs
(`https://opencode.ai/theme.json`, `https://opencode.ai/v2/theme.json`) both
return 404, so the binary is the authoritative contract.

## How this was extracted

The binary is ~186 MB. Use fixed-string search — a regex with bounded context
does not finish in two minutes.

```sh
B=~/.opencode/bin/opencode
LC_ALL=C grep -a -c -F 'listEnumeration' "$B"   # 2
node -e '
const s=require("fs").readFileSync(process.env.HOME+"/.opencode/bin/opencode").toString("latin1");
const i=s.indexOf("listEnumeration");
console.log(s.slice(i-900,i+300).replace(/[^\x20-\x7e]/g,"."));
'
```

The embedded themes are JavaScript source, not JSON — values are quoted but
keys are bare (`border:{base:"#484848"}`). So they cannot be `JSON.parse`d
wholesale. Read the schema-construction regions instead.

The theme *loader* is readable source too. Locate a distinctive function or
error string and get its byte offset, then take a bounded slice — never
`strings` the whole 186 MB binary into a pipe:

```sh
B=~/.opencode/bin/opencode
grep -a -b -o -F 'references a missing hue' "$B"     # -> offset:match
dd if="$B" bs=1 skip=$((offset - 900)) count=6000 | strings -a
```

`tools/check-loader.mjs` does exactly this: it lifts the resolver segment from
`function ae(e)` to the next `function XI(` and runs the loader's own per-mode
resolve over `dist/fjord.json`.

## File shape

```jsonc
{
  "$schema": "https://opencode.ai/theme.json",  // cosmetic; the URL 404s
  "base":  { /* complete token tree, shared by both modes */ },
  "light": { "hue": { /* all 11 hue names */ }, /* optional token overrides */ },
  "dark":  { "hue": { /* all 11 hue names */ }, /* optional token overrides */ }
}
```

At least one of `light` / `dark` must be present. A mode inherits from the
file's own `base`, never from the built-in theme and never from the other mode.
If a file provides only one mode, OpenCode uses it for both.

The **filename is the theme name**: `fjord.json` appears as `fjord`. Theme files
load from `~/.config/opencode/themes/` or a project's `.opencode/themes/`;
a nearer file replaces a global one of the same name. OpenCode reads `.json`
only, and a restart is needed after adding a file.

## Hue names

Every mode defines all eleven, nine steps each:

```
gray red orange yellow green cyan blue purple     (base hues)
accent interactive neutral                        (required aliases)
```

The binary enforces the aliases explicitly — its error string is
`Missing required semantic hues: ${...}`. A hue's value is either a full
nine-step object or an alias to another hue (`"accent": "$hue.cyan"`).

**Step direction flips between modes.** Dark themes run lightest at `100` to
darkest at `900`. Light themes run darkest at `100` to lightest at `900`. An
interpolated step must never duplicate an anchor step.

## Value syntax

There are **three** value types, and the loader treats them differently. Each
rule below is quoted from, or backed by, the installed binary (v2.0.31) — the
error strings are the loader's own.

**A hue alias** — a `modes.<mode>.hue.<name>` value. It is either a full
nine-step ramp object, or a *whole-hue* reference. The loader matches
`/^\$hue\.(.+)$/` and looks the **entire** capture up in the hue map, so
`"$hue.cyan"` is legal and `"$hue.cyan.400"` throws:

```
Hue alias "$hue.cyan.400" references a missing hue
```

Built-ins and the V1→V2 converter use only whole-hue aliases.

**A colour** — any token under `text`, `background`, `border`, `scrollbar` or
`diff`. Legal forms:

- a hex — `^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$`
- `"transparent"`
- a token reference — `$<dotted.path>`, e.g. `$text.muted`,
  `$background.raised.base`
- a **step-qualified** hue reference — `$hue.<name>.<100..900>`

A bare whole-hue reference is **not** a colour. The loader special-cases only
`hue.<name>.<step>`, so `$hue.accent` resolves to the whole ramp object and
throws:

```
Theme reference "$hue.accent" at ".text.action.primary.base" is not a color
```

`$hue.<alias>.<step>` *is* legal even when `<alias>` is a whole-hue alias: the
built-ins use `$hue.neutral.200`, and the loader resolves the step through the
alias.

**A `syntax.*` / `markdown.*` value** is a stricter subtype: a hex, or a
step-qualified hue reference. The schema's type is
`hex | ^\$hue\..+\.(?:100|200|300|400|500|600|700|800|900)$`, so
`"transparent"`, a token reference such as `$text.muted`, and a whole-hue
reference are all rejected.

## Token tree

```
base
├── categorical: [hueName, ...]            ordered hues for agents and repeated items
├── text
│   ├── base, muted
│   ├── action.{primary,secondary,destructive}.{base,$hovered,$focused,$pressed,$selected,$disabled}
│   ├── formfield.{base,$hovered,$focused,$pressed,$selected,$disabled}
│   └── feedback.{error,warning,success,info}.{base,muted}
├── background
│   ├── base
│   ├── raised.{base,high,max}
│   ├── action.{primary,secondary,destructive}.{base,$hovered,$focused,$pressed,$selected,$disabled}
│   ├── formfield.{base,$hovered,$focused,$pressed,$selected,$disabled}
│   └── feedback.{error,warning,success,info}.base
├── border.base
├── scrollbar.base
├── diff
│   ├── text.{added,removed,context,hunkHeader}
│   ├── background.{added,removed,context}
│   ├── highlight.{added,removed}
│   └── lineNumber.text, lineNumber.background.{added,removed}
├── syntax.{comment,keyword,function,variable,string,number,type,operator,punctuation}
├── markdown.{text,heading,link,linkText,code,blockQuote,emphasis,strong,
│             horizontalRule,listItem,listEnumeration,image,imageText,codeBlock}
└── @dialog.background.base
    @dialog.background.action.primary.$hovered
```

The interaction state keys are exactly `$hovered`, `$focused`, `$pressed`,
`$selected`, `$disabled`. An unspecified state falls back to that action's or
form field's `base`. A contextual action `base` becomes the fallback for its
unspecified states.

## Defaults seen in a built-in theme

The built-in `@dialog` default is:

```jsonc
"@dialog": {
  "background": {
    "base": "$background.raised.base",
    "action": { "primary": { "$hovered": "$background.raised.high" } }
  }
}
```

And the idiomatic way a built-in binds syntax and markdown is by pointing at hue
steps rather than at literal hexes:

```jsonc
"syntax": {
  "comment":     "$hue.neutral.400",
  "keyword":     "$hue.accent.200",
  "function":    "$hue.interactive.200",
  "variable":    "$hue.red.200",
  "string":      "$hue.green.200",
  "number":      "#f5a742",
  "type":        "#e5c07b",
  "operator":    "$hue.cyan.200",
  "punctuation": "$hue.neutral.200"
}
```

Diff tokens follow a consistent shape — text, background, highlight and
line-number backgrounds each carry `added` / `removed`, with `context` and
`hunkHeader` on the text group:

```jsonc
"diff": {
  "text":       { "added": "#4fd6be", "removed": "#c53b53", "context": "#828bb8", "hunkHeader": "#828bb8" },
  "background": { "added": "#20303b", "removed": "#37222c", "context": "$hue.neutral.700" },
  "highlight":  { "added": "#b8db87", "removed": "#e26a75" },
  "lineNumber": { "text": "#8f8f8f", "background": { "added": "#1b2b34", "removed": "#2d1f26" } }
}
```

## What we still have to verify by hand

The binary enforces this schema at load time, but we do not know whether a
theme missing a token fails loudly or silently falls back to a built-in colour.
So completeness is checked two ways: our own validator asserts every path in
the token tree above is defined, and the theme is then loaded in the real TUI
and looked at.
