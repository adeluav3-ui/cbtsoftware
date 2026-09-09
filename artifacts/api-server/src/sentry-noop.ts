// No-op Sentry stub for local (offline) builds.
// The local server has no DSN and no internet access — Sentry is never active.
// This file is aliased over @sentry/node by build-local.mjs so the full
// @sentry/node package (and its heavy OpenTelemetry dependencies) are excluded
// from the local bundle entirely.

export const init = (_options?: unknown) => {};
export const setupExpressErrorHandler = (_app: unknown) => {};
export const getClient = () => undefined;
export const captureException = (_err: unknown) => {};
export const captureMessage = (_msg: string) => {};
export const withScope = (_cb: (scope: unknown) => void) => {};
export const setContext = (_key: string, _val: unknown) => {};
export const setUser = (_user: unknown) => {};
export const setTag = (_key: string, _val: string) => {};
