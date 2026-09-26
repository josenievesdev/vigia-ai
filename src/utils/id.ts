let counter = 0;

/** IDs únicos locales. Cuando exista backend se podrán reemplazar por UUID del servidor. */
export function createId(prefix: string): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}
