// The Alacritty target: the sixteen-colour palette a terminal loads, as TOML.
//
// The input is the theme JSON the OpenCode target already ships
// (`opencode/dist/<name>.json`), not the palettes — that is why `npm run export`
// chains the exporters with `&&`, and why every terminal target carries the same
// bytes. Reading a built file is also why `hue.accent` here is a string to follow
// before it can be indexed by step.
//
// The mapping is data, not branches, and there is no mode branch: the ramps
// already flip, so `.300` is the normal ANSI colour and `.200` the bright one in
// both modes. Alacritty's magenta is the pack's purple; there is no orange slot.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PROJECT_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** The pack's purple is Alacritty's magenta. */
const CHROMATIC = ["red", "green", "yellow", "blue", "purple", "cyan"];
/** Alacritty's names for the eight roles in each half of the palette. */
const ANSI = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];
/** The sixteen slots in ANSI order: `[colors.normal]` then `[colors.bright]`. */
const SLOTS = [
  ["gray", "900"],
  ...CHROMATIC.map((hue) => [hue, "300"]),
  ["gray", "300"],
  ["gray", "600"],
  ...CHROMATIC.map((hue) => [hue, "200"]),
  ["gray", "100"],
];

/** A hue entry is either a ramp or a whole-hue alias; follow the alias to the ramp. */
const ramp = (tree, name) =>
  typeof tree.hue[name] === "string"
    ? ramp(tree, tree.hue[name].replace("$hue.", "").split(".")[0])
    : tree.hue[name];

/**
 * One theme in one mode, as an Alacritty colours file.
 *
 * No mode branch: the ramps already flip, so `.300` is the normal ANSI colour
 * and `.200` the bright one in both modes, exactly as in the Ghostty file.
 *
 * @param {object} theme a built theme file
 * @param {"dark"|"light"} mode
 * @returns {string}
 */
export function alacrittyTheme(theme, mode) {
  const tree = theme[mode];
  const hex = ([hue, step]) => ramp(tree, hue)[step];
  const normal = SLOTS.slice(0, 8);
  const bright = SLOTS.slice(8);
  const lines = [
    "[colors.primary]",
    `background = "${tree.background.base}"`,
    `foreground = "${tree.text.base}"`,
    "",
    "[colors.cursor]",
    `text = "${tree.background.base}"`,
    `cursor = "${ramp(tree, "accent")["300"]}"`,
    "",
    "[colors.selection]",
    `text = "${tree.text.base}"`,
    `background = "${tree.background.raised.high}"`,
    "",
    "[colors.normal]",
    ...ANSI.map((name, index) => `${name} = "${hex(normal[index])}"`),
    "",
    "[colors.bright]",
    ...ANSI.map((name, index) => `${name} = "${hex(bright[index])}"`),
  ];
  return `${lines.join("\n")}\n`;
}

/**
 * Write every built theme as an Alacritty colours file, one per mode.
 *
 * @param {{themesDir: string, outDir: string}} paths
 * @returns {{themes: string[], errors: string[]}}
 */
export function exportAlacritty({ themesDir, outDir }) {
  mkdirSync(outDir, { recursive: true });
  const themes = [];
  const errors = [];
  const names = readdirSync(themesDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.slice(0, -".json".length))
    .sort();

  for (const name of names) {
    try {
      const theme = JSON.parse(readFileSync(join(themesDir, `${name}.json`), "utf8"));
      writeFileSync(join(outDir, `${name}.toml`), alacrittyTheme(theme, "dark"));
      writeFileSync(join(outDir, `${name}-light.toml`), alacrittyTheme(theme, "light"));
      themes.push(name);
    } catch (error) {
      errors.push(`${name}: ${error.message}`);
    }
  }

  return { themes, errors };
}

function main() {
  const { themes, errors } = exportAlacritty({
    themesDir: join(PROJECT_ROOT, "opencode", "dist"),
    outDir: join(PROJECT_ROOT, "alacritty", "dist"),
  });
  for (const name of themes) console.log(`${name}: exported`);
  for (const error of errors) console.error(error);
  if (errors.length > 0) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
