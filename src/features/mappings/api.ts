import { api } from '../../auth/session';

export type TransformStep = { name: string; args?: unknown };

export type FieldSpec = {
  target: string;
  from: string[];
  transforms: TransformStep[];
  rules: string[];
  onError: 'quarantine' | 'null';
};

export type MappingSpec = { fields: FieldSpec[] };

export type Mapping = {
  id: string;
  sourceId: string;
  version: number;
  spec: MappingSpec;
  createdBy: string;
  createdAt: string;
};

/** A JSON Schema, as much of it as the editor reads. */
export type ArgsSchema = {
  type?: string;
  properties?: Record<string, ArgsSchema & { enum?: string[]; items?: ArgsSchema }>;
  required?: string[];
  anyOf?: ArgsSchema[];
};

export type Catalog = {
  targets: string[];
  requiredTargets: string[];
  transforms: { name: string; args: ArgsSchema }[];
  rules: { name: string; param: 'date' | 'number' | null }[];
  bsDateFormats: string[];
  onError: ('quarantine' | 'null')[];
};

export type FieldIssue = { field: string; stage: 'transform' | 'validate'; message: string };

export type PreviewRow = {
  rowNo: number;
  raw: Record<string, string>;
  values: Record<string, string | null>;
  warnings: FieldIssue[];
  errors: FieldIssue[];
  status: 'valid' | 'quarantined';
};

export type Preview = {
  mappingId: string | null;
  version: number | null;
  sourceFileId: string;
  summary: { rows: number; valid: number; quarantined: number };
  rows: PreviewRow[];
};

export const getCatalog = () => api<Catalog>('/mappings/catalog');

export const listMappings = (sourceId: string) => api<Mapping[]>(`/sources/${sourceId}/mappings`);

export const getMapping = (id: string) => api<Mapping>(`/mappings/${id}`);

export const saveMapping = (sourceId: string, spec: MappingSpec) =>
  api<Mapping>(`/sources/${sourceId}/mappings`, { method: 'POST', body: JSON.stringify(spec) });

export const previewDraft = (sourceId: string, spec: MappingSpec, sourceFileId: string) =>
  api<Preview>(`/sources/${sourceId}/mappings/preview`, {
    method: 'POST',
    body: JSON.stringify({ spec, sourceFileId }),
  });

export const previewMapping = (mappingId: string, sourceFileId: string) =>
  api<Preview>(`/mappings/${mappingId}/preview`, {
    method: 'POST',
    body: JSON.stringify({ sourceFileId }),
  });
