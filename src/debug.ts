let debugEnabled = false;

export function enableDebug(): void {
  debugEnabled = true;
}

export function isDebugEnabled(): boolean {
  return debugEnabled;
}

export function debug(message: string): void {
  if (debugEnabled) {
    console.error(`[debug] ${message}`);
  }
}
