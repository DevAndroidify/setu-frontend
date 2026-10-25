import { ApiError } from '../api/client';

/** Field errors from a 400 answer, by field name, for showing next to each input. */
export function fieldErrorsOf(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  return Object.fromEntries(error.fieldErrors.map((f) => [f.path, f.message]));
}
