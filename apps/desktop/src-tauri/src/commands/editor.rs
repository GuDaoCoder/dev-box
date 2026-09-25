use std::path::Path;

use tauri::{State, Webview};

use crate::{
    editor::{EditorEntry, EditorFile, EditorRoot},
    state::AppState,
};

fn require_main(webview: &Webview) -> Result<(), &'static str> {
    if webview.label() == "main" {
        Ok(())
    } else {
        Err("PERMISSION_DENIED")
    }
}

#[tauri::command]
pub fn editor_open_directory(
    webview: Webview,
    state: State<'_, AppState>,
    path: String,
) -> Result<EditorRoot, &'static str> {
    require_main(&webview)?;
    state.editor.open_directory(Path::new(&path))
}

#[tauri::command]
pub fn editor_list_directory(
    webview: Webview,
    state: State<'_, AppState>,
    path: String,
) -> Result<Vec<EditorEntry>, &'static str> {
    require_main(&webview)?;
    state.editor.list_directory(&path)
}

#[tauri::command]
pub fn editor_read_file(
    webview: Webview,
    state: State<'_, AppState>,
    path: String,
) -> Result<EditorFile, &'static str> {
    require_main(&webview)?;
    state.editor.read_file(&path)
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn editor_save_file(
    webview: Webview,
    state: State<'_, AppState>,
    path: String,
    content: String,
    expected_revision: String,
    force: bool,
    encoding: String,
    line_ending: String,
) -> Result<EditorFile, &'static str> {
    require_main(&webview)?;
    state.editor.save_file(
        &path,
        &content,
        &expected_revision,
        force,
        &encoding,
        &line_ending,
    )
}

#[tauri::command]
pub fn editor_rename_file(
    webview: Webview,
    state: State<'_, AppState>,
    path: String,
    new_name: String,
    expected_revision: String,
) -> Result<EditorFile, &'static str> {
    require_main(&webview)?;
    state
        .editor
        .rename_file(&path, &new_name, &expected_revision)
}
