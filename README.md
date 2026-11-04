# Setu frontend

The officer web app for the [Setu backend](https://github.com/DevAndroidify/setu), which moves records
from legacy government systems into a modern database. Operators, reviewers, approvers, auditors and
admins each get their own view of migration runs, quarantine, duplicate matches and the audit log.

Built with React 19, TypeScript and Vite.

## Run it

Needs Node 22 and the Setu backend running on port 3000.

```bash
npm ci
npm run dev        # http://localhost:5173
```

The build plan is in [PLAN.md](PLAN.md).
