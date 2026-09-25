import {
  Coffee,
  Database,
  FileJson2,
  FileQuestionMark,
  FileSymlink,
  FileType2,
} from "lucide-react";
import { describe, expect, it } from "vitest";

import { fileIconFor, fileIconToneFor } from "./file-icons";

describe("fileIconFor", () => {
  it("按文件格式选择图标，未知格式单独标识", () => {
    expect(fileIconFor("query.SQL", "file")).toBe(Database);
    expect(fileIconFor("App.java", "file")).toBe(Coffee);
    expect(fileIconFor("data.json", "file")).toBe(FileJson2);
    expect(fileIconFor("note.txt", "file")).toBe(FileType2);
    expect(fileIconFor("blob.xyz", "file")).toBe(FileQuestionMark);
    expect(fileIconFor("target.java", "symlink")).toBe(FileSymlink);
  });

  it("把文件归入少量语义色组，未知文件保持中性", () => {
    expect(fileIconToneFor("App.java", "file")).toBe("code");
    expect(fileIconToneFor("data.json", "file")).toBe("data");
    expect(fileIconToneFor("README.md", "file")).toBe("document");
    expect(fileIconToneFor("app.properties", "file")).toBe("config");
    expect(fileIconToneFor("blob.xyz", "file")).toBe("neutral");
    expect(fileIconToneFor("target.java", "symlink")).toBe("neutral");
  });
});
