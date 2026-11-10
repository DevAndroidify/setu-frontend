import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { ApiError } from '../../api/client';
import { Alert, Button, PageHeader, SelectField } from '../../ui/controls';
import { ProblemMessage } from '../../ui/ProblemMessage';
import { Spinner } from '../../ui/Spinner';
import { useToast } from '../../ui/toast-context';
import ui from '../../ui/ui.module.css';
import { getProfile, getSource, listFiles } from '../sources/api';
import { getCatalog, getMapping, type MappingSpec, previewDraft, saveMapping } from './api';
import { FieldEditor } from './FieldEditor';
import styles from './mappings.module.css';
import { PreviewTable } from './PreviewTable';
import { cleanSpec, draftProblems, emptyField, errorsByField } from './spec';
import { HOUSEHOLD_REGISTER_TEMPLATE } from './template';
import { useStrings } from '../../i18n/language';

const BLANK: MappingSpec = { fields: [emptyField('person.name_ne'), emptyField('person.name_en')] };

/**
 * Writes a mapping as a form (or as JSON), previews the draft on a real file without saving
 * it, and saves it as the source's next version. Saved versions are never edited.
 */
export function MappingEditorPage() {
  const strings = useStrings();
  const { sourceId = '' } = useParams();
  const [params] = useSearchParams();
  const fromId = params.get('from');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useToast();

  const catalog = useQuery({
    queryKey: ['mapping-catalog'],
    queryFn: getCatalog,
    staleTime: Infinity,
  });
  const source = useQuery({ queryKey: ['source', sourceId], queryFn: () => getSource(sourceId) });
  const files = useQuery({
    queryKey: ['source-files', sourceId],
    queryFn: () => listFiles(sourceId),
  });
  const base = useQuery({
    queryKey: ['mapping', fromId],
    queryFn: () => getMapping(fromId!),
    enabled: !!fromId,
  });

  // The draft: what the user edited, else the version it starts from, else a blank mapping.
  const [edited, setSpec] = useState<MappingSpec | null>(null);
  const spec = edited ?? (fromId ? (base.data?.spec ?? null) : BLANK);
  const [tab, setTab] = useState<'form' | 'json'>('form');
  const [json, setJson] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [fileId, setFileId] = useState('');

  const readable = useMemo(
    () => (files.data ?? []).filter((f) => f.profileStatus === 'ok'),
    [files.data],
  );
  const chosenFile = fileId || readable[0]?.id || '';
  const profile = useQuery({
    queryKey: ['profile', chosenFile],
    queryFn: () => getProfile(chosenFile),
    enabled: !!chosenFile,
  });
  const columns = profile.data?.status === 'ok' ? profile.data.columns.map((c) => c.name) : [];

  const preview = useMutation({
    mutationFn: (s: MappingSpec) => previewDraft(sourceId, s, chosenFile),
  });
  const save = useMutation({
    mutationFn: (s: MappingSpec) => saveMapping(sourceId, s),
    onSuccess: async (mapping) => {
      await queryClient.invalidateQueries({ queryKey: ['mappings', sourceId] });
      notify('success', `Mapping version ${mapping.version} saved.`);
      navigate(`/sources/${sourceId}/mappings/${mapping.id}`);
    },
  });

  if (catalog.isError)
    return <ProblemMessage error={catalog.error} title="Could not load the mapping catalog" />;
  if (base.isError) return <ProblemMessage error={base.error} title="Could not load the mapping" />;
  if (!catalog.data || !spec || source.isPending) return <Spinner label="Loading the editor" />;
  const cat = catalog.data;

  const problems = draftProblems(spec, cat);
  const serverError = save.error ?? preview.error;
  const { byField, other } = errorsByField(
    serverError instanceof ApiError ? serverError.fieldErrors : [],
  );
  const setField = (i: number, field: MappingSpec['fields'][number]) =>
    setSpec({ fields: spec.fields.map((f, j) => (j === i ? field : f)) });

  function showJson() {
    setJson(JSON.stringify(spec, null, 2));
    setJsonError(null);
    setTab('json');
  }
  function showForm() {
    try {
      const parsed = JSON.parse(json) as MappingSpec;
      if (!Array.isArray(parsed.fields)) throw new Error('The JSON needs a "fields" list');
      setSpec({
        fields: parsed.fields.map((f) => ({
          ...emptyField(),
          ...f,
          transforms: f.transforms ?? [],
          rules: f.rules ?? [],
        })),
      });
      setTab('form');
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'Not valid JSON');
    }
  }

  return (
    <section aria-labelledby="mapping-editor-title">
      <PageHeader
        title={
          <span id="mapping-editor-title">
            {base.data ? `New version from version ${base.data.version}` : 'New mapping'}
          </span>
        }
        back={{ to: `/sources/${sourceId}`, label: source.data?.name ?? strings.back.source }}
      />
      <p className={ui.muted}>
        A mapping says, for each target field, which source columns it comes from, how the value is
        cleaned, and which checks it must pass. Saving creates a new version; runs use the version
        they were created with.
      </p>

      <div className={styles.toolbar} role="tablist" aria-label="Edit as">
        <Button
          role="tab"
          aria-selected={tab === 'form'}
          variant={tab === 'form' ? 'primary' : 'secondary'}
          onClick={() => (tab === 'json' ? showForm() : undefined)}
        >
          Form
        </Button>
        <Button
          role="tab"
          aria-selected={tab === 'json'}
          variant={tab === 'json' ? 'primary' : 'secondary'}
          onClick={() => (tab === 'form' ? showJson() : undefined)}
        >
          JSON
        </Button>
        {!fromId && (
          <Button variant="ghost" onClick={() => setSpec(HOUSEHOLD_REGISTER_TEMPLATE)}>
            Start from the household register template
          </Button>
        )}
      </div>

      {tab === 'json' ? (
        <div className={styles.json}>
          {jsonError && (
            <Alert kind="error">
              <p>{jsonError}</p>
            </Alert>
          )}
          <label htmlFor="mapping-json" className={ui.label}>
            Mapping spec
          </label>
          <textarea
            id="mapping-json"
            className={`${ui.input} ${styles.jsonInput}`}
            spellCheck={false}
            value={json}
            onChange={(e) => setJson(e.target.value)}
          />
          <p>
            <Button onClick={showForm}>Apply JSON</Button>
          </p>
        </div>
      ) : (
        <>
          {spec.fields.map((field, i) => (
            <FieldEditor
              key={i}
              index={i}
              field={field}
              catalog={cat}
              taken={spec.fields.map((f) => f.target).filter((_, j) => j !== i)}
              columns={columns}
              errors={byField.get(i) ?? []}
              onChange={(f) => setField(i, f)}
              onRemove={() => setSpec({ fields: spec.fields.filter((_, j) => j !== i) })}
            />
          ))}
          <p>
            <Button
              variant="secondary"
              onClick={() => setSpec({ fields: [...spec.fields, emptyField()] })}
            >
              Add a field
            </Button>
          </p>
        </>
      )}

      {problems.length > 0 && (
        <Alert kind="warning">
          <p>Before previewing or saving:</p>
          <ul>
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Alert>
      )}
      {serverError &&
        !(
          serverError instanceof ApiError &&
          serverError.fieldErrors.length &&
          other.length === 0
        ) && (
          <ProblemMessage error={serverError} title={save.error ? 'Not saved' : 'Preview failed'} />
        )}

      <div className={styles.actions}>
        <SelectField
          label="Preview on file"
          value={chosenFile}
          onChange={(e) => setFileId(e.target.value)}
          hint={readable.length ? undefined : 'Upload a file and wait for its profile to preview.'}
        >
          {readable.length === 0 && <option value="">No profiled file yet</option>}
          {readable.map((f) => (
            <option key={f.id} value={f.id}>
              {f.filename}
            </option>
          ))}
        </SelectField>
        <Button
          variant="secondary"
          disabled={tab === 'json' || problems.length > 0 || !chosenFile || preview.isPending}
          onClick={() => preview.mutate(cleanSpec(spec))}
        >
          {preview.isPending ? 'Previewing…' : 'Preview 50 rows'}
        </Button>
        <Button
          disabled={tab === 'json' || problems.length > 0 || save.isPending}
          onClick={() => save.mutate(cleanSpec(spec))}
        >
          {save.isPending ? 'Saving…' : 'Save as new version'}
        </Button>
      </div>

      {preview.data && (
        <section aria-labelledby="preview-title" className={styles.previewSection}>
          <h2 id="preview-title">Preview (nothing was written)</h2>
          <PreviewTable preview={preview.data} spec={spec} />
        </section>
      )}
    </section>
  );
}
