import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { Badge, Button, EmptyState, PageHeader, TextAreaField } from '../../ui/controls';
import { Dialog } from '../../ui/Dialog';
import { fieldErrorsOf } from '../../ui/field-errors';
import { ProblemMessage } from '../../ui/ProblemMessage';
import { Spinner } from '../../ui/Spinner';
import { useToast } from '../../ui/toast-context';
import ui from '../../ui/ui.module.css';
import { formatNumber } from '../sources/format';
import {
  COMPARED,
  decideMatch,
  listMatches,
  type MatchCandidate,
  type MatchDecision,
  type MatchRow,
  scoreWords,
} from './api';
import styles from './matches.module.css';

const show = (v: MatchRow[keyof MatchRow]) => (v === null || v === '' ? '—' : String(v));
const origin = (r: MatchRow, other: MatchRow) =>
  r.status === 'loaded' && r.runId !== other.runId
    ? 'In the register (an earlier run)'
    : `Row ${formatNumber(r.rowNo)} of this run`;

function Pair({
  candidate,
  onDecide,
}: {
  candidate: MatchCandidate;
  onDecide: (d: MatchDecision) => void;
}) {
  const { row, match, features } = candidate;
  return (
    <article className={styles.card} aria-label={`Possible duplicate: ${row.name_en}`}>
      <header className={styles.cardHead}>
        <div>
          <strong>{Math.round(candidate.score * 100)}%</strong>{' '}
          <span className={ui.muted}>{scoreWords(candidate.score)}</span>
        </div>
        <div className={styles.features}>
          <Badge tone={features.name >= 0.95 ? 'success' : 'warning'}>
            name {Math.round(features.name * 100)}%
          </Badge>
          <Badge tone={features.dob === 1 ? 'success' : features.dob === 0 ? 'danger' : 'neutral'}>
            {features.dob === 1
              ? 'same birth date'
              : features.dob === 0
                ? 'different birth date'
                : 'birth date unknown'}
          </Badge>
          <Badge tone={features.father >= 0.95 ? 'success' : 'warning'}>
            father {Math.round(features.father * 100)}%
          </Badge>
          {features.citizenship === 'same' && <Badge tone="success">same citizenship number</Badge>}
        </div>
      </header>
      <table className={`${ui.table} ${styles.compare}`}>
        <thead>
          <tr>
            <th scope="col">
              <span className="visually-hidden">Field</span>
            </th>
            <th scope="col">Held row · {origin(row, match)}</th>
            <th scope="col">Possible match · {origin(match, row)}</th>
          </tr>
        </thead>
        <tbody>
          {COMPARED.map(({ key, label }) => {
            const differs = show(row[key]) !== show(match[key]);
            return (
              <tr key={key} className={differs ? styles.differs : undefined}>
                <th scope="row">
                  {label}
                  {differs && <span className="visually-hidden"> (differs)</span>}
                </th>
                <td>{show(row[key])}</td>
                <td>{show(match[key])}</td>
              </tr>
            );
          })}
          <tr>
            <th scope="row">Citizenship number</th>
            <td>{row.hasCitizenshipNo ? 'recorded' : 'none'}</td>
            <td>{match.hasCitizenshipNo ? 'recorded' : 'none'}</td>
          </tr>
        </tbody>
      </table>
      <div className={styles.decide}>
        <Button onClick={() => onDecide('link')}>Same person: link…</Button>
        <Button variant="secondary" onClick={() => onDecide('not_same')}>
          Different people…
        </Button>
      </div>
    </article>
  );
}

const COPY: Record<MatchDecision, { title: string; button: string; hint: string }> = {
  link: {
    title: 'Link to the existing record',
    button: 'Link',
    hint: 'The held row becomes part of that record’s history; no new record is created.',
  },
  not_same: {
    title: 'Load as a different person',
    button: 'Load as new',
    hint: 'The held row is loaded as a new record.',
  },
};

/** The reviewer's queue: rows the matcher held because they may be a person already known. */
export function MatchesPage() {
  const [params] = useSearchParams();
  const runId = params.get('runId') ?? undefined;
  const queryClient = useQueryClient();
  const notify = useToast();
  const [deciding, setDeciding] = useState<{
    candidate: MatchCandidate;
    decision: MatchDecision;
  } | null>(null);
  const [reason, setReason] = useState('');

  const matches = useInfiniteQuery({
    queryKey: ['matches', runId],
    queryFn: ({ pageParam }) => listMatches({ runId }, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const decide = useMutation({
    mutationFn: () => decideMatch(deciding!.candidate.id, deciding!.decision, reason.trim()),
    onSuccess: async (result) => {
      notify(
        'success',
        result.decision === 'link' ? 'Linked to the existing record.' : 'Loaded as a new person.',
      );
      setDeciding(null);
      setReason('');
      await queryClient.invalidateQueries({ queryKey: ['matches'] });
    },
  });
  const rows = matches.data?.pages.flatMap((p) => p.data) ?? [];
  const close = () => {
    setDeciding(null);
    decide.reset();
  };
  const errors = fieldErrorsOf(decide.error);

  function submit(event: FormEvent) {
    event.preventDefault();
    decide.mutate();
  }

  return (
    <section aria-labelledby="matches-title">
      <PageHeader title="Duplicate review" />
      <p className={ui.muted}>
        Each pair scored between 80% and 95%: alike enough to hold, not enough to link without a
        person deciding. Differences are highlighted. Citizenship numbers are never shown here.
      </p>
      {matches.isPending && <Spinner label="Loading the review queue" />}
      {matches.isError && <ProblemMessage error={matches.error} title="Could not load the queue" />}
      {matches.isSuccess && rows.length === 0 && (
        <EmptyState>Nothing is waiting for review.</EmptyState>
      )}
      {rows.map((c) => (
        <Pair
          key={c.id}
          candidate={c}
          onDecide={(decision) => setDeciding({ candidate: c, decision })}
        />
      ))}
      {matches.hasNextPage && (
        <p>
          <Button
            variant="secondary"
            onClick={() => matches.fetchNextPage()}
            disabled={matches.isFetchingNextPage}
          >
            Show more
          </Button>
        </p>
      )}
      {deciding && (
        <Dialog title={COPY[deciding.decision].title} onClose={close}>
          <form onSubmit={submit}>
            {decide.isError && !errors.reason && (
              <ProblemMessage error={decide.error} title="Not recorded" />
            )}
            <TextAreaField
              label="Reason"
              hint={`${COPY[deciding.decision].hint} The reason is kept in the run’s audit trail.`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={1000}
              error={errors.reason}
            />
            <div className={ui.dialogActions}>
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={reason.trim().length < 3 || decide.isPending}>
                {decide.isPending ? 'Recording…' : COPY[deciding.decision].button}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </section>
  );
}
