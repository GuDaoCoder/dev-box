import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

const [mainCapability, pluginCapability, tauriConfig, runtimeSource, pluginCommands] =
  await Promise.all([
    readJson("apps/desktop/src-tauri/capabilities/default.json"),
    readJson("apps/desktop/src-tauri/capabilities/plugin-runtime.json"),
    readJson("apps/desktop/src-tauri/tauri.conf.json"),
    readFile(new URL("apps/desktop/src-tauri/src/runtime.rs", root), "utf8"),
    readFile(new URL("apps/desktop/src-tauri/src/commands/plugins.rs", root), "utf8"),
  ]);

assert.deepEqual(mainCapability.webviews, ["main"], "主能力只能授权 main WebView");
assert.ok(
  mainCapability.permissions.includes("dialog:allow-open"),
  "只有主 WebView 需要文件选择权限",
);
assert.deepEqual(
  pluginCapability.webviews,
  ["plugin-*"],
  "插件能力只能授权隔离的 plugin-* WebView",
);
assert.ok(
  !pluginCapability.permissions.some((permission) => permission.startsWith("dialog:")),
  "插件 WebView 不能直接访问文件选择器",
);

const mainCsp = tauriConfig.app.security.csp;
for (const directive of [
  "script-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-src 'none'",
]) {
  assert.ok(mainCsp.includes(directive), `主界面 CSP 缺少 ${directive}`);
}
assert.ok(!mainCsp.includes("*"), "主界面 CSP 不能包含通配源");

for (const policy of [
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "X-Content-Type-Options",
]) {
  assert.ok(runtimeSource.includes(policy), `插件资源响应缺少安全策略：${policy}`);
}
assert.ok(pluginCommands.includes('window.label() != "main"'), "管理命令必须校验主 WebView 身份");
assert.ok(pluginCommands.includes("validate_bridge_secret"), "插件失败上报必须校验桥接密钥");
assert.ok(pluginCommands.includes("consume_gesture_token"), "剪贴板命令必须消费用户手势令牌");

console.log("Security configuration checks passed.");
