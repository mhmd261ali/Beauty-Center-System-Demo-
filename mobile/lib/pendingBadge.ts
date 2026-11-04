const listeners = new Set<(count: number) => void>();
let latest = 0;

export function publishPendingCount(count: number) {
  latest = count;
  listeners.forEach((listener) => listener(count));
}

export function subscribePendingCount(listener: (count: number) => void) {
  listeners.add(listener);
  listener(latest);
  return () => {
    listeners.delete(listener);
  };
}
