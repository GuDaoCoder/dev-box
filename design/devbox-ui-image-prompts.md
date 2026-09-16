# DevBox UI 设计图生成提示

生成方式：Codex 内置图像生成工具。  
统一约束：高保真桌面产品界面、16:10 横向、深色主题、8 px 网格、8 px 圆角、克制阴影、无玻璃拟态、无渐变、无设备外框、无水印。

## JSON Tool

```text
Use case: ui-mockup
Asset type: high-fidelity desktop application design screen, 16:10 landscape
Primary request: DevBox developer toolbox home and JSON formatter screen, showing a unified desktop shell for a local-first cross-platform utility app.
Scene/backdrop: full application window only, no laptop hardware, no surrounding desk.
Style/medium: shippable realistic product UI, original design, not concept art. Crisp dark theme, calm professional developer tool aesthetic.
Composition/framing: 1440x900-style desktop layout. 64px icon rail at far left, 232px navigation sidebar, top command/search bar, central split editor workspace, slim bottom status bar. Balanced dense layout.
Color palette: near-black navy background #0B0F14, elevated surfaces #111821 and #17212C, hairline borders #263241, primary cyan #43C6E8, secondary violet #8B7CF6, success mint #55D6A7, warning amber #F2B84B, off-white text #E6EDF3, muted text #8B98A7.
UI content: brand text "DevBox"; navigation sections "TOOLS", "DEVELOPMENT"; tool items "JSON", "Timestamp", "SQL", "Java Runner", "HTTP Client"; JSON selected. Header title "JSON"; compact buttons "Format", "Minify", "Validate"; two equal code panes labeled "Input" and "Output"; sample JSON in monospace; inline validation badge "Valid JSON"; small utility controls for copy, clear, wrap; status bar shows "Local only", "UTF-8", "Ready".
Typography: readable modern sans-serif UI with crisp monospace editor text, strong hierarchy, 13–15px scale.
Constraints: exact text where practical; consistent 8px spacing grid; 8px corner radius; restrained shadows; practical resizable desktop layout; no glassmorphism; no gradients; no illustrations; no people; no logos besides plain DevBox wordmark; no watermark; no browser chrome; no mockup device frame.
Avoid: oversized cards, excessive rounded pills, neon cyberpunk, clutter, tiny illegible labels.
```

## Java Runner

```text
Use case: ui-mockup
Asset type: high-fidelity desktop application design screen, 16:10 landscape
Primary request: DevBox Java Runner workspace, using the exact same unified shell and visual system as the DevBox JSON screen.
Scene/backdrop: full application window only, no laptop hardware, no surrounding desk.
Style/medium: shippable realistic product UI, original design, crisp dark professional developer tool.
Composition/framing: 1440x900-style desktop layout. 64px icon rail, 232px navigation sidebar, top command/search bar. Main area has tab strip, large Monaco-like Java code editor on the left two-thirds, configuration inspector on the right, resizable console panel across the bottom, slim status bar.
Color palette: near-black navy #0B0F14, surfaces #111821 and #17212C, borders #263241, cyan #43C6E8, violet #8B7CF6, mint #55D6A7, amber #F2B84B, red #F26D78, off-white #E6EDF3, muted #8B98A7.
UI content: "DevBox"; sidebar tool list "JSON", "Timestamp", "SQL", "Java Runner", "HTTP Client"; Java Runner selected. Header "Java Runner"; primary button "Run" with shortcut "⌘ Enter"; secondary "Stop". Tabs "Main.java" and "+". Editor with readable Java sample and line numbers. Right inspector fields "Runtime", "JDK 21", "Mode", "JBang", "Dependencies", "Program args", "Timeout", "30 s". Bottom console tabs "OUTPUT", "PROBLEMS", "HISTORY"; output contains "Hello, DevBox!" and a green status "Exited 0 · 428 ms". Status bar shows "Java 21", "JBang", "Ready".
Typography: modern sans-serif with crisp monospace code, readable 13–15px scale.
Constraints: exact text where practical; consistent 8px grid; 8px radius; restrained shadows; clear running/idle state; practical layout; no glassmorphism; no gradients; no illustrations; no people; no watermark; no browser chrome; no device frame.
Avoid: IDE clutter, excessive panels, neon cyberpunk, oversized controls, tiny illegible text.
```

## HTTP Client

```text
Use case: ui-mockup
Asset type: high-fidelity desktop application design screen, 16:10 landscape
Primary request: DevBox HTTP Client workspace, using the exact same unified shell and visual system as the DevBox JSON and Java screens.
Scene/backdrop: full application window only.
Style/medium: shippable realistic product UI, original design, crisp dark theme for a local-first developer tool.
Composition/framing: 1440x900-style desktop layout. 64px icon rail, 232px sidebar, top command/search bar. Main workspace with request builder across the top, request tabs in left/main pane, response panel on the right, lower response detail tabs, slim status bar.
Color palette: near-black navy #0B0F14, surfaces #111821 and #17212C, borders #263241, cyan #43C6E8, violet #8B7CF6, mint #55D6A7, amber #F2B84B, red #F26D78, off-white #E6EDF3, muted #8B98A7.
UI content: "DevBox"; sidebar items "JSON", "Timestamp", "SQL", "Java Runner", "HTTP Client"; HTTP Client selected. Header "HTTP Client". Request row with method "GET", URL "https://api.example.com/users", primary button "Send". Request tabs "Params", "Headers 2", "Body", "Auth". Key/value table. Response heading "Response"; green badge "200 OK"; metrics "142 ms" and "1.8 KB"; response tabs "Pretty", "Raw", "Headers"; formatted JSON body. Small notice "Local request · No cloud relay". History list with three recent requests.
Typography: readable modern sans-serif and crisp monospace payloads.
Constraints: exact text where practical; consistent 8px grid and 8px corner radius; restrained shadows; excellent information hierarchy; practical resizable panels; no glassmorphism; no gradients; no illustrations; no people; no watermark; no browser chrome; no device frame.
Avoid: oversized cards, excessive pills, neon cyberpunk, clutter, tiny text.
```

## Plugin Permissions

```text
Use case: ui-mockup
Asset type: high-fidelity desktop application design screen, 16:10 landscape
Primary request: DevBox plugin manager and permissions settings screen, using the exact same unified shell and visual system as the other DevBox screens.
Scene/backdrop: full application window only.
Style/medium: shippable realistic product UI, original design, crisp dark professional desktop UI.
Composition/framing: 1440x900-style layout. 64px icon rail, 232px settings navigation sidebar, top command/search bar. Main content is a clean settings page with a plugin list on the left and selected plugin details on the right. Permission rows are structured and easy to audit. Slim status bar.
Color palette: near-black navy #0B0F14, surfaces #111821 and #17212C, borders #263241, cyan #43C6E8, violet #8B7CF6, mint #55D6A7, amber #F2B84B, red #F26D78, off-white #E6EDF3, muted #8B98A7.
UI content: "DevBox"; settings nav "General", "Appearance", "Runtime", "Plugins", "Privacy & Logs"; Plugins selected. Page title "Plugins". Plugin list cards "JSON Tool", "Timestamp", "Java Runner", "SQL Tool", "HTTP Client" with small status labels "Built-in" and enabled toggles. "Java Runner" selected. Detail header "Java Runner" version "0.1.0", description "Run Java snippets with JBang and a selected JDK." Sections "Permissions" and "Runtime access". Permission rows "Run Java processes", "Open .java files", "Save .java files", "Plugin storage · 20 MB" with clear granted states. Warning callout: "Java code runs with your user permissions." Footer actions "Disable", "View logs", primary "Save changes".
Typography: readable modern sans-serif, 13–15px scale.
Constraints: exact text where practical; consistent 8px grid and 8px radius; restrained shadows; clear security hierarchy; no glassmorphism; no gradients; no illustrations; no people; no watermark; no browser chrome; no device frame.
Avoid: app-store marketing style, giant icons, excessive cards, neon cyberpunk, clutter, tiny text.
```
