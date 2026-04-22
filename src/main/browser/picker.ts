import type { PickedElement } from '@shared/types';
import type { TabManager } from './TabManager';
import { nanoid } from 'nanoid';
import { createLogger } from '../utils/logger';

const log = createLogger('picker');

interface RawPick {
  tag: string;
  selector: string;
  text: string;
  html: string;
  rect: { x: number; y: number; width: number; height: number };
  imageSrc: string | null;
}

/**
 * Inject a lightweight picker into the active tab's WebContents. The user
 * hovers to highlight DOM nodes, clicks to select, or presses Escape to
 * cancel. Returns the picked element (or null if cancelled).
 *
 * The injected script runs in the tab's renderer context (sandboxed from
 * the main process) and resolves the outer `executeJavaScript` promise with
 * the capture — or `null` on cancel.
 */
export class Picker {
  private activeTabId: string | null = null;

  constructor(private readonly tabs: TabManager) {}

  async start(tabId: string): Promise<PickedElement | null> {
    const view = this.tabs.getViewFor(tabId);
    if (!view) {
      throw new Error('pick target tab has no live web view');
    }
    if (this.activeTabId) {
      // Already picking — cancel the prior one.
      await this.cancel();
    }
    this.activeTabId = tabId;

    try {
      const result = (await view.webContents.executeJavaScript(
        PICKER_SCRIPT,
        /* userGesture */ true,
      )) as RawPick | null;

      if (!result) return null;

      const tab = this.tabs.list().find((t) => t.id === tabId);
      return {
        id: nanoid(10),
        tabId,
        pageUrl: tab?.url ?? '',
        pageTitle: tab?.title ?? '',
        tag: result.tag,
        selector: result.selector,
        text: result.text,
        html: result.html,
        rect: result.rect,
        imageSrc: result.imageSrc,
      };
    } catch (err) {
      log.warn('picker failed', { err: String(err) });
      return null;
    } finally {
      this.activeTabId = null;
    }
  }

  async cancel(): Promise<void> {
    const tabId = this.activeTabId;
    if (!tabId) return;
    const view = this.tabs.getViewFor(tabId);
    if (!view) return;
    try {
      // The script listens on window.__forge_picker_cancel.
      await view.webContents.executeJavaScript(
        `(function(){ if (window.__forge_picker_cancel) window.__forge_picker_cancel(); })()`,
        true,
      );
    } catch {
      /* ignore */
    }
  }
}

/**
 * The picker script. Runs inside the tab's page. Resolves the outer
 * executeJavaScript promise with a RawPick on click, or null on escape /
 * programmatic cancel.
 *
 * Intentionally self-contained + defensive against page CSS (uses a very
 * high z-index, inline styles via style attribute on dynamically created
 * nodes only, no global style pollution beyond our own scoped stylesheet).
 */
const PICKER_SCRIPT = `
(function() {
  return new Promise((resolve) => {
    // Bail if an older picker is still active on this page.
    if (window.__forge_picker_active) {
      resolve(null);
      return;
    }
    window.__forge_picker_active = true;

    var Z = 2147483646;

    var style = document.createElement('style');
    style.setAttribute('data-forge-picker', '1');
    style.textContent = [
      '.__fgpk_hover { outline: 2px solid #B8FF3C !important; outline-offset: -2px !important; box-shadow: 0 0 0 9999px rgba(0,0,0,0.08) !important; cursor: crosshair !important; }',
      '.__fgpk_label { position: fixed; z-index: ' + Z + '; background: #0A0B0D; color: #B8FF3C; padding: 4px 8px; font: 10px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 0.06em; text-transform: uppercase; border: 1px solid #B8FF3C; border-radius: 3px; pointer-events: none; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.4); }',
      '.__fgpk_hint { position: fixed; top: 12px; left: 50%; transform: translateX(-50%); z-index: ' + Z + '; background: #0A0B0D; color: #F0F1F3; padding: 8px 14px; font: 11px/1.2 ui-sans-serif, -apple-system, system-ui, sans-serif; border: 1px solid #2A2D33; border-radius: 6px; pointer-events: none; box-shadow: 0 4px 16px rgba(0,0,0,0.6); }',
      '.__fgpk_hint b { color: #B8FF3C; }',
      '* { cursor: crosshair !important; }',
    ].join('\\n');
    document.head.appendChild(style);

    var label = document.createElement('div');
    label.className = '__fgpk_label';
    label.style.display = 'none';
    document.body.appendChild(label);

    var hint = document.createElement('div');
    hint.className = '__fgpk_hint';
    hint.innerHTML = '<b>click</b> to pick · <b>esc</b> to cancel';
    document.body.appendChild(hint);

    var hovered = null;

    function describe(el) {
      var tag = el.tagName.toLowerCase();
      var id = el.id ? '#' + el.id : '';
      var cls = '';
      if (el.classList && el.classList.length) {
        cls = '.' + [].slice.call(el.classList).slice(0, 2).join('.');
      }
      var kids = el.children ? el.children.length : 0;
      return tag + id + cls + (kids ? ' · ' + kids + ' children' : '');
    }

    function selectorFor(el) {
      var tag = el.tagName.toLowerCase();
      var id = el.id ? '#' + el.id : '';
      var cls = '';
      if (el.classList && el.classList.length) {
        cls = '.' + [].slice.call(el.classList).slice(0, 3).join('.');
      }
      return tag + id + cls;
    }

    function clearHover() {
      if (hovered && hovered.classList) hovered.classList.remove('__fgpk_hover');
      hovered = null;
    }

    function setHover(el) {
      if (el === hovered) return;
      clearHover();
      hovered = el;
      if (el && el.classList) el.classList.add('__fgpk_hover');
    }

    function onMove(e) {
      // Prefer the deepest element under the cursor that isn't our own UI.
      var el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el === label || el === hint || el === style) return;
      // Skip html/body as direct picks — they're almost never what you want.
      if (el === document.body || el === document.documentElement) {
        clearHover();
        label.style.display = 'none';
        return;
      }
      setHover(el);
      label.textContent = describe(el);
      label.style.display = 'block';
      var lx = e.clientX + 14;
      var ly = e.clientY - 22;
      if (lx + 240 > window.innerWidth) lx = window.innerWidth - 244;
      if (ly < 6) ly = e.clientY + 18;
      label.style.left = lx + 'px';
      label.style.top = ly + 'px';
    }

    function capture(el) {
      var rect = el.getBoundingClientRect();
      var text = (el.textContent || '').replace(/\\s+/g, ' ').trim();
      if (text.length > 2000) text = text.slice(0, 2000) + '…';
      var html = (el.outerHTML || '');
      if (html.length > 5000) html = html.slice(0, 5000) + '…';
      var imageSrc = null;
      if (el.tagName && el.tagName.toLowerCase() === 'img') {
        imageSrc = el.currentSrc || el.src || null;
      }
      return {
        tag: el.tagName.toLowerCase(),
        selector: selectorFor(el),
        text: text,
        html: html,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        imageSrc: imageSrc,
      };
    }

    function cleanup() {
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', onScroll, true);
      clearHover();
      try { style.remove(); } catch (_) {}
      try { label.remove(); } catch (_) {}
      try { hint.remove(); } catch (_) {}
      window.__forge_picker_active = false;
      window.__forge_picker_cancel = null;
    }

    function onClick(e) {
      // Don't let the page's own click handlers fire.
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (!hovered) {
        cleanup();
        resolve(null);
        return;
      }
      var pick = capture(hovered);
      cleanup();
      resolve(pick);
    }

    function onKey(e) {
      if (e.key === 'Escape' || e.keyCode === 27) {
        e.preventDefault();
        e.stopPropagation();
        cleanup();
        resolve(null);
      }
    }

    function onScroll() {
      label.style.display = 'none';
      clearHover();
    }

    window.__forge_picker_cancel = function() {
      cleanup();
      resolve(null);
    };

    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', onScroll, true);
  });
})()
`;
