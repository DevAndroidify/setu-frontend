import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button, PageHeader, SelectField, TextField } from '../../ui/controls';
import ui from '../../ui/ui.module.css';
import { fieldErrorsOf } from '../../ui/field-errors';
import { ProblemMessage } from '../../ui/ProblemMessage';
import { useToast } from '../../ui/toast-context';
import { createSource, KINDS, type SourceKind } from './api';

export function NewSourcePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useToast();
  const [name, setName] = useState('');
  const [agency, setAgency] = useState('');
  const [kind, setKind] = useState<SourceKind>('csv');

  const create = useMutation({
    mutationFn: createSource,
    onSuccess: async (source) => {
      await queryClient.invalidateQueries({ queryKey: ['sources'] });
      notify('success', `Source "${source.name}" registered. Upload its first file.`);
      navigate(`/sources/${source.id}`);
    },
  });
  const errors = fieldErrorsOf(create.error);

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate({ name: name.trim(), agency: agency.trim(), kind });
  }

  return (
    <section aria-labelledby="new-source-title">
      <PageHeader title="New source" />
      <form onSubmit={submit} aria-labelledby="new-source-title" noValidate>
        {create.isError && Object.keys(errors).length === 0 && (
          <ProblemMessage error={create.error} title="Could not register the source" />
        )}
        <TextField
          label="Name"
          hint="What the legacy system is called, e.g. Household register"
          required
          maxLength={200}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />
        <TextField
          label="Agency"
          hint="The office that keeps it"
          required
          maxLength={200}
          value={agency}
          onChange={(e) => setAgency(e.target.value)}
          error={errors.agency}
        />
        <SelectField
          label="Kind of file"
          hint={KINDS[kind].hint}
          value={kind}
          onChange={(e) => setKind(e.target.value as SourceKind)}
          error={errors.kind}
        >
          {Object.entries(KINDS).map(([value, k]) => (
            <option key={value} value={value}>
              {k.label}
            </option>
          ))}
        </SelectField>
        <p>
          <Button type="submit" disabled={create.isPending || !name.trim() || !agency.trim()}>
            {create.isPending ? 'Registering…' : 'Register source'}
          </Button>{' '}
          <Link to="/sources" className={`${ui.button} ${ui.ghost}`}>
            Cancel
          </Link>
        </p>
      </form>
    </section>
  );
}
