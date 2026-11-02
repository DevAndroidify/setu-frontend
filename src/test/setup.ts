import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// Whole-app tests wait for a chain of requests (session refresh, /me, the page's data); the
// 1 s default made them fail on a busy machine (reproduced with every core loaded).
configure({ asyncUtilTimeout: 5000 });

afterEach(() => cleanup());
