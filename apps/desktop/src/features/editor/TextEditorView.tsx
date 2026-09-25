import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { basicSetup } from "codemirror";
import { redo, undo, indentLess, indentMore } from "@codemirror/commands";
import { Compartment, EditorState, Prec } from "@codemirror/state";
import { indentUnit, syntaxHighlighting } from "@codemirror/language";
import {
  findNext,
  findPrevious,
  replaceAll,
  replaceNext,
  SearchQuery,
  search,
  setSearchQuery,
} from "@codemirror/search";
import { EditorView, keymap } from "@codemirror/view";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Menu,
  MoreHorizontal,
  ListOrdered,
  Save,
  Search as SearchIcon,
  Undo2,
  Redo2,
  Replace,
  ReplaceAll as ReplaceAllIcon,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button, ShortcutKbd } from "@devbox/ui";
import { useAppStore } from "../../stores/app-store";
import {
  editorAPI,
  type EditorEntry,
  type EditorFile,
  type EditorRoot,
  type TextEncoding,
} from "./editor-api";
import { registerEditorCloseGuard } from "./close-guard";
import { readEditorSession, writeEditorSession } from "./editor-session";
import { fileIconFor, fileIconToneFor } from "./file-icons";
import { codeHighlight } from "./highlight";
import { languageFor } from "./languages";
import "./TextEditorView.css";

type OpenDocument = EditorFile & {
  name: string;
  savedContent: string;
  savedEncoding: TextEncoding;
};
type Decision = "save" | "discard" | "cancel" | "reload" | "overwrite";
type PendingDialog = {
  type: "dirty" | "conflict";
  name: string;
  resolve: (decision: Decision) => void;
};

const encodings: TextEncoding[] = ["UTF-8", "UTF-8 BOM", "GBK", "UTF-16 LE", "UTF-16 BE"];

function isDirty(file: OpenDocument) {
  return file.content !== file.savedContent || file.encoding !== file.savedEncoding;
}

function displayError(t: (key: string) => string, error: unknown) {
  const code =
    error instanceof Error ? error.message : typeof error === "string" ? error : String(error);
  const key = `editor.errors.${code}`;
  const translated = t(key);
  return translated === key ? t("editor.errors.READ_FAILED") : translated;
}

function normalizeFile(file: EditorFile): OpenDocument {
  const content = file.content.replace(/\r\n/g, "\n");
  const parts = file.path.split("/");
  return {
    ...file,
    name: parts[parts.length - 1] ?? file.path,
    content,
    savedContent: content,
    savedEncoding: file.encoding,
  };
}

export function TextEditorView() {
  const { t } = useTranslation();
  const theme = useAppStore((state) => state.theme);
  const setEditorDialogOpen = useAppStore((state) => state.setEditorDialogOpen);
  const [savedSession] = useState(readEditorSession);
  const [sessionReady, setSessionReady] = useState(!savedSession);
  const [root, setRoot] = useState<EditorRoot>();
  const [tree, setTree] = useState<Record<string, EditorEntry[]>>({});
  const [treeErrors, setTreeErrors] = useState<Record<string, string>>({});
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const [treeMenuOpen, setTreeMenuOpen] = useState(false);
  const [treeOpen, setTreeOpen] = useState(true);
  const [treeWidth, setTreeWidth] = useState(260);
  const [files, setFiles] = useState<OpenDocument[]>([]);
  const filesRef = useRef<OpenDocument[]>([]);
  const [activePath, setActivePath] = useState<string>();
  const [draggedPath, setDraggedPath] = useState<string>();
  const [busy, setBusy] = useState(Boolean(savedSession));
  const [error, setError] = useState("");
  const [wrap, setWrap] = useState(true);
  const wrapRef = useRef(wrap);
  wrapRef.current = wrap;
  const [findMode, setFindMode] = useState<"find" | "replace">();
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [regexp, setRegexp] = useState(false);
  const [matches, setMatches] = useState({ current: 0, total: 0 });
  const [position, setPosition] = useState({ line: 1, column: 1 });
  const [goToLineOpen, setGoToLineOpen] = useState(false);
  const [lineInput, setLineInput] = useState("");
  const [encodingMenuOpen, setEncodingMenuOpen] = useState(false);
  const [fileMenu, setFileMenu] = useState<{ path: string; x: number; y: number }>();
  const [renamePath, setRenamePath] = useState<string>();
  const [renameName, setRenameName] = useState("");
  const [renameError, setRenameError] = useState("");
  const [dialog, setDialog] = useState<PendingDialog>();
  const editorHost = useRef<HTMLDivElement>(null);
  const editorPage = useRef<HTMLElement>(null);
  const wasNarrow = useRef(false);
  const viewRef = useRef<EditorView | undefined>(undefined);
  const editorStates = useRef(new Map<string, EditorState>());
  const resetEditorStatePaths = useRef(new Set<string>());
  const languageCompartment = useRef(new Compartment());
  const wrapCompartment = useRef(new Compartment());
  const findInput = useRef<HTMLInputElement>(null);
  const fileMenuRef = useRef<HTMLDivElement>(null);
  const encodingMenuRef = useRef<HTMLDivElement>(null);
  const queryRef = useRef({ query, replacement, caseSensitive, wholeWord, regexp });
  queryRef.current = { query, replacement, caseSensitive, wholeWord, regexp };
  const translateRef = useRef(t);
  translateRef.current = t;

  const active = files.find((file) => file.path === activePath);
  const activeRef = useRef(activePath);
  activeRef.current = activePath;

  const modifyFiles = useCallback((change: (current: OpenDocument[]) => OpenDocument[]) => {
    const next = change(filesRef.current);
    filesRef.current = next;
    setFiles(next);
  }, []);

  useEffect(() => {
    if (!savedSession || !("__TAURI_INTERNALS__" in window)) {
      setBusy(false);
      setSessionReady(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const opened = await editorAPI.openDirectory(savedSession.rootPath);
        const entries = await editorAPI.listDirectory("");
        const restored: OpenDocument[] = [];
        let missing = false;
        // 分批读取，避免大量文件标签同时占用过多内存。
        for (let index = 0; index < savedSession.tabs.length; index += 8) {
          const batch = await Promise.all(
            savedSession.tabs.slice(index, index + 8).map(async (path) => {
              try {
                return normalizeFile(await editorAPI.readFile(path));
              } catch {
                return null;
              }
            }),
          );
          for (const file of batch) {
            if (file) restored.push(file);
            else missing = true;
          }
          if (cancelled) return;
        }
        if (cancelled) return;
        setRoot(opened);
        setTree({ "": entries });
        setExpanded(new Set([""]));
        modifyFiles(() => restored);
        setActivePath(
          restored.find((file) => file.path === savedSession.activePath)?.path ??
            restored[restored.length - 1]?.path,
        );
        if (missing) setError(translateRef.current("editor.errors.RESTORE_PARTIAL"));
      } catch {
        if (!cancelled) {
          writeEditorSession(null);
          setError(translateRef.current("editor.errors.RESTORE_FAILED"));
        }
      } finally {
        if (!cancelled) {
          setBusy(false);
          setSessionReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modifyFiles, savedSession]);

  useEffect(() => {
    if (!sessionReady || !("__TAURI_INTERNALS__" in window)) return;
    writeEditorSession(
      root ? { rootPath: root.path, tabs: files.map((file) => file.path), activePath } : null,
    );
  }, [activePath, files, root, sessionReady]);

  const ask = useCallback(
    (type: PendingDialog["type"], name: string) =>
      new Promise<Decision>((resolve) => setDialog({ type, name, resolve })),
    [],
  );

  const finishDialog = (decision: Decision) => {
    dialog?.resolve(decision);
    setDialog(undefined);
  };

  useEffect(() => {
    setEditorDialogOpen(Boolean(dialog || renamePath || goToLineOpen));
  }, [dialog, renamePath, goToLineOpen, setEditorDialogOpen]);
  useEffect(() => () => setEditorDialogOpen(false), [setEditorDialogOpen]);

  const saveFile = useCallback(
    async (path: string, force = false): Promise<boolean> => {
      const file = filesRef.current.find((item) => item.path === path);
      if (!file || file.readOnly) return false;
      const content =
        viewRef.current && activeRef.current === path
          ? viewRef.current.state.doc.toString()
          : file.content;
      try {
        const saved = await editorAPI.saveFile(file, content, force);
        modifyFiles((current) =>
          current.map((item) =>
            item.path === path
              ? {
                  ...item,
                  revision: saved.revision,
                  size: saved.size,
                  savedContent: content,
                  savedEncoding: file.encoding,
                }
              : item,
          ),
        );
        setError("");
        return true;
      } catch (nextError) {
        if (nextError === "EXTERNAL_MODIFIED") {
          const decision = await ask("conflict", file.name);
          if (decision === "overwrite") return saveFile(path, true);
          if (decision === "reload") {
            try {
              const reloaded = normalizeFile(await editorAPI.readFile(path));
              resetEditorStatePaths.current.add(path);
              editorStates.current.delete(path);
              modifyFiles((current) =>
                current.map((item) => (item.path === path ? reloaded : item)),
              );
              if (activeRef.current === path) setActivePath(undefined);
              window.requestAnimationFrame(() => {
                if (filesRef.current.some((item) => item.path === path)) setActivePath(path);
              });
              return true;
            } catch (readError) {
              setError(displayError(t, readError));
            }
          }
          return false;
        }
        setError(displayError(t, nextError));
        return false;
      }
    },
    [ask, modifyFiles, t],
  );

  const guardChanges = useCallback(
    async (paths: string[]) => {
      for (const path of paths) {
        const file = filesRef.current.find((item) => item.path === path);
        if (!file || !isDirty(file)) continue;
        const decision = await ask("dirty", file.name);
        if (decision === "cancel") return false;
        if (decision === "save" && !(await saveFile(path))) return false;
      }
      return true;
    },
    [ask, saveFile],
  );

  useEffect(() => {
    registerEditorCloseGuard(() => guardChanges(filesRef.current.map((file) => file.path)));
    return () => registerEditorCloseGuard(undefined);
  }, [guardChanges]);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    let disposed = false;
    let stop: (() => void) | undefined;
    void getCurrentWindow()
      .onCloseRequested((event) => {
        if (!filesRef.current.some(isDirty)) return;
        event.preventDefault();
        void guardChanges(filesRef.current.map((file) => file.path)).then((allowed) => {
          if (allowed && !disposed) void getCurrentWindow().destroy();
        });
      })
      .then((unlisten) => {
        if (disposed) unlisten();
        else stop = unlisten;
      });
    return () => {
      disposed = true;
      stop?.();
    };
  }, [guardChanges]);

  async function loadDirectory(path: string) {
    try {
      const entries = await editorAPI.listDirectory(path);
      setTree((current) => ({ ...current, [path]: entries }));
      setTreeErrors((current) => {
        const next = { ...current };
        delete next[path];
        return next;
      });
    } catch (nextError) {
      setTreeErrors((current) => ({ ...current, [path]: displayError(t, nextError) }));
    }
  }

  async function chooseDirectory() {
    if (busy) return;
    if (!("__TAURI_INTERNALS__" in window)) {
      setError(t("editor.errors.DESKTOP_ONLY"));
      return;
    }
    let selected: string | null;
    try {
      selected = await open({ directory: true, multiple: false });
    } catch (nextError) {
      setError(displayError(t, nextError));
      return;
    }
    if (typeof selected !== "string") return;
    if (!(await guardChanges(filesRef.current.map((file) => file.path)))) return;
    setSessionReady(false);
    setBusy(true);
    setError("");
    try {
      const opened = await editorAPI.openDirectory(selected);
      setRoot(opened);
      setTree({});
      setTreeErrors({});
      setFileErrors({});
      setExpanded(new Set([""]));
      setActivePath(undefined);
      editorStates.current.clear();
      modifyFiles(() => []);
      setTreeOpen(true);
      await loadDirectory("");
    } catch (nextError) {
      setError(displayError(t, nextError));
    } finally {
      setBusy(false);
      setSessionReady(true);
    }
  }

  async function toggleDirectory(path: string) {
    if (expanded.has(path)) {
      setExpanded((current) => {
        const next = new Set(current);
        next.delete(path);
        return next;
      });
      return;
    }
    setExpanded((current) => new Set(current).add(path));
    if (!tree[path]) await loadDirectory(path);
  }

  async function openFile(entry: EditorEntry) {
    if (entry.kind !== "file") return;
    if (filesRef.current.some((file) => file.path === entry.path)) {
      setActivePath(entry.path);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const file = normalizeFile(await editorAPI.readFile(entry.path));
      modifyFiles((current) => [...current, file]);
      setActivePath(entry.path);
      setFileErrors((current) => {
        const next = { ...current };
        delete next[entry.path];
        return next;
      });
    } catch (nextError) {
      setFileErrors((current) => ({ ...current, [entry.path]: displayError(t, nextError) }));
    } finally {
      setBusy(false);
    }
  }

  async function closeFiles(paths: string[]) {
    if (!(await guardChanges(paths))) return;
    const removed = new Set(paths);
    const index = filesRef.current.findIndex((file) => file.path === activeRef.current);
    const next = filesRef.current.filter((file) => !removed.has(file.path));
    for (const path of paths) editorStates.current.delete(path);
    modifyFiles(() => next);
    if (activeRef.current && removed.has(activeRef.current))
      setActivePath(next[Math.min(index, next.length - 1)]?.path);
  }

  function showFileMenu(path: string, x: number, y: number) {
    setFileMenu({
      path,
      x: Math.max(8, Math.min(x, window.innerWidth - 185)),
      y: Math.max(8, Math.min(y, window.innerHeight - 220)),
    });
  }

  function startRename(path: string) {
    const file = filesRef.current.find((item) => item.path === path);
    if (!file) return;
    setFileMenu(undefined);
    setRenameName(file.name);
    setRenameError("");
    setRenamePath(path);
  }

  async function confirmRename() {
    const path = renamePath;
    if (!path) return;
    const newName = renameName;
    if (
      !newName.trim() ||
      newName === "." ||
      newName === ".." ||
      /[\\/<>:"|?*]/.test(newName) ||
      [...newName].some((character) => character.charCodeAt(0) < 32) ||
      newName.endsWith(" ") ||
      newName.endsWith(".")
    ) {
      setRenameError(t("editor.errors.INVALID_NAME"));
      return;
    }
    setRenamePath(undefined);
    if (!(await guardChanges([path]))) return;
    const file = filesRef.current.find((item) => item.path === path);
    if (!file) return;
    try {
      const renamed = {
        ...normalizeFile(await editorAPI.renameFile(file, newName)),
        encoding: file.savedEncoding,
        savedEncoding: file.savedEncoding,
      };
      resetEditorStatePaths.current.add(path);
      editorStates.current.delete(path);
      modifyFiles((current) => current.map((item) => (item.path === path ? renamed : item)));
      if (activeRef.current === path) setActivePath(renamed.path);
      setRenamePath(undefined);
      setRenameError("");
      const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
      setTree((current) => ({
        ...current,
        [parent]:
          current[parent]?.map((item) =>
            item.path === path ? { ...item, name: newName, path: renamed.path } : item,
          ) ?? [],
      }));
      void loadDirectory(parent);
    } catch (nextError) {
      setRenamePath(path);
      setRenameError(displayError(t, nextError));
    }
  }

  const findQuery = useMemo(
    () =>
      new SearchQuery({
        search: query,
        replace: replacement,
        caseSensitive,
        wholeWord,
        regexp,
      }),
    [query, replacement, caseSensitive, wholeWord, regexp],
  );

  const refreshMatches = useCallback((state: EditorState) => {
    const values = queryRef.current;
    const currentQuery = new SearchQuery({
      search: values.query,
      replace: values.replacement,
      caseSensitive: values.caseSensitive,
      wholeWord: values.wholeWord,
      regexp: values.regexp,
    });
    if (!currentQuery.valid) {
      setMatches({ current: 0, total: 0 });
      return;
    }
    let total = 0;
    let current = 0;
    const selection = state.selection.main;
    const cursor = currentQuery.getCursor(state);
    for (let next = cursor.next(); !next.done; next = cursor.next()) {
      const match = next.value;
      total++;
      if (match.from === selection.from && match.to === selection.to) current = total;
      if (total >= 100_000) break;
    }
    setMatches({ current, total });
  }, []);

  useEffect(() => {
    const file = filesRef.current.find((item) => item.path === activePath);
    if (!file || !editorHost.current) return;
    let alive = true;
    const description = languageFor(file.name);
    const cached = editorStates.current.get(file.path);
    const statePaths = editorStates.current;
    const resetPaths = resetEditorStatePaths.current;
    const state =
      cached ??
      EditorState.create({
        doc: file.content,
        extensions: [
          basicSetup,
          indentUnit.of("  "),
          search({ top: true }),
          syntaxHighlighting(codeHighlight),
          EditorState.readOnly.of(file.readOnly),
          languageCompartment.current.of([]),
          wrapCompartment.current.of(wrapRef.current ? EditorView.lineWrapping : []),
          Prec.highest(
            keymap.of([
              {
                key: "Mod-f",
                run: () => {
                  setFindMode("find");
                  return true;
                },
              },
              {
                key: "Mod-r",
                run: () => {
                  setFindMode("replace");
                  return true;
                },
              },
              {
                key: "Mod-g",
                run: () => {
                  setLineInput("");
                  setGoToLineOpen(true);
                  return true;
                },
              },
              {
                key: "Mod-s",
                run: () => {
                  void saveFile(file.path);
                  return true;
                },
              },
              { key: "Tab", run: indentMore },
              { key: "Shift-Tab", run: indentLess },
            ]),
          ),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              const content = update.state.doc.toString();
              modifyFiles((current) =>
                current.map((item) => (item.path === file.path ? { ...item, content } : item)),
              );
            }
            if (update.docChanged || update.selectionSet) {
              const head = update.state.selection.main.head;
              const line = update.state.doc.lineAt(head);
              setPosition({ line: line.number, column: head - line.from + 1 });
              refreshMatches(update.state);
            }
          }),
        ],
      });
    const view = new EditorView({ state, parent: editorHost.current });
    viewRef.current = view;
    if (description)
      void description
        .load()
        .then((support) => {
          if (alive) view.dispatch({ effects: languageCompartment.current.reconfigure(support) });
        })
        .catch(() => {});
    refreshMatches(view.state);
    return () => {
      alive = false;
      if (
        resetPaths.delete(file.path) ||
        !filesRef.current.some((item) => item.path === file.path)
      ) {
        statePaths.delete(file.path);
      } else {
        statePaths.set(file.path, view.state);
      }
      if (viewRef.current === view) viewRef.current = undefined;
      view.destroy();
    };
  }, [activePath, modifyFiles, refreshMatches, saveFile]);

  useEffect(() => {
    const view = viewRef.current;
    if (view)
      view.dispatch({
        effects: wrapCompartment.current.reconfigure(wrap ? EditorView.lineWrapping : []),
      });
  }, [wrap]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: setSearchQuery.of(findQuery) });
    refreshMatches(view.state);
  }, [findQuery, activePath, refreshMatches]);

  useEffect(() => {
    if (findMode) findInput.current?.focus();
  }, [findMode]);

  useEffect(() => {
    if (!fileMenu) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!fileMenuRef.current?.contains(event.target as Node)) setFileMenu(undefined);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFileMenu(undefined);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [fileMenu]);

  useEffect(() => {
    setEncodingMenuOpen(false);
  }, [activePath]);

  useEffect(() => {
    if (!encodingMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!encodingMenuRef.current?.contains(event.target as Node)) setEncodingMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setEncodingMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [encodingMenuOpen]);

  useEffect(() => {
    if (!editorPage.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const narrow = (entry?.contentRect.width ?? 0) < 900;
      if (narrow && !wasNarrow.current) setTreeOpen(false);
      wasNarrow.current = narrow;
    });
    observer.observe(editorPage.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!activeRef.current) return;
      if (event.key === "Escape" && findMode) {
        event.preventDefault();
        setFindMode(undefined);
        viewRef.current?.focus();
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setFindMode("find");
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "r") {
        event.preventDefault();
        setFindMode("replace");
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "g") {
        event.preventDefault();
        setLineInput("");
        setGoToLineOpen(true);
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveFile(activeRef.current);
      }
    };
    const panel = editorHost.current?.closest<HTMLElement>(".workspace-panel");
    panel?.addEventListener("keydown", handler, true);
    return () => panel?.removeEventListener("keydown", handler, true);
  }, [findMode, saveFile]);

  const language = active ? (languageFor(active.name)?.name ?? "Plain Text") : "Plain Text";

  function renderEntries(path: string, depth: number): React.ReactNode {
    const entries = tree[path]?.filter((entry) => showHidden || !entry.hidden) ?? [];
    return entries.map((entry) => {
      const folder = entry.kind === "directory";
      const isExpanded = expanded.has(entry.path);
      const Icon =
        entry.kind === "directory"
          ? isExpanded
            ? FolderOpen
            : Folder
          : fileIconFor(entry.name, entry.kind);
      return (
        <div key={entry.path}>
          <button
            aria-expanded={folder ? isExpanded : undefined}
            className={`editor-tree-row${entry.path === activePath ? " active" : ""}`}
            onClick={() => (folder ? void toggleDirectory(entry.path) : void openFile(entry))}
            style={{ paddingLeft: 10 + depth * 17 }}
            title={entry.path}
            type="button"
          >
            {folder ? (
              isExpanded ? (
                <ChevronDown size={13} />
              ) : (
                <ChevronRight size={13} />
              )
            ) : (
              <span className="editor-tree-spacer" />
            )}
            <Icon
              aria-hidden="true"
              className={`editor-tree-icon editor-tree-icon--${entry.kind === "directory" ? "folder" : fileIconToneFor(entry.name, entry.kind)}`}
              size={15}
            />
            <span>{entry.name}</span>
          </button>
          {entry.kind === "symlink" ? (
            <small className="editor-tree-note">{t("editor.symlink")}</small>
          ) : null}
          {fileErrors[entry.path] ? (
            <div className="editor-tree-error">
              {fileErrors[entry.path]}{" "}
              <button onClick={() => void openFile(entry)} type="button">
                {t("editor.retry")}
              </button>
            </div>
          ) : null}
          {folder && isExpanded ? (
            <>
              {treeErrors[entry.path] ? (
                <div className="editor-tree-error">
                  {treeErrors[entry.path]}{" "}
                  <button onClick={() => void loadDirectory(entry.path)} type="button">
                    {t("editor.retry")}
                  </button>
                </div>
              ) : null}
              {renderEntries(entry.path, depth + 1)}
            </>
          ) : null}
        </div>
      );
    });
  }

  function goToLine() {
    const view = viewRef.current;
    const match = /^([1-9]\d*)(?::([1-9]\d*))?$/.exec(lineInput.trim());
    const lineNumber = Number(match?.[1]);
    const column = Number(match?.[2] ?? 1);
    if (!view || !match) return;
    const line = view.state.doc.line(Math.min(lineNumber, view.state.doc.lines));
    const offset = line.from + Math.min(column - 1, line.length);
    view.dispatch({ selection: { anchor: offset }, scrollIntoView: true });
    view.focus();
    setGoToLineOpen(false);
  }

  return (
    <section
      className="devbox-page devbox-page--fluid editor-page"
      data-theme={theme}
      ref={editorPage}
    >
      <header className="editor-page-header">
        <div>
          <h1>{t("editor.title")}</h1>
          {root ? <span title={root.path}>{root.name}</span> : null}
        </div>
      </header>
      {root ? (
        <>
          <div className="editor-toolbar">
            <Button
              aria-label={t("editor.files")}
              className="editor-tree-toggle"
              icon={<Menu size={15} />}
              onClick={() => setTreeOpen((value) => !value)}
            >
              {t("editor.files")}
            </Button>
            <div className="editor-toolbar-actions">
              <Button
                disabled={!active || active.readOnly || !isDirty(active) || busy}
                icon={<Save size={15} />}
                onClick={() => active && void saveFile(active.path)}
                variant="primary"
              >
                {t("editor.save")}
              </Button>
              <Button
                disabled={busy}
                icon={<FolderOpen size={15} />}
                onClick={() => void chooseDirectory()}
              >
                {t("editor.openDirectory")}
              </Button>
              <Button
                disabled={!active || active.readOnly}
                icon={<Undo2 size={15} />}
                onClick={() => viewRef.current && undo(viewRef.current)}
              >
                {t("editor.undo")}
              </Button>
              <Button
                disabled={!active || active.readOnly}
                icon={<Redo2 size={15} />}
                onClick={() => viewRef.current && redo(viewRef.current)}
              >
                {t("editor.redo")}
              </Button>
              <Button
                aria-label={t("editor.find")}
                disabled={!active}
                icon={<SearchIcon size={15} />}
                onClick={() => setFindMode("find")}
              >
                {t("editor.find")} <ShortcutKbd keyName="F" />
              </Button>
              <Button
                aria-label={t("editor.replace")}
                disabled={!active}
                icon={<Replace size={15} />}
                onClick={() => setFindMode("replace")}
              >
                {t("editor.replace")} <ShortcutKbd keyName="R" />
              </Button>
              <Button
                disabled={!active}
                icon={<ListOrdered size={15} />}
                onClick={() => {
                  setLineInput("");
                  setGoToLineOpen(true);
                }}
              >
                {t("editor.goToLine")} <ShortcutKbd keyName="G" />
              </Button>
            </div>
            <div className="editor-option-group">
              <label className="editor-wrap-toggle">
                <input
                  checked={wrap}
                  onChange={(event) => setWrap(event.target.checked)}
                  type="checkbox"
                />
                {t("editor.wrap")}
              </label>
            </div>
          </div>
          {error ? (
            <div className="editor-alert" role="alert">
              {error}
            </div>
          ) : null}
          <div
            className={`editor-main${treeOpen ? "" : " tree-hidden"}`}
            style={{ "--editor-tree-width": `${treeWidth}px` } as React.CSSProperties}
          >
            {treeOpen ? (
              <>
                <aside aria-label={t("editor.files")} className="editor-explorer">
                  <div className="editor-explorer-heading">
                    <strong>{t("editor.files")}</strong>
                    <div className="editor-tree-options">
                      <button
                        aria-expanded={treeMenuOpen}
                        aria-label={t("editor.files")}
                        onClick={() => setTreeMenuOpen((value) => !value)}
                        type="button"
                      >
                        <MoreHorizontal size={17} />
                      </button>
                      {treeMenuOpen ? (
                        <div className="editor-tree-options-menu">
                          <label>
                            <input
                              checked={showHidden}
                              onChange={(event) => setShowHidden(event.target.checked)}
                              type="checkbox"
                            />
                            {t("editor.showHidden")}
                          </label>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="editor-tree-scroll" role="tree">
                    <button
                      aria-expanded={expanded.has("")}
                      className="editor-tree-row editor-tree-root"
                      onClick={() => void toggleDirectory("")}
                      title={root.path}
                      type="button"
                    >
                      {expanded.has("") ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      <FolderOpen
                        aria-hidden="true"
                        className="editor-tree-icon editor-tree-icon--folder"
                        size={15}
                      />
                      <span>{root.name}</span>
                    </button>
                    {expanded.has("") ? (
                      <>
                        {treeErrors[""] ? (
                          <div className="editor-tree-error">
                            {treeErrors[""]}{" "}
                            <button onClick={() => void loadDirectory("")} type="button">
                              {t("editor.retry")}
                            </button>
                          </div>
                        ) : null}
                        {renderEntries("", 1)}
                      </>
                    ) : null}
                  </div>
                </aside>
                <div
                  aria-hidden="true"
                  className="editor-splitter"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    const start = event.clientX;
                    const initial = treeWidth;
                    const move = (next: PointerEvent) =>
                      setTreeWidth(Math.max(220, Math.min(400, initial + next.clientX - start)));
                    const stop = () => {
                      window.removeEventListener("pointermove", move);
                      window.removeEventListener("pointerup", stop);
                    };
                    window.addEventListener("pointermove", move);
                    window.addEventListener("pointerup", stop);
                  }}
                />
              </>
            ) : null}
            <div className="editor-workarea">
              <div aria-label={t("editor.files")} className="editor-file-tabs" role="tablist">
                {files.map((file) => (
                  <div
                    className={`editor-file-tab${activePath === file.path ? " active" : ""}`}
                    draggable
                    key={file.path}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      showFileMenu(file.path, event.clientX, event.clientY);
                    }}
                    onDragStart={() => setDraggedPath(file.path)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (!draggedPath || draggedPath === file.path) return;
                      modifyFiles((current) => {
                        const next = [...current];
                        const from = next.findIndex((item) => item.path === draggedPath);
                        const to = next.findIndex((item) => item.path === file.path);
                        if (from >= 0 && to >= 0) next.splice(to, 0, next.splice(from, 1)[0]!);
                        return next;
                      });
                      setDraggedPath(undefined);
                    }}
                  >
                    <button
                      aria-selected={activePath === file.path}
                      onClick={() => setActivePath(file.path)}
                      onKeyDown={(event) => {
                        if (
                          event.key === "ContextMenu" ||
                          (event.shiftKey && event.key === "F10")
                        ) {
                          event.preventDefault();
                          const rect = event.currentTarget.getBoundingClientRect();
                          showFileMenu(file.path, rect.left, rect.bottom);
                        }
                      }}
                      role="tab"
                      title={file.path}
                      type="button"
                    >
                      <FileText aria-hidden="true" size={14} />
                      <span>{file.name}</span>
                      {isDirty(file) ? (
                        <span aria-label={t("editor.modified")} className="editor-dirty-dot">
                          ●
                        </span>
                      ) : null}
                    </button>
                    <button
                      aria-label={`${t("actions.close")} ${file.name}`}
                      className="editor-tab-close"
                      onClick={() => void closeFiles([file.path])}
                      type="button"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              {findMode && active ? (
                <div className="editor-findbar">
                  <SearchIcon aria-hidden="true" size={15} />
                  <input
                    aria-label={t("editor.find")}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        if (viewRef.current)
                          (event.shiftKey ? findPrevious : findNext)(viewRef.current);
                      }
                      if (event.key === "Escape") {
                        setFindMode(undefined);
                        viewRef.current?.focus();
                      }
                    }}
                    ref={findInput}
                    value={query}
                  />
                  <span className="editor-match-count">
                    {matches.current} / {matches.total}
                  </span>
                  <button
                    aria-label={t("editor.previous")}
                    onClick={() => viewRef.current && findPrevious(viewRef.current)}
                    type="button"
                  >
                    ↑
                  </button>
                  <button
                    aria-label={t("editor.next")}
                    onClick={() => viewRef.current && findNext(viewRef.current)}
                    type="button"
                  >
                    ↓
                  </button>
                  <label title={t("editor.caseSensitive")}>
                    <input
                      checked={caseSensitive}
                      onChange={(event) => setCaseSensitive(event.target.checked)}
                      type="checkbox"
                    />
                    Aa
                  </label>
                  <label title={t("editor.wholeWord")}>
                    <input
                      checked={wholeWord}
                      onChange={(event) => setWholeWord(event.target.checked)}
                      type="checkbox"
                    />
                    W
                  </label>
                  <label title={t("editor.regex")}>
                    <input
                      checked={regexp}
                      onChange={(event) => setRegexp(event.target.checked)}
                      type="checkbox"
                    />
                    .*
                  </label>
                  <button
                    aria-label={t("actions.close")}
                    onClick={() => {
                      setFindMode(undefined);
                      viewRef.current?.focus();
                    }}
                    type="button"
                  >
                    <X size={15} />
                  </button>
                  {findMode === "replace" ? (
                    <div className="editor-replace-row">
                      <input
                        aria-label={t("editor.replace")}
                        onChange={(event) => setReplacement(event.target.value)}
                        value={replacement}
                      />
                      <Button
                        disabled={!findQuery.valid || !matches.total || active.readOnly}
                        icon={<Replace size={14} />}
                        onClick={() => viewRef.current && replaceNext(viewRef.current)}
                      >
                        {t("editor.replaceOne")}
                      </Button>
                      <Button
                        disabled={!findQuery.valid || !matches.total || active.readOnly}
                        icon={<ReplaceAllIcon size={14} />}
                        onClick={() => viewRef.current && replaceAll(viewRef.current)}
                      >
                        {t("editor.replaceAll")}
                      </Button>
                    </div>
                  ) : null}
                  {!findQuery.valid && query ? (
                    <small className="editor-find-error">{t("editor.invalidRegex")}</small>
                  ) : null}
                </div>
              ) : null}
              <div className="editor-code-region">
                <div className="editor-code-host" hidden={!active} ref={editorHost} />
                {!active ? (
                  <div className="editor-blank">
                    <FileText size={30} />
                    <span>{t("editor.selectFile")}</span>
                  </div>
                ) : null}
              </div>
              <footer className="editor-status">
                {active ? (
                  <>
                    <span>
                      {t("editor.line")} {position.line}, {t("editor.column")} {position.column}
                    </span>
                    <span>{t("editor.indent", { count: 2 })}</span>
                    <div className="editor-encoding" ref={encodingMenuRef}>
                      <button
                        aria-expanded={encodingMenuOpen}
                        aria-haspopup="menu"
                        disabled={active.readOnly}
                        onClick={() => setEncodingMenuOpen((value) => !value)}
                        type="button"
                      >
                        {active.encoding} <ChevronDown aria-hidden="true" size={12} />
                      </button>
                      {encodingMenuOpen ? (
                        <div
                          aria-label={t("editor.encoding")}
                          className="editor-encoding-menu"
                          role="menu"
                        >
                          <small>{t("editor.saveEncoding")}</small>
                          {encodings.map((encoding) => (
                            <button
                              aria-checked={active.encoding === encoding}
                              key={encoding}
                              onClick={() => {
                                modifyFiles((current) =>
                                  current.map((file) =>
                                    file.path === active.path ? { ...file, encoding } : file,
                                  ),
                                );
                                setEncodingMenuOpen(false);
                              }}
                              role="menuitemradio"
                              type="button"
                            >
                              {encoding}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <span>{active.lineEnding}</span>
                    <span>{language}</span>
                    {active.readOnly ? <span>{t("editor.readOnly")}</span> : null}
                    {isDirty(active) ? <span>{t("editor.modified")}</span> : null}
                  </>
                ) : null}
              </footer>
            </div>
          </div>
        </>
      ) : (
        <div className="editor-initial">
          <FolderOpen size={38} />
          <p>{busy ? t("editor.loading") : t("editor.empty")}</p>
          <Button
            disabled={busy}
            icon={<FolderOpen size={15} />}
            onClick={() => void chooseDirectory()}
            variant="primary"
          >
            {t("editor.openDirectory")}
          </Button>
          {error ? <span role="alert">{error}</span> : null}
        </div>
      )}
      {fileMenu
        ? createPortal(
            <div
              aria-label={t("editor.tabActions")}
              className="editor-file-menu"
              ref={fileMenuRef}
              role="menu"
              style={{ left: fileMenu.x, top: fileMenu.y }}
            >
              {[
                { key: "closeCurrent", paths: [fileMenu.path] },
                { key: "closeAll", paths: files.map((file) => file.path) },
                {
                  key: "closeRight",
                  paths: files
                    .slice(files.findIndex((file) => file.path === fileMenu.path) + 1)
                    .map((file) => file.path),
                },
                {
                  key: "closeOthers",
                  paths: files
                    .filter((file) => file.path !== fileMenu.path)
                    .map((file) => file.path),
                },
              ].map((action) => (
                <button
                  disabled={!action.paths.length}
                  key={action.key}
                  onClick={() => {
                    setFileMenu(undefined);
                    void closeFiles(action.paths);
                  }}
                  role="menuitem"
                  type="button"
                >
                  {t(`editor.${action.key}`)}
                </button>
              ))}
              <div className="editor-file-menu-separator" />
              <button onClick={() => startRename(fileMenu.path)} role="menuitem" type="button">
                {t("editor.rename")}
              </button>
            </div>,
            document.body,
          )
        : null}
      {goToLineOpen
        ? createPortal(
            <div className="editor-dialog-backdrop">
              <form
                aria-label={t("editor.goToLine")}
                aria-modal="true"
                className="editor-dialog editor-position-dialog"
                onKeyDown={(event) => {
                  if (event.key === "Escape") setGoToLineOpen(false);
                }}
                onSubmit={(event) => {
                  event.preventDefault();
                  goToLine();
                }}
                role="dialog"
              >
                <h2>{t("editor.goToLine")}</h2>
                <input
                  aria-label={t("editor.position")}
                  autoFocus
                  onChange={(event) => setLineInput(event.target.value)}
                  placeholder={t("editor.positionPlaceholder")}
                  value={lineInput}
                />
                <div>
                  <Button onClick={() => setGoToLineOpen(false)}>{t("editor.cancel")}</Button>
                  <Button
                    disabled={!/^([1-9]\d*)(?::([1-9]\d*))?$/.test(lineInput.trim())}
                    type="submit"
                    variant="primary"
                  >
                    {t("editor.confirm")}
                  </Button>
                </div>
              </form>
            </div>,
            document.body,
          )
        : null}
      {renamePath
        ? createPortal(
            <div className="editor-dialog-backdrop">
              <form
                aria-label={t("editor.rename")}
                aria-modal="true"
                className="editor-dialog editor-position-dialog"
                onKeyDown={(event) => {
                  if (event.key === "Escape") setRenamePath(undefined);
                }}
                onSubmit={(event) => {
                  event.preventDefault();
                  void confirmRename();
                }}
                role="dialog"
              >
                <h2>{t("editor.rename")}</h2>
                <input
                  aria-label={t("editor.fileName")}
                  autoFocus
                  onChange={(event) => {
                    setRenameName(event.target.value);
                    setRenameError("");
                  }}
                  value={renameName}
                />
                {renameError ? <small role="alert">{renameError}</small> : null}
                <div>
                  <Button onClick={() => setRenamePath(undefined)}>{t("editor.cancel")}</Button>
                  <Button type="submit" variant="primary">
                    {t("editor.rename")}
                  </Button>
                </div>
              </form>
            </div>,
            document.body,
          )
        : null}
      {dialog
        ? createPortal(
            <div className="editor-dialog-backdrop">
              <section
                aria-label={
                  dialog.type === "dirty"
                    ? t("editor.dirtyTitle", { name: dialog.name })
                    : t("editor.conflictTitle")
                }
                aria-modal="true"
                className="editor-dialog"
                onKeyDown={(event) => {
                  if (event.key === "Escape") finishDialog("cancel");
                }}
                role="dialog"
              >
                <h2>
                  {dialog.type === "dirty"
                    ? t("editor.dirtyTitle", { name: dialog.name })
                    : t("editor.conflictTitle")}
                </h2>
                {dialog.type === "conflict" ? <p>{t("editor.conflictMessage")}</p> : null}
                <div>
                  {dialog.type === "dirty" ? (
                    <>
                      <Button autoFocus onClick={() => finishDialog("cancel")}>
                        {t("editor.cancel")}
                      </Button>
                      <Button onClick={() => finishDialog("discard")}>{t("editor.discard")}</Button>
                      <Button onClick={() => finishDialog("save")} variant="primary">
                        {t("editor.save")}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button autoFocus onClick={() => finishDialog("cancel")}>
                        {t("editor.cancel")}
                      </Button>
                      <Button onClick={() => finishDialog("reload")}>{t("editor.reload")}</Button>
                      <Button onClick={() => finishDialog("overwrite")} variant="danger">
                        {t("editor.overwrite")}
                      </Button>
                    </>
                  )}
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
