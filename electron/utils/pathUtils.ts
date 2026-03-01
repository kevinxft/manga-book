import path from 'node:path';

export function normalizeAbsolutePath(input: string): string {
  const resolved = path.resolve(input.trim());
  return path.normalize(resolved);
}

export function pathToDisplayName(input: string): string {
  const normalized = normalizeAbsolutePath(input);
  return path.basename(normalized);
}

export function toKey(value: string): string {
  return value.trim().toLocaleLowerCase();
}
