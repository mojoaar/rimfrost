// Windows Terminal check: one fragment holding one colour scheme.
//
// No hand-made file outside the repo to pin against, so this asserts the
// mapping and the exact key set the fragment loader requires.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAll } from "../src/build.mjs";
import { exportWindowsterminal } from "../src/export-windowsterminal.mjs";

const PROJECT_ROOT = fileURLToPath(new URL("..", import.meta.url));
const PALETTES = join(PROJECT_ROOT, "src", "palettes");
const themesDir = mkdtempSync(join(tmpdir(), "rimfrost-themes-"));
const outDir = mkdtempSync(join(tmpdir(), "rimfrost-windowsterminal-"));
buildAll({ palettesDir: PALETTES, outDir: themesDir });
const { themes, errors } = exportWindowsterminal({ themesDir, outDir });
const body = (file) => readFileSync(join(outDir, file), "utf8");
const scheme = (file) => JSON.parse(body(file)).schemes[0];
const mode = (file) => (file.endsWith(" Light.json") ? "light" : "dark");
const cap = (name) => name[0].toUpperCase() + name.slice(1);
const themefile = (file) =>
  JSON.parse(readFileSync(join(themesDir, `${file.replace(/( Light)?\.json$/, "").toLowerCase()}.json`), "utf8"));
const ANSI = ["black", "red", "green", "yellow", "blue", "purple", "cyan", "white"];
const CHROMATIC = ["red", "green", "yellow", "blue", "purple", "cyan"];
const SLOTS = [
  ["gray", "900"], ...CHROMATIC.map((hue) => [hue, "300"]), ["gray", "300"],
  ["gray", "600"], ...CHROMATIC.map((hue) => [hue, "200"]), ["gray", "100"],
];
const step = (tree, hue, at) =>
  typeof tree.hue[hue] === "string"
    ? tree.hue[tree.hue[hue].replace("$hue.", "")][at]
    : tree.hue[hue][at];
const KEYS = [...ANSI, ...ANSI.map((name) => `bright${name[0].toUpperCase()}${name.slice(1)}`)];
const expected = (tree, label) => ({
  name: label,
  ...Object.fromEntries(SLOTS.map((slot, i) => [KEYS[i], step(tree, slot[0], slot[1])])),
  background: tree.background.base,
  foreground: tree.text.base,
  cursorColor: step(tree, "accent", "300"),
  selectionBackground: tree.background.raised.high,
});

test("every theme is exported as two fragments, with no errors", () => {
  assert.deepEqual(errors, []);
  assert.deepEqual(themes, ["fjord", "nordlys", "ravn", "skumring"]);
  assert.deepEqual(
    readdirSync(outDir).sort(),
    themes.flatMap((name) => [`${cap(name)} Light.json`, `${cap(name)}.json`]),
  );
});

test("every fragment is a schemes array of one scheme, with the 21 keys in order", () => {
  for (const file of readdirSync(outDir)) {
    const parsed = JSON.parse(body(file));
    assert.deepEqual(Object.keys(parsed), ["schemes"], file);
    assert.equal(parsed.schemes.length, 1, file);
    assert.deepEqual(Object.keys(scheme(file)), [
      "name",
      "black", "red", "green", "yellow", "blue", "purple", "cyan", "white",
      "brightBlack", "brightRed", "brightGreen", "brightYellow",
      "brightBlue", "brightPurple", "brightCyan", "brightWhite",
      "background", "foreground", "cursorColor", "selectionBackground",
    ], file);
    for (const [key, value] of Object.entries(scheme(file))) {
      if (key !== "name") assert.match(value, /^#[0-9a-f]{6}$/, `${file} ${key}`);
    }
  }
});

test("every key is the mapping's token", () => {
  for (const file of readdirSync(outDir)) {
    // deepEqual on the whole scheme: a missing key and a stray key both fail.
    assert.deepEqual(scheme(file), expected(themefile(file)[mode(file)], file.replace(".json", "")), file);
  }
});

test("no orange reaches a terminal: there is no ANSI slot for it", () => {
  // Values here are hex strings, so the hex comparison is live.
  for (const file of readdirSync(outDir)) {
    for (const hex of Object.values(themefile(file)[mode(file)].hue.orange)) {
      assert.ok(!body(file).includes(hex), `${file} carries orange ${hex}`);
    }
  }
});

test("bright slots in light mode are darker, not lighter", () => {
  const lum = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  for (const file of readdirSync(outDir)) {
    const { hue } = themefile(file)[mode(file)];
    const [normal, bright] = [hue.red["300"], hue.red["200"]];
    if (mode(file) === "dark") assert.ok(lum(bright) > lum(normal), `${file}: bright should be lighter`);
    else assert.ok(lum(bright) < lum(normal), `${file}: bright should be darker`);
  }
});
