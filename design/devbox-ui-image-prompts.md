# DevBox UI 设计图生成提示

生成方式：Codex 内置图像生成工具。  
统一约束：高保真桌面产品界面、16:10 横向、深色主题、8 px 网格、8 px 圆角、克制阴影、无玻璃拟态、无渐变、无设备外框、无水印。

> 当前设计图只覆盖平台 Shell、插件中心和首批四个通用工具。XML、SQL 工具沿用 JSON 工具的双栏规范，具体交互以统一界面设计规范为准。Java 编辑器、JWT、正则测试和 HTTP Client 不在当前路线中；已有相关旧图仅作为历史草案，不参与验收。

## JSON Tool

```text
Use case: ui-mockup
Asset type: high-fidelity desktop application design screen, 16:10 landscape
Primary request: DevBox JSON formatter and validator screen inside a unified local-first plugin platform.
Scene/backdrop: full application window only, no laptop hardware, no surrounding desk.
Style/medium: shippable realistic product UI, original design, crisp dark theme, calm professional developer-tool aesthetic.
Composition/framing: 1440x900-style desktop layout. 250px two-level navigation tree at far left, top command/search bar, a compact multi-tab strip, central split editor workspace, slim bottom status bar. Balanced dense layout.
Color palette: near-black navy background #0B0F14, elevated surfaces #111821 and #17212C, hairline borders #263241, primary cyan #43C6E8, secondary violet #8B7CF6, success mint #55D6A7, warning amber #F2B84B, off-white text #E6EDF3, muted text #8B98A7.
UI content: brand text "DevBox"; navigation categories "Data", "Conversion", "Identity", "Plugins", "System"; second-level items "JSON Tool", "Timestamp Tool", "Encoding Tool", "UUID & Hash", "Plugin Manager", "Settings"; JSON selected. Tabs "JSON Tool" and "Timestamp Tool" are open. Header title "JSON Tool". The page action bar uses two explicit groups in this exact order: contiguous buttons "Format", "Compact", "Clear", then a divider or 16px gap, then contiguous options "Sort keys" and "Wrap"; never place an option between action buttons. Two equal code panes are labeled "Input" and "Result"; the Result pane header contains "Copy". Show sample JSON in monospace, an inline validation badge "Valid JSON", and a status bar with "Local only", "UTF-8", "Ready".
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
Composition/framing: 1440x900-style layout. 250px two-level navigation tree, top command/search bar, compact multi-tab strip, two-column conversion workspace, slim status bar.
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
Composition/framing: 1440x900-style layout. 250px two-level navigation tree, top command/search bar, compact multi-tab strip, central two-pane converter, slim status bar.
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
Primary request: DevBox Plugin Manager showing a secure, understandable experience for adding an unsigned local ZIP custom plugin.
Scene/backdrop: full application window only.
Style/medium: shippable realistic product UI, original design, crisp dark professional desktop UI, trustworthy rather than promotional.
Composition/framing: 1440x900-style layout. 250px two-level navigation tree, top command/search bar, compact multi-tab strip. Main content has Installed and Add ZIP Plugin tabs. A contained install confirmation dialog is open above the page. Slim status bar.
Color palette: near-black navy #0B0F14, surfaces #111821 and #17212C, borders #263241, cyan #43C6E8, violet #8B7CF6, mint #55D6A7, amber #F2B84B, red #F26D78, off-white #E6EDF3, muted #8B98A7.
UI content: "DevBox"; navigation categories "Data", "Conversion", "Identity", "Plugins", "System"; "Plugin Manager" selected and open as a workspace tab. Page tabs "Installed" and "Add ZIP Plugin". Open confirmation dialog title "Install Custom Formatter?"; source "Local ZIP"; amber warning "Unsigned plugin — publisher and content integrity cannot be verified"; checks "Structure checked", "Compatible with this DevBox version"; SHA-256 checksum; permissions list "Read clipboard when requested" and "Write plugin-local storage"; actions "Cancel" and primary "Install". Status bar shows "1 custom plugin", "Ready".
Typography: readable modern sans-serif, crisp monospace checksum fragment, 13–15px scale.
Constraints: exact text where practical; consistent 8px grid and 8px radius; restrained shadows; clear source, unsigned warning and permission hierarchy; no online catalog, no developer mode, no activity rail, no glassmorphism; no gradients; no illustrations; no people; no watermark; no browser chrome; no device frame.
Avoid: consumer app-store advertising, giant artwork, vague security copy, excessive cards, neon cyberpunk, clutter, tiny text.
```
