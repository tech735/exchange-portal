import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// supabase.functions.invoke reports any error response as "Edge Function
// returned a non-2xx status code"; the function's own { error } message is
// in the response body.
export async function functionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: Response })?.context;
  if (context && typeof context.json === 'function') {
    const body = await context.clone().json().catch(() => null);
    if (body?.error) return String(body.error);
  }
  return (error as Error)?.message || fallback;
}
