// macOS Terminal.app check: one XML profile per theme per mode, whose colours
// are archived NSColor blobs.
//
// No hand-made file outside the repo to pin against, so this asserts the
// mapping and the blob shape: every blob is the same length and differs from
// the others only inside one 39-byte payload.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAll } from "../src/build.mjs";
import { exportTerminal } from "../src/export-terminal.mjs";

const PROJECT_ROOT = fileURLToPath(new URL("..", import.meta.url));
const PALETTES = join(PROJECT_ROOT, "src", "palettes");
const themesDir = mkdtempSync(join(tmpdir(), "rimfrost-themes-"));
const outDir = mkdtempSync(join(tmpdir(), "rimfrost-terminal-"));
buildAll({ palettesDir: PALETTES, outDir: themesDir });
const { themes, errors } = exportTerminal({ themesDir, outDir });
const body = (file) => readFileSync(join(outDir, file), "utf8");
const mode = (file) => (file.endsWith(" Light.terminal") ? "light" : "dark");
const cap = (name) => name[0].toUpperCase() + name.slice(1);
const themefile = (file) =>
  JSON.parse(readFileSync(join(themesDir, `${file.replace(/( Light)?\.terminal$/, "").toLowerCase()}.json`), "utf8"));
// The blob contract, stated here independently of the exporter.
const BLOB_LENGTH = 274;  // ← the number step 3 prints
const PAYLOAD_AT = 129;   // ← the offset step 3 prints
const PAYLOAD_LENGTH = 39;
/** The twenty-one colour keys, in the order the file must carry them. */
const KEYS = [
  "ANSIBlackColor", "ANSIRedColor", "ANSIGreenColor", "ANSIYellowColor",
  "ANSIBlueColor", "ANSIMagentaColor", "ANSICyanColor", "ANSIWhiteColor",
  "ANSIBrightBlackColor", "ANSIBrightRedColor", "ANSIBrightGreenColor", "ANSIBrightYellowColor",
  "ANSIBrightBlueColor", "ANSIBrightMagentaColor", "ANSIBrightCyanColor", "ANSIBrightWhiteColor",
  "BackgroundColor", "TextColor", "TextBoldColor", "SelectionColor", "CursorColor",
];
const entries = (file) =>
  [...body(file).matchAll(/<key>([A-Za-z]+)<\/key>\s*<data>([A-Za-z0-9+/=]+)<\/data>/g)]
    .map((m) => [m[1], Buffer.from(m[2], "base64")]);
/** A blob's three floats, round-tripped back to the bytes they came from. */
const bytesOf = (blob) =>
  blob.subarray(PAYLOAD_AT, PAYLOAD_AT + PAYLOAD_LENGTH).toString("latin1")
    .replace(/\0$/, "").split(" ")
    .map((part) => Math.round(parseFloat(part) * 255));
const hexOf = (blob) => `#${bytesOf(blob).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
const ANSI = ["red", "green", "yellow", "blue", "purple", "cyan"];
const SLOTS = [
  ["gray", "900"], ...ANSI.map((hue) => [hue, "300"]), ["gray", "300"],
  ["gray", "600"], ...ANSI.map((hue) => [hue, "200"]), ["gray", "100"],
];
const step = (tree, hue, at) =>
  typeof tree.hue[hue] === "string"
    ? tree.hue[tree.hue[hue].replace("$hue.", "")][at]
    : tree.hue[hue][at];

test("every theme is exported as two profiles, with no errors", () => {
  assert.deepEqual(errors, []);
  assert.deepEqual(themes, ["fjord", "nordlys", "ravn", "skumring"]);
  assert.deepEqual(
    readdirSync(outDir).sort(),
    themes.flatMap((name) => [`${cap(name)} Light.terminal`, `${cap(name)}.terminal`]),
  );
});

test("every file is a plist carrying the twenty-one colour keys, in order", () => {
  for (const file of readdirSync(outDir)) {
    const xml = body(file);
    assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), file);
    assert.ok(xml.includes('<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"'), file);
    assert.ok(xml.includes("<string>Window Settings</string>"), file);
    assert.ok(xml.includes("<real>2.09</real>"), file);
    assert.match(xml, new RegExp(`<key>name</key>\\s*<string>${file.replace(".terminal", "")}</string>`), file);
    assert.deepEqual(entries(file).map(([key]) => key), KEYS, file);
  }
});

test("every blob is the same length and differs only inside its payload", () => {
  const masked = (blob) => {
    const copy = Buffer.from(blob);
    copy.fill(0, PAYLOAD_AT, PAYLOAD_AT + PAYLOAD_LENGTH);
    return copy;
  };
  let reference = null;
  for (const file of readdirSync(outDir)) {
    for (const [key, blob] of entries(file)) {
      assert.equal(blob.length, BLOB_LENGTH, `${file} ${key} blob length`);
      assert.match(blob.subarray(0, 8).toString("latin1"), /^bplist00$/, `${file} ${key} is not a binary plist`);
      assert.ok(blob.toString("latin1").includes("NSKeyedArchiver"), `${file} ${key} is not an archive`);
      reference ??= masked(blob);
      assert.deepEqual(masked(blob), reference, `${file} ${key} differs outside its payload`);
    }
  }
});

test("every slot is the ramp step the design names", () => {
  for (const file of readdirSync(outDir)) {
    const tree = themefile(file)[mode(file)];
    // deepEqual on the whole map: a missing key and a stray key both fail.
    const expected = Object.fromEntries([
      ...KEYS.slice(0, 16).map((key, i) => [key, step(tree, SLOTS[i][0], SLOTS[i][1])]),
      ["BackgroundColor", tree.background.base],
      ["TextColor", tree.text.base],
      ["TextBoldColor", tree.text.base],
      ["SelectionColor", tree.background.raised.high],
      ["CursorColor", step(tree, "accent", "300")],
    ]);
    assert.deepEqual(
      Object.fromEntries(entries(file).map(([key, blob]) => [key, hexOf(blob)])),
      expected,
      `${file} does not match the mapping`,
    );
  }
});

test("the cursor is the signature hue, not the action's step", () => {
  // `hue.accent` is a whole-hue alias and it differs per theme (fjord cyan,
  // nordlys green, ravn purple, skumring blue), so follow it: asserting
  // `hue.cyan` here would pass for fjord only.
  for (const file of readdirSync(outDir)) {
    const tree = themefile(file)[mode(file)];
    const blob = entries(file).find(([key]) => key === "CursorColor")[1];
    assert.equal(hexOf(blob), step(tree, "accent", "300"), file);
  }
});

test("no orange reaches a terminal: there is no ANSI slot for it", () => {
  // Components, never a hex string: a blob is binary and its payload is floats.
  for (const file of readdirSync(outDir)) {
    const orange = Object.values(themefile(file)[mode(file)].hue.orange)
      .map((hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)));
    for (const [key, blob] of entries(file)) {
      assert.ok(!orange.some((bytes) => bytes.every((b, i) => b === bytesOf(blob)[i])), `${file} ${key} carries orange`);
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
