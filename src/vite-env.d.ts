/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" for the public showcase build: one-click sign-in as any role (backend DEMO_MODE). */
  readonly VITE_DEMO_MODE?: string;
}
