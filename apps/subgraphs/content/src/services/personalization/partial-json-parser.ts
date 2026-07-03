export class PartialJsonParser {
  private buffer = '';
  private depth = 0;
  private inString = false;
  private escape = false;
  private braceStack: number[] = [];
  private seenTopLevelClose = false;

  feed(chunk: string): unknown[] {
    this.buffer += chunk;
    return this.parseBuffer();
  }

  private parseBuffer(): unknown[] {
    const completed: unknown[] = [];
    let pos = 0;

    while (pos < this.buffer.length) {
      const ch = this.buffer[pos]!;

      if (this.escape) {
        this.escape = false;
        pos++;
        continue;
      }

      if (this.inString) {
        if (ch === '\\') {
          this.escape = true;
        } else if (ch === '"') {
          this.inString = false;
        }
        pos++;
        continue;
      }

      if (ch === '"') {
        this.inString = true;
        pos++;
        continue;
      }

      if (ch === '{') {
        this.braceStack.push(pos);
        this.depth++;
        pos++;
        continue;
      }

      if (ch === '}') {
        this.depth--;
        if (this.depth === 0) {
          this.seenTopLevelClose = true;
        }
        const start = this.braceStack.pop();
        if (start !== undefined) {
          const end = pos + 1;
          const objStr = this.buffer.slice(start, end);
          try {
            const parsed = JSON.parse(objStr);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'component' in parsed && 'priority' in parsed) {
              completed.push(parsed);
            }
          } catch {
            // Not yet a valid complete object
          }
        }
        pos++;
        continue;
      }

      pos++;
    }

    if (completed.length > 0) {
      const lastEnd = this.buffer.lastIndexOf('}');
      if (lastEnd >= 0) {
        const afterLastObject = this.buffer.slice(lastEnd + 1);
        this.buffer = afterLastObject;
        this.depth = 0;
        this.inString = false;
        this.escape = false;
        this.braceStack = [];
        for (const ch of this.buffer) {
          if (this.escape) { this.escape = false; continue; }
          if (this.inString) { if (ch === '\\') this.escape = true; else if (ch === '"') this.inString = false; continue; }
          if (ch === '"') { this.inString = true; continue; }
          if (ch === '{') this.depth++;
          if (ch === '}') { this.depth = Math.max(0, this.depth - 1); if (this.depth === 0) this.seenTopLevelClose = true; }
        }
      }
    }

    return completed;
  }

  get isComplete(): boolean {
    return this.seenTopLevelClose;
  }

  reset(): void {
    this.buffer = '';
    this.depth = 0;
    this.inString = false;
    this.escape = false;
    this.braceStack = [];
    this.seenTopLevelClose = false;
  }
}
