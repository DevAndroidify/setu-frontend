import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { useAuth } from '../../auth/context';
import { useStrings } from '../../i18n/language';
import { listApprovals, pendingOf } from '../approvals/api';
import { ApprovalHistory } from '../approvals/ApprovalHistory';
import { DecisionControls } from '../approvals/DecisionControls';
import { RollbackControl } from '../approvals/RollbackControl';
import { getMapping, previewMapping } from '../mappings/api';
import { listQuarantine, type QuarantineEntry } from '../quarantine/api';
import {
  Alert,
  Button,
  Counters,
  MarginNote,
  PageHeader,
  Raw,
  StatusMark,
} from '../../ui/controls';
import { ProblemMessage } from '../../ui/ProblemMessage';
import { Spinner } from '../../ui/Spinner';
import { useToast } from '../../ui/toast-context';
import { formatDateTime, formatNumber } from '../sources/format';
import { ACTIVE, type RunAction, runAction, type RunDetail } from './api';
import { fixExamples, heldReasons, rowSplit, stageProgress } from './insights';
import styles from './runs.module.css';
import ui from '../../ui/ui.module.css';
import { ACTION_LABELS, availableActions, STATUS, STATUS_MARK } from './status';
import { useLiveRun } from './useLiveRun';

/** Held rows read for the reasons summary: up to four pages of fifty. */
const HELD_PAGES = 4;

const SEGMENT_CLASS = {
  loaded: styles.segLoaded,
  linked: styles.segLinked,
  passed: styles.segLoaded,
  held: styles.segHeld,
  review: styles.segReview,
} as const;

/** The counter strip and one full-width bar of where every row went. */
function RowCounts({ run }: { run: RunDetail }) {
  const t = useStrings().run;
  const split = rowSplit(run);
  const value = (kind: string) => split.parts.find((p) => p.kind === kind)?.value ?? 0;
  const items =
    run.mode === 'production'
      ? [
          { label: t.rowsInFile, value: split.total },
          {
            label: t.loaded,
            value: value('loaded'),
            note: value('linked') > 0 ? t.linkedNote(formatNumber(value('linked'))) : undefined,
            highlight: true,
          },
          { label: t.held, value: value('held'), tone: 'held' as const },
          { label: t.review, value: value('review') },
          { label: t.toGo, value: split.toGo, tone: 'muted' as const },
        ]
      : [
          { label: t.rowsInFile, value: split.total },
          { label: t.passed, value: value('passed'), highlight: true },
          { label: t.held, value: value('held'), tone: 'held' as const },
          { label: t.toGo, value: split.toGo, tone: 'muted' as const },
        ];
  const pct = (n: number) => (split.total ? Math.round((n / split.total) * 100) : 0);
  const described = [
    ...split.parts.map((p) => t.percent(pct(p.value), t.barPart[p.kind])),
    t.percent(pct(split.toGo), t.barPart.toGo),
  ].join(', ');
  return (
    <section className={styles.counts} aria-label={t.countsLabel}>
      <Counters label={t.countsLabel} items={items} />
      {split.total > 0 && (
        <div className={styles.bar} role="img" aria-label={described}>
          {split.parts.map(
            (p) =>
              p.value > 0 && (
                <span
                  key={p.kind}
                  className={SEGMENT_CLASS[p.kind]}
                  style={{ width: `${(p.value / split.total) * 100}%` }}
                />
              ),
          )}
          <span className={styles.segRest} />
        </div>
      )}
    </section>
  );
}

function Stages({ run, live }: { run: RunDetail; live: boolean }) {
  const strings = useStrings();
  const t = strings.run;
  const stages = stageProgress(run);
  const names: Record<string, string> = {
    extract: strings.stages[0]![0],
    transform: strings.stages[1]![0],
    validate: strings.stages[2]![0],
    match: strings.stages[3]![0],
    load: strings.stages[4]![0],
    reconcile: t.reconcile,
  };
  const total = stages[0]?.total ?? 0;
  const done = stages.find((s) => s.stage === (run.mode === 'production' ? 'load' : 'validate'));
  return (
    <section className={styles.stagesBlock} aria-labelledby="stages-title">
      <div className={styles.blockHead}>
        <h2 id="stages-title">{t.stagesTitle}</h2>
        {total > 0 && (
          <span className={ui.muted}>
            {t.batchesDone(done?.done ?? 0, total)}
            {live && ` · ${t.updatesLive}`}
          </span>
        )}
      </div>
      <ol className={styles.stages}>
        {stages.map((s) => (
          <li key={s.stage} className={s.state === 'now' ? styles.stageNow : styles.stage}>
            <div className={styles.stageHead}>
              <span className={styles.stageName}>{names[s.stage]}</span>
              <span className={s.state === 'now' ? styles.stateNow : styles.state}>
                {t.stageState[s.state]}
              </span>
            </div>
            <span className={styles.stageCount}>
              {s.done}
              <span className={styles.stageTotal}> / {s.total}</span>
            </span>
            <div className={styles.stageBar} aria-hidden="true">
              <div
                className={s.state === 'done' ? styles.stageFillDone : styles.stageFill}
                style={{ width: `${s.total ? (s.done / s.total) * 100 : 0}%` }}
              />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Reasons from the first pages of this run's held rows, grouped by field and message. */
function HeldReasons({ run }: { run: RunDetail }) {
  const t = useStrings().run;
  const going = ACTIVE.includes(run.status);
  const held = useQuery({
    queryKey: ['run-held', run.id],
    queryFn: async () => {
      const entries: QuarantineEntry[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < HELD_PAGES; page++) {
        const result = await listQuarantine({ runId: run.id }, cursor);
        entries.push(...result.data.filter((e) => !e.resolvedAt));
        if (!result.nextCursor) return { entries, complete: true };
        cursor = result.nextCursor;
      }
      return { entries, complete: false };
    },
    refetchInterval: going ? 15_000 : false,
  });
  const total = run.progress.quarantined;
  const groups = held.data ? heldReasons(held.data.entries) : [];
  const widest = groups[0]?.count ?? 1;
  return (
    <section className={styles.held} aria-labelledby="held-title">
      <div className={styles.blockHead}>
        <h2 id="held-title">{t.heldTitle(total, formatNumber(total))}</h2>
        <Link to={`/quarantine?runId=${run.id}`}>{t.openQuarantine}</Link>
      </div>
      {groups.length > 0 && (
        <ul className={styles.reasons}>
          {groups.map((g) => (
            <li key={`${g.field}:${g.message}`}>
              <span>
                <Raw>{g.field}</Raw> {g.message}
              </span>
              <span className={styles.reasonCount}>{formatNumber(g.count)}</span>
              <div className={styles.reasonBar} aria-hidden="true">
                <div style={{ width: `${(g.count / widest) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {held.data && !held.data.complete && (
        <p className={ui.muted}>{t.heldSample(formatNumber(held.data.entries.length))}</p>
      )}
      <MarginNote>{t.heldNote}</MarginNote>
    </section>
  );
}

/** One before → after for each kind of fix, from this run's mapping applied to its file. */
function FixedOnTheWay({ run }: { run: RunDetail }) {
  const t = useStrings().run;
  const examples = useQuery({
    queryKey: ['run-fixes', run.mappingId, run.sourceFileId],
    queryFn: async () => {
      const [mapping, preview] = await Promise.all([
        getMapping(run.mappingId),
        previewMapping(run.mappingId, run.sourceFileId),
      ]);
      return fixExamples(mapping.spec, preview.rows);
    },
    staleTime: Infinity,
  });
  if (!examples.data?.length) return null;
  return (
    <section className={styles.fixed} aria-labelledby="fixed-title">
      <h2 id="fixed-title">{t.fixedTitle}</h2>
      <dl className={styles.fixes}>
        {examples.data.map((e) => (
          <div key={e.kind}>
            <dt>{t.fixKind[e.kind]}</dt>
            <dd>
              <Raw>{e.before}</Raw>
              <span aria-hidden="true" className={ui.muted}>
                →
              </span>
              <span className={styles.after}>{e.after}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className={ui.muted}>{t.fixedNote}</p>
    </section>
  );
}

export function RunPage() {
  const { runId = '' } = useParams();
  const { user } = useAuth();
  const t = useStrings().run;
  const queryClient = useQueryClient();
  const notify = useToast();
  const run = useLiveRun(runId);
  const approvals = useQuery({
    queryKey: ['approvals', runId],
    queryFn: () => listApprovals(runId),
    enabled: run.data?.mode === 'production',
  });
  const act = useMutation({
    mutationFn: (action: RunAction) => runAction(runId, action),
    onSuccess: async (_r, action) => {
      notify('success', `${ACTION_LABELS[action]}: done.`);
      await queryClient.invalidateQueries({ queryKey: ['run', runId] });
      await queryClient.invalidateQueries({ queryKey: ['runs'] });
    },
  });

  if (run.isPending) return <Spinner label="Loading the run" />;
  if (run.isError) return <ProblemMessage error={run.error} title="Could not load the run" />;
  const r = run.data;
  const actions = user ? availableActions(r, user.role) : [];
  const role = user?.role;
  // Held rows and mapping previews are for the officers who fix them (backend role guards).
  const operates = role === 'operator' || role === 'admin';
  const started = !['draft', 'awaiting_approval', 'approved'].includes(r.status);
  const canRollBack =
    role === 'approver' &&
    r.mode === 'production' &&
    ['completed', 'cancelled', 'failed'].includes(r.status);
  const hasReport = role === 'auditor' && (r.status === 'completed' || r.status === 'rolled_back');

  return (
    <section aria-labelledby="run-title">
      <PageHeader
        title={<span id="run-title">{r.source.name}</span>}
        back={{ to: '/runs', label: t.back }}
        meta={
          <>
            <span>{t.mode[r.mode]}</span>
            <Raw>{r.file.filename}</Raw>
            <Link to={`/sources/${r.source.id}/mappings/${r.mappingId}`}>
              {t.mappingVersion(r.mappingVersion)}
            </Link>
            {r.approvedBy && <span>{t.approved}</span>}
          </>
        }
        actions={
          <>
            <span className={styles.statusChip}>
              <StatusMark kind={STATUS_MARK[r.status]}>{STATUS[r.status].label}</StatusMark>
              {run.live && <span className={styles.live}>· {t.live}</span>}
            </span>
            {hasReport && (
              <Link className={`${ui.button} ${ui.primary}`} to={`/runs/${r.id}/reconciliation`}>
                Reconciliation report
              </Link>
            )}
            {canRollBack && <RollbackControl run={r} />}
            {actions.map((a) => (
              <Button
                key={a}
                variant={a === 'cancel' ? 'link' : a === 'pause' ? 'secondary' : 'primary'}
                disabled={act.isPending}
                onClick={() => act.mutate(a)}
              >
                {ACTION_LABELS[a]}
              </Button>
            ))}
          </>
        }
      />
      {act.isError && <ProblemMessage error={act.error} title="That did not work" />}
      {r.status === 'awaiting_approval' && role !== 'approver' && (
        <Alert kind="info">
          <p>Waiting for an approver. It cannot be approved by whoever created or submitted it.</p>
        </Alert>
      )}
      {r.status === 'awaiting_approval' && role === 'approver' && approvals.data && (
        <section aria-label="Decision" className={styles.decision}>
          <p>This production run is waiting for your decision.</p>
          <DecisionControls run={r} pending={pendingOf(approvals.data)} />
        </section>
      )}
      {r.status === 'rolled_back' && (
        <Alert kind="info">
          <p>Rolled back: the records it loaded were removed. Its report and audit trail remain.</p>
        </Alert>
      )}
      {r.status === 'approved' && (
        <Alert kind="success">
          <p>Approved. Start it within 24 hours, or the approval expires.</p>
        </Alert>
      )}
      {r.status === 'failed' && (
        <Alert kind="error">
          <p>
            The run failed. Its audit trail has the reason; rows already loaded stay until the run
            is rolled back.
          </p>
        </Alert>
      )}

      <RowCounts run={r} />
      <Stages run={r} live={run.live} />

      {operates && started && (
        <div className={styles.lower}>
          {r.progress.quarantined > 0 && <HeldReasons run={r} />}
          <FixedOnTheWay run={r} />
        </div>
      )}

      <dl className={styles.facts}>
        <div>
          <dt>Source</dt>
          <dd>
            <Link to={`/sources/${r.source.id}`}>{r.source.name}</Link>
          </dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{formatDateTime(r.createdAt)}</dd>
        </div>
        {r.startedAt && (
          <div>
            <dt>Started</dt>
            <dd>{formatDateTime(r.startedAt)}</dd>
          </div>
        )}
        {r.finishedAt && (
          <div>
            <dt>Finished</dt>
            <dd>{formatDateTime(r.finishedAt)}</dd>
          </div>
        )}
      </dl>
      {r.mode === 'production' && <ApprovalHistory runId={r.id} />}
    </section>
  );
}
