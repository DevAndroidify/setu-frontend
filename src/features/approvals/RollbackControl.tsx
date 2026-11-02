import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '../../ui/controls';
import { Dialog } from '../../ui/Dialog';
import { ProblemMessage } from '../../ui/ProblemMessage';
import { useToast } from '../../ui/toast-context';
import ui from '../../ui/ui.module.css';
import type { RunDetail } from '../runs/api';
import { formatNumber } from '../sources/format';
import { rollback } from './api';

/** Undoes a production run's loads after saying exactly what will be removed. */
export function RollbackControl({ run }: { run: RunDetail }) {
  const queryClient = useQueryClient();
  const notify = useToast();
  const [open, setOpen] = useState(false);
  const mutation = useMutation({
    mutationFn: () => rollback(run.id),
    onSuccess: async () => {
      setOpen(false);
      notify('success', 'Rolled back. The register is as it was before this run.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['run', run.id] }),
        queryClient.invalidateQueries({ queryKey: ['runs'] }),
      ]);
    },
  });
  const p = run.progress;
  const close = () => {
    setOpen(false);
    mutation.reset();
  };

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Roll back…
      </Button>
      {open && (
        <Dialog title="Roll back this run?" onClose={close}>
          <p>This removes from the register:</p>
          <ul>
            <li>
              <strong>{formatNumber(p.loaded)}</strong> records this run created, and the households
              it created
            </li>
            <li>
              <strong>{formatNumber(p.linked)}</strong> links from its rows to records that already
              existed (those records stay)
            </li>
          </ul>
          <p>
            Its staged rows become valid again, the run is marked rolled back, and the audit trail
            keeps the record of it. If a later run has linked to these records, the rollback is
            refused: roll that run back first.
          </p>
          {mutation.isError && <ProblemMessage error={mutation.error} title="Not rolled back" />}
          <div className={ui.dialogActions}>
            <Button variant="ghost" onClick={close}>
              Keep the run
            </Button>
            <Button
              variant="danger"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Rolling back…' : 'Roll back'}
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
