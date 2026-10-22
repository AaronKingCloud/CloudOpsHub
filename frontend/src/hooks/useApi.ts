import { useEffect, useState } from "react";

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

// Runs an async fetcher once on mount and tracks loading / error state.
// Usage: const { data, loading, error } = useApi(getDevices);
export function useApi<T>(fetcher: () => Promise<T>): ApiState<T> {
  const [state, setState] = useState<ApiState<T>>({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    fetcher()
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Request failed";
        if (!cancelled) setState({ data: null, loading: false, error: message });
      });
    return () => {
      cancelled = true;
    };
  }, [fetcher]);

  return state;
}
