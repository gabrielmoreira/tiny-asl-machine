export function clone<T = unknown>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
