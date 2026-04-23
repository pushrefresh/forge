/**
 * Scripts injected into a tab's renderer context to detect and fill login
 * forms. Kept as raw strings rather than a compiled module because
 * webContents.executeJavaScript expects a source string and these need to
 * work against arbitrary third-party pages (no closures / deps).
 *
 * Forms on modern sites (React, Vue, Svelte) intercept value changes via
 * synthetic events — plain `el.value = x` often leaves the framework's
 * state out of sync. The trick is to call the native HTMLInputElement
 * value setter directly, then dispatch `input` + `change` events so the
 * framework listeners fire normally.
 */

/** Snapshot the visible login form on the page for the save flow. */
export const SNAPSHOT_FORM_SCRIPT = `
(function() {
  function visible(el) {
    if (!el || el.disabled) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    return true;
  }
  // Prefer the first visible password field — most login forms have exactly one.
  const pw = Array.prototype.find.call(
    document.querySelectorAll('input[type="password"]'),
    visible
  );
  if (!pw) return null;
  const form = pw.closest('form');
  // Username candidates in priority order: explicit email/tel/username, then
  // any non-hidden text-ish input that sits before the password field.
  var usernameEl = null;
  if (form) {
    usernameEl =
      form.querySelector('input[type="email"]') ||
      form.querySelector('input[autocomplete*="username"]') ||
      form.querySelector('input[autocomplete*="email"]') ||
      form.querySelector('input[name*="user" i]') ||
      form.querySelector('input[name*="email" i]') ||
      form.querySelector('input[type="tel"]') ||
      form.querySelector('input[type="text"]:not([type="hidden"])');
  }
  if (!usernameEl) {
    // No form element — fall back to the first text-ish input before the password
    // in document order (covers Google-style multi-step pages where password is
    // on a separate render).
    var all = Array.prototype.slice.call(
      document.querySelectorAll('input:not([type="hidden"]):not([type="password"])')
    );
    var before = [];
    for (var i = 0; i < all.length; i++) {
      if (all[i].compareDocumentPosition(pw) & Node.DOCUMENT_POSITION_FOLLOWING) {
        before.push(all[i]);
      }
    }
    usernameEl = before.filter(visible).pop() || null;
  }
  return {
    username: usernameEl && typeof usernameEl.value === 'string' ? usernameEl.value : '',
    password: typeof pw.value === 'string' ? pw.value : '',
    hasUsernameField: !!usernameEl,
  };
})()
`;

/**
 * Build the fill script with a credential inlined. Inline is intentional —
 * the alternative (window.__forge_credential) would leave the password in
 * global scope where page JS could read it.
 */
export function buildFillScript(username: string, password: string): string {
  const u = JSON.stringify(username);
  const p = JSON.stringify(password);
  return `
(function(creds) {
  function visible(el) {
    if (!el || el.disabled) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const style = window.getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none';
  }
  function setNative(el, value) {
    var proto = Object.getPrototypeOf(el);
    var desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  var pw = Array.prototype.find.call(
    document.querySelectorAll('input[type="password"]'),
    visible
  );
  if (!pw) return { ok: false, reason: 'no password field visible' };
  var form = pw.closest('form');
  var usernameEl = null;
  if (form) {
    usernameEl =
      form.querySelector('input[type="email"]') ||
      form.querySelector('input[autocomplete*="username"]') ||
      form.querySelector('input[autocomplete*="email"]') ||
      form.querySelector('input[name*="user" i]') ||
      form.querySelector('input[name*="email" i]') ||
      form.querySelector('input[type="tel"]') ||
      form.querySelector('input[type="text"]:not([type="hidden"])');
  }
  if (usernameEl && visible(usernameEl) && creds.username) {
    usernameEl.focus();
    setNative(usernameEl, creds.username);
  }
  pw.focus();
  setNative(pw, creds.password);
  return { ok: true, hasUsername: !!usernameEl };
})({ username: ${u}, password: ${p} })
`;
}
