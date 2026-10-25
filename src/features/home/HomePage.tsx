import { Link } from 'react-router';
import { useAuth } from '../../auth/context';
import { navFor, ROLE_LABELS } from '../../auth/roles';
import type { Role } from '../../auth/session';

const INTRO: Record<Role, string> = {
  operator:
    'Register legacy sources, upload their files and read the profile before writing a mapping.',
  admin:
    'Register sources and upload files like an operator. Approvals and unmasking are not part of this role.',
  approver: 'Review production runs waiting for your approval, and roll back a run if needed.',
  reviewer: 'Decide whether held records are the same person as one already in the register.',
  auditor:
    'Read reconciliation reports, trace records to their source rows and verify the audit trail.',
};

export function HomePage() {
  const { user } = useAuth();
  if (!user) return null;
  const shortcuts = navFor(user.role).filter((i) => i.to !== '/' && !i.phase);
  return (
    <section aria-labelledby="home-title">
      <h1 id="home-title">Welcome</h1>
      <p>
        You are signed in as <strong>{user.email}</strong>, {ROLE_LABELS[user.role]}.
      </p>
      <p>{INTRO[user.role]}</p>
      <ul>
        {shortcuts.map((item) => (
          <li key={item.to}>
            <Link to={item.to}>{item.label}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
