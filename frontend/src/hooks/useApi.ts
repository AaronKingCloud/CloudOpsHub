import { useEffect, useState } from "react";
import { getErrorMessage, getErrorStatus } from "../utils/errors";

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  // HTTP status of a failed request (e.g. 401, 502), if there was one.
  errorStatus?: number;
}

interface Result<T> {
  source: () => Promise<T>;
  data: T | null;
  error: string | null;
  errorStatus?: number;
}

// Runs an async fetcher and tracks loading / error state. Re-runs when the fetcher changes,
// so for parameterised calls wrap it in useCallback:
//   const { data, loading, error } = useApi(getDevices);
//   const fetchCpu = useCallback(() => getEc2Cpu(id, hours), [id, hours]);
//   const cpu = useApi(fetchCpu);
export function useApi<T>(fetcher: () => Promise<T>): ApiState<T> {
  const [result, setResult] = useState<Result<T> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetcher()
      .then((data) => {
        if (!cancelled) setResult({ source: fetcher, data, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setResult({ source: fetcher, data: null, error: getErrorMessage(err), errorStatus: getErrorStatus(err) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fetcher]);

  // Still loading until the result belongs to the current fetcher (avoids showing stale data).
  if (!result || result.source !== fetcher) {
    return { data: null, loading: true, error: null };
  }
  return { data: result.data, loading: false, error: result.error, errorStatus: result.errorStatus };
}
