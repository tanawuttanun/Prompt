import { useCallback, useEffect, useState } from 'react';

import { ApiError, request, type Pagination } from '../api/client';

// Loads `path` and reloads whenever it changes. A null path skips the request.
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [pagination, setPagination] = useState<Pagination | undefined>();
  const [raw, setRaw] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (path === null) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    request<T>(path, { signal: controller.signal })
      .then(r => {
        setData(r.data);
        setPagination(r.pagination);
        setRaw(r.raw);
      })
      .catch(e => {
        if ((e as Error).name !== 'AbortError') setError(e instanceof ApiError ? e : new ApiError(0, 'ERROR', String(e)));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, nonce]);

  const reload = useCallback(() => setNonce(n => n + 1), []);
  return { data, setData, pagination, raw, error, loading, reload };
}
