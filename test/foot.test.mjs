// foot check: one ini holding both colour sections.
//
// There is no hand-made file outside the repo to pin against, so this asserts
// the mapping itself, and the shape a wrong serialiser would break.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAll } from "../src/build.mjs";
import { exportFoot } from "../src/export-foot.mjs";

const PROJECT_ROOT = fileURLToPath(new URL("..", import.meta.url));
const PALETTES = join(PROJECT_ROOT, "src", "palettes");
const themesDir = mkdtempSync(join(tmpdir(), "rimfrost-themes-"));
const outDir = mkdtempSync(join(tmpdir(), "rimfrost-foot-"));
buildAll({ palettesDir: PALETTES, outDir: themesDir });
const { themes, errors } = exportFoot({ themesDir, outDir });
const body = (name) => readFileSync(join(outDir, `${name}.ini`), "utf8");
const theme = (name) => JSON.parse(readFileSync(join(themesDir, `${name}.json`), "utf8"));
/** Every section of one file, as [{ name, keys: Map }, …], in file order. */
const sections = (name) => {
  const found = [];
  for (const line of body(name).split("\n")) {
    const section = line.match(/^\[(.+)\]$/);
    if (section) found.push({ name: section[1], keys: new Map() });
    else {
      const pair = line.match(/^([a-z0-9-]+)=(.*)$/);
      if (pair && found.length) found[found.length - 1].keys.set(pair[1], pair[2]);
    }
  }
  return found;
};
// A hue entry is either a ramp or a whole-hue alias; follow the alias.
const step = (tree, hue, at) =>
  typeof tree.hue[hue] === "string"
    ? tree.hue[tree.hue[hue].replace("$hue.", "")][at]
    : tree.hue[hue][at];
const bare = (hex) => hex.slice(1);
const CHROMATIC = ["red", "green", "yellow", "blue", "purple", "cyan"];
const SLOTS = [
  ["gray", "900"], ...CHROMATIC.map((hue) => [hue, "300"]), ["gray", "300"],
  ["gray", "600"], ...CHROMATIC.map((hue) => [hue, "200"]), ["gray", "100"],
];
const expected = (tree) => Object.fromEntries([
  ["background", bare(tree.background.base)],
  ["foreground", bare(tree.text.base)],
  ...SLOTS.map(([hue, at], i) => [`${i < 8 ? "regular" : "bright"}${i % 8}`, bare(step(tree, hue, at))]),
  ["selection-foreground", bare(tree.text.base)],
  ["selection-background", bare(tree.background.raised.high)],
  ["cursor", `${bare(tree.background.base)} ${bare(step(tree, "accent", "300"))}`],
  ["urls", bare(step(tree, "accent", "300"))],
]);

test("every theme is exported as one file holding both modes, with no errors", () => {
  assert.deepEqual(errors, []);
  assert.deepEqual(themes, ["fjord", "nordlys", "ravn", "skumring"]);
  assert.deepEqual(readdirSync(outDir).sort(), themes.map((name) => `${name}.ini`));
});

test("each file carries the dark section then the light one, 22 keys each", () => {
  for (const name of themes) {
    assert.deepEqual(sections(name).map((s) => s.name), ["colors-dark", "colors-light"], name);
    for (const section of sections(name)) assert.equal(section.keys.size, 22, `${name} ${section.name}`);
    assert.match(body(name).split("\n")[0], /^# /, `${name} has no header comment`);
  }
});

test("every key is the mapping's token, as bare six-digit hex", () => {
  for (const name of themes) {
    const { dark, light } = theme(name);
    for (const section of sections(name)) {
      // deepEqual on the whole map: a missing key and a stray key both fail.
      const got = Object.fromEntries(section.keys);
      assert.deepEqual(got, expected(section.name === "colors-dark" ? dark : light), `${name} ${section.name}`);
      for (const [key, value] of Object.entries(got)) {
        const shape = key === "cursor" ? /^[0-9a-f]{6} [0-9a-f]{6}$/ : /^[0-9a-f]{6}$/;
        assert.match(value, shape, `${name} ${section.name} ${key}=${value}`);
      }
    }
  }
});

test("the cursor pair is the text colour, then the cursor colour", () => {
  // Two values in one key, unlike every other target: text first.
  for (const name of themes) {
    const { dark } = theme(name);
    // The second value is the theme's accent — cyan for fjord, green for
    // nordlys, purple for ravn, blue for skumring — so follow the alias.
    assert.equal(
      sections(name)[0].keys.get("cursor"),
      `${bare(dark.background.base)} ${bare(step(dark, "accent", "300"))}`,
      name,
    );
  }
});

test("no orange reaches a terminal: there is no ANSI slot for it", () => {
  for (const name of themes) {
    const { dark, light } = theme(name);
    for (const hex of [...Object.values(dark.hue.orange), ...Object.values(light.hue.orange)]) {
      assert.ok(!body(name).includes(bare(hex)), `${name} carries orange ${hex}`);
    }
  }
});

test("bright slots in light mode are darker, not lighter", () => {
  const lum = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  for (const name of themes) {
    const { dark, light } = theme(name);
    const darker = (tree) => lum(tree.hue.red["200"]) < lum(tree.hue.red["300"]);
    assert.ok(!darker(dark), `${name}: bright should be lighter in dark mode`);
    assert.ok(darker(light), `${name}: bright should be darker in light mode`);
  }
});
