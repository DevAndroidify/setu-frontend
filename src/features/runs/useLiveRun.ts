import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ACTIVE, FINISHED, followRun, getRun, type RunDetail } from './api';

/**
 * The run, kept current: over the live event stream while it is queued, running or paused
 * (asking every 3 seconds instead if the stream cannot be opened), and every 10 seconds while
 * it waits for someone (draft, approval).
 */
export function useLiveRun(id: string) {
  const queryClient = useQueryClient();
  const [live, setLive] = useState(false);
  const [streamFailed, setStreamFailed] = useState(false);
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
    followRun(
      id,
      (status: RunDetail) => {
        setLive(true);
        queryClient.setQueryData(['run', id], status);
      },
      controller.signal,
    )
      .then(() => queryClient.invalidateQueries({ queryKey: ['run', id] }))
      .catch((err: unknown) => {
        if ((err as Error).name !== 'AbortError') setStreamFailed(true);
      })
      .finally(() => setLive(false));
    return () => controller.abort();
  }, [id, inProgress, queryClient]);

  return { ...run, live };
}
