// Suppress React 19's act() console.error for async state updates that happen
// inside useEffect after renderHook completes. These are expected in RNTL 13 +
// React 19 when hooks fire async work on mount — all tests still assert correctly.
const originalError = console.error.bind(console);
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    const msg = typeof args[0] === "string" ? args[0] : "";
    if (msg.includes("not wrapped in act(...)")) return;
    originalError(...args);
  };
});
afterAll(() => {
  console.error = originalError;
});
