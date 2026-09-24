export function shortcutLabelForPlatform(platform: string, key: string) {
  return `${/Mac|iPhone|iPad/i.test(platform) ? "⌘" : "Ctrl"} ${key.toUpperCase()}`;
}
