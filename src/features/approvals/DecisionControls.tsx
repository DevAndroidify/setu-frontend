import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../auth/context';
import { Alert, Button, TextAreaField } from '../../ui/controls';
import { Dialog } from '../../ui/Dialog';
import { fieldErrorsOf } from '../../ui/field-errors';
import { ProblemMessage } from '../../ui/ProblemMessage';
import { useToast } from '../../ui/toast-context';
import ui from '../../ui/ui.module.css';
import type { Run } from '../runs/api';
import { type Approval, cannotDecide, decide } from './api';
import styles from './approvals.module.css';

type Decision = 'approved' | 'rejected';

const COPY: Record<Decision, { title: string; button: string; hint: string; done: string }> = {
  approved: {
    title: 'Approve this production run',
    button: 'Approve',
    hint: 'Say what you checked, e.g. the dry-run counts. The reason is kept in the run’s audit trail.',
    done: 'Approved. The operator can start it within 24 hours.',
  },
  rejected: {
    title: 'Send this run back',
    button: 'Reject',
    hint: 'Say what must change before it is submitted again. It goes back to draft.',
    done: 'Rejected. The run is back in draft.',
  },
};

/** Approve and Reject, each asking for a reason, for a run waiting for approval. */
export function DecisionControls({ run, pending }: { run: Run; pending: Approval | undefined }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const notify = useToast();
  const [open, setOpen] = useState<Decision | null>(null);
  const [reason, setReason] = useState('');
  const mutation = useMutation({
    mutationFn: (d: Decision) => decide(run.id, d, reason.trim()),
    onSuccess: async (_r, d) => {
      notify('success', COPY[d].done);
      setOpen(null);
      setReason('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['runs'] }),
        queryClient.invalidateQueries({ queryKey: ['run', run.id] }),
        queryClient.invalidateQueries({ queryKey: ['approvals', run.id] }),
      ]);
    },
  });

  if (!user) return null;
  const blocked = cannotDecide(run, pending, user.id);
  if (blocked) {
    return (
      <Alert kind="info">
        <p>{blocked}</p>
      </Alert>
    );
  }

  const close = () => {
    setOpen(null);
    mutation.reset();
  };
  function submit(event: FormEvent) {
    event.preventDefault();
    if (open) mutation.mutate(open);
  }

  const errors = fieldErrorsOf(mutation.error);
  return (
    <>
      <span className={styles.decide}>
        <Button onClick={() => setOpen('approved')}>Approve…</Button>
        <Button variant="secondary" onClick={() => setOpen('rejected')}>
          Reject…
        </Button>
      </span>
      {open && (
        <Dialog title={COPY[open].title} onClose={close}>
          <form onSubmit={submit}>
            {mutation.isError && !errors.reason && (
              <ProblemMessage error={mutation.error} title="Not recorded" />
            )}
            <TextAreaField
              label="Reason"
              hint={COPY[open].hint}
              required
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              error={errors.reason}
            />
            <div className={ui.dialogActions}>
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant={open === 'approved' ? 'primary' : 'danger'}
                disabled={reason.trim().length < 3 || mutation.isPending}
              >
                {mutation.isPending ? 'Recording…' : COPY[open].button}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
