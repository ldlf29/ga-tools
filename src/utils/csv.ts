/**
 * Parse a CSV line respecting quoted fields.
 * Handles escaped quotes ("") and commas within quoted strings.
 */
export function parseCSVLine(text: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuote) {
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        cur += char;
      }
    } else {
      if (char === '"') {
        inQuote = true;
      } else if (char === ',') {
        result.push(cur);
        cur = '';
      } else {
        cur += char;
      }
    }
  }
  result.push(cur);
  return result;
}
