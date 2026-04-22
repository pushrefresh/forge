// JavaScript we inject into page WebContents to extract structured info.
// Kept as a template string so it survives bundling. Returns JSON-safe data.

export const EXTRACTOR_SCRIPT = String.raw`
(() => {
  function textOf(node) {
    if (!node) return '';
    return (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function collectMeta() {
    const get = (sel) => {
      const el = document.querySelector(sel);
      return el ? el.getAttribute('content') : null;
    };
    return {
      url: location.href,
      title: document.title || '',
      description:
        get('meta[name="description"]') ||
        get('meta[property="og:description"]') ||
        null,
      favicon:
        (document.querySelector('link[rel="icon"]') || {}).href ||
        (document.querySelector('link[rel="shortcut icon"]') || {}).href ||
        null,
      language: document.documentElement.lang || null,
      siteName: get('meta[property="og:site_name"]') || null,
      ogImage: get('meta[property="og:image"]') || null,
    };
  }

  function collectHeadings() {
    const out = [];
    document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
      const text = textOf(h);
      if (!text || text.length > 240) return;
      out.push({ level: Number(h.tagName.substring(1)), text });
    });
    return out.slice(0, 200);
  }

  function classifyLink(a) {
    const href = a.getAttribute('href') || '';
    const text = textOf(a).toLowerCase();
    const inNav = !!a.closest('nav, header');
    const ctaHints = ['sign up', 'get started', 'book', 'try', 'start', 'buy', 'contact', 'demo', 'subscribe', 'download'];
    if (ctaHints.some((c) => text.includes(c))) return 'cta';
    if (inNav) return 'nav';
    if (href && href.length) return 'content';
    return 'unknown';
  }

  function collectLinks() {
    const out = [];
    document.querySelectorAll('a[href]').forEach((a) => {
      const href = a.href;
      const text = textOf(a);
      if (!text || !href || href.startsWith('javascript:')) return;
      out.push({ text: text.slice(0, 160), href, kind: classifyLink(a) });
    });
    // dedupe by href
    const seen = new Set();
    return out.filter((l) => (seen.has(l.href) ? false : (seen.add(l.href), true))).slice(0, 300);
  }

  function collectForms() {
    return Array.from(document.querySelectorAll('form')).map((f, i) => ({
      id: f.id || 'form_' + i,
      action: f.getAttribute('action'),
      method: f.getAttribute('method'),
      fields: Array.from(f.querySelectorAll('input, textarea, select')).map((el) => {
        const name = el.getAttribute('name') || el.getAttribute('id') || '';
        const type = el.getAttribute('type') || el.tagName.toLowerCase();
        let label = null;
        const id = el.getAttribute('id');
        if (id) {
          const lbl = document.querySelector('label[for="' + id + '"]');
          if (lbl) label = textOf(lbl);
        }
        if (!label) {
          const wrap = el.closest('label');
          if (wrap) label = textOf(wrap);
        }
        if (!label) label = el.getAttribute('placeholder') || el.getAttribute('aria-label') || null;
        return { name, type, label };
      }),
    }));
  }

  /**
   * Readability-lite. Picks the densest large block of text.
   */
  function pickMainText() {
    const candidates = Array.from(document.querySelectorAll('main, article, [role="main"], #content, .content, .post, .prose, body'));
    let best = document.body;
    let bestScore = 0;
    for (const c of candidates) {
      const paragraphs = c.querySelectorAll('p, li');
      const words = textOf(c).split(/\s+/).length;
      const score = paragraphs.length * 10 + words;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    const parts = [];
    best.querySelectorAll('h1, h2, h3, h4, p, li, blockquote').forEach((el) => {
      const t = textOf(el);
      if (t && t.length > 1) parts.push(t);
    });
    const text = parts.join('\n').slice(0, 18000);
    return text || textOf(best).slice(0, 18000);
  }

  function buildDigest(meta, headings, mainText) {
    const lines = [];
    lines.push('URL: ' + meta.url);
    lines.push('TITLE: ' + meta.title);
    if (meta.description) lines.push('DESCRIPTION: ' + meta.description);
    if (headings.length) {
      lines.push('\n# OUTLINE');
      headings.slice(0, 60).forEach((h) => {
        lines.push('  '.repeat(h.level - 1) + '- ' + h.text);
      });
    }
    lines.push('\n# CONTENT');
    lines.push(mainText);
    return lines.join('\n').slice(0, 22000);
  }

  const meta = collectMeta();
  const headings = collectHeadings();
  const links = collectLinks();
  const forms = collectForms();
  const mainText = pickMainText();

  return {
    metadata: meta,
    headings,
    links,
    forms,
    mainText,
    digest: buildDigest(meta, headings, mainText),
  };
})();
`;

export const CLICK_SEMANTIC_SCRIPT = (target: string) => `
(() => {
  const target = ${JSON.stringify(target)}.toLowerCase();
  function visible(el) {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  }
  const candidates = Array.from(document.querySelectorAll('a, button, [role="button"], input[type="submit"]'));
  const scored = candidates
    .filter(visible)
    .map((el) => {
      const text = (el.innerText || el.textContent || el.getAttribute('aria-label') || el.getAttribute('value') || '').trim().toLowerCase();
      const score = text.includes(target) ? (text === target ? 100 : 50 + (target.length / Math.max(text.length,1)) * 30) : 0;
      return { el, text, score };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return { ok: false, reason: 'no matching element' };
  scored[0].el.click();
  return { ok: true, text: scored[0].text };
})();
`;

export const SCROLL_SCRIPT = (direction: 'up' | 'down' | 'top' | 'bottom') => `
(() => {
  const h = window.innerHeight;
  switch (${JSON.stringify(direction)}) {
    case 'up': window.scrollBy({ top: -h * 0.8, behavior: 'smooth' }); break;
    case 'down': window.scrollBy({ top: h * 0.8, behavior: 'smooth' }); break;
    case 'top': window.scrollTo({ top: 0, behavior: 'smooth' }); break;
    case 'bottom': window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); break;
  }
  return { ok: true };
})();
`;
