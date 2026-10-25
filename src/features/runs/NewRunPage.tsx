import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Alert, Button, PageHeader, SelectField } from '../../ui/controls';
import { ProblemMessage } from '../../ui/ProblemMessage';
import { useToast } from '../../ui/toast-context';
import ui from '../../ui/ui.module.css';
import { listMappings } from '../mappings/api';
import { listFiles, listSources } from '../sources/api';
import { createRun, type RunMode } from './api';
import styles from './runs.module.css';

/** Picks a file, a mapping version and a mode, and creates the run as a draft. */
export function NewRunPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useToast();
  const [sourceId, setSourceId] = useState(params.get('sourceId') ?? '');
  const [fileId, setFileId] = useState('');
  const [mappingId, setMappingId] = useState(params.get('mappingId') ?? '');
  const [mode, setMode] = useState<RunMode>('dry_run');

  const sources = useInfiniteQuery({
    queryKey: ['sources'],
    queryFn: ({ pageParam }) => listSources(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const files = useQuery({
    queryKey: ['source-files', sourceId],
    queryFn: () => listFiles(sourceId),
    enabled: !!sourceId,
  });
  const mappings = useQuery({
    queryKey: ['mappings', sourceId],
    queryFn: () => listMappings(sourceId),
    enabled: !!sourceId,
  });
  const readable = (files.data ?? []).filter((f) => f.profileStatus === 'ok');
  const chosenFile = fileId || readable[0]?.id || '';
  const chosenMapping = mappingId || mappings.data?.[0]?.id || '';

  const create = useMutation({
    mutationFn: createRun,
    onSuccess: async (run) => {
      await queryClient.invalidateQueries({ queryKey: ['runs'] });
      notify(
        'success',
        run.mode === 'dry_run'
          ? 'Dry run created. Start it when ready.'
          : 'Production run created. Submit it for approval.',
      );
      navigate(`/runs/${run.id}`);
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate({ sourceFileId: chosenFile, mappingId: chosenMapping, mode });
  }

  const allSources = sources.data?.pages.flatMap((p) => p.data) ?? [];
  return (
    <section aria-labelledby="new-run-title">
      <PageHeader title="New run" />
      <form onSubmit={submit} aria-labelledby="new-run-title">
        {create.isError && <ProblemMessage error={create.error} title="Could not create the run" />}
        <SelectField
          label="Source"
          value={sourceId}
          onChange={(e) => {
            setSourceId(e.target.value);
            setFileId('');
            setMappingId('');
          }}
        >
          <option value="">Choose a source…</option>
          {allSources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.agency})
            </option>
          ))}
        </SelectField>
        {sourceId && (
          <>
            <SelectField
              label="File"
              value={chosenFile}
              onChange={(e) => setFileId(e.target.value)}
              hint={readable.length ? 'Only files with a finished profile can be run.' : undefined}
            >
              {readable.length === 0 && <option value="">No profiled file</option>}
              {readable.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.filename} ({f.rowCount} rows)
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Mapping version"
              value={chosenMapping}
              onChange={(e) => setMappingId(e.target.value)}
            >
              {mappings.data?.length === 0 && <option value="">No mapping yet</option>}
              {mappings.data?.map((m) => (
                <option key={m.id} value={m.id}>
                  Version {m.version}
                </option>
              ))}
            </SelectField>
            {mappings.data?.length === 0 && (
              <Alert kind="info">
                <p>
                  This source has no mapping yet.{' '}
                  <Link to={`/sources/${sourceId}/mappings/new`}>Write one first</Link>.
                </p>
              </Alert>
            )}
          </>
        )}
        <fieldset className={styles.modes}>
          <legend className={ui.label}>Mode</legend>
          <label className={styles.mode}>
            <input
              type="radio"
              name="mode"
              checked={mode === 'dry_run'}
              onChange={() => setMode('dry_run')}
            />
            <span>
              <strong>Dry run</strong>
              <span className={ui.muted}>
                {' '}
                Transforms and validates every row and reports the result. Loads nothing, needs no
                approval.
              </span>
            </span>
          </label>
          <label className={styles.mode}>
            <input
              type="radio"
              name="mode"
              checked={mode === 'production'}
              onChange={() => setMode('production')}
            />
            <span>
              <strong>Production</strong>
              <span className={ui.muted}>
                {' '}
                Loads the records into the register. A different user with the approver role must
                approve it first.
              </span>
            </span>
          </label>
        </fieldset>
        <p>
          <Button type="submit" disabled={!chosenFile || !chosenMapping || create.isPending}>
            {create.isPending ? 'Creating…' : 'Create run'}
          </Button>
        </p>
      </form>
    </section>
  );
}
