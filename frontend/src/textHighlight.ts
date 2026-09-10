/** A slice of text, flagged when it matches the active search term. */
export interface TextSegment {
  text: string;
  match: boolean;
}

/**
 * Splits text into matched and unmatched segments for the given query.
 *
 * Uses plain case-insensitive `indexOf` rather than a RegExp: log lines and
 * filters routinely contain characters like `(`, `[`, `*` and `?`, which would
 * otherwise need escaping and could build an invalid pattern.
 */
export function highlightSegments(text: string, query: string): TextSegment[] {
  const needle = query.trim();
  if (!needle) return [{ text, match: false }];

  const haystack = text.toLowerCase();
  const target = needle.toLowerCase();
  const segments: TextSegment[] = [];

  let cursor = 0;
  let found = haystack.indexOf(target, cursor);

  while (found !== -1) {
    if (found > cursor) {
      segments.push({ text: text.slice(cursor, found), match: false });
    }
    segments.push({ text: text.slice(found, found + needle.length), match: true });
    cursor = found + needle.length;
    found = haystack.indexOf(target, cursor);
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), match: false });
  }

  return segments;
}
