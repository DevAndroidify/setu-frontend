import { useId, useState } from 'react';
import { Button } from '../../ui/controls';
import ui from '../../ui/ui.module.css';
import type { Catalog, TransformStep } from './api';
import styles from './mappings.module.css';

type Props = {
  step: TransformStep;
  catalog: Catalog;
  onChange: (args: unknown) => void;
};

type MapArgs = { values: Record<string, string>; caseInsensitive?: boolean };

function DateFormats({ step, catalog, onChange }: Props) {
  const chosen = ((step.args as { formats?: string[] } | undefined)?.formats ?? []) as string[];
  const toggle = (format: string) =>
    onChange({
      formats: chosen.includes(format) ? chosen.filter((f) => f !== format) : [...chosen, format],
    });
  return (
    <fieldset className={styles.args}>
      <legend>Formats the dates are written in (tried in this order)</legend>
      {catalog.bsDateFormats.map((format) => (
        <label key={format} className={styles.check}>
          <input
            type="checkbox"
            checked={chosen.includes(format)}
            onChange={() => toggle(format)}
          />{' '}
          <code>{format}</code>
        </label>
      ))}
    </fieldset>
  );
}

function NamePart({ step, onChange }: Props) {
  const id = useId();
  const part = (step.args as { part?: string } | undefined)?.part ?? 'first';
  return (
    <div className={styles.args}>
      <label htmlFor={id}>Which part </label>
      <select
        id={id}
        className={ui.input}
        value={part}
        onChange={(e) => onChange({ part: e.target.value })}
      >
        <option value="first">First name</option>
        <option value="middle">Middle name</option>
        <option value="last">Last name</option>
      </select>
    </div>
  );
}

function MapValues({ step, onChange }: Props) {
  const args = (step.args ?? { values: {} }) as MapArgs;
  const entries = Object.entries(args.values);
  const set = (next: [string, string][], caseInsensitive = args.caseInsensitive ?? true) =>
    onChange({ values: Object.fromEntries(next), caseInsensitive });
  return (
    <fieldset className={styles.args}>
      <legend>Replace each legacy code with its value; any other code fails the row</legend>
      <table className={styles.codes}>
        <thead>
          <tr>
            <th scope="col">Legacy code</th>
            <th scope="col">Becomes</th>
            <th>
              <span className="visually-hidden">Remove</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([code, value], i) => (
            <tr key={i}>
              <td>
                <input
                  className={ui.input}
                  aria-label={`Code ${i + 1}`}
                  value={code}
                  onChange={(e) =>
                    set(entries.map((p, j) => (j === i ? [e.target.value, p[1]] : p)))
                  }
                />
              </td>
              <td>
                <input
                  className={ui.input}
                  aria-label={`Value for code ${i + 1}`}
                  value={value}
                  onChange={(e) =>
                    set(entries.map((p, j) => (j === i ? [p[0], e.target.value] : p)))
                  }
                />
              </td>
              <td>
                <Button
                  variant="ghost"
                  aria-label={`Remove code ${i + 1}`}
                  onClick={() => set(entries.filter((_, j) => j !== i))}
                >
                  ×
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button variant="secondary" onClick={() => set([...entries, ['', '']])}>
        Add code
      </Button>{' '}
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={args.caseInsensitive ?? true}
          onChange={(e) => set(entries, e.target.checked)}
        />{' '}
        Ignore upper and lower case
      </label>
    </fieldset>
  );
}

/** For a transform the editor has no form for: its arguments as JSON. */
function RawArgs({ step, onChange }: Props) {
  const id = useId();
  const [text, setText] = useState(step.args === undefined ? '' : JSON.stringify(step.args));
  const [bad, setBad] = useState(false);
  return (
    <div className={styles.args}>
      <label htmlFor={id}>Arguments (JSON)</label>
      <input
        id={id}
        className={ui.input}
        value={text}
        aria-invalid={bad || undefined}
        onChange={(e) => {
          setText(e.target.value);
          try {
            onChange(e.target.value.trim() ? JSON.parse(e.target.value) : undefined);
            setBad(false);
          } catch {
            setBad(true);
          }
        }}
      />
    </div>
  );
}

/** The arguments of one transform step, with a form for the transforms that take any. */
export function StepArgs(props: Props) {
  const schema = props.catalog.transforms.find((t) => t.name === props.step.name)?.args;
  switch (props.step.name) {
    case 'bsToAd':
    case 'fiscalYear':
      return <DateFormats {...props} />;
    case 'namePart':
      return <NamePart {...props} />;
    case 'mapValues':
      return <MapValues {...props} />;
  }
  const takesArgs = Object.keys(schema?.properties ?? {}).length > 0;
  return takesArgs ? <RawArgs {...props} /> : null;
}
