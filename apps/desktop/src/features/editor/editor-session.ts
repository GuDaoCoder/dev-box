const sessionKey = "devbox.editor.workspace.v1";

export type EditorSession = {
  rootPath: string;
  tabs: string[];
  activePath?: string;
};

export function readEditorSession(): EditorSession | null {
  try {
    const raw = window.localStorage.getItem(sessionKey);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const session = value as Record<string, unknown>;
    if (typeof session.rootPath !== "string" || !session.rootPath) return null;
    if (!Array.isArray(session.tabs)) return null;
    const tabs = session.tabs.filter(
      (path): path is string => typeof path === "string" && path.length > 0 && path.length <= 1024,
    );
    return {
      rootPath: session.rootPath,
      tabs: [...new Set(tabs)].slice(0, 100),
      activePath: typeof session.activePath === "string" ? session.activePath : undefined,
    };
  } catch {
    return null;
  }
}

export function writeEditorSession(session: EditorSession | null) {
  try {
    if (session) window.localStorage.setItem(sessionKey, JSON.stringify(session));
    else window.localStorage.removeItem(sessionKey);
  } catch {
    // 本地存储不可用时不阻止编辑器使用。
  }
}
