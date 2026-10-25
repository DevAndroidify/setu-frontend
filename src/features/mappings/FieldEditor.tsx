import { useId, useState } from 'react';
import { Button, Badge } from '../../ui/controls';
import ui from '../../ui/ui.module.css';
import type { Catalog, FieldSpec } from './api';
import styles from './mappings.module.css';
import { move, newStep, ruleLabel, targetLabel, transformLabel } from './spec';
import { StepArgs } from './StepArgs';

type Props = {
  index: number;
  field: FieldSpec;
  catalog: Catalog;
  /** Targets other fields already use: not offered again. */
  taken: string[];
  /** Column names of the chosen file, offered as suggestions. */
  columns: string[];
  errors: string[];
  onChange: (field: FieldSpec) => void;
  onRemove: () => void;
};

function Columns({ field, columns, onChange }: Pick<Props, 'field' | 'columns' | 'onChange'>) {
  const id = useId();
  const [draft, setDraft] = useState('');
  const add = (name: string) => {
    const column = name.trim();
    if (column && !field.from.includes(column))
      onChange({ ...field, from: [...field.from, column] });
    setDraft('');
  };
  return (
    <div className={styles.row}>
      <label htmlFor={id} className={ui.label}>
        Source columns
      </label>
      <div className={styles.chips}>
        {field.from.map((c) => (
          <span key={c} className={styles.chip}>
            <code>{c}</code>
            <button
              type="button"
              aria-label={`Remove column ${c}`}
              onClick={() => onChange({ ...field, from: field.from.filter((x) => x !== c) })}
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          className={`${ui.input} ${styles.chipInput}`}
          list={`${id}-columns`}
          placeholder={field.from.length ? 'Add another' : 'Column name'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add(draft);
            }
          }}
          onBlur={() => draft && add(draft)}
        />
        <datalist id={`${id}-columns`}>
          {columns
            .filter((c) => !field.from.includes(c))
            .map((c) => (
              <option key={c} value={c} />
            ))}
        </datalist>
      </div>
      {field.from.length > 1 && (
        <span className={ui.hint}>Several columns are joined with a space.</span>
      )}
    </div>
  );
}

function Steps({ field, catalog, onChange }: Pick<Props, 'field' | 'catalog' | 'onChange'>) {
  const id = useId();
  const setSteps = (transforms: FieldSpec['transforms']) => onChange({ ...field, transforms });
  return (
    <div className={styles.row}>
      <span className={ui.label}>Transforms, in order</span>
      {field.transforms.length === 0 && (
        <span className={ui.hint}>The value is used as written.</span>
      )}
      <ol className={styles.steps}>
        {field.transforms.map((step, i) => (
          <li key={i} className={styles.step}>
            <div className={styles.stepHead}>
              <strong>{transformLabel(step.name)}</strong>
              <span className={styles.stepButtons}>
                <Button
                  variant="ghost"
                  aria-label={`Move ${transformLabel(step.name)} up`}
                  disabled={i === 0}
                  onClick={() => setSteps(move(field.transforms, i, i - 1))}
                >
                  ↑
                </Button>
                <Button
                  variant="ghost"
                  aria-label={`Move ${transformLabel(step.name)} down`}
                  disabled={i === field.transforms.length - 1}
                  onClick={() => setSteps(move(field.transforms, i, i + 1))}
                >
                  ↓
                </Button>
                <Button
                  variant="ghost"
                  aria-label={`Remove ${transformLabel(step.name)}`}
                  onClick={() => setSteps(field.transforms.filter((_, j) => j !== i))}
                >
                  ×
                </Button>
              </span>
            </div>
            <StepArgs
              step={step}
              catalog={catalog}
              onChange={(args) =>
                setSteps(
                  field.transforms.map((s, j) =>
                    j === i ? (args === undefined ? { name: s.name } : { name: s.name, args }) : s,
                  ),
                )
              }
            />
          </li>
        ))}
      </ol>
      <label htmlFor={id} className="visually-hidden">
        Add a transform
      </label>
      <select
        id={id}
        className={`${ui.input} ${styles.adder}`}
        value=""
        onChange={(e) =>
          e.target.value && setSteps([...field.transforms, newStep(e.target.value, catalog)])
        }
      >
        <option value="">+ Add a transform…</option>
        {catalog.transforms.map((t) => (
          <option key={t.name} value={t.name}>
            {transformLabel(t.name)}
          </option>
        ))}
      </select>
    </div>
  );
}

function Rules({ field, catalog, onChange }: Pick<Props, 'field' | 'catalog' | 'onChange'>) {
  const id = useId();
  const setRules = (rules: string[]) => onChange({ ...field, rules });
  const used = field.rules.map((r) => r.split(':')[0]);
  return (
    <div className={styles.row}>
      <span className={ui.label}>Checks</span>
      <ul className={styles.rules}>
        {field.rules.map((rule, i) => {
          const [name = '', ...rest] = rule.split(':');
          const param = catalog.rules.find((r) => r.name === name)?.param ?? null;
          return (
            <li key={i} className={styles.rule}>
              {ruleLabel(name)}
              {param && (
                <input
                  className={`${ui.input} ${styles.param}`}
                  type={param === 'date' ? 'date' : 'number'}
                  aria-label={`${ruleLabel(name)}: ${param}`}
                  value={rest.join(':')}
                  onChange={(e) =>
                    setRules(field.rules.map((r, j) => (j === i ? `${name}:${e.target.value}` : r)))
                  }
                />
              )}
              <Button
                variant="ghost"
                aria-label={`Remove check ${ruleLabel(name)}`}
                onClick={() => setRules(field.rules.filter((_, j) => j !== i))}
              >
                ×
              </Button>
            </li>
          );
        })}
      </ul>
      <label htmlFor={id} className="visually-hidden">
        Add a check
      </label>
      <select
        id={id}
        className={`${ui.input} ${styles.adder}`}
        value=""
        onChange={(e) => {
          const rule = catalog.rules.find((r) => r.name === e.target.value);
          if (!rule) return;
          const initial =
            rule.param === 'date' ? ':1940-01-01' : rule.param === 'number' ? ':100' : '';
          setRules([...field.rules, `${rule.name}${initial}`]);
        }}
      >
        <option value="">+ Add a check…</option>
        {catalog.rules
          .filter((r) => !used.includes(r.name))
          .map((r) => (
            <option key={r.name} value={r.name}>
              {ruleLabel(r.name)}
            </option>
          ))}
      </select>
    </div>
  );
}

/** One field of a mapping: where it goes, where it comes from, and what happens on the way. */
export function FieldEditor({
  index,
  field,
  catalog,
  taken,
  columns,
  errors,
  onChange,
  onRemove,
}: Props) {
  const targetId = useId();
  const required = catalog.requiredTargets.includes(field.target);
  return (
    <article
      className={errors.length ? `${styles.card} ${styles.cardError}` : styles.card}
      aria-label={field.target ? targetLabel(field.target) : `Field ${index + 1}`}
    >
      <div className={styles.cardHead}>
        <div className={styles.row}>
          <label htmlFor={targetId} className={ui.label}>
            Maps to {required && <Badge>required</Badge>}
          </label>
          <select
            id={targetId}
            className={ui.input}
            value={field.target}
            onChange={(e) => onChange({ ...field, target: e.target.value })}
          >
            <option value="">Choose a target…</option>
            {catalog.targets
              .filter((t) => t === field.target || !taken.includes(t))
              .map((t) => (
                <option key={t} value={t}>
                  {targetLabel(t)} ({t})
                </option>
              ))}
          </select>
        </div>
        <Button
          variant="ghost"
          onClick={onRemove}
          aria-label={`Remove field ${field.target ? targetLabel(field.target) : index + 1}`}
        >
          Remove
        </Button>
      </div>
      {errors.length > 0 && (
        <ul className={styles.cardErrors} role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <Columns field={field} columns={columns} onChange={onChange} />
      <Steps field={field} catalog={catalog} onChange={onChange} />
      <Rules field={field} catalog={catalog} onChange={onChange} />
      <fieldset className={styles.row}>
        <legend className={ui.label}>If a transform fails</legend>
        <label className={styles.check}>
          <input
            type="radio"
            name={`onError-${index}`}
            checked={field.onError === 'quarantine'}
            onChange={() => onChange({ ...field, onError: 'quarantine' })}
          />{' '}
          Quarantine the row
        </label>
        <label className={styles.check}>
          <input
            type="radio"
            name={`onError-${index}`}
            checked={field.onError === 'null'}
            onChange={() => onChange({ ...field, onError: 'null' })}
          />{' '}
          Keep the row, leave this field empty (with a warning)
        </label>
      </fieldset>
    </article>
  );
}
