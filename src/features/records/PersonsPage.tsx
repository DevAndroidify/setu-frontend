import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Button, EmptyState, PageHeader, TextField } from '../../ui/controls';
import { ProblemMessage } from '../../ui/ProblemMessage';
import { Spinner } from '../../ui/Spinner';
import ui from '../../ui/ui.module.css';
import { GENDER, searchPersons } from './api';
import styles from './records.module.css';

/** Search the clean register by name (English or Nepali) and local unit. */
export function PersonsPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const localUnit = params.get('localUnit') ?? '';
  const [draft, setDraft] = useState({ q, localUnit });
  const persons = useInfiniteQuery({
    queryKey: ['persons', q, localUnit],
    queryFn: ({ pageParam }) =>
      searchPersons({ q: q || undefined, localUnit: localUnit || undefined }, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = persons.data?.pages.flatMap((p) => p.data) ?? [];
  const tooShort = draft.q.trim().length === 1;

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams();
    if (draft.q.trim()) next.set('q', draft.q.trim());
    if (draft.localUnit.trim()) next.set('localUnit', draft.localUnit.trim());
    setParams(next);
  }

  return (
    <section aria-labelledby="persons-title">
      <PageHeader title="Records" />
      <form className={styles.search} onSubmit={submit} role="search" aria-label="Search records">
        <TextField
          label="Name"
          hint="Part of a name, in English or Nepali"
          value={draft.q}
          onChange={(e) => setDraft({ ...draft, q: e.target.value })}
          error={tooShort ? 'Type at least 2 characters' : undefined}
        />
        <TextField
          label="Local unit code"
          hint="e.g. kaski-pokhara"
          value={draft.localUnit}
          onChange={(e) => setDraft({ ...draft, localUnit: e.target.value })}
        />
        <Button type="submit" disabled={tooShort}>
          Search
        </Button>
      </form>
      {persons.isPending && <Spinner label="Searching" />}
      {persons.isError && <ProblemMessage error={persons.error} title="Search failed" />}
      {persons.isSuccess && rows.length === 0 && <EmptyState>No records match.</EmptyState>}
      {rows.length > 0 && (
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Gender</th>
                <th scope="col">Date of birth (BS)</th>
                <th scope="col">Citizenship no.</th>
                <th scope="col">Address</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link to={`/persons/${p.id}`}>{p.name_en}</Link>
                    <div lang="ne">{p.name_ne}</div>
                  </td>
                  <td>{p.gender ? GENDER[p.gender] : '—'}</td>
                  <td>
                    {p.dob_bs ?? '—'}
                    {p.dob_ad && <div className={ui.muted}>AD {p.dob_ad}</div>}
                  </td>
                  <td className={styles.mono}>{p.citizenship_no ?? '—'}</td>
                  <td>
                    {p.household
                      ? `${p.household.local_unit_code}, ward ${p.household.ward_no}`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {persons.hasNextPage && (
        <p>
          <Button
            variant="secondary"
            onClick={() => persons.fetchNextPage()}
            disabled={persons.isFetchingNextPage}
          >
            Show more
          </Button>
        </p>
      )}
    </section>
  );
}
