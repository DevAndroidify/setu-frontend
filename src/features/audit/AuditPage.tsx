import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { Alert, Button, EmptyState, PageHeader, TextField } from '../../ui/controls';
import { ProblemMessage } from '../../ui/ProblemMessage';
import { Spinner } from '../../ui/Spinner';
import ui from '../../ui/ui.module.css';
import { formatDateTime, formatNumber } from '../sources/format';
import styles from '../records/records.module.css';
import { type AuditFilter, listEvents, verifyChain } from './api';

const FILTERS: { key: keyof AuditFilter; label: string; hint: string }[] = [
  { key: 'stream', label: 'Stream', hint: '"global", or "run:" followed by a run id' },
  { key: 'action', label: 'Action', hint: 'e.g. run.approved, person.unmasked' },
  { key: 'entity', label: 'Entity', hint: 'e.g. run, person, user' },
  { key: 'entityId', label: 'Entity id', hint: '' },
];

/**
 * The audit trail (newest first) and chain verification. Each event's hash covers the one
 * before it, so verification finds the first event that was changed or removed.
 */
export function AuditPage() {
  const [params, setParams] = useSearchParams();
  const filter: AuditFilter = Object.fromEntries(
    FILTERS.map(({ key }) => [key, params.get(key) ?? undefined]).filter(([, v]) => v),
  );
  const [draft, setDraft] = useState<AuditFilter>(filter);
  const events = useInfiniteQuery({
    queryKey: ['audit', filter],
    queryFn: ({ pageParam }) => listEvents(filter, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const verify = useMutation({ mutationFn: () => verifyChain(filter.stream) });
  const rows = events.data?.pages.flatMap((p) => p.data) ?? [];

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(draft))
      if (value?.trim()) next.set(key, value.trim());
    setParams(next);
    verify.reset();
  }

  return (
    <section aria-labelledby="audit-title">
      <PageHeader title="Audit trail" />
      <section aria-labelledby="verify-title">
        <h2 id="verify-title">Verify the chain</h2>
        <div className={styles.verify}>
          <Button onClick={() => verify.mutate()} disabled={verify.isPending}>
            {verify.isPending
              ? 'Checking every event…'
              : filter.stream
                ? `Verify stream ${filter.stream}`
                : 'Verify every stream'}
          </Button>
        </div>
        {verify.isError && <ProblemMessage error={verify.error} title="Could not verify" />}
        {verify.data &&
          (verify.data.valid ? (
            <Alert kind="success">
              <p>
                <strong>Intact.</strong> {formatNumber(verify.data.eventsChecked)} events in{' '}
                {formatNumber(verify.data.streamsChecked)} streams: every hash matches its event and
                the one before.
              </p>
            </Alert>
          ) : (
            <Alert kind="error">
              <p>
                <strong>The chain is broken</strong> in stream{' '}
                <code>{verify.data.firstBroken?.stream}</code> at event{' '}
                <strong>{verify.data.firstBroken?.seq}</strong>: {verify.data.firstBroken?.reason}.
                That event, or one before it, was changed after it was written.
              </p>
            </Alert>
          ))}
      </section>

      <h2>Events</h2>
      <form className={styles.search} onSubmit={submit} aria-label="Filter events">
        {FILTERS.map(({ key, label, hint }) => (
          <TextField
            key={key}
            label={label}
            hint={hint || undefined}
            value={draft[key] ?? ''}
            onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
          />
        ))}
        <Button type="submit">Filter</Button>
      </form>
      {events.isPending && <Spinner label="Loading events" />}
      {events.isError && <ProblemMessage error={events.error} title="Could not load events" />}
      {events.isSuccess && rows.length === 0 && <EmptyState>No events match.</EmptyState>}
      {rows.length > 0 && (
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Stream · seq</th>
                <th scope="col">Action</th>
                <th scope="col">Entity</th>
                <th scope="col">Reason</th>
                <th scope="col">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={`${e.stream}:${e.seq}`}>
                  <td>{formatDateTime(e.occurredAt)}</td>
                  <td className={styles.mono}>
                    {e.stream} · {String(e.seq)}
                  </td>
                  <td>
                    <code>{e.action}</code>
                    <div className={ui.muted}>
                      {e.actorId ? `by ${e.actorId.slice(0, 8)}` : 'by the system'}
                    </div>
                  </td>
                  <td>
                    {e.entity}
                    {e.entityId && (
                      <div className={`${ui.muted} ${styles.mono}`}>{e.entityId.slice(0, 12)}</div>
                    )}
                  </td>
                  <td>{e.reason ?? '—'}</td>
                  <td>
                    <details>
                      <summary>payload and hash</summary>
                      <pre className={styles.payload}>{JSON.stringify(e.payload, null, 2)}</pre>
                      <div className={styles.mono}>hash {e.hash.slice(0, 16)}…</div>
                      <div className={styles.mono}>prev {e.prevHash.slice(0, 16)}…</div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {events.hasNextPage && (
        <p>
          <Button
            variant="secondary"
            onClick={() => events.fetchNextPage()}
            disabled={events.isFetchingNextPage}
          >
            Show older
          </Button>
        </p>
      )}
    </section>
  );
}
