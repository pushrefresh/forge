import { z } from 'zod';
import type { Tool } from '../ToolRegistry';
import { CLICK_SEMANTIC_SCRIPT, SCROLL_SCRIPT } from '../../page/scripts';
import { isSensitiveUrl } from '../../security/permissions';

export const NavigateTool: Tool<{ url: string; tabId?: string }, { url: string }> = {
  name: 'navigate',
  description:
    'Navigate the active tab (or specified tab) to a URL. Sensitive URL patterns require approval.',
  permission: 'interact',
  input: z.object({ url: z.string(), tabId: z.string().optional() }),
  async run({ url, tabId }, ctx) {
    const targetId = tabId || ctx.activeTabId;
    if (!targetId) throw new Error('No active tab');

    const sensitive = isSensitiveUrl(url);
    if (sensitive) {
      const decision = await ctx.requestApproval({
        type: 'navigate',
        target: url,
        payload: { url },
        explanation: `Navigate to a sensitive URL: ${url}`,
        permission: 'sensitive',
      });
      if (decision !== 'approved') {
        return { url };
      }
    }

    const { id } = await ctx.recordAction({
      type: 'navigate',
      target: url,
      payload: { url },
      explanation: `Navigate active tab to ${url}`,
      permission: sensitive ? 'sensitive' : 'interact',
      requiresApproval: sensitive,
      status: 'executing',
    });
    try {
      await ctx.tabs.navigate(targetId, url);
      await ctx.finalizeAction(id, 'done', url);
    } catch (err) {
      await ctx.finalizeAction(id, 'failed', err instanceof Error ? err.message : String(err));
      throw err;
    }
    return { url };
  },
};

export const ClickTool: Tool<{ target: string; tabId?: string }, { ok: boolean; matched?: string }> = {
  name: 'click',
  description:
    'Click the element whose visible text best matches the semantic target. Never auto-submits forms.',
  permission: 'interact',
  input: z.object({ target: z.string(), tabId: z.string().optional() }),
  async run({ target, tabId }, ctx) {
    const targetId = tabId || ctx.activeTabId;
    if (!targetId) throw new Error('No active tab');

    const view = ctx.tabs.getViewFor(targetId);
    if (!view) throw new Error('Tab has no live view');

    const { id } = await ctx.recordAction({
      type: 'click',
      target,
      payload: { target },
      explanation: `Click element matching "${target}"`,
      permission: 'interact',
      requiresApproval: false,
      status: 'executing',
    });

    try {
      const res = (await view.webContents.executeJavaScript(
        CLICK_SEMANTIC_SCRIPT(target),
        true,
      )) as { ok: boolean; reason?: string; text?: string };
      await ctx.finalizeAction(
        id,
        res.ok ? 'done' : 'failed',
        res.ok ? (res.text ?? target) : (res.reason ?? 'no match'),
      );
      return { ok: res.ok, matched: res.text };
    } catch (err) {
      await ctx.finalizeAction(id, 'failed', err instanceof Error ? err.message : String(err));
      throw err;
    }
  },
};

export const TypeIntoTool: Tool<
  { target: string; value: string; tabId?: string },
  { ok: boolean }
> = {
  name: 'type_into',
  description:
    'Type a value into a field labeled by "target". ALWAYS requires approval — the harness will show the user what will be typed.',
  permission: 'sensitive',
  input: z.object({
    target: z.string(),
    value: z.string(),
    tabId: z.string().optional(),
  }),
  async run({ target, value, tabId }, ctx) {
    const targetId = tabId || ctx.activeTabId;
    if (!targetId) throw new Error('No active tab');

    const decision = await ctx.requestApproval({
      type: 'type_into',
      target,
      payload: { target, value },
      explanation: `Type "${value}" into field labeled "${target}"`,
      permission: 'sensitive',
    });
    if (decision !== 'approved') return { ok: false };

    const view = ctx.tabs.getViewFor(targetId);
    if (!view) throw new Error('Tab has no live view');

    const script = `
      (() => {
        const target = ${JSON.stringify(target)}.toLowerCase();
        const value = ${JSON.stringify(value)};
        function visible(el){ const r = el.getBoundingClientRect(); return r.width>0 && r.height>0; }
        const fields = Array.from(document.querySelectorAll('input, textarea'));
        let best=null, bestScore=0;
        for (const el of fields){
          if (!visible(el)) continue;
          const id = el.getAttribute('id') || '';
          const placeholder = el.getAttribute('placeholder') || '';
          const aria = el.getAttribute('aria-label') || '';
          let labelText = '';
          if (id) { const l = document.querySelector('label[for="'+id+'"]'); if (l) labelText = (l.innerText||'').toLowerCase(); }
          const lbl = (labelText + ' ' + placeholder + ' ' + aria).toLowerCase();
          const score = lbl.includes(target) ? 50 + (target.length / Math.max(lbl.length,1)) * 40 : 0;
          if (score > bestScore){ best = el; bestScore = score; }
        }
        if (!best) return { ok:false };
        best.focus();
        const proto = Object.getPrototypeOf(best);
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(best, value);
        best.dispatchEvent(new Event('input', { bubbles: true }));
        best.dispatchEvent(new Event('change', { bubbles: true }));
        return { ok:true };
      })();
    `;
    const { id } = await ctx.recordAction({
      type: 'type_into',
      target,
      payload: { target, value },
      explanation: `Type into "${target}"`,
      permission: 'sensitive',
      requiresApproval: true,
      status: 'executing',
    });
    try {
      const res = (await view.webContents.executeJavaScript(script, true)) as { ok: boolean };
      await ctx.finalizeAction(id, res.ok ? 'done' : 'failed', res.ok ? value : 'no matching field');
      return res;
    } catch (err) {
      await ctx.finalizeAction(id, 'failed', err instanceof Error ? err.message : String(err));
      throw err;
    }
  },
};

export const ScrollTool: Tool<
  { direction: 'up' | 'down' | 'top' | 'bottom'; tabId?: string },
  { ok: boolean }
> = {
  name: 'scroll',
  description: 'Scroll the active tab.',
  permission: 'interact',
  input: z.object({
    direction: z.enum(['up', 'down', 'top', 'bottom']),
    tabId: z.string().optional(),
  }),
  async run({ direction, tabId }, ctx) {
    const targetId = tabId || ctx.activeTabId;
    if (!targetId) throw new Error('No active tab');
    const view = ctx.tabs.getViewFor(targetId);
    if (!view) throw new Error('Tab has no live view');
    await ctx.recordAction({
      type: 'scroll',
      target: direction,
      payload: { direction },
      explanation: `Scroll ${direction}`,
      permission: 'interact',
      requiresApproval: false,
      status: 'done',
    });
    await view.webContents.executeJavaScript(SCROLL_SCRIPT(direction), true);
    return { ok: true };
  },
};
