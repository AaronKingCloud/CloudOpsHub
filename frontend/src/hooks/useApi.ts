import { useCallback, useEffect, useState } from "react";
import { getErrorMessage, getErrorStatus } from "../utils/errors";

interface ApiState<T> {
  data: T | null;
  // True only until the first response for this fetcher arrives.
  loading: boolean;
  // True while a reload() is in flight (the previous data stays on screen).
  refreshing: boolean;
  error: string | null;
  // HTTP status of a failed request (e.g. 401, 502), if there was one.
  errorStatus?: number;
  // Fetch again, keeping the current data visible until the new response arrives.
  reload: () => void;
}

interface Result<T> {
  source: () => Promise<T>;
  version: number;
  data: T | null;
  error: string | null;
  errorStatus?: number;
}

// Runs an async fetcher and tracks loading / error state. Re-runs when the fetcher changes,
// so for parameterised calls wrap it in useCallback:
//   const { data, loading, error, reload } = useApi(getDevices);
//   const fetchCpu = useCallback(() => getEc2Cpu(id, hours), [id, hours]);
//   const cpu = useApi(fetchCpu);
export function useApi<T>(fetcher: () => Promise<T>): ApiState<T> {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<Result<T> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetcher()
      .then((data) => {
        if (!cancelled) setResult({ source: fetcher, version, data, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setResult({ source: fetcher, version, data: null, error: getErrorMessage(err), errorStatus: getErrorStatus(err) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fetcher, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  // A result from a different fetcher (e.g. another instance was selected) is never shown.
  if (!result || result.source !== fetcher) {
    return { data: null, loading: true, refreshing: false, error: null, reload };
  }
  return {
    data: result.data,
    loading: false,
    refreshing: result.version !== version,
    error: result.error,
    errorStatus: result.errorStatus,
    reload,
  };
}
