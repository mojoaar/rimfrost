// The macOS Terminal.app target: one XML profile per theme per mode.
//
// The input is the theme JSON the OpenCode target already ships
// (`opencode/dist/<name>.json`), not the palettes — that is why `npm run export`
// chains the exporters with `&&`, and why every terminal target carries the same
// bytes. Reading a built file is also why `hue.accent` here is a string to follow
// before it can be indexed by step.
//
// A `.terminal` profile stores each colour as an archived `NSColor` blob, which
// nothing in Node can build — so the exporter patches one Apple-authored template
// in place. Its only variable part is a NUL-terminated ASCII payload of three
// space-separated floats, and every payload this file writes is exactly the
// template's 39 bytes, so no offset in the binary plist ever moves.
//
// Terminal.app has no light/dark pairing and no selection-foreground key: the
// user installs both files and picks a default profile by hand. Only the colours
// a program prints are set — no font, blur or window size.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PROJECT_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** The pack's purple is Terminal.app's magenta. */
const CHROMATIC = ["red", "green", "yellow", "blue", "purple", "cyan"];
/** The sixteen slots in ANSI order: the eight, then the eight brights. */
const SLOTS = [
  ["gray", "900"],
  ...CHROMATIC.map((hue) => [hue, "300"]),
  ["gray", "300"],
  ["gray", "600"],
  ...CHROMATIC.map((hue) => [hue, "200"]),
  ["gray", "100"],
];
/** Terminal.app's names for the eight roles in each half of the palette. */
const ANSI = ["Black", "Red", "Green", "Yellow", "Blue", "Magenta", "Cyan", "White"];

/** A hue entry is either a ramp or a whole-hue alias; follow the alias to the ramp. */
const ramp = (tree, name) =>
  typeof tree.hue[name] === "string"
    ? ramp(tree, tree.hue[name].replace("$hue.", "").split(".")[0])
    : tree.hue[name];

const cap = (name) => name[0].toUpperCase() + name.slice(1);

/**
 * The template, and where its payload lives.
 *
 * Taken from Apple's own `Clear Dark.terminal` in Terminal.app's
 * `Contents/Resources/Initial Settings/` — its `NSColorSpace` is `2`. An
 * `NSColor` archive's only variable part is a NUL-terminated ASCII payload of
 * three space-separated floats. `(byte / 255).toFixed(10)` is 12 characters for
 * every byte in 0…255, so three of them plus two spaces plus the terminator is
 * always 39 bytes — the template's own length — and no offset in the binary
 * plist ever moves.
 */
const TEMPLATE = Buffer.from(
  "YnBsaXN0MDDUAQIDBAUGBwpYJHZlcnNpb25ZJGFyY2hpdmVyVCR0b3BYJG9iamVjdHMSAAGGoF8QD05TS2V5ZWRBcmNoaXZlctEICVRyb290gAGjCwwTVSRudWxs0w0ODxARElVOU1JHQlxOU0NvbG9yU3BhY2VWJGNsYXNzTxAnMC40Mjc0NTA5ODA0IDAuNTg4MjM1Mjk0MSAwLjcwNTg4MjM1MjkAEAKAAtIUFRYXWiRjbGFzc25hbWVYJGNsYXNzZXNXTlNDb2xvcqIWGFhOU09iamVjdAgRGiQpMjdJTFFTV11kand+qKqssbzFzdAAAAAAAAABAQAAAAAAAAAZAAAAAAAAAAAAAAAAAAAA2Q==",
  "base64",
);
const PAYLOAD_AT = 129;
const PAYLOAD_LENGTH = 39;

/**
 * One archived `NSColor`, base64-encoded, for a `#rrggbb` colour.
 *
 * @param {string} hex
 * @returns {string}
 */
function nscolor(hex) {
  const payload = [1, 3, 5]
    .map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(10))
    .join(" ");
  const blob = Buffer.from(TEMPLATE);
  blob.write(`${payload}\0`, PAYLOAD_AT, "latin1");
  return blob.toString("base64");
}

/**
 * One theme in one mode, as a Terminal.app profile.
 *
 * No mode branch: the ramps already flip, so `.300` is the normal ANSI colour
 * and `.200` the bright one in both modes. `TextBoldColor` is exactly the
 * foreground — the pack has one text colour and no bold concept, as in the
 * iTerm2 target — and `CursorColor` is the signature hue, not the action's step.
 *
 * @param {object} theme a built theme file
 * @param {"dark"|"light"} mode
 * @param {string} name
 * @returns {string}
 */
export function terminalProfile(theme, mode, name) {
  const tree = theme[mode];
  const slot = ([hue, at]) => nscolor(ramp(tree, hue)[at]);
  const labelled = (index) =>
    index < 8 ? `ANSI${ANSI[index]}Color` : `ANSIBright${ANSI[index - 8]}Color`;
  const entries = [
    ...SLOTS.map((entry, index) => [labelled(index), slot(entry)]),
    ["BackgroundColor", nscolor(tree.background.base)],
    ["TextColor", nscolor(tree.text.base)],
    ["TextBoldColor", nscolor(tree.text.base)],
    ["SelectionColor", nscolor(tree.background.raised.high)],
    ["CursorColor", nscolor(ramp(tree, "accent")["300"])],
  ];
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    "<dict>",
    ...entries.flatMap(([key, blob]) => [`\t<key>${key}</key>`, `\t<data>${blob}</data>`]),
    "\t<key>name</key>",
    `\t<string>${mode === "light" ? `${cap(name)} Light` : cap(name)}</string>`,
    "\t<key>ProfileCurrentVersion</key>",
    "\t<real>2.09</real>",
    "\t<key>type</key>",
    "\t<string>Window Settings</string>",
    "</dict>",
    "</plist>",
  ];
  return `${lines.join("\n")}\n`;
}

/**
 * Write every built theme as a Terminal.app profile, one per mode.
 *
 * @param {{themesDir: string, outDir: string}} paths
 * @returns {{themes: string[], errors: string[]}}
 */
export function exportTerminal({ themesDir, outDir }) {
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
      writeFileSync(join(outDir, `${cap(name)}.terminal`), terminalProfile(theme, "dark", name));
      writeFileSync(join(outDir, `${cap(name)} Light.terminal`), terminalProfile(theme, "light", name));
      themes.push(name);
    } catch (error) {
      errors.push(`${name}: ${error.message}`);
    }
  }

  return { themes, errors };
}

function main() {
  const { themes, errors } = exportTerminal({
    themesDir: join(PROJECT_ROOT, "opencode", "dist"),
    outDir: join(PROJECT_ROOT, "terminal", "dist"),
  });
  for (const name of themes) console.log(`${name}: exported`);
  for (const error of errors) console.error(error);
  if (errors.length > 0) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
