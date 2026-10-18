// nordlys — the aurora. Night blue under green light, the most saturated of
// the four.
//
// Built from the approved anchor tables in
// docs/superpowers/specs/2026-10-15-opencode-nordic-theme-pack-design.md (dark)
// and the settled light-mode ladders in the same file. The light chromatic
// ramps are reused verbatim from fjord — the four themes share one syntax
// family; identity is carried by the neutrals and the signature accent.
//
// Anchors are the five approved steps (100, 300, 500, 700, 900); buildTheme
// expands the other four. Surfaces are literal values, not ramp steps.
//
// Value syntax (docs/reference/opencode-theme-contract.md). A hue alias must be
// a whole-hue reference — `"$hue.green"` — because the loader looks the entire
// capture up in the hue map; `"$hue.green.300"` throws. A *colour* in any token
// (`text.*`, `background.*`, `diff.*`, `border`, `scrollbar`) needs a step:
// `$hue.<name>.<100..900>`, and a whole-hue reference there is not a colour.
// `syntax.*` and `markdown.*` are stricter still: a hex or a step-qualified
// hue reference only — no `"transparent"`, no `$<token.path>`.
//
// The file schema also requires `base` to define every group; a mode may
// override individual tokens but not supply missing structure. So the values
// that differ per mode live in `base` at their dark-mode step and are overridden
// in `tokens` for light below. `$hue.*` references follow the mode on their own.

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
 * site, not on the alias: nordlys's approved dark accent (aurora green #6ee0a8)
 * and its approved light accent (#2f6349) are both step 300 of their own mode's
 * green ramp, so one binding serves both.
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
  name: "nordlys",
  // The signature accent first, then the hues furthest from green.
  categorical: ["accent", "cyan", "blue", "purple"],

  base: {
    text: {
      base: "#ccd8ee",
      muted: "#7c8ab0",
      action: actionGroups("$hue.accent.300", "$hue.neutral.500", "$hue.red.400"),
      formfield: allStates("$text.base"),
      feedback: {
        error: { base: "$hue.red.200", muted: "$hue.red.300" },
        warning: { base: "$hue.yellow.200", muted: "$hue.yellow.300" },
        success: { base: "$hue.green.200", muted: "$hue.green.300" },
        info: { base: "$hue.cyan.200", muted: "$hue.cyan.300" },
      },
    },
    background: {
      base: "#0b1020",
      raised: { base: "#131a2e", high: "#192336", max: "#212d43" },
      action: actionSurfaces(),
      formfield: allStates("$background.raised.base"),
      feedback: {
        error: { base: "$hue.red.700" },
        warning: { base: "$hue.yellow.700" },
        success: { base: "$hue.green.700" },
        info: { base: "$hue.cyan.700" },
      },
    },
    border: { base: "#243050" },
    scrollbar: { base: "#243050" },
    diff: {
      text: {
        added: "$hue.green.200",
        removed: "$hue.red.200",
        // The greys that carry text all point at $text.muted, so light mode's
        // corrected grey reaches them too. diff.* is a general colour position,
        // so a `$<token.path>` reference is legal here.
        context: "$text.muted",
        hunkHeader: "$text.muted",
      },
      // The line fills are ramp steps, not hand-picked hexes: .800 in dark
      // (one step up from the background) and .900 in light (a pale tint).
      background: {
        added: "$hue.green.800",
        removed: "$hue.red.800",
        context: "$hue.gray.800",
      },
      highlight: { added: "$hue.green.300", removed: "$hue.red.300" },
      lineNumber: {
        text: "$text.muted",
        background: { added: "$diff.background.added", removed: "$diff.background.removed" },
      },
    },
    // syntax and markdown are the strict subtype: a hex or a step-qualified hue
    // reference only. `comment` cannot sit on the approved gray.500 — in light
    // mode that is a mid grey on a mid surface, under the 3:1 floor — so light
    // mode overrides it to gray.200. `operator` and `punctuation` then take the
    // two steps between it and `variable` so all nine syntax tokens stay
    // distinct in both modes.
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
        gray: { 100: "#e6ebf6", 300: "#aab6d1", 500: "#7c8ab0", 700: "#38425f", 900: "#0d1020" },
        red: { 100: "#e6b2bb", 300: "#b06678", 500: "#72384a", 700: "#3d1c28", 900: "#15070c" },
        orange: { 100: "#ecc9a4", 300: "#b68251", 500: "#7a4d26", 700: "#422810", 900: "#160c03" },
        yellow: { 100: "#f2e8c0", 300: "#cbb168", 500: "#8a7333", 700: "#4b3d17", 900: "#1b1405" },
        green: { 100: "#c8f5e0", 300: "#6ee0a8", 500: "#2f9e70", 700: "#175440", 900: "#062018" },
        cyan: { 100: "#c4eff5", 300: "#63cfe0", 500: "#2b8fa3", 700: "#154d5c", 900: "#05171e" },
        blue: { 100: "#cdddf8", 300: "#7fa8ee", 500: "#4169b3", 700: "#22386a", 900: "#0b1020" },
        purple: { 100: "#ded3f5", 300: "#ab93e4", 500: "#7459b3", 700: "#3d2d68", 900: "#100a1f" },
        // The signature accent aliases the hue; the step is chosen at the
        // reference site (green.300 in both modes for nordlys).
        accent: "$hue.green",
        interactive: "$hue.blue",
        neutral: "$hue.gray",
      },
    },

    light: {
      hue: {
        gray: { 100: "#1d2f29", 300: "#465e56", 500: "#778f87", 700: "#b1c3bc", 900: "#dae5e1" },
        red: { 100: "#451f27", 300: "#77393f", 500: "#a85f63", 700: "#d9a8ab", 900: "#f0d6d8" },
        orange: { 100: "#40291a", 300: "#6f4a2c", 500: "#a2734a", 700: "#d4b193", 900: "#eddbc9" },
        yellow: { 100: "#3d3212", 300: "#6d5b21", 500: "#a08a3c", 700: "#d3c58f", 900: "#ece4c8" },
        green: { 100: "#16362a", 300: "#2f6349", 500: "#4f9273", 700: "#a9cdb9", 900: "#d6e9dd" },
        cyan: { 100: "#0d3540", 300: "#22646f", 500: "#3f95a2", 700: "#a3d0d7", 900: "#d3e8ec" },
        blue: { 100: "#123047", 300: "#2c5f80", 500: "#4f8fb0", 700: "#a8c9dd", 900: "#d5e5ef" },
        purple: { 100: "#2c2148", 300: "#514173", 500: "#7f6ea6", 700: "#bfb2d6", 900: "#e2dbef" },
        accent: "$hue.green",
        interactive: "$hue.blue",
        neutral: "$hue.gray",
      },
      tokens: {
        text: {
          base: "#1d2f29",
          muted: "#556e65",
          action: actionGroups("$hue.accent.300", "$hue.neutral.500", "$hue.red.300"),
        },
        background: {
          base: "#dae5e1",
          raised: { base: "#cedad6", high: "#c6d4cf", max: "#bfcec8" },
        },
        border: { base: "#b4c5bf" },
        scrollbar: { base: "#b4c5bf" },
        diff: {
          // Matches dark mode: gray.800 is one step from the background (gray.900)
          // in each mode. gray.700 put muted context text below the 3:1 floor.
          background: { added: "$hue.green.900", removed: "$hue.red.900", context: "$hue.gray.800" },
        },
        syntax: { comment: "$hue.gray.200" },
        markdown: { blockQuote: "$hue.gray.300", horizontalRule: "$hue.gray.300" },
      },
    },
  },
};
