// The API returns RFC-7807 problem+json (ErrorModel: { detail, title, status }).
// openapi-react-query throws that body on non-2xx; fetch failures throw an Error.

type ProblemJson = { detail?: string; title?: string; status?: number };

function asProblem(error: unknown): ProblemJson | null {
  return error && typeof error === "object" ? (error as ProblemJson) : null;
}

// Re-exported so callers can branch on connectivity without reaching into the
// API client.
export { isNetworkError } from "@/lib/api/client";
import { isNetworkError } from "@/lib/api/client";

// 401s are handled by the client's auth layer (refresh → logout) — never toast them.
export function isAuthError(error: unknown): boolean {
  return asProblem(error)?.status === 401;
}

export function getErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  // A raw connectivity failure has no useful problem+json body — "Failed to
  // fetch" is not something to show a user.
  if (isNetworkError(error)) {
    return "You're offline. This change wasn't saved — reconnect and try again.";
  }

  const problem = asProblem(error);
  if (problem?.detail) return problem.detail;
  if (problem?.title) return problem.title;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
