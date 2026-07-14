/** Simulated network latency for mock services. Replace with real fetch later. */
export function mockDelay(ms = 280): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
