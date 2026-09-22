import i18n from "../i18n";

export function hostErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const structured = error as {
      code?: unknown;
      message?: unknown;
      messageKey?: unknown;
      details?: { field?: unknown; reason?: unknown };
    };
    const details = structured.details;
    if (typeof details?.reason === "string") return details.reason;
    if (typeof details?.field === "string" && typeof structured.code === "string") {
      return `${structured.code}: ${details.field}`;
    }
    if (typeof structured.message === "string") return structured.message;
    if (typeof structured.messageKey === "string") return i18n.t(structured.messageKey);
    if (typeof structured.code === "string") return structured.code;
  }
  return error instanceof Error ? error.message : String(error);
}
