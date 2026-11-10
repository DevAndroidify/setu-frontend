import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useStrings } from '../../i18n/language';
import { Button, EmptyState, MarginNote, PageHeader, TextAreaField } from '../../ui/controls';
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
} from './api';
import { type FieldMatch, fieldMatch } from './compare';
import styles from './matches.module.css';

/** Fields written in Nepali, marked so screen readers pronounce them as Nepali. */
const NEPALI = new Set<keyof MatchRow>(['name_ne', 'father_name_ne']);
const show = (v: MatchRow[keyof MatchRow]) => (v === null || v === '' ? '—' : String(v));
const text = (v: MatchRow[keyof MatchRow]) => (typeof v === 'string' ? v : null);

/** One pair side by side: the held row, and the record it may be (tinted). */
function Comparison({ candidate }: { candidate: MatchCandidate }) {
  const t = useStrings().matches;
  const { row, match, features } = candidate;
  const inRegister = match.status === 'loaded' && match.runId !== row.runId;
  const citizenship: FieldMatch =
    features.citizenship === 'same'
      ? 'same'
      : features.citizenship === 'different'
        ? 'different'
        : 'unknown';
  const label = (m: FieldMatch) => <span className={styles[`m-${m}`]}>{t.match[m]}</span>;
  return (
    <div className={styles.compareWrap}>
      <div className={ui.tableWrap}>
        <table className={styles.compare}>
          <thead>
            <tr>
              <th scope="col">
                <span className="visually-hidden">Field</span>
              </th>
              <th scope="col">
                <span className={styles.heldLabel}>{t.heldFrom}</span>
                <span className={styles.sideName}>{t.row(formatNumber(row.rowNo))}</span>
              </th>
              <th scope="col" className={styles.register}>
                <span className={styles.registerLabel}>
                  {inRegister ? t.inRegister : t.earlier}
                </span>
                <span className={styles.sideName}>{t.row(formatNumber(match.rowNo))}</span>
              </th>
              <th scope="col" className={styles.matchHead}>
                {t.matchColumn}
              </th>
            </tr>
          </thead>
          <tbody>
            {COMPARED.map(({ key, label: fallback }) => {
              const m = fieldMatch(key, text(row[key]), text(match[key]), features);
              const lang = NEPALI.has(key) ? 'ne' : undefined;
              const cell = m === 'different' ? styles.differs : undefined;
              return (
                <tr key={key} data-match={m}>
                  <th scope="row">{t.field[key] ?? fallback}</th>
                  <td lang={lang} className={cell}>
                    {show(row[key])}
                  </td>
                  <td lang={lang} className={`${styles.register} ${cell ?? ''}`}>
                    {show(match[key])}
                  </td>
                  <td>{label(m)}</td>
                </tr>
              );
            })}
            <tr data-match={citizenship}>
              <th scope="row">{t.citizenship}</th>
              <td>{row.hasCitizenshipNo ? t.hasOne : t.noneOnFile}</td>
              <td className={styles.register}>
                {match.hasCitizenshipNo ? t.hasOne : t.noneOnFile}
              </td>
              <td>{label(citizenship)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className={ui.muted}>{t.neverShown}</p>
    </div>
  );
}

function Closeness({ candidate }: { candidate: MatchCandidate }) {
  const t = useStrings().matches;
  const f = candidate.features;
  const bars = [
    { label: t.featureName, value: f.name },
    { label: t.featureDob, value: f.dob },
    { label: t.featureFather, value: f.father },
  ];
  return (
    <section className={styles.closeness} aria-labelledby="closeness-title">
      <h2 id="closeness-title">{t.closeness}</h2>
      <p className={styles.score}>
        <span className={styles.scoreValue}>{candidate.score.toFixed(2)}</span>
        <span className={ui.muted}>{t.outOf}</span>
      </p>
      {bars.map((b) => (
        <div key={b.label} className={styles.feature}>
          <div className={styles.featureHead}>
            <span>{b.label}</span>
            <span className={styles.featureValue}>{b.value.toFixed(2)}</span>
          </div>
          <div className={styles.featureBar} aria-hidden="true">
            <div style={{ width: `${Math.max(0, Math.min(1, b.value)) * 100}%` }} />
          </div>
        </div>
      ))}
      <div className={styles.feature}>
        <div className={styles.featureHead}>
          <span>{t.citizenship}</span>
          <span className={styles.featureValue}>{t.citizenshipState[f.citizenship]}</span>
        </div>
      </div>
    </section>
  );
}

/** The reviewer's queue, one pair at a time: rows held because they may be someone known. */
export function MatchesPage() {
  const strings = useStrings();
  const t = strings.matches;
  const [params] = useSearchParams();
  const runId = params.get('runId') ?? undefined;
  const queryClient = useQueryClient();
  const notify = useToast();
  const [index, setIndex] = useState(0);
  const [reason, setReason] = useState('');

  const matches = useInfiniteQuery({
    queryKey: ['matches', runId],
    queryFn: ({ pageParam }) => listMatches({ runId }, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const pairs = matches.data?.pages.flatMap((p) => p.data) ?? [];
  const at = Math.min(index, Math.max(0, pairs.length - 1));
  const current = pairs[at];
  const decide = useMutation({
    mutationFn: (decision: MatchDecision) => decideMatch(current!.id, decision, reason.trim()),
    onSuccess: async (result) => {
      notify('success', result.decision === 'link' ? t.linked : t.loadedNew);
      setReason('');
      // The decided pair leaves the queue, so the same position now shows the next one.
      await queryClient.invalidateQueries({ queryKey: ['matches'] });
    },
  });
  const errors = fieldErrorsOf(decide.error);

  // Reaching the last pair that is loaded, fetch the next page so "skip" can go on.
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = matches;
  useEffect(() => {
    if (pairs.length > 0 && at >= pairs.length - 1 && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [at, pairs.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const move = (to: number) => {
    setIndex(to);
    setReason('');
    decide.reset();
  };

  if (matches.isPending) return <Spinner label="Loading the review queue" />;
  if (matches.isError)
    return <ProblemMessage error={matches.error} title="Could not load the queue" />;
  if (!current) {
    return (
      <section aria-labelledby="matches-title">
        <PageHeader title={<span id="matches-title">{strings.nav['/matches']?.[0]}</span>} />
        <EmptyState>{t.empty}</EmptyState>
      </section>
    );
  }

  const ready = reason.trim().length >= 3 && !decide.isPending;
  return (
    <section aria-labelledby="matches-title">
      <PageHeader
        title={<span id="matches-title">{t.title}</span>}
        meta={<span>{t.position(at + 1, pairs.length, !!hasNextPage)}</span>}
        actions={
          <span className={styles.pager}>
            <Button variant="link" disabled={at === 0} onClick={() => move(at - 1)}>
              <span aria-hidden="true">← </span>
              {t.previous}
            </Button>
            <Button variant="link" disabled={at >= pairs.length - 1} onClick={() => move(at + 1)}>
              {t.skip}
              <span aria-hidden="true"> →</span>
            </Button>
          </span>
        }
      />
      <div className={styles.layout}>
        <Comparison candidate={current} />
        <aside className={styles.side} aria-label={t.decisionTitle}>
          <Closeness candidate={current} />
          <form
            className={styles.decision}
            aria-labelledby="decision-title"
            onSubmit={(e) => e.preventDefault()}
          >
            <h2 id="decision-title">{t.decisionTitle}</h2>
            {decide.isError && !errors.reason && (
              <ProblemMessage error={decide.error} title="Not recorded" />
            )}
            <TextAreaField
              label={t.reason}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={1000}
              rows={3}
              required
              error={errors.reason}
            />
            <Button className={styles.wide} disabled={!ready} onClick={() => decide.mutate('link')}>
              {decide.isPending && decide.variables === 'link' ? t.recording : t.link}
            </Button>
            <Button
              variant="secondary"
              className={styles.wide}
              disabled={!ready}
              onClick={() => decide.mutate('not_same')}
            >
              {decide.isPending && decide.variables === 'not_same' ? t.recording : t.notSame}
            </Button>
            <MarginNote>{t.note}</MarginNote>
          </form>
        </aside>
      </div>
    </section>
  );
}
