// Tiny allow-list HTML sanitiser shared by the server (require) and browser
// (window.SanitizeHtml). Operators may use light HTML in ad text / announcement
// body; everything else is stripped so stored content can never inject scripts.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SanitizeHtml = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const ALLOWED = new Set(['a', 'b', 'strong', 'i', 'em', 'u', 's', 'br', 'p', 'span', 'ul', 'ol', 'li', 'small']);

  function attrEsc(v) {
    return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function safeHref(raw) {
    const u = String(raw || '').trim();
    return (/^https?:\/\//i.test(u) || u[0] === '/') ? u : '';
  }

  function sanitize(input) {
    let s = String(input == null ? '' : input);
    // Drop entire script/style blocks first.
    s = s.replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
    // Rebuild tags against the allow-list; discard every attribute except a[href].
    s = s.replace(/<\s*\/?\s*([a-zA-Z0-9]+)((?:[^>"']|"[^"]*"|'[^']*')*)>/g, (m, tag, attrs) => {
      const t = String(tag).toLowerCase();
      if (!ALLOWED.has(t)) return ''; // strip unknown tag, keep inner text
      if (t === 'br') return '<br>';
      if (m.replace(/<\s*/, '').startsWith('/')) return `</${t}>`;
      if (t === 'a') {
        const hm = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs || '');
        const url = safeHref(hm ? (hm[1] != null ? hm[1] : hm[2] != null ? hm[2] : hm[3]) : '');
        if (!url) return ''; // unsafe href -> drop the tag, keep text
        return `<a href="${attrEsc(url)}" target="_blank" rel="noopener noreferrer nofollow">`;
      }
      return `<${t}>`;
    });
    return s;
  }
  function stripTags(input) {
    return String(input == null ? '' : input).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }
  const api = function (input) { return sanitize(input); };
  api.sanitize = sanitize;
  api.strip = stripTags;
  return api;
});
