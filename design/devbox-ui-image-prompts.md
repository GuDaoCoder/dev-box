# DevBox UI 设计图生成提示

生成方式：Codex 内置图像生成工具。  
统一约束：高保真桌面产品界面、16:10 横向、深色主题、8 px 网格、8 px 圆角、克制阴影、无玻璃拟态、无渐变、无设备外框、无水印。

> 当前设计图只覆盖平台 Shell、插件中心和首批四个通用工具。Java 编辑器、SQL Formatter、JWT、正则测试和 HTTP Client 不在当前路线中；已有相关旧图仅作为历史草案，不参与验收。

## JSON Tool

```text
Use case: ui-mockup
Asset type: high-fidelity desktop application design screen, 16:10 landscape
Primary request: DevBox JSON formatter and validator screen inside a unified local-first plugin platform.
Scene/backdrop: full application window only, no laptop hardware, no surrounding desk.
Style/medium: shippable realistic product UI, original design, crisp dark theme, calm professional developer-tool aesthetic.
Composition/framing: 1440x900-style desktop layout. 64px activity rail at far left, 232px navigation sidebar, top command/search bar, central split editor workspace, slim bottom status bar. Balanced dense layout.
Color palette: near-black navy background #0B0F14, elevated surfaces #111821 and #17212C, hairline borders #263241, primary cyan #43C6E8, secondary violet #8B7CF6, success mint #55D6A7, warning amber #F2B84B, off-white text #E6EDF3, muted text #8B98A7.
UI content: brand text "DevBox"; activity rail entries "Tools", "Plugin Center", "Settings"; navigation section "TOOLS" with "JSON", "Timestamp", "Encoding", "UUID / Hash"; JSON selected. Header title "JSON"; compact buttons "Format", "Minify", "Validate"; two equal code panes labeled "Input" and "Output"; sample JSON in monospace; inline validation badge "Valid JSON"; utility controls for copy, clear and wrap; status bar shows "Local only", "UTF-8", "Ready".
Typography: readable modern sans-serif UI with crisp monospace editor text, strong hierarchy, 13–15px scale.
Constraints: exact text where practical; consistent 8px spacing grid; 8px corner radius; restrained shadows; practical resizable desktop layout; no glassmorphism; no gradients; no illustrations; no people; no logos besides plain DevBox wordmark; no watermark; no browser chrome; no mockup device frame.
Avoid: oversized cards, excessive rounded pills, neon cyberpunk, clutter, tiny illegible labels.
```

## Timestamp Tool

```text
Use case: ui-mockup
Asset type: high-fidelity desktop application design screen, 16:10 landscape
Primary request: DevBox timestamp conversion tool, using the exact same shell and visual system as the JSON screen.
Scene/backdrop: full application window only, no laptop hardware, no surrounding desk.
Style/medium: shippable realistic product UI, original design, crisp dark professional desktop UI.
Composition/framing: 1440x900-style layout. 64px activity rail, 232px tools sidebar, top command/search bar, two-column conversion workspace, compact history panel on the right, slim status bar.
Color palette: near-black navy #0B0F14, surfaces #111821 and #17212C, borders #263241, cyan #43C6E8, violet #8B7CF6, mint #55D6A7, amber #F2B84B, off-white #E6EDF3, muted #8B98A7.
UI content: "DevBox"; sidebar items "JSON", "Timestamp", "Encoding", "UUID / Hash"; Timestamp selected. Header "Timestamp". Primary input field contains "1789574400" with unit selector "Seconds". Output rows "Local time", "UTC", "ISO 8601", "Relative time" with copy buttons. A timezone selector shows "Asia/Shanghai (UTC+8)". Compact card "Current time" updates live and has "Pause" and "Copy" actions. Right panel "Recent conversions" contains a short local-only history. Status bar shows "Local only", "Asia/Shanghai", "Ready".
Typography: modern sans-serif with tabular numerals and crisp monospace values, readable 13–15px scale.
Constraints: exact text where practical; consistent 8px grid; 8px radius; restrained shadows; clear input-to-output hierarchy; no glassmorphism; no gradients; no illustrations; no people; no watermark; no browser chrome; no device frame.
Avoid: dashboard charts, calendar-heavy UI, giant numbers, excessive cards, neon cyberpunk, clutter.
```

## Encoding Tool

```text
Use case: ui-mockup
Asset type: high-fidelity desktop application design screen, 16:10 landscape
Primary request: DevBox text encoding and decoding tool, using the same unified shell and visual language as the JSON and Timestamp screens.
Scene/backdrop: full application window only.
Style/medium: shippable realistic product UI, original design, crisp dark professional developer utility.
Composition/framing: 1440x900-style layout. 64px activity rail, 232px tools sidebar, top command/search bar, central two-pane converter with a narrow action column between input and output, slim status bar.
Color palette: near-black navy #0B0F14, surfaces #111821 and #17212C, borders #263241, cyan #43C6E8, violet #8B7CF6, mint #55D6A7, amber #F2B84B, red #F26D78, off-white #E6EDF3, muted #8B98A7.
UI content: "DevBox"; sidebar items "JSON", "Timestamp", "Encoding", "UUID / Hash"; Encoding selected. Header "Encoding". Segmented mode control "Base64", "URL", "UTF-8 ↔ Hex" with Base64 selected. Left pane "Input" contains readable sample text. Center actions "Encode →", "← Decode", and swap icon. Right pane "Output" contains Base64 text. Utility buttons "Paste", "Clear", "Copy". Options row includes "UTF-8", "Standard Base64", and a checked "Preserve line breaks" control. A compact validation message says "Valid Base64 input". Status bar shows "Local only", "UTF-8", "Ready".
Typography: readable modern sans-serif with crisp monospace payloads.
Constraints: exact text where practical; consistent 8px grid and 8px corner radius; restrained shadows; practical resizable panels; no glassmorphism; no gradients; no illustrations; no people; no watermark; no browser chrome; no device frame.
Avoid: cryptography branding, security theater, oversized controls, excessive pills, neon cyberpunk, tiny text.
```

## Plugin Center

```text
Use case: ui-mockup
Asset type: high-fidelity desktop application design screen, 16:10 landscape
Primary request: DevBox Plugin Center showing a secure, understandable experience for online and offline plugin installation.
Scene/backdrop: full application window only.
Style/medium: shippable realistic product UI, original design, crisp dark professional desktop UI, trustworthy rather than promotional.
Composition/framing: 1440x900-style layout. 64px activity rail, 232px Plugin Center navigation sidebar, top command/search bar. Main content has a plugin catalog list on the left and selected plugin details on the right. A contained install confirmation dialog is open above the page. Slim status bar.
Color palette: near-black navy #0B0F14, surfaces #111821 and #17212C, borders #263241, cyan #43C6E8, violet #8B7CF6, mint #55D6A7, amber #F2B84B, red #F26D78, off-white #E6EDF3, muted #8B98A7.
UI content: "DevBox"; activity rail entries "Tools", "Plugin Center", "Settings"; Plugin Center selected. Sidebar sections "Installed", "Online", "Offline Install", "Updates"; Online selected. Search placeholder "Search official plugins". Plugin entries "JSON Tool", "Timestamp", "Encoding", "UUID / Hash" with publisher badge "DevBox Official", version and installed state. Selected detail shows version "1.0.0", compatibility "DevBox 0.2+", checksum status and release notes. Open confirmation dialog title "Install Encoding?"; source "Official online catalog"; checks "Signature verified", "Package checksum verified", "Compatible with this DevBox version"; permissions list "Read clipboard when requested" and "Write plugin-local storage"; actions "Cancel" and primary "Install". A secondary toolbar action says "Install from file…". Status bar shows "Catalog updated", "Signature policy: Strict", "Ready".
Typography: readable modern sans-serif, crisp monospace checksum fragment, 13–15px scale.
Constraints: exact text where practical; consistent 8px grid and 8px radius; restrained shadows; clear source, signature and permission hierarchy; distinguish online source from offline file source while keeping one installation flow; no glassmorphism; no gradients; no illustrations; no people; no watermark; no browser chrome; no device frame.
Avoid: consumer app-store advertising, giant artwork, vague security copy, excessive cards, neon cyberpunk, clutter, tiny text.
```
