export class VisualError extends Error {
  constructor(readonly code: "VALIDATION" | "LIMIT" | "LAYOUT" | "RENDER" | "BUSY" | "CANCELLED" | "ARTIFACT", message: string, readonly path = "") {
    super(message);
    this.name = "VisualError";
  }
}

export function publicError(error: unknown): string {
  if (error instanceof VisualError) return JSON.stringify({ code: error.code, path: error.path, message: error.message });
  return JSON.stringify({ code: "RENDER", message: "Rendering failed; no artifact was published." });
}
