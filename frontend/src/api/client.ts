// Thin fetch wrapper: sends the session cookie, unwraps { data } and turns
// { error: { code, message } } into a thrown ApiError the UI can show.
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

type Options = { method?: string; body?: unknown; form?: FormData; signal?: AbortSignal };

export async function request<T>(path: string, options: Options = {}): Promise<{ data: T; pagination?: Pagination; raw: Record<string, unknown> }> {
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;
  if (options.form) body = options.form;
  else if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method: options.method ?? (body ? 'POST' : 'GET'), headers, body, credentials: 'include', signal: options.signal });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Is the backend running?');
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: { code: string; message: string; details?: unknown } };
  if (!res.ok || json.error) {
    throw new ApiError(res.status, json.error?.code ?? 'HTTP_ERROR', json.error?.message ?? `Request failed (${res.status})`, json.error?.details);
  }
  return { data: json.data as T, pagination: json.pagination as Pagination | undefined, raw: json };
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }).then(r => r.data),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ?? {} }).then(r => r.data),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body }).then(r => r.data),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body }).then(r => r.data),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }).then(r => r.data),
  upload: <T>(path: string, form: FormData) => request<T>(path, { method: 'POST', form }).then(r => r.data),
};

export type Pagination = { page: number; page_size: number; total: number; total_pages: number };

export const errorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Something went wrong');
