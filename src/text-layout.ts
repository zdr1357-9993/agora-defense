/** Lossless Unicode wrapping for canvas dialogue. No ellipsis or character slicing. */
export function wrapCanvasText(text: string, maxWidth: number, measure: (text: string) => number): string[] {
  const lines: string[] = []; let line = '';
  for (const character of Array.from(text)) {
    if (character === '\n') { lines.push(line); line = ''; continue; }
    if (line && measure(line + character) > maxWidth) { lines.push(line); line = ''; }
    line += character;
  }
  if (line || !lines.length) lines.push(line);
  return lines;
}
