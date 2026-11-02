import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { useAuth } from '../../auth/context';
import type { Role } from '../../auth/session';
import { Alert, Badge, Button, PageHeader, TextAreaField } from '../../ui/controls';
import { Dialog } from '../../ui/Dialog';
import { fieldErrorsOf } from '../../ui/field-errors';
import { ProblemMessage } from '../../ui/ProblemMessage';
import { Spinner } from '../../ui/Spinner';
import ui from '../../ui/ui.module.css';
import { GENDER, getLineage, getPerson, unmaskPerson } from './api';
import styles from './records.module.css';

const MAY_UNMASK: Role[] = ['reviewer', 'auditor'];
const SEES_RUNS: Role[] = ['operator', 'approver', 'auditor', 'admin'];

/** Where the record came from: every source row behind it (auditors only). */
function Lineage({ personId }: { personId: string }) {
  const lineage = useQuery({
    queryKey: ['lineage', personId],
    queryFn: () => getLineage(personId),
  });
  return (
    <section aria-labelledby="lineage-title">
      <h2 id="lineage-title">Lineage</h2>
      {lineage.isPending && <Spinner label="Loading lineage" />}
      {lineage.isError && <ProblemMessage error={lineage.error} title="Could not load lineage" />}
      {lineage.data && (
        <>
          <p className={ui.muted}>
            The legacy rows behind this record: the one that created it, then any later rows linked
            to it as the same person.
          </p>
          <table className={ui.table}>
            <thead>
              <tr>
                <th scope="col">Source row</th>
                <th scope="col">Run</th>
                <th scope="col">Batch</th>
              </tr>
            </thead>
            <tbody>
              {lineage.data.map((l, i) => (
                <tr key={l.rawRowId}>
                  <td className={styles.mono}>
                    #{l.rawRowId} {i === 0 && <Badge>created the record</Badge>}
                  </td>
                  <td>
                    <Link to={`/runs/${l.runId}`} className={styles.mono}>
                      {l.runId.slice(0, 8)}
                    </Link>
                  </td>
                  <td className={styles.mono}>{l.batchId.slice(0, 8)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

export function PersonPage() {
  const { personId = '' } = useParams();
  const { user } = useAuth();
  const person = useQuery({ queryKey: ['person', personId], queryFn: () => getPerson(personId) });
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  // The full number lives only in this component's memory, never in the query cache.
  const unmask = useMutation({ mutationFn: () => unmaskPerson(personId, reason.trim()) });
  const fullNumber = unmask.data?.citizenship_no ?? null;

  if (person.isPending) return <Spinner label="Loading the record" />;
  if (person.isError)
    return <ProblemMessage error={person.error} title="Could not load the record" />;
  const p = person.data;
  const role = user?.role;
  const errors = fieldErrorsOf(unmask.error);

  function submit(event: FormEvent) {
    event.preventDefault();
    unmask.mutate(undefined, {
      onSuccess: () => {
        setAsking(false);
        setReason('');
      },
    });
  }

  return (
    <section aria-labelledby="person-title">
      <p className={styles.crumbs}>
        <Link to="/persons">Records</Link> /
      </p>
      <PageHeader title={p.name_en} />
      <p lang="ne" className={styles.nepali}>
        {p.name_ne}
      </p>
      <dl className={styles.facts}>
        <div>
          <dt>Gender</dt>
          <dd>{p.gender ? GENDER[p.gender] : '—'}</dd>
        </div>
        <div>
          <dt>Date of birth</dt>
          <dd>
            {p.dob_bs ? `${p.dob_bs} BS` : '—'}
            {p.dob_ad && <div className={ui.muted}>{p.dob_ad} AD</div>}
          </dd>
        </div>
        <div>
          <dt>Father's name</dt>
          <dd lang="ne">{p.father_name_ne ?? '—'}</dd>
        </div>
        <div>
          <dt>Citizenship number</dt>
          <dd className={styles.mono}>
            {fullNumber ?? p.citizenship_no ?? '—'}
            {fullNumber && <Badge tone="warning">unmasked</Badge>}
          </dd>
        </div>
        <div>
          <dt>Household</dt>
          <dd>
            {p.household ? (
              <>
                {p.household.local_unit_code}, ward {p.household.ward_no}
                {p.household.tole && `, ${p.household.tole}`}
                {p.household.is_head && <div className={ui.muted}>Head of household</div>}
              </>
            ) : (
              '—'
            )}
          </dd>
        </div>
        {p.created_by_run && role && SEES_RUNS.includes(role) && (
          <div>
            <dt>Created by</dt>
            <dd>
              <Link to={`/runs/${p.created_by_run}`} className={styles.mono}>
                run {p.created_by_run.slice(0, 8)}
              </Link>
            </dd>
          </div>
        )}
      </dl>

      {p.citizenship_no_masked && role && MAY_UNMASK.includes(role) && !fullNumber && (
        <p>
          <Button variant="secondary" onClick={() => setAsking(true)}>
            Show the full citizenship number…
          </Button>
        </p>
      )}
      {fullNumber && (
        <Alert kind="warning">
          <p>
            You are seeing the full number; your reason is in the audit trail. It is not kept
            anywhere in this page or browser.{' '}
            <Button variant="ghost" onClick={() => unmask.reset()}>
              Hide it
            </Button>
          </p>
        </Alert>
      )}
      {asking && (
        <Dialog title="Why do you need the full number?" onClose={() => setAsking(false)}>
          <form onSubmit={submit}>
            {unmask.isError && !errors.reason && (
              <ProblemMessage error={unmask.error} title="Not shown" />
            )}
            <TextAreaField
              label="Reason"
              hint="e.g. the complaint or case you are working on. It is written to the audit trail with your name."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              error={errors.reason}
            />
            <div className={ui.dialogActions}>
              <Button variant="ghost" onClick={() => setAsking(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={reason.trim().length < 3 || unmask.isPending}>
                {unmask.isPending ? 'Checking…' : 'Show number'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
      {role === 'auditor' && <Lineage personId={p.id} />}
    </section>
  );
}
