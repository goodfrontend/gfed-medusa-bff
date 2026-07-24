let _lastInput = 0;
let _lastOutput = 0;

export function setTokenUsage(input: number, output: number): void {
  _lastInput = input;
  _lastOutput = output;
}

export function getTokenUsage(): { input: number; output: number } | null {
  if (_lastInput === 0 && _lastOutput === 0) return null;
  return { input: _lastInput, output: _lastOutput };
}
