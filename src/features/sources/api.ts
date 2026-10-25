import { ApiError, apiPath } from '../../api/client';
import { api, currentToken } from '../../auth/session';

export type SourceKind = 'csv' | 'excel' | 'xml' | 'sql';

export type Source = {
  id: string;
  name: string;
  kind: SourceKind;
  agency: string;
  createdBy: string;
  createdAt: string;
  fileCount: number;
};

export type SourceFile = {
  id: string;
  sourceId: string;
  filename: string;
  sha256: string;
  sizeBytes: number;
  encoding: string | null;
  rowCount: number | null;
  createdAt: string;
  profileStatus?: 'pending' | 'ok' | 'failed';
};

export type Page<T> = { data: T[]; nextCursor: string | null };

export type ColumnProfile = {
  name: string;
  filled: number;
  empty: number;
  emptyPct: number;
  distinct: number;
  distinctCapped: boolean;
  topValues: { value: string; count: number }[];
  length: { min: number; max: number } | null;
  patterns: { pattern: string; count: number }[];
  preeti: { share: number; likely: boolean };
  dateFormats: { format: string; count: number }[];
  numeric: { min: number; max: number; mean: number } | null;
};

export type Profile =
  | {
      status: 'ok';
      encoding: string;
      rowCount: number;
      raggedRows: number;
      columns: ColumnProfile[];
    }
  | { status: 'failed'; encoding: string; error: string };

/** What each kind of source holds, as the backend's connectors read it. */
export const KINDS: Record<SourceKind, { label: string; accept: string; hint: string }> = {
  csv: {
    label: 'CSV file',
    accept: '.csv,.txt,text/csv',
    hint: 'First row is the header. Windows-1252 (Preeti era), UTF-8 and UTF-16 are detected.',
  },
  excel: {
    label: 'Excel workbook (.xlsx)',
    accept: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    hint: 'The first worksheet is read. Old .xls files must be saved as .xlsx or CSV first.',
  },
  xml: {
    label: 'XML export',
    accept: '.xml,application/xml,text/xml',
    hint: 'One record per child of the root element; attributes and child elements are columns.',
  },
  sql: {
    label: 'SQL dump',
    accept: '.sql,text/plain',
    hint: 'INSERT rows of one table. The file is read, never executed.',
  },
};

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const listSources = (cursor?: string) =>
  api<Page<Source>>(`/sources?limit=25${cursor ? `&cursor=${cursor}` : ''}`);

export const getSource = (id: string) => api<Source>(`/sources/${id}`);

export const listFiles = (sourceId: string) => api<SourceFile[]>(`/sources/${sourceId}/files`);

export const createSource = (input: { name: string; kind: SourceKind; agency: string }) =>
  api<Source>('/sources', { method: 'POST', body: JSON.stringify(input) });

/** The profile, or null while the worker is still profiling (the backend answers 404). */
export async function getProfile(fileId: string): Promise<Profile | null> {
  try {
    return await api<Profile>(`/files/${fileId}/profile`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/**
 * Uploads with XMLHttpRequest, because fetch cannot report upload progress. Errors are the
 * backend's problem+json, as ApiError, like every other call.
 */
export async function uploadFile(
  sourceId: string,
  file: File,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<SourceFile> {
  const token = await currentToken();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', apiPath(`/sources/${sourceId}/files`));
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onerror = () => reject(new TypeError('Network error during upload'));
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
    xhr.onload = () => {
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // not JSON
      }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(body as SourceFile);
      reject(
        new ApiError(
          xhr.status,
          (body.title as string) ?? `HTTP ${xhr.status}`,
          body.detail as string | undefined,
          (body.errors as ApiError['fieldErrors']) ?? [],
          xhr.getResponseHeader('x-request-id'),
        ),
      );
    };
    signal?.addEventListener('abort', () => xhr.abort());
    const form = new FormData();
    form.append('file', file, file.name);
    xhr.send(form);
  });
}
