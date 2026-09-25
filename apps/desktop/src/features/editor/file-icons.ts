import {
  Braces,
  CodeXml,
  Coffee,
  Database,
  FileCode,
  FileCode2,
  FileCog,
  FileJson2,
  FileQuestionMark,
  FileSliders,
  FileSymlink,
  FileText,
  FileType2,
  ListTree,
  Paintbrush,
  ScrollText,
  SquareTerminal,
  type LucideIcon,
} from "lucide-react";

import { languageFor } from "./languages";

const languageIcons: Record<string, LucideIcon> = {
  SQL: Database,
  Markdown: FileText,
  Java: Coffee,
  JSON: FileJson2,
  XML: CodeXml,
  YAML: ListTree,
  Properties: FileCog,
  JavaScript: Braces,
  TypeScript: FileCode2,
  HTML: FileCode,
  CSS: Paintbrush,
  Shell: SquareTerminal,
  TOML: FileSliders,
};

export type FileIconTone = "code" | "data" | "document" | "config" | "neutral";

export function fileIconToneFor(name: string, kind: "file" | "symlink" | "other"): FileIconTone {
  if (kind !== "file") return "neutral";
  if (/\.(txt|log)$/i.test(name)) return "document";
  const language = languageFor(name)?.name;
  if (!language) return "neutral";
  if (["SQL", "JSON", "YAML", "TOML"].includes(language)) return "data";
  if (language === "Markdown") return "document";
  if (language === "Properties") return "config";
  return "code";
}

export function fileIconFor(name: string, kind: "file" | "symlink" | "other"): LucideIcon {
  if (kind === "symlink") return FileSymlink;
  if (kind === "other") return FileQuestionMark;
  if (/\.log$/i.test(name)) return ScrollText;
  if (/\.txt$/i.test(name)) return FileType2;
  const language = languageFor(name)?.name;
  return (language && languageIcons[language]) || FileQuestionMark;
}
