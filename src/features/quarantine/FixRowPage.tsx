import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../../auth/context';
import { useStrings } from '../../i18n/language';
import { Alert, Button, MarginNote, PageHeader, Raw, StatusMark } from '../../ui/controls';
import { ProblemMessage } from '../../ui/ProblemMessage';
import { Spinner } from '../../ui/Spinner';
import { useToast } from '../../ui/toast-context';
import ui from '../../ui/ui.module.css';
import { getMapping } from '../mappings/api';
import { valueKey } from '../mappings/spec';
import { getRun } from '../runs/api';
import { formatNumber } from '../sources/format';
import { correctEntry, getEntry, listQuarantine, retryRows, retrySummary } from './api';
import { columnPlan, maskCitizenship, withoutStep } from './fix-plan';
import styles from './quarantine.module.css';

/**
 * One held row, column by column: what the old file says, what Setu made of it, and a fix for
 * the columns behind a failing field. Saving runs every check again on the fix; sending it
 * through again retries the row in its run. The old file's value is never changed.
 */
export function FixRowPage() {
  const { entryId = '' } = useParams();
  const { user } = useAuth();
  const t = useStrings().fix;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useToast();
  const entry = useQuery({
    queryKey: ['quarantine-entry', entryId],
    queryFn: () => getEntry(entryId),
  });
  const runId = entry.data?.runId;
  const run = useQuery({
    queryKey: ['run', runId],
    queryFn: () => getRun(runId!),
    enabled: !!runId,
  });
  const mapping = useQuery({
    queryKey: ['mapping', run.data?.mappingId],
    queryFn: () => getMapping(run.data!.mappingId),
    enabled: !!run.data,
  });
  // The run's first page of held rows, for "1 of N" and the next one.
  const siblings = useQuery({
    queryKey: ['quarantine', 'siblings', runId],
    queryFn: () => listQuarantine({ runId }),
    enabled: !!runId,
  });
  const [edits, setEdits] = useState<Record<string, string>>({});

  const check = useMutation({
    mutationFn: () => correctEntry(entryId, edits),
    onSuccess: async () => {
      setEdits({});
      await queryClient.invalidateQueries({ queryKey: ['quarantine-entry', entryId] });
    },
  });
  const retry = useMutation({
    mutationFn: () => retryRows(entry.data!.runId, [entryId]),
    onSuccess: async (result) => {
      notify(result.passed ? 'success' : 'info', retrySummary(result));
      await queryClient.invalidateQueries({ queryKey: ['quarantine'] });
      if (result.passed) navigate(`/quarantine?runId=${entry.data!.runId}`);
      else await queryClient.invalidateQueries({ queryKey: ['quarantine-entry', entryId] });
    },
  });

  if (entry.isPending) return <Spinner label="Loading the row" />;
  if (entry.isError) return <ProblemMessage error={entry.error} title="Could not load the row" />;
  const e = entry.data;
  const canFix = user?.role === 'operator' && !e.resolvedAt && run.data?.status === 'completed';
  const fields = mapping.data?.spec.fields ?? [];
  const plan = columnPlan(e, fields);
  const citizenshipKey = valueKey('person.citizenship_no');
  const dirty = Object.keys(edits).length > 0;
  const busy = check.isPending || retry.isPending;

  const held = (siblings.data?.data ?? []).filter((s) => !s.resolvedAt);
  const at = held.findIndex((s) => s.id === e.id);
  const next = at >= 0 ? held[at + 1] : held.find((s) => s.id !== e.id);
  const heldTotal = Math.max(run.data?.progress.quarantined ?? 0, held.length);

  function saveOnly(event: FormEvent) {
    event.preventDefault();
    check.mutate();
  }

  async function saveAndRetry() {
    if (dirty) {
      const saved = await check.mutateAsync().catch(() => null);
      if (!saved || saved.result.status !== 'valid') return;
    }
    retry.mutate();
  }

  const result = check.data?.result;
  const row = formatNumber(e.rowNo);
  return (
    <section aria-labelledby="fix-title">
      <PageHeader
        title={
          <span id="fix-title">
            {e.resolvedAt ? t.resolved(row) : t.title(row, e.reasons.length)}
          </span>
        }
        back={{ to: `/quarantine?runId=${e.runId}`, label: t.back(run.data?.source.name) }}
        meta={
          run.data && (
            <>
              <Link to={`/runs/${e.runId}`}>run {e.runId.slice(0, 8)}</Link>
              <Raw>{run.data.file.filename}</Raw>
            </>
          )
        }
        actions={
          held.length > 0 && (
            <span className={styles.position}>
              {at >= 0 && <span>{t.position(formatNumber(at + 1), formatNumber(heldTotal))}</span>}
              {next && (
                <Link to={`/quarantine/${next.id}`}>
                  {t.next} <span aria-hidden="true">→</span>
                </Link>
              )}
            </span>
          )
        }
      />
      {e.resolvedAt && (
        <Alert kind="success">
          <p>This row was fixed and placed.</p>
        </Alert>
      )}
      {run.data && run.data.status !== 'completed' && !e.resolvedAt && (
        <Alert kind="info">
          <p>
            Rows can be fixed once their run has completed (this one is{' '}
            {run.data.status.replace('_', ' ')}).
          </p>
        </Alert>
      )}

      <div className={styles.fixLayout}>
        <form className={styles.fixTable} onSubmit={saveOnly} aria-labelledby="values-title">
          <div className={styles.blockHead}>
            <h2 id="values-title">{t.tableTitle}</h2>
            <span className={ui.muted}>{t.tableHint}</span>
          </div>
          <div className={ui.tableWrap}>
            <table className={`${ui.table} ${styles.values}`}>
              <thead>
                <tr>
                  <th scope="col">{t.column}</th>
                  <th scope="col">{t.raw}</th>
                  <th scope="col">{t.made}</th>
                  <th scope="col">{t.yourFix}</th>
                </tr>
              </thead>
              <tbody>
                {plan.map((c) => {
                  const masked = c.reads.includes(citizenshipKey);
                  const show = (v: string) => (masked ? maskCitizenship(v) : v);
                  const corrected = e.corrected?.[c.column];
                  const value =
                    edits[c.column] ?? corrected ?? (masked ? '' : (e.raw[c.column] ?? ''));
                  return (
                    <tr key={c.column} className={c.failing ? styles.failing : undefined}>
                      <th scope="row">
                        <Raw>{c.column}</Raw>
                      </th>
                      <td>
                        {e.raw[c.column] ? (
                          <Raw>{show(e.raw[c.column]!)}</Raw>
                        ) : (
                          <span className={ui.muted}>{t.empty}</span>
                        )}
                      </td>
                      <td className={c.failing ? styles.madeFailing : undefined}>
                        {c.problems.length > 0
                          ? c.problems.map((p) => <div key={p}>{withoutStep(p)}</div>)
                          : c.made.length > 0
                            ? c.made.map((m) => <div key={m}>{masked ? t.masked : m}</div>)
                            : c.reads.length === 0 && <span className={ui.muted}>{t.notRead}</span>}
                      </td>
                      <td>
                        {c.editable && canFix && !mapping.isPending ? (
                          <label className={styles.fixInput}>
                            {t.newValue(c.column)}
                            <input
                              className={ui.input}
                              value={value}
                              autoComplete="off"
                              onChange={(ev) => setEdits({ ...edits, [c.column]: ev.target.value })}
                            />
                          </label>
                        ) : c.failing && corrected !== undefined ? (
                          <Raw>{show(corrected)}</Raw>
                        ) : c.failing ? (
                          // A fix is needed here, but cannot be made now (run not completed, role).
                          <span className={ui.muted}>—</span>
                        ) : (
                          <span className={ui.muted}>{t.noChange}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <MarginNote>{t.note}</MarginNote>
        </form>

        <aside className={styles.side} aria-label={t.whyTitle}>
          <section className={styles.why} aria-labelledby="why-title">
            <h2 id="why-title">{t.whyTitle}</h2>
            <ol className={styles.whyList}>
              {e.reasons.map((r, i) => (
                <li key={`${r.field}:${r.message}`}>
                  <span className={styles.reasonNo} aria-hidden="true">
                    {i + 1}
                  </span>
                  <span>
                    <Raw>{r.field}</Raw> {withoutStep(r.message)}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          {canFix && (
            <section className={styles.withFix} aria-labelledby="check-title">
              <h2 id="check-title">{t.withFix}</h2>
              {result ? (
                <>
                  <dl className={styles.result}>
                    {Object.entries(result.values)
                      .filter(([, v]) => v !== null)
                      .map(([field, v]) => (
                        <div key={field}>
                          <dt>
                            <Raw>{field}</Raw>
                          </dt>
                          <dd>{field === citizenshipKey ? maskCitizenship(v!) : v}</dd>
                        </div>
                      ))}
                  </dl>
                  {result.status === 'valid' ? (
                    <p className={styles.passes}>
                      <StatusMark kind="loaded">{t.passes}</StatusMark>
                    </p>
                  ) : (
                    <div role="alert" className={styles.fails}>
                      <StatusMark kind="held">{t.stillFails}</StatusMark>
                      <ul>
                        {result.errors.map((r) => (
                          <li key={`${r.field}:${r.message}`}>
                            <Raw>{r.field}</Raw> {withoutStep(r.message)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <p className={ui.muted}>{t.withFixHint}</p>
              )}
              {check.isError && <ProblemMessage error={check.error} title="Not saved" />}
              {retry.isError && <ProblemMessage error={retry.error} title="Retry failed" />}
              <Button
                className={styles.wide}
                onClick={() => void saveAndRetry()}
                disabled={
                  busy ||
                  !(dirty || ((e.corrected || check.data) && result?.status !== 'quarantined'))
                }
              >
                {busy ? t.saving : t.saveAndRetry}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className={styles.wide}
                onClick={() => check.mutate()}
                disabled={busy || !dirty}
              >
                {t.saveOnly}
              </Button>
              <p className={ui.muted}>{t.savedNote}</p>
            </section>
          )}
        </aside>
      </div>
    </section>
  );
}
