// ravn — the raven. Ink-black with a violet sheen, the darkest of the four.
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
// a whole-hue reference — `"$hue.purple"` — because the loader looks the entire
// capture up in the hue map; `"$hue.purple.300"` throws. A *colour* in any token
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
 * site, not on the alias: ravn's approved dark accent (violet #a596d8) and its
 * approved light accent (#514173) are both step 300 of their own mode's purple
 * ramp, so one binding serves both.
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
  name: "ravn",
  // The signature accent first, then the hues furthest from violet.
  categorical: ["accent", "cyan", "green", "blue"],

  base: {
    text: {
      base: "#c9d1e2",
      muted: "#767e92",
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
      base: "#0a0b12",
      raised: { base: "#13151f", high: "#191e27", max: "#212733" },
      action: actionSurfaces(),
      formfield: allStates("$background.raised.base"),
      feedback: {
        error: { base: "$hue.red.700" },
        warning: { base: "$hue.yellow.700" },
        success: { base: "$hue.green.700" },
        info: { base: "$hue.cyan.700" },
      },
    },
    border: { base: "#232734" },
    scrollbar: { base: "#232734" },
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
        gray: { 100: "#e4e8f0", 300: "#a9b2c4", 500: "#767e92", 700: "#343a49", 900: "#0a0b12" },
        red: { 100: "#dfb0b4", 300: "#a2626d", 500: "#6a3642", 700: "#381b22", 900: "#130809" },
        orange: { 100: "#e4c3a8", 300: "#ab7c56", 500: "#6f4a2b", 700: "#3d2614", 900: "#150d05" },
        yellow: { 100: "#ece2c2", 300: "#bda96a", 500: "#7c6c37", 700: "#443a1c", 900: "#19150a" },
        green: { 100: "#c6e3d3", 300: "#74a98d", 500: "#3a6b53", 700: "#1d3a2b", 900: "#0a1a13" },
        cyan: { 100: "#c5e5ec", 300: "#6fb3c4", 500: "#37707f", 700: "#1b3c45", 900: "#08181c" },
        blue: { 100: "#ccd9ef", 300: "#7d9cd6", 500: "#46618f", 700: "#22314c", 900: "#0c1220" },
        purple: { 100: "#dcd4f0", 300: "#a596d8", 500: "#6f5da8", 700: "#3a2f5c", 900: "#12101f" },
        // The signature accent aliases the hue; the step is chosen at the
        // reference site (purple.300 in both modes for ravn).
        accent: "$hue.purple",
        interactive: "$hue.blue",
        neutral: "$hue.gray",
      },
    },

    light: {
      hue: {
        gray: { 100: "#2b2936", 300: "#585668", 500: "#898698", 700: "#bebcca", 900: "#e2e1e9" },
        red: { 100: "#451f27", 300: "#77393f", 500: "#a85f63", 700: "#d9a8ab", 900: "#f0d6d8" },
        orange: { 100: "#40291a", 300: "#6f4a2c", 500: "#a2734a", 700: "#d4b193", 900: "#eddbc9" },
        yellow: { 100: "#3d3212", 300: "#6d5b21", 500: "#a08a3c", 700: "#d3c58f", 900: "#ece4c8" },
        green: { 100: "#16362a", 300: "#2f6349", 500: "#4f9273", 700: "#a9cdb9", 900: "#d6e9dd" },
        cyan: { 100: "#0d3540", 300: "#22646f", 500: "#3f95a2", 700: "#a3d0d7", 900: "#d3e8ec" },
        blue: { 100: "#123047", 300: "#2c5f80", 500: "#4f8fb0", 700: "#a8c9dd", 900: "#d5e5ef" },
        purple: { 100: "#2c2148", 300: "#514173", 500: "#7f6ea6", 700: "#bfb2d6", 900: "#e2dbef" },
        accent: "$hue.purple",
        interactive: "$hue.blue",
        neutral: "$hue.gray",
      },
      tokens: {
        text: {
          base: "#2b2936",
          muted: "#686577",
          action: actionGroups("$hue.accent.300", "$hue.neutral.500", "$hue.red.300"),
        },
        background: {
          base: "#e2e1e9",
          raised: { base: "#d7d5df", high: "#d0cfda", max: "#cac8d4" },
        },
        border: { base: "#c0bfcc" },
        scrollbar: { base: "#c0bfcc" },
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
