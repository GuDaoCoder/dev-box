import { format } from "sql-formatter";

export const SQL_INPUT_LIMIT = 2 * 1024 * 1024;

export type SqlDialect = "sql" | "mysql" | "postgresql" | "transactsql" | "plsql";
export type SqlKeywordCase = "preserve" | "upper" | "lower";

export function transformSql(
  input: string,
  options: { dialect: SqlDialect; keywordCase: SqlKeywordCase; indent: 2 | 4 },
) {
  if (new TextEncoder().encode(input).byteLength > SQL_INPUT_LIMIT) {
    return { error: "INPUT_TOO_LARGE" as const };
  }
  try {
    return {
      output: format(input, {
        language: options.dialect,
        keywordCase: options.keywordCase,
        tabWidth: options.indent,
      }),
    };
  } catch {
    // 格式化器不是语法校验器，仅报告无法安全排版的输入。
    return { error: "FORMAT_FAILED" as const };
  }
}
