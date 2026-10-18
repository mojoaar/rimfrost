// fjord — daylight on cold water. The pack's flagship.
//
// This is the only hand-authored colour content in the project: every hex below
// is either copied verbatim from the approved anchor tables in
// docs/superpowers/specs/2026-10-15-opencode-nordic-theme-pack-design.md, or a
// binding onto one of those ramps. Nothing is hand-tuned here; to change a
// colour, change an anchor and rebuild.
//
// Anchors are the five approved steps (100, 300, 500, 700, 900); buildTheme
// expands the other four. Surfaces are literal values, not ramp steps — the
// contract does not require them to be addressable.
//
// Value syntax (docs/reference/opencode-theme-contract.md). A hue alias must be
// a whole-hue reference — `"$hue.cyan"` — because the loader looks the entire
// capture up in the hue map; `"$hue.cyan.400"` throws. A *colour* in any token
// (`text.*`, `background.*`, `diff.*`, `border`, `scrollbar`) needs a step:
// `$hue.<name>.<100..900>`, and a whole-hue reference there is not a colour.
// `syntax.*` and `markdown.*` are stricter still: a hex or a step-qualified
// hue reference only — no `"transparent"`, no `$<token.path>`.
//
// The file schema also requires `base` to define every group; a mode may
// override individual tokens but not supply missing structure. So the values
// that differ per mode live in `base` at their dark-mode step and are overridden
// in `tokens` for both modes below.

/** The five interaction states every stateful group carries. */
const allStates = (value) => ({
  base: value,
  $hovered: value,
  $focused: value,
  $pressed: value,
  $selected: value,
  $disabled: value,
});

/**
 * The six action *text* groups. The accent's step is pinned at the reference
 * site, not on the alias: primary is cyan.400 dark / cyan.300 light — the
 * approved anchors — and secondary/destructive use neutral and red at the step
 * that keeps contrast. Returns the dark-mode binding, which `base` carries and
 * both modes restate.
 */
const actionGroups = (accent, neutral, red) => {
  // The focused row's fill is `interactive.200` (see `surfaceStates`), so its
  // text inverts to the background colour — the pairing OpenCode's own themes
  // use. A token ref, so it follows the mode without a restatement.
  const group = (hue) => ({ ...allStates(hue), $focused: "$background.base" });
  return { primary: group(accent), secondary: group(neutral), destructive: group(red) };
};

/**
 * Action *backgrounds* are surfaces, never the hue itself. OpenCode's own
 * themes paint an action's hover/focus with a neutral surface step, because a
 * filled accent under accent-coloured text is unreadable — that is what washed
 * out the `/` picker's cursor row. These are `$hue.*` refs, so they follow the
 * mode on their own and need no per-mode override.
 */
const surfaceStates = () => ({
  base: "transparent",
  // One step from the background (gray.900), as OpenCode's own hover is from
  // its own background. Keeps the cursor row readable, not just visible.
  $hovered: "$hue.neutral.800",
  $focused: "$hue.interactive.200",
  $pressed: "$hue.neutral.800",
  $selected: "transparent",
  $disabled: "transparent",
});

const actionSurfaces = () => ({
  primary: surfaceStates(),
  secondary: surfaceStates(),
  destructive: surfaceStates(),
});

export default {
  name: "fjord",
  // The signature accent first, then the hues furthest from teal.
  categorical: ["accent", "purple", "green", "blue"],

  base: {
    text: {
      base: "#c6d4e0",
      muted: "#7d90a3",
      action: actionGroups("$hue.accent.400", "$hue.neutral.500", "$hue.red.400"),
      formfield: allStates("$text.base"),
      feedback: {
        error: { base: "$hue.red.200", muted: "$hue.red.300" },
        warning: { base: "$hue.yellow.200", muted: "$hue.yellow.300" },
        success: { base: "$hue.green.200", muted: "$hue.green.300" },
        info: { base: "$hue.cyan.200", muted: "$hue.cyan.300" },
      },
    },
    background: {
      base: "#0e1620",
      raised: { base: "#16202c", high: "#1c2934", max: "#243341" },
      action: actionSurfaces(),
      formfield: allStates("$background.raised.base"),
      feedback: {
        error: { base: "$hue.red.700" },
        warning: { base: "$hue.yellow.700" },
        success: { base: "$hue.green.700" },
        info: { base: "$hue.cyan.700" },
      },
    },
    border: { base: "#24333f" },
    scrollbar: { base: "#24333f" },
    diff: {
      text: {
        added: "$hue.green.200",
        removed: "$hue.red.200",
        // The greys that carry text all point at $text.muted, so light mode's
        // approved corrected grey (#586a7a) reaches them too. Dark $text.muted
        // is #7d90a3, byte-identical to dark gray.500. diff.* is a general
        // colour position, so a `$<token.path>` reference is legal here.
        context: "$text.muted",
        hunkHeader: "$text.muted",
      },
      background: {
        added: "#163020",
        removed: "#2a1519",
        context: "$hue.gray.800",
      },
      highlight: { added: "$hue.green.300", removed: "$hue.red.300" },
      // The brief fixes no values for the gutter fills, so they reference the
      // approved line fills rather than inventing hexes. Defined once here:
      // each mode's own diff.background values flow through.
      lineNumber: {
        text: "$text.muted",
        background: { added: "$diff.background.added", removed: "$diff.background.removed" },
      },
    },
    // syntax and markdown are the strict subtype: a hex or a step-qualified hue
    // reference only. `comment` cannot sit on the approved gray.500 — that is
    // #7b8b9c in light mode, 2.69:1 on the light background, under the 3:1
    // floor — so light mode overrides it to gray.200 (7.92:1). `operator` and
    // `punctuation` then take the two steps between it and `variable` so all
    // nine syntax tokens stay distinct in both modes.
    syntax: {
      comment: "$hue.gray.500",
      keyword: "$hue.cyan.300",
      function: "$hue.blue.300",
      variable: "$hue.gray.100",
      string: "$hue.green.300",
      number: "$hue.yellow.300",
      type: "$hue.purple.300",
      operator: "$hue.gray.400",
      punctuation: "$hue.gray.300",
    },
    markdown: {
      text: "$hue.gray.100",
      heading: "$hue.purple.300",
      link: "$hue.interactive.300",
      linkText: "$hue.interactive.200",
      code: "$hue.cyan.300",
      blockQuote: "$hue.gray.500",
      emphasis: "$hue.gray.100",
      strong: "$hue.gray.100",
      horizontalRule: "$hue.gray.500",
      listItem: "$hue.gray.200",
      listEnumeration: "$hue.gray.300",
      image: "$hue.gray.300",
      imageText: "$hue.gray.200",
      codeBlock: "$hue.gray.100",
    },
  },

  modes: {
    dark: {
      hue: {
        gray: { 100: "#e6ecf2", 300: "#aebfcd", 500: "#7d90a3", 700: "#3a4b5a", 900: "#0e1620" },
        red: { 100: "#e0b6b6", 300: "#a86c72", 500: "#6f3c43", 700: "#3d1f24", 900: "#150a0c" },
        orange: { 100: "#e8c9b0", 300: "#b1845f", 500: "#75502f", 700: "#422c17", 900: "#180f06" },
        yellow: { 100: "#f0e6c4", 300: "#c3b06f", 500: "#857439", 700: "#4b401d", 900: "#1c170a" },
        green: { 100: "#cbe7d8", 300: "#78b096", 500: "#3d755a", 700: "#224231", 900: "#0c1e14" },
        cyan: { 100: "#cbf0f2", 300: "#6fc4cd", 500: "#358892", 700: "#1c4c53", 900: "#0a1d20" },
        blue: { 100: "#cfe4f7", 300: "#7fb2dc", 500: "#4278ad", 700: "#234468", 900: "#0e1c2c" },
        purple: { 100: "#d5cde8", 300: "#9183b6", 500: "#594d7d", 700: "#2f2746", 900: "#100d1a" },
        // The signature accent aliases the hue; the step is chosen at the
        // reference site (cyan.400 here, cyan.300 in light).
        accent: "$hue.cyan",
        interactive: "$hue.blue",
        neutral: "$hue.gray",
      },
      tokens: {
        text: { action: actionGroups("$hue.accent.400", "$hue.neutral.500", "$hue.red.400") },
        syntax: { comment: "$hue.gray.500" },
        markdown: { blockQuote: "$hue.gray.500", horizontalRule: "$hue.gray.500" },
      },
    },

    light: {
      hue: {
        gray: { 100: "#202c38", 300: "#4a5a6b", 500: "#7b8b9c", 700: "#b3c0cc", 900: "#dbe3ea" },
        red: { 100: "#451f27", 300: "#77393f", 500: "#a85f63", 700: "#d9a8ab", 900: "#f0d6d8" },
        orange: { 100: "#40291a", 300: "#6f4a2c", 500: "#a2734a", 700: "#d4b193", 900: "#eddbc9" },
        yellow: { 100: "#3d3212", 300: "#6d5b21", 500: "#a08a3c", 700: "#d3c58f", 900: "#ece4c8" },
        green: { 100: "#16362a", 300: "#2f6349", 500: "#4f9273", 700: "#a9cdb9", 900: "#d6e9dd" },
        cyan: { 100: "#0d3540", 300: "#22646f", 500: "#3f95a2", 700: "#a3d0d7", 900: "#d3e8ec" },
        blue: { 100: "#123047", 300: "#2c5f80", 500: "#4f8fb0", 700: "#a8c9dd", 900: "#d5e5ef" },
        purple: { 100: "#2c2148", 300: "#514173", 500: "#7f6ea6", 700: "#bfb2d6", 900: "#e2dbef" },
        accent: "$hue.cyan",
        interactive: "$hue.blue",
        neutral: "$hue.gray",
      },
      tokens: {
        text: {
          base: "#1b2733",
          muted: "#586a7a",
          action: actionGroups("$hue.accent.300", "$hue.neutral.500", "$hue.red.300"),
        },
        background: {
          base: "#dbe3ea",
          raised: { base: "#cfd8e1", high: "#c8d2dc", max: "#c1cbd6" },
        },
        border: { base: "#b6c2ce" },
        scrollbar: { base: "#b6c2ce" },
        diff: {
          // Matches dark mode: gray.800 is one step from the background (gray.900)
          // in each mode. gray.700 put muted context text below the 3:1 floor.
          background: { added: "#d6e9dd", removed: "#f0d6d8", context: "$hue.gray.800" },
        },
        syntax: { comment: "$hue.gray.200" },
        markdown: { blockQuote: "$hue.gray.300", horizontalRule: "$hue.gray.300" },
      },
    },
  },
};
