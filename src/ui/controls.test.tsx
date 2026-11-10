import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { Badge, Counters, MarginNote, PageHeader, Raw, StatusMark } from './controls';

describe('status markers', () => {
  it('shows the status as a word next to a square, never as colour alone', () => {
    const { container } = render(<StatusMark kind="held">Held</StatusMark>);
    expect(screen.getByText('Held')).toBeVisible();
    const square = container.querySelector('[data-mark="held"]');
    expect(square).toHaveAttribute('aria-hidden', 'true');
  });

  it('draws a badge tone as the matching status marker', () => {
    const { container } = render(
      <>
        <Badge tone="success">Completed</Badge>
        <Badge tone="warning">Awaiting approval</Badge>
        <Badge tone="danger">Failed</Badge>
        <Badge>Draft</Badge>
      </>,
    );
    const marks = [...container.querySelectorAll('[data-mark]')].map((m) =>
      m.getAttribute('data-mark'),
    );
    expect(marks).toEqual(['loaded', 'held', 'failed', 'review']);
  });
});

describe('the page title block', () => {
  it('puts the back link before the heading and the actions after it', () => {
    render(
      <MemoryRouter>
        <PageHeader
          title="A run"
          back={{ to: '/runs', label: 'All runs' }}
          meta="Dry run"
          actions={<button>Pause</button>}
        />
      </MemoryRouter>,
    );
    const back = screen.getByRole('link', { name: 'All runs' });
    const heading = screen.getByRole('heading', { level: 1, name: 'A run' });
    expect(back).toHaveAttribute('href', '/runs');
    expect(back.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('Dry run')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeVisible();
  });
});

describe('the counter strip', () => {
  it('lists every number with its label and fills only the important one', () => {
    render(
      <Counters
        label="Row counts"
        items={[
          { label: 'Rows in file', value: 12480 },
          { label: 'Loaded', value: 10914, note: 'plus 312 linked', highlight: true },
          { label: 'Held', value: 1106 },
        ]}
      />,
    );
    const list = screen.getByRole('list', { name: 'Row counts' });
    const items = [...list.querySelectorAll('li')];
    expect(items.map((li) => li.textContent)).toEqual([
      'Rows in file12,480',
      'Loaded10,914plus 312 linked',
      'Held1,106',
    ]);
    expect(items.filter((li) => li.dataset.highlight === 'true')).toHaveLength(1);
  });
});

describe('small pieces', () => {
  it('shows raw legacy values exactly as written', () => {
    render(<Raw>/fd yfkf</Raw>);
    expect(screen.getByText('/fd yfkf').tagName).toBe('CODE');
  });

  it('writes the margin note as an aside', () => {
    render(<MarginNote>no real person's data.</MarginNote>);
    expect(screen.getByRole('note')).toHaveTextContent("no real person's data.");
  });
});
