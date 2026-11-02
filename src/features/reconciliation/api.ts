import { api } from '../../auth/session';

/** The backend's reconciliation report of a completed run (src/modules/reconciliation). */
export type Report = {
  runId: string;
  mode: 'dry_run' | 'production';
  ok: boolean;
  counts: {
    profiled: number | null;
    extracted: number;
    loaded: number;
    linked: number;
    quarantined: number;
    pendingReview: number;
    valid: number;
    balanced: boolean;
    problems: string[];
  };
  checksums: { field: string; source: string; target: string; match: boolean }[] | null;
  sample: {
    size: number;
    rowNos: number[];
    mismatches: { rowNo: number; field: string; source: string | null; target: string | null }[];
  } | null;
};

export const getReport = (runId: string) => api<Report>(`/runs/${runId}/reconciliation`);

/** Fetches the CSV with the signed-in user's token and hands it to the browser as a download. */
export async function downloadReportCsv(runId: string): Promise<void> {
  const csv = await api<string>(`/runs/${runId}/reconciliation?format=csv`, {
    headers: { Accept: 'text/csv' },
  });
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `reconciliation-${runId}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
