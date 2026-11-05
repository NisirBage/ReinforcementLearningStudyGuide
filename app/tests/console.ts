// Shared with tests/setup.ts: lets a test declare console.error output it deliberately causes (e.g. React
// reporting an error that an error boundary caught). Anything else still fails the test.
export const allowed: RegExp[] = [];
export const allowConsoleError = (re: RegExp) => void allowed.push(re);
