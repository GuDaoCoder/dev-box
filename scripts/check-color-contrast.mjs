import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../packages/ui/src/styles.css", import.meta.url), "utf8");

function tokens(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))?.[1];
  assert.ok(block, `找不到颜色主题 ${selector}`);
  return Object.fromEntries(
    [...block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})/gi)].map((match) => [match[1], match[2]]),
  );
}

function luminance(hex) {
  const channels = [1, 3, 5].map(
    (offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255,
  );
  const linear = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(left, right) {
  const values = [luminance(left), luminance(right)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

for (const [name, palette] of [
  ["dark", tokens(":root")],
  ["light", tokens(':root[data-theme="light"]')],
]) {
  for (const [foreground, background, minimum] of [
    ["text", "bg-canvas", 4.5],
    ["text", "bg-surface", 4.5],
    ["text-muted", "bg-canvas", 4.5],
    ["text-muted", "bg-surface", 4.5],
    ["accent", "bg-canvas", 3],
    ["accent", "bg-surface", 3],
  ]) {
    const ratio = contrast(palette[foreground], palette[background]);
    assert.ok(
      ratio >= minimum,
      `${name} 主题 ${foreground}/${background} 对比度 ${ratio.toFixed(2)} 低于 ${minimum}:1`,
    );
  }
}

console.log("Color contrast checks passed.");
