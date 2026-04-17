declare module 'deep-iterator' {
  export type DeepIteratorEntry = {
    key: string | number;
    value: unknown;
    parent: Record<string | number, unknown>;
  };

  export default function deepIterator(value: unknown): Iterable<DeepIteratorEntry>;
}
