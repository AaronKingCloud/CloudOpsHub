import { isAxiosError } from "axios";

// Turns any thrown value into a message a user can act on.
// Prefers the backend's `detail` field (FastAPI's error format) over axios' generic text.
export function getErrorMessage(err: unknown): string {
  if (isAxiosError(err)) {
    const detail = (err.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === "string") return detail;
    if (err.response?.status === 401) return "Please sign in to see this.";
    if (err.response?.status === 403) return "Your role doesn't have access to this.";
    if (!err.response) return "Can't reach the backend. Is it running?";
  }
  if (err instanceof Error) return err.message;
  return "Request failed";
}

export function getErrorStatus(err: unknown): number | undefined {
  return isAxiosError(err) ? err.response?.status : undefined;
}
