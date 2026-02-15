import * as clack from '@clack/prompts';

export default clack;

export function isCancel(value: unknown): value is symbol {
  return clack.isCancel(value);
}

export async function abortIfCancelled<T>(
  input: T | Promise<T>,
): Promise<Exclude<T, symbol>> {
  const result = await input;
  if (clack.isCancel(result)) {
    clack.cancel('Setup cancelled.');
    process.exit(0);
  }
  return result as Exclude<T, symbol>;
}
