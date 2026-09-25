import { invoke } from "@tauri-apps/api/core";

export type EditorRoot = { name: string; path: string };
export type TextEncoding = "UTF-8" | "UTF-8 BOM" | "UTF-16 LE" | "UTF-16 BE" | "GBK";
export type EditorEntry = {
  name: string;
  path: string;
  kind: "directory" | "file" | "symlink" | "other";
  hidden: boolean;
};
export type EditorFile = {
  path: string;
  content: string;
  revision: string;
  size: number;
  readOnly: boolean;
  encoding: TextEncoding;
  lineEnding: "LF" | "CRLF";
};

function host<T>(command: string, args: Record<string, unknown>): Promise<T> {
  if (!("__TAURI_INTERNALS__" in window)) return Promise.reject(new Error("DESKTOP_ONLY"));
  return invoke<T>(command, args);
}

export const editorAPI = {
  openDirectory(path: string) {
    return host<EditorRoot>("editor_open_directory", { path });
  },
  listDirectory(path: string) {
    return host<EditorEntry[]>("editor_list_directory", { path });
  },
  readFile(path: string) {
    return host<EditorFile>("editor_read_file", { path });
  },
  saveFile(file: EditorFile, content: string, force = false) {
    return host<EditorFile>("editor_save_file", {
      path: file.path,
      content,
      expectedRevision: file.revision,
      force,
      encoding: file.encoding,
      lineEnding: file.lineEnding,
    });
  },
  renameFile(file: EditorFile, newName: string) {
    return host<EditorFile>("editor_rename_file", {
      path: file.path,
      newName,
      expectedRevision: file.revision,
    });
  },
};
