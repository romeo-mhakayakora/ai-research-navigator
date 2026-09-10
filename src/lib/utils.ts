import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function errorEnvelope(code: string, message: string) {
  return { error: { code, message } };
}

/** Parse model output that may be wrapped in fences/prose into JSON. */
export function parseLooseJson(raw: string): any {
  const t = raw.trim();
  try {
    return JSON.parse(t);
  } catch { /* fall through */ }
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch { /* fall through */ }
  }
  const start = t.search(/[\[{]/);
  if (start >= 0) {
    const endIdx = Math.max(t.lastIndexOf("]"), t.lastIndexOf("}"));
    if (endIdx > start) {
      try {
        return JSON.parse(t.slice(start, endIdx + 1));
      } catch { /* fall through */ }
    }
  }
  throw new Error("Model returned non-JSON output");
}
