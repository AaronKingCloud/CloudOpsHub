import { useCallback, useContext, useEffect, useState } from "react";
import { RefreshContext } from "../context/refreshContextDef";
import { getErrorMessage, getErrorStatus } from "../utils/errors";

interface ApiOptions {
  // Re-fetch on every auto-refresh tick / "Refresh now" click (see RefreshProvider).
  // Leave off for anything that costs money or has tight quotas (AWS, billing):
  // those refresh only when the user asks via reload().
  live?: boolean;
}

interface ApiState<T> {
  data: T | null;
  // True only until the first response for this fetcher arrives.
  loading: boolean;
  // True while a refresh is in flight (the previous data stays on screen).
  refreshing: boolean;
  error: string | null;
  // HTTP status of a failed request (e.g. 401, 502), if there was one.
  errorStatus?: number;
  // Fetch again, keeping the current data visible until the new response arrives.
  reload: () => void;
}

interface Result<T> {
  source: () => Promise<T>;
  key: string;
  data: T | null;
  error: string | null;
  errorStatus?: number;
}

// Runs an async fetcher and tracks loading / error state. Re-runs when the fetcher changes,
// so for parameterised calls wrap it in useCallback:
//   const { data, loading, error, reload } = useApi(getDevices, { live: true });
//   const fetchCpu = useCallback(() => getEc2Cpu(id, hours), [id, hours]);
//   const cpu = useApi(fetchCpu);
export function useApi<T>(fetcher: () => Promise<T>, options: ApiOptions = {}): ApiState<T> {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<Result<T> | null>(null);
  const { refreshKey } = useContext(RefreshContext);
  const liveKey = options.live ? refreshKey : 0;
  const key = `${version}:${liveKey}`;

  useEffect(() => {
    let cancelled = false;
    fetcher()
      .then((data) => {
        if (!cancelled) setResult({ source: fetcher, key, data, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setResult({ source: fetcher, key, data: null, error: getErrorMessage(err), errorStatus: getErrorStatus(err) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fetcher, key]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  // A result from a different fetcher (e.g. another instance was selected) is never shown.
  if (!result || result.source !== fetcher) {
    return { data: null, loading: true, refreshing: false, error: null, reload };
  }
  return {
    data: result.data,
    loading: false,
    refreshing: result.key !== key,
    error: result.error,
    errorStatus: result.errorStatus,
    reload,
  };
}
