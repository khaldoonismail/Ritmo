export function randomPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// Generates `count` 4-digit PINs guaranteed not to collide with each other
// or with any PIN in `taken` (e.g. PINs already used in the same class).
export function generateUniquePins(count: number, taken: Iterable<string>): string[] {
  const used = new Set(taken);
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    let pin = randomPin();
    while (used.has(pin)) {
      pin = randomPin();
    }
    used.add(pin);
    result.push(pin);
  }
  return result;
}
