// The OpenCode theme contract: the token tree and value syntax that OpenCode
// enforces at load time. Extracted from the V2 binary (2.0.29) and recorded in
// docs/reference/opencode-theme-contract.md, which is the source of truth for
// every path below. Nothing here depends on a palette; this module is the
// shape that the assembly and validation tasks work against.

/** The eight base hues, then the three semantic aliases every mode must define. */
export const HUES = [
  "gray", "red", "orange", "yellow", "green", "cyan", "blue", "purple",
  "accent", "interactive", "neutral",
];

/** The five interaction states a stateful group carries on top of `base`. */
export const STATE_KEYS = ["$hovered", "$focused", "$pressed", "$selected", "$disabled"];

const STEPS = ["100", "200", "300", "400", "500", "600", "700", "800", "900"];

/**
 * HEX_RE is copied verbatim from the binary's validator, which accepts 3- and
 * 4-digit shorthand as well as 6- and 8-digit (alpha) forms. That is the
 * contract OpenCode applies, so we mirror it here; this project always *emits*
 * 6-digit hex, and src/color.mjs uses its own, deliberately stricter parser for
 * values it has to interpolate.
 */
export const HEX_RE = /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i;

/** `$hue.<name>` for a whole hue, or `$hue.<name>.<step>` for one of its steps. */
export const HUE_REF_RE = new RegExp(`^\\$hue\\.[a-z]+(?:\\.(?:${STEPS.join("|")}))?$`);

/**
 * `$<dotted.path>` pointing at another token, e.g. `$text.muted`. Segments are
 * case-sensitive and include camelCase (`$diff.text.hunkHeader`) and the
 * `@dialog` / `$hovered` forms, hence the permissive character class. The
 * lookahead keeps hue references out, since those are matched by HUE_REF_RE.
 */
export const TOKEN_REF_RE = /^\$(?!hue(?:\.|$))[\w@$]+(?:\.[\w@$]+)*$/;

const ACTIONS = ["primary", "secondary", "destructive"];
const FEEDBACK = ["error", "warning", "success", "info"];
const SYNTAX = ["comment", "keyword", "function", "variable", "string", "number", "type", "operator", "punctuation"];
const MARKDOWN = [
  "text", "heading", "link", "linkText", "code", "blockQuote", "emphasis",
  "strong", "horizontalRule", "listItem", "listEnumeration", "image",
  "imageText", "codeBlock",
];

/** `<prefix>.<key>` for each key. */
const at = (prefix, keys) => keys.map((key) => `${prefix}.${key}`);

/** `base` plus each state key, under each of the given prefixes. */
const withStates = (...prefixes) =>
  prefixes.flatMap((prefix) => at(prefix, ["base", ...STATE_KEYS]));

/**
 * Every dotted token path in the contract, in the order the reference lists
 * them. `base.categorical` is deliberately absent: it holds hue *names*, not a
 * colour, and is validated separately by the validator.
 *
 * @returns {string[]}
 */
export function tokenPaths() {
  return [
    // text
    ...at("text", ["base", "muted"]),
    ...ACTIONS.flatMap((action) => withStates(`text.action.${action}`)),
    ...withStates("text.formfield"),
    ...FEEDBACK.flatMap((kind) => at(`text.feedback.${kind}`, ["base", "muted"])),

    // background
    ...at("background", ["base"]),
    ...at("background.raised", ["base", "high", "max"]),
    ...ACTIONS.flatMap((action) => withStates(`background.action.${action}`)),
    ...withStates("background.formfield"),
    ...FEEDBACK.map((kind) => `background.feedback.${kind}.base`),

    // border and scrollbar
    ...at("border", ["base"]),
    ...at("scrollbar", ["base"]),

    // diff
    ...at("diff.text", ["added", "removed", "context", "hunkHeader"]),
    ...at("diff.background", ["added", "removed", "context"]),
    ...at("diff.highlight", ["added", "removed"]),
    ...at("diff.lineNumber", ["text"]),
    ...at("diff.lineNumber.background", ["added", "removed"]),

    // syntax and markdown
    ...at("syntax", SYNTAX),
    ...at("markdown", MARKDOWN),

    // dialog overrides (the `@` is part of the token name). The reference
    // documents exactly these two paths, so exactly these two are required.
    ...at("@dialog.background", ["base"]),
    ...at("@dialog.background.action.primary", ["$hovered"]),
  ];
}
