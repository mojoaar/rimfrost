// Colour maths for the palette pipeline. Everything here is 8-bit sRGB hex in
// and out, because that is the only form the theme contract accepts; the
// interpolation itself happens in OKLab, where a linear ramp between two
// anchors is perceptually even instead of muddy in the midtones.
//
// The OKLab matrices are Björn Ottosson's published constants. They are
// reproduced exactly rather than re-derived, since the round-trip and lightness
// anchors are sensitive to the last digit.
//
// This module is standalone: it deliberately does not import the contract's
// HEX_RE. That regex mirrors OpenCode's validator and accepts 3-, 4-, 6- and
// 8-digit input; here we must actually parse the value, so `hexToRgb` is
// stricter on purpose. Consumers must not rely on this parser being lenient.

const HEX6_RE = /^#([\da-f]{6})$/i;
const HEX3_RE = /^#([\da-f]{3})$/i;

/**
 * Parse `#rrggbb` or `#rgb` (case-insensitive) into 8-bit channels.
 *
 * @param {string} hex
 * @returns {{r: number, g: number, b: number}}
 */
export function hexToRgb(hex) {
  const full = HEX6_RE.exec(hex) ?? HEX3_RE.exec(hex);
  if (!full) throw new Error(`Invalid hex colour: ${hex}`);

  const digits = full[1];
  // Shorthand expands each nibble to a byte: #abc -> #aabbcc.
  const byte = (i) => Number.parseInt(
    digits.length === 6 ? digits.slice(i * 2, i * 2 + 2) : digits[i].repeat(2),
    16,
  );
  return { r: byte(0), g: byte(1), b: byte(2) };
}

/**
 * Format 8-bit channels as lowercase `#rrggbb`. Out-of-gamut channels are
 * clamped to 0..255 before rounding, so the result is always a valid hex
 * colour.
 *
 * @param {{r: number, g: number, b: number}} rgb
 * @returns {string}
 */
export function rgbToHex({ r, g, b }) {
  const byte = (channel) => {
    const clamped = Math.min(255, Math.max(0, channel));
    return Math.round(clamped).toString(16).padStart(2, "0");
  };
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

/** sRGB encoded channel (0..1) -> linear-light channel (0..1). */
function toLinear(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Linear-light channel (0..1) -> sRGB encoded channel (0..1). */
function toGamma(c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

/**
 * Convert 8-bit sRGB to OKLab.
 *
 * @param {{r: number, g: number, b: number}} rgb
 * @returns {{L: number, a: number, b: number}}
 */
export function srgbToOklab({ r, g, b }) {
  const lr = toLinear(r / 255);
  const lg = toLinear(g / 255);
  const lb = toLinear(b / 255);

  // linear sRGB -> cone response (LMS)
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return {
    L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  };
}

/**
 * Convert OKLab back to 8-bit sRGB. Channels are returned unclamped so callers
 * can tell how far outside the gamut a colour sits; `rgbToHex` clamps.
 *
 * @param {{L: number, a: number, b: number}} oklab
 * @returns {{r: number, g: number, b: number}}
 */
export function oklabToSrgb({ L, a, b }) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  const lr = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  return { r: toGamma(lr) * 255, g: toGamma(lg) * 255, b: toGamma(lb) * 255 };
}

/**
 * Interpolate two hex colours in OKLab. `t` is not clamped: 0 is exactly
 * `hexA`, 1 exactly `hexB`, and values outside 0..1 extrapolate.
 *
 * @param {string} hexA
 * @param {string} hexB
 * @param {number} t
 * @returns {string}
 */
export function mixOklab(hexA, hexB, t) {
  const A = srgbToOklab(hexToRgb(hexA));
  const B = srgbToOklab(hexToRgb(hexB));
  const lerp = (x, y) => x + (y - x) * t;
  return rgbToHex(oklabToSrgb({
    L: lerp(A.L, B.L),
    a: lerp(A.a, B.a),
    b: lerp(A.b, B.b),
  }));
}

/**
 * WCAG relative luminance of a hex colour, from its linear-light channels.
 *
 * @param {string} hex
 * @returns {number}
 */
export function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * toLinear(r / 255)
    + 0.7152 * toLinear(g / 255)
    + 0.0722 * toLinear(b / 255);
}

/**
 * WCAG contrast ratio between two hex colours, lighter first. Ranges from 1
 * (identical colours) to 21 (black on white).
 *
 * @param {string} hexA
 * @param {string} hexB
 * @returns {number}
 */
export function contrastRatio(hexA, hexB) {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const [hi, lo] = a >= b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}
