// The iTerm2 target: one dynamic profile per theme per mode, as JSON.
//
// The input is the built `opencode/dist/<name>.json` — the same bytes the
// OpenCode target ships — rather than a second build, which is why `npm run
// export` chains the exporters with `&&`. Drop the output into
// `~/Library/Application Support/iTerm2/DynamicProfiles/` and iTerm2 picks it
// up live: no GUI import, no restart.
//
// Every colour is an NSColor dict. iTerm2's source also accepts a hex string
// for the sixteen `Ansi N Color` keys, but its docs never say so and the named
// keys need the dict, so there is one serialiser and one shape.
//
// The mapping is data, not branches, and there is no mode branch: the ramps
// already flip, so `.300` is the normal ANSI colour and `.200` the bright one
// in both modes. Alacritty's magenta is the pack's purple, and there is no
// orange slot.

import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PROJECT_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Slots 1–6, then the brights 9–14, in ANSI order. No orange: ANSI has no slot for it. */
const CHROMATIC = ["red", "green", "yellow", "blue", "purple", "cyan"];

/** The sixteen ANSI slots, in index order. */
const SLOTS = [
  ["gray", "900"],
  ...CHROMATIC.map((hue) => [hue, "300"]),
  ["gray", "300"],
  ["gray", "600"],
  ...CHROMATIC.map((hue) => [hue, "200"]),
  ["gray", "100"],
];

/** RFC 4122's DNS namespace, so anyone can reproduce a Guid with any UUID tool. */
const NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

/** A hue entry is either a ramp or a whole-hue alias; follow the alias to the ramp. */
const ramp = (tree, name) =>
  typeof tree.hue[name] === "string"
    ? ramp(tree, tree.hue[name].replace("$hue.", "").split(".")[0])
    : tree.hue[name];

const cap = (name) => name[0].toUpperCase() + name.slice(1);

/** UUIDv5: SHA-1 over the namespace bytes + the name, version 5 and variant 10. */
function uuidv5(name) {
  const digest = createHash("sha1")
    .update(Buffer.concat([Buffer.from(NAMESPACE.replace(/-/g, ""), "hex"), Buffer.from(name, "utf8")]))
    .digest();
  const bytes = digest.subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** `#rrggbb` as the three 0–1 floats iTerm2 stores, rounded as iTerm2 rounds. */
const colour = (hex, alpha = 1) => ({
  "Red Component": Number((parseInt(hex.slice(1, 3), 16) / 255).toFixed(3)),
  "Green Component": Number((parseInt(hex.slice(3, 5), 16) / 255).toFixed(3)),
  "Blue Component": Number((parseInt(hex.slice(5, 7), 16) / 255).toFixed(3)),
  "Color Space": "sRGB",
  "Alpha Component": alpha,
});

/**
 * One theme in one mode, as an iTerm2 dynamic profile file.
 *
 * @param {object} theme a built theme file
 * @param {"dark"|"light"} mode
 * @param {string} name the theme's own name, as it appears in iTerm2's profile list
 * @returns {string}
 */
export function itermProfile(theme, mode, name) {
  const tree = theme[mode];
  const accent = ramp(tree, "accent")["300"];
  const profile = {
    Name: mode === "light" ? `${cap(name)} Light` : cap(name),
    Guid: uuidv5(`rimfrost/${name}/${mode}`),
    "Background Color": colour(tree.background.base),
    "Foreground Color": colour(tree.text.base),
    "Cursor Color": colour(accent),
    "Cursor Text Color": colour(tree.background.base),
    "Selection Color": colour(tree.background.raised.high),
    "Selected Text Color": colour(tree.text.base),
    "Bold Color": colour(tree.text.base),
    "Link Color": colour(accent),
    "Underline Color": colour(tree.text.muted),
    "Cursor Guide Color": colour(accent, 0.25),
    "Badge Color": colour(accent),
    ...Object.fromEntries(
      SLOTS.map(([hue, step], index) => [`Ansi ${index} Color`, colour(ramp(tree, hue)[step])]),
    ),
  };
  return `${JSON.stringify({ Profiles: [profile] }, null, 2)}\n`;
}

/**
 * Write one profile per theme per mode into `outDir`.
 *
 * @param {{themesDir: string, outDir: string}} paths
 * @returns {{themes: string[], errors: string[]}}
 */
export function exportIterm({ themesDir, outDir }) {
  mkdirSync(outDir, { recursive: true });
  const names = readdirSync(themesDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.replace(/\.json$/, ""))
    .sort();
  const themes = [];
  const errors = [];
  for (const name of names) {
    try {
      const theme = JSON.parse(readFileSync(join(themesDir, `${name}.json`), "utf8"));
      writeFileSync(join(outDir, `${cap(name)}.json`), itermProfile(theme, "dark", name));
      writeFileSync(join(outDir, `${cap(name)} Light.json`), itermProfile(theme, "light", name));
      themes.push(name);
    } catch (error) {
      errors.push(`${name}: ${error.message}`);
    }
  }
  return { themes, errors };
}

function main() {
  const { themes, errors } = exportIterm({
    themesDir: join(PROJECT_ROOT, "opencode", "dist"),
    outDir: join(PROJECT_ROOT, "iterm", "dist"),
  });
  for (const name of themes) console.log(`${name}: exported`);
  for (const error of errors) console.log(error);
  if (errors.length > 0) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
