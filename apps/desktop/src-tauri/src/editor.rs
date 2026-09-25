use std::{
    cmp::Ordering,
    fs::{self, OpenOptions},
    io::Write,
    path::{Component, Path, PathBuf},
    sync::Mutex,
};

use encoding_rs::GBK;
use serde::Serialize;
use sha2::{Digest, Sha256};

const EDITABLE_LIMIT: u64 = 5 * 1024 * 1024;
const PREVIEW_LIMIT: u64 = 20 * 1024 * 1024;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorRoot {
    pub name: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorEntry {
    pub name: String,
    pub path: String,
    pub kind: &'static str,
    pub hidden: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorFile {
    pub path: String,
    pub content: String,
    pub revision: String,
    pub size: u64,
    pub read_only: bool,
    pub encoding: &'static str,
    pub line_ending: &'static str,
}

#[derive(Default)]
pub struct EditorService {
    root: Mutex<Option<PathBuf>>,
}

impl EditorService {
    pub fn open_directory(&self, selected: &Path) -> Result<EditorRoot, &'static str> {
        let root = selected.canonicalize().map_err(|_| "OPEN_FAILED")?;
        if !root.is_dir() {
            return Err("NOT_DIRECTORY");
        }
        let name = root
            .file_name()
            .map(|value| value.to_string_lossy().into_owned())
            .unwrap_or_else(|| root.display().to_string());
        *self.root.lock().map_err(|_| "OPEN_FAILED")? = Some(root.clone());
        Ok(EditorRoot {
            name,
            path: root.display().to_string(),
        })
    }

    pub fn list_directory(&self, relative: &str) -> Result<Vec<EditorEntry>, &'static str> {
        let directory = self.resolve(relative)?;
        if !directory.is_dir() {
            return Err("NOT_DIRECTORY");
        }
        let mut entries = fs::read_dir(directory)
            .map_err(|_| "READ_FAILED")?
            .map(|entry| {
                let entry = entry.map_err(|_| "READ_FAILED")?;
                let name = entry.file_name().to_string_lossy().into_owned();
                let kind = entry.file_type().map_err(|_| "READ_FAILED")?;
                let kind = if kind.is_symlink() {
                    "symlink"
                } else if kind.is_dir() {
                    "directory"
                } else if kind.is_file() {
                    "file"
                } else {
                    "other"
                };
                let hidden = name.starts_with('.') || is_platform_hidden(&entry);
                Ok(EditorEntry {
                    path: if relative.is_empty() {
                        name.clone()
                    } else {
                        format!("{relative}/{name}")
                    },
                    hidden,
                    name,
                    kind,
                })
            })
            .collect::<Result<Vec<_>, &'static str>>()?;
        entries.sort_by(|left, right| {
            let left_rank = if left.kind == "directory" { 0 } else { 1 };
            let right_rank = if right.kind == "directory" { 0 } else { 1 };
            left_rank
                .cmp(&right_rank)
                .then_with(|| natural_cmp(&left.name, &right.name))
        });
        Ok(entries)
    }

    pub fn read_file(&self, relative: &str) -> Result<EditorFile, &'static str> {
        let path = self.resolve(relative)?;
        let metadata = fs::metadata(&path).map_err(|_| "READ_FAILED")?;
        if !metadata.is_file() {
            return Err("NOT_FILE");
        }
        if metadata.len() > PREVIEW_LIMIT {
            return Err("TOO_LARGE");
        }
        let bytes = fs::read(path).map_err(|_| "READ_FAILED")?;
        if bytes.len() as u64 > PREVIEW_LIMIT {
            return Err("TOO_LARGE");
        }
        let (text, encoding) = decode_text(&bytes)?;
        Ok(EditorFile {
            path: relative.to_owned(),
            content: text.clone(),
            revision: digest(&bytes),
            size: bytes.len() as u64,
            read_only: metadata.permissions().readonly() || bytes.len() as u64 > EDITABLE_LIMIT,
            encoding,
            line_ending: if text.contains("\r\n") { "CRLF" } else { "LF" },
        })
    }

    pub fn save_file(
        &self,
        relative: &str,
        content: &str,
        expected_revision: &str,
        force: bool,
        encoding: &str,
        line_ending: &str,
    ) -> Result<EditorFile, &'static str> {
        if !matches!(line_ending, "LF" | "CRLF") || content.contains('\0') {
            return Err("INVALID_CONTENT");
        }
        let content = content.replace("\r\n", "\n");
        let content = if line_ending == "CRLF" {
            content.replace('\n', "\r\n")
        } else {
            content
        };
        let bytes = encode_text(&content, encoding)?;
        if bytes.len() as u64 > EDITABLE_LIMIT {
            return Err("TOO_LARGE");
        }
        let path = self.resolve(relative)?;
        let metadata = fs::metadata(&path).map_err(|_| "READ_FAILED")?;
        if !metadata.is_file() {
            return Err("NOT_FILE");
        }
        if metadata.permissions().readonly() || metadata.len() > EDITABLE_LIMIT {
            return Err("READ_ONLY");
        }
        let current = fs::read(&path).map_err(|_| "READ_FAILED")?;
        if !force && digest(&current) != expected_revision {
            return Err("EXTERNAL_MODIFIED");
        }
        let mut file = OpenOptions::new()
            .write(true)
            .truncate(true)
            .open(path)
            .map_err(|_| "WRITE_FAILED")?;
        file.write_all(&bytes).map_err(|_| "WRITE_FAILED")?;
        file.sync_all().map_err(|_| "WRITE_FAILED")?;
        let mut saved = self.read_file(relative)?;
        saved.encoding = encoding_label(encoding)?;
        Ok(saved)
    }

    pub fn rename_file(
        &self,
        relative: &str,
        new_name: &str,
        expected_revision: &str,
    ) -> Result<EditorFile, &'static str> {
        if new_name.is_empty()
            || matches!(new_name, "." | "..")
            || new_name.chars().any(|value| {
                value.is_control()
                    || matches!(value, '/' | '\\' | '<' | '>' | ':' | '"' | '|' | '?' | '*')
            })
            || new_name.ends_with([' ', '.'])
        {
            return Err("INVALID_NAME");
        }
        let path = self.resolve(relative)?;
        if !path.is_file() {
            return Err("NOT_FILE");
        }
        if digest(&fs::read(&path).map_err(|_| "READ_FAILED")?) != expected_revision {
            return Err("EXTERNAL_MODIFIED");
        }
        let parent = path.parent().ok_or("OUTSIDE_ROOT")?;
        let target = parent.join(new_name);
        if target == path {
            return self.read_file(relative);
        }
        if fs::symlink_metadata(&target).is_ok() {
            return Err("ALREADY_EXISTS");
        }
        fs::rename(&path, &target).map_err(|_| "RENAME_FAILED")?;
        let new_relative = relative
            .rsplit_once('/')
            .map(|(parent, _)| format!("{parent}/{new_name}"))
            .unwrap_or_else(|| new_name.to_owned());
        self.read_file(&new_relative)
    }

    fn resolve(&self, relative: &str) -> Result<PathBuf, &'static str> {
        let root = self.root.lock().map_err(|_| "OPEN_FAILED")?;
        let root = root.as_ref().ok_or("NO_DIRECTORY")?;
        let mut path = root.clone();
        if !relative.is_empty() {
            for component in Path::new(relative).components() {
                let Component::Normal(part) = component else {
                    return Err("OUTSIDE_ROOT");
                };
                path.push(part);
                if fs::symlink_metadata(&path)
                    .map_err(|_| "NOT_FOUND")?
                    .file_type()
                    .is_symlink()
                {
                    return Err("SYMLINK");
                }
            }
        }
        let canonical = path.canonicalize().map_err(|_| "NOT_FOUND")?;
        if !canonical.starts_with(root) {
            return Err("OUTSIDE_ROOT");
        }
        Ok(canonical)
    }
}

fn digest(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}

fn decode_text(bytes: &[u8]) -> Result<(String, &'static str), &'static str> {
    let (text, encoding) = if let Some(value) = bytes.strip_prefix(&[0xef, 0xbb, 0xbf]) {
        (
            std::str::from_utf8(value)
                .map_err(|_| "INVALID_ENCODING")?
                .to_owned(),
            "UTF-8 BOM",
        )
    } else if let Some(value) = bytes.strip_prefix(&[0xff, 0xfe]) {
        (decode_utf16(value, true)?, "UTF-16 LE")
    } else if let Some(value) = bytes.strip_prefix(&[0xfe, 0xff]) {
        (decode_utf16(value, false)?, "UTF-16 BE")
    } else if let Ok(value) = std::str::from_utf8(bytes) {
        (value.to_owned(), "UTF-8")
    } else {
        (
            GBK.decode_without_bom_handling_and_without_replacement(bytes)
                .ok_or("INVALID_ENCODING")?
                .into_owned(),
            "GBK",
        )
    };
    if text
        .chars()
        .any(|value| value.is_control() && !matches!(value, '\n' | '\r' | '\t'))
    {
        return Err("BINARY_FILE");
    }
    Ok((text, encoding))
}

fn decode_utf16(bytes: &[u8], little_endian: bool) -> Result<String, &'static str> {
    if !bytes.len().is_multiple_of(2) {
        return Err("INVALID_ENCODING");
    }
    let (pairs, _) = bytes.as_chunks::<2>();
    let units = pairs.iter().map(|pair| {
        if little_endian {
            u16::from_le_bytes([pair[0], pair[1]])
        } else {
            u16::from_be_bytes([pair[0], pair[1]])
        }
    });
    String::from_utf16(&units.collect::<Vec<_>>()).map_err(|_| "INVALID_ENCODING")
}

fn encode_text(content: &str, encoding: &str) -> Result<Vec<u8>, &'static str> {
    match encoding {
        "UTF-8" => Ok(content.as_bytes().to_vec()),
        "UTF-8 BOM" => Ok([&[0xef, 0xbb, 0xbf][..], content.as_bytes()].concat()),
        "UTF-16 LE" | "UTF-16 BE" => {
            let little_endian = encoding == "UTF-16 LE";
            let mut bytes = if little_endian {
                vec![0xff, 0xfe]
            } else {
                vec![0xfe, 0xff]
            };
            for value in content.encode_utf16() {
                bytes.extend_from_slice(&if little_endian {
                    value.to_le_bytes()
                } else {
                    value.to_be_bytes()
                });
            }
            Ok(bytes)
        }
        "GBK" => {
            let (bytes, _, errors) = GBK.encode(content);
            if errors {
                Err("INVALID_ENCODING")
            } else {
                Ok(bytes.into_owned())
            }
        }
        _ => Err("INVALID_ENCODING"),
    }
}

fn encoding_label(value: &str) -> Result<&'static str, &'static str> {
    match value {
        "UTF-8" => Ok("UTF-8"),
        "UTF-8 BOM" => Ok("UTF-8 BOM"),
        "UTF-16 LE" => Ok("UTF-16 LE"),
        "UTF-16 BE" => Ok("UTF-16 BE"),
        "GBK" => Ok("GBK"),
        _ => Err("INVALID_ENCODING"),
    }
}

#[cfg(windows)]
fn is_platform_hidden(entry: &fs::DirEntry) -> bool {
    use std::os::windows::fs::MetadataExt;
    fs::symlink_metadata(entry.path())
        .map(|metadata| metadata.file_attributes() & 0x2 != 0)
        .unwrap_or(false)
}

#[cfg(not(windows))]
fn is_platform_hidden(_: &fs::DirEntry) -> bool {
    false
}

fn natural_cmp(left: &str, right: &str) -> Ordering {
    let mut left = left.chars().peekable();
    let mut right = right.chars().peekable();
    loop {
        match (left.peek().copied(), right.peek().copied()) {
            (Some(a), Some(b)) if a.is_ascii_digit() && b.is_ascii_digit() => {
                let take_digits = |iter: &mut std::iter::Peekable<std::str::Chars<'_>>| {
                    let mut digits = String::new();
                    while iter.peek().is_some_and(|value| value.is_ascii_digit()) {
                        digits.push(iter.next().unwrap());
                    }
                    digits
                };
                let a = take_digits(&mut left);
                let b = take_digits(&mut right);
                let order = a
                    .trim_start_matches('0')
                    .len()
                    .cmp(&b.trim_start_matches('0').len())
                    .then_with(|| a.cmp(&b));
                if order != Ordering::Equal {
                    return order;
                }
            }
            (Some(a), Some(b)) => {
                left.next();
                right.next();
                let order = a.to_ascii_lowercase().cmp(&b.to_ascii_lowercase());
                if order != Ordering::Equal {
                    return order;
                }
            }
            (None, None) => return Ordering::Equal,
            (None, _) => return Ordering::Less,
            (_, None) => return Ordering::Greater,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn 目录树排序与路径限制() {
        let root =
            std::env::temp_dir().join(format!("devbox-editor-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        fs::create_dir(root.join("folder")).unwrap();
        fs::write(root.join("file10.txt"), "ten").unwrap();
        fs::write(root.join("file2.txt"), "two").unwrap();
        let editor = EditorService::default();
        editor.open_directory(&root).unwrap();
        let entries = editor.list_directory("").unwrap();
        assert_eq!(
            entries
                .iter()
                .map(|entry| entry.name.as_str())
                .collect::<Vec<_>>(),
            ["folder", "file2.txt", "file10.txt"]
        );
        assert!(editor.read_file("../outside.txt").is_err());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn 保存保留_bom_换行并检查外部修改() {
        let root =
            std::env::temp_dir().join(format!("devbox-editor-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        let path = root.join("data.txt");
        fs::write(&path, b"\xef\xbb\xbfhello\r\n").unwrap();
        let editor = EditorService::default();
        editor.open_directory(&root).unwrap();
        let opened = editor.read_file("data.txt").unwrap();
        assert_eq!(opened.encoding, "UTF-8 BOM");
        assert_eq!(opened.line_ending, "CRLF");
        let saved = editor
            .save_file(
                "data.txt",
                "world\n",
                &opened.revision,
                false,
                "UTF-8 BOM",
                "CRLF",
            )
            .unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"\xef\xbb\xbfworld\r\n");
        fs::write(&path, "external").unwrap();
        assert!(matches!(
            editor.save_file(
                "data.txt",
                "mine",
                &saved.revision,
                false,
                "UTF-8 BOM",
                "CRLF"
            ),
            Err("EXTERNAL_MODIFIED")
        ));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn 支持切换编码并阻止无效转换() {
        let root =
            std::env::temp_dir().join(format!("devbox-editor-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        let path = root.join("text.txt");
        fs::write(&path, "中文\n").unwrap();
        let editor = EditorService::default();
        editor.open_directory(&root).unwrap();
        let opened = editor.read_file("text.txt").unwrap();
        let saved = editor
            .save_file(
                "text.txt",
                &opened.content,
                &opened.revision,
                false,
                "UTF-16 LE",
                "LF",
            )
            .unwrap();
        assert_eq!(saved.encoding, "UTF-16 LE");
        assert_eq!(saved.content, "中文\n");
        assert!(fs::read(&path).unwrap().starts_with(&[0xff, 0xfe]));
        let gbk = editor
            .save_file(
                "text.txt",
                &saved.content,
                &saved.revision,
                false,
                "GBK",
                "LF",
            )
            .unwrap();
        assert_eq!(gbk.encoding, "GBK");
        assert!(matches!(
            editor.save_file("text.txt", "🙂", &gbk.revision, false, "GBK", "LF"),
            Err("INVALID_ENCODING")
        ));
        assert_eq!(editor.read_file("text.txt").unwrap().content, "中文\n");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn 重命名文件不覆盖目标并拒绝非法文件名() {
        let root =
            std::env::temp_dir().join(format!("devbox-editor-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        fs::write(root.join("old.txt"), "content").unwrap();
        fs::write(root.join("existing.txt"), "other").unwrap();
        let editor = EditorService::default();
        editor.open_directory(&root).unwrap();
        let opened = editor.read_file("old.txt").unwrap();
        assert!(matches!(
            editor.rename_file("old.txt", "../escape.txt", &opened.revision),
            Err("INVALID_NAME")
        ));
        assert!(matches!(
            editor.rename_file("old.txt", "existing.txt", &opened.revision),
            Err("ALREADY_EXISTS")
        ));
        let renamed = editor
            .rename_file("old.txt", "new.json", &opened.revision)
            .unwrap();
        assert_eq!(renamed.path, "new.json");
        assert_eq!(renamed.content, "content");
        assert!(!root.join("old.txt").exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn 符号链接不能越过所选目录() {
        let root =
            std::env::temp_dir().join(format!("devbox-editor-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        std::os::unix::fs::symlink(std::env::temp_dir(), root.join("outside")).unwrap();
        let editor = EditorService::default();
        editor.open_directory(&root).unwrap();
        assert!(matches!(editor.list_directory("outside"), Err("SYMLINK")));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn 二进制与超限文件不能打开且预览不可保存() {
        let root =
            std::env::temp_dir().join(format!("devbox-editor-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        fs::write(root.join("binary.dat"), b"a\0b").unwrap();
        fs::write(
            root.join("preview.txt"),
            vec![b'a'; EDITABLE_LIMIT as usize + 1],
        )
        .unwrap();
        fs::write(
            root.join("large.txt"),
            vec![b'a'; PREVIEW_LIMIT as usize + 1],
        )
        .unwrap();
        let editor = EditorService::default();
        editor.open_directory(&root).unwrap();
        assert!(matches!(editor.read_file("binary.dat"), Err("BINARY_FILE")));
        let preview = editor.read_file("preview.txt").unwrap();
        assert!(preview.read_only);
        assert!(matches!(
            editor.save_file(
                "preview.txt",
                "replacement",
                &preview.revision,
                false,
                "UTF-8",
                "LF"
            ),
            Err("READ_ONLY")
        ));
        assert!(matches!(editor.read_file("large.txt"), Err("TOO_LARGE")));
        fs::remove_dir_all(root).unwrap();
    }
}
