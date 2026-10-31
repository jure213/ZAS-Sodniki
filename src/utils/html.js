// HTML escaping for values interpolated into template strings that end up in
// innerHTML. Every value that comes from the database, a file, the user or an
// error message must go through esc(), in element content and in attributes.

const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

// Escapes text and keeps its line breaks visible.
export function escMultiline(value) {
  return esc(value).replace(/\r?\n/g, '<br>');
}
