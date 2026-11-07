import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ACTIVE, FINISHED, followRun, getRun, type RunDetail } from './api';

/**
 * The run, kept current: over the live event stream while it is queued, running or paused
 * (asking every 3 seconds instead if the stream cannot be opened), and every 10 seconds while
 * it waits for someone (draft, approval). A stream that ends while the run is still going (a
 * proxy timeout on a long pause, an API restart) is opened again after a short wait.
 */
const RECONNECT_MS = 2000;

export function useLiveRun(id: string) {
  const queryClient = useQueryClient();
  const [live, setLive] = useState(false);
  const [streamFailed, setStreamFailed] = useState(false);
  const [round, setRound] = useState(0);
  const run = useQuery({
    queryKey: ['run', id],
    queryFn: () => getRun(id),
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      if (!status || FINISHED.includes(status)) return false;
      if (ACTIVE.includes(status)) return streamFailed ? 3000 : false;
      return 10_000;
    },
  });
  const inProgress = !!run.data && ACTIVE.includes(run.data.status);

  useEffect(() => {
    if (!inProgress) return;
    const controller = new AbortController();
    const open = () =>
      followRun(
        id,
        (status: RunDetail) => {
          setLive(true);
          queryClient.setQueryData(['run', id], status);
        },
        controller.signal,
      )
        .then(async () => {
          // Ended: the run finished, or the connection dropped. Re-read it; if it is still in
          // progress, inProgress stays true and the new round opens another stream.
          await queryClient.invalidateQueries({ queryKey: ['run', id] });
          if (!controller.signal.aborted) setRound((r) => r + 1);
        })
        .catch((err: unknown) => {
          if ((err as Error).name !== 'AbortError') setStreamFailed(true);
        })
        .finally(() => setLive(false));
    const timer = setTimeout(open, round === 0 ? 0 : RECONNECT_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [id, inProgress, queryClient, round]);

  return { ...run, live };
}
