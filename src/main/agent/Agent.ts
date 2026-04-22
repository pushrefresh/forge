import type { BrowserWindow } from 'electron';
import type { CommandRun, PickedElement } from '@shared/types';
import { IPC } from '@shared/ipc';
import { CommandRepo, ActionRepo } from '../db/repositories/commands';
import { ArtifactRepo } from '../db/repositories/artifacts';
import type { TabManager } from '../browser/TabManager';
import type { SiteCrawler } from '../browser/SiteCrawler';
import type {
  ConversationMessage,
  ModelProvider,
  ToolResultBlock,
} from './providers';
import { ToolRegistry, type ToolContext } from './ToolRegistry';
import { ApprovalBroker } from './approval';
import { extractSnapshot } from '../page/extractor';
import { buildMissionContext } from './missionContext';
import { estimateCostUsd } from './pricing';
import { createLogger } from '../utils/logger';
import { GetCurrentPageTool, GetOpenTabsTool, ReadMissionTabsTool } from './tools/read';
import { SummarizePageTool } from './tools/summarize';
import { CompareTabsTool } from './tools/compare';
import { ExtractStructuredTool } from './tools/extract';
import { ClickTool, NavigateTool, ScrollTool, TypeIntoTool } from './tools/interact';
import { SaveToMissionTool } from './tools/save';
import { ScanSiteTool } from './tools/scan';
import { OpenTabsTool, SearchWebTool } from './tools/search';

const log = createLogger('agent');
const MAX_TURNS = 6;

/**
 * The agent is prompted to prefix honest failures with "⚠️ could not complete:"
 * so we can route them away from the "save as summary" success path.
 */
function isDeclaredFailure(text: string): boolean {
  const first = text.trimStart().slice(0, 120).toLowerCase();
  return first.startsWith('⚠️') || first.includes('could not complete');
}

/**
 * Render picked elements as a context block that prefixes the user's prompt.
 * The model gets scoped content — "this specific region of the page" —
 * rather than having to infer intent from the whole page.
 */
function formatPickedElements(elements: PickedElement[]): string {
  const lines: string[] = [];
  lines.push('=== ELEMENTS THE USER PICKED FROM THE PAGE ===');
  lines.push(
    `The user used the in-page picker to attach ${elements.length} element(s) as scoped context. Treat these as the specific region(s) the user is asking about — don't re-scrape the whole page unless you need to.`,
  );
  elements.forEach((el, i) => {
    lines.push('');
    lines.push(`[${i + 1}] from "${el.pageTitle}" (${el.pageUrl})`);
    lines.push(`    selector: ${el.selector}`);
    if (el.imageSrc) lines.push(`    image: ${el.imageSrc}`);
    if (el.text) {
      lines.push('    text:');
      for (const t of el.text.split('\n')) lines.push('      ' + t);
    }
    if (el.html) {
      lines.push('    html:');
      for (const h of el.html.split('\n').slice(0, 20)) lines.push('      ' + h);
    }
  });
  lines.push('=== END PICKED ELEMENTS ===');
  return lines.join('\n');
}

export class Agent {
  readonly registry = new ToolRegistry();
  readonly approvals: ApprovalBroker;
  private cancelFlags = new Map<string, boolean>();

  constructor(
    private readonly win: BrowserWindow,
    private readonly tabs: TabManager,
    private readonly crawler: SiteCrawler,
    private readonly provider: () => ModelProvider,
  ) {
    this.approvals = new ApprovalBroker(win);
    this.registry.register(GetCurrentPageTool);
    this.registry.register(GetOpenTabsTool);
    this.registry.register(ReadMissionTabsTool);
    this.registry.register(SummarizePageTool);
    this.registry.register(CompareTabsTool);
    this.registry.register(ExtractStructuredTool);
    this.registry.register(ScanSiteTool);
    this.registry.register(SearchWebTool);
    this.registry.register(OpenTabsTool);
    this.registry.register(NavigateTool);
    this.registry.register(ClickTool);
    this.registry.register(TypeIntoTool);
    this.registry.register(ScrollTool);
    this.registry.register(SaveToMissionTool);
  }

  cancel(commandRunId: string) {
    this.cancelFlags.set(commandRunId, true);
  }

  async runCommand(args: {
    prompt: string;
    workspaceId: string | null;
    missionId: string | null;
    tabId: string | null;
    pickedElements?: PickedElement[];
  }): Promise<CommandRun> {
    const provider = this.provider();
    const run = await CommandRepo.create({
      prompt: args.prompt,
      workspaceId: args.workspaceId,
      missionId: args.missionId,
      provider: provider.name,
      model: provider.model,
    });
    this.emitCommand(run);

    this.execute(
      run.id,
      args.prompt,
      args.missionId,
      args.tabId,
      args.pickedElements ?? [],
      provider,
    ).catch((err) => {
      log.error('execute failed', { id: run.id, err: String(err) });
      CommandRepo.setStatus(
        run.id,
        'failed',
        `Agent error: ${err instanceof Error ? err.message : String(err)}`,
      ).then((r) => r && this.emitCommand(r));
    });

    return run;
  }

  private async execute(
    commandRunId: string,
    prompt: string,
    missionId: string | null,
    tabId: string | null,
    pickedElements: PickedElement[],
    provider: ModelProvider,
  ): Promise<void> {
    await this.update(commandRunId, 'thinking');

    const ctx = this.buildContext(commandRunId, missionId, tabId);
    const providerTools = this.registry.toProviderTools();
    const missionContext = buildMissionContext(missionId, commandRunId);

    const composedUserText =
      pickedElements.length > 0
        ? formatPickedElements(pickedElements) + '\n\n' + prompt
        : prompt;

    const history: ConversationMessage[] = [
      { role: 'user', content: [{ type: 'text', text: composedUserText }] },
    ];

    let lastText = '';
    let inputTokens = 0;
    let outputTokens = 0;

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      if (this.cancelFlags.get(commandRunId)) {
        await this.update(commandRunId, 'cancelled', 'Cancelled by user.');
        return;
      }

      const result = await provider.turn({
        system: missionContext,
        messages: history,
        tools: providerTools,
      });

      history.push(result.assistantMessage);
      if (result.text) lastText = result.text;
      if (result.usage) {
        inputTokens += result.usage.inputTokens;
        outputTokens += result.usage.outputTokens;
        await this.updateUsage(commandRunId, provider.model, inputTokens, outputTokens);
      }

      if (result.done && result.toolCalls.length === 0) {
        const summary = lastText || 'No output.';
        const declaredFailure = isDeclaredFailure(summary);
        await this.update(
          commandRunId,
          declaredFailure ? 'failed' : 'completed',
          summary,
        );
        // Honesty rule: don't persist a failure as a success artifact.
        if (missionId && !declaredFailure) {
          await ArtifactRepo.create({
            missionId,
            commandRunId,
            kind: 'summary',
            title: prompt.slice(0, 100),
            body: summary,
            data: null,
          });
          this.win.webContents.send(
            IPC.EvtArtifactsUpdated,
            ArtifactRepo.list(missionId),
          );
        }
        return;
      }

      if (result.toolCalls.length === 0) {
        // Model produced text but no tool calls and didn't mark done — finish.
        await this.update(commandRunId, 'completed', lastText || 'No output.');
        return;
      }

      const toolResults: ToolResultBlock[] = [];
      for (const call of result.toolCalls) {
        const tool = this.registry.get(call.name);
        if (!tool) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: call.id,
            content: `Unknown tool: ${call.name}`,
            is_error: true,
          });
          continue;
        }
        try {
          const input = tool.input.parse(call.input ?? {});
          await this.update(commandRunId, 'running');
          const out = await tool.run(input, ctx);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: call.id,
            content: typeof out === 'string' ? out : JSON.stringify(out).slice(0, 20000),
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          log.warn('tool error', { name: call.name, message });
          toolResults.push({
            type: 'tool_result',
            tool_use_id: call.id,
            content: message,
            is_error: true,
          });
        }
      }

      history.push({ role: 'user', content: toolResults });
    }

    await this.update(commandRunId, 'completed', lastText || 'Reached max turns.');
  }

  private buildContext(
    commandRunId: string,
    missionId: string | null,
    tabId: string | null,
  ): ToolContext {
    return {
      tabs: this.tabs,
      crawler: this.crawler,
      activeTabId: tabId ?? this.tabs.getActive()?.id ?? null,
      missionId,
      commandRunId,
      snapshotTab: async (targetId) => {
        const view = this.tabs.getViewFor(targetId);
        if (!view) {
          throw new Error(
            'That tab has no live view yet. Navigate it somewhere first (the new-tab home does not load a web view).',
          );
        }
        return extractSnapshot(view.webContents, targetId, missionId);
      },
      requestApproval: async (partial) => {
        const action = await ActionRepo.create({
          commandRunId,
          type: partial.type,
          target: partial.target,
          payload: partial.payload,
          permission: partial.permission,
          requiresApproval: true,
          explanation: partial.explanation,
          resultPreview: null,
        });
        this.win.webContents.send(IPC.EvtActionUpdated, action);
        await this.update(commandRunId, 'awaiting_approval');
        const decision = await this.approvals.request(action);
        await this.update(commandRunId, 'running');
        return decision;
      },
      saveArtifact: async ({ kind, title, body, data }) => {
        if (!missionId) return;
        await ArtifactRepo.create({
          missionId,
          commandRunId,
          kind,
          title,
          body,
          data: data ?? null,
        });
        this.win.webContents.send(
          IPC.EvtArtifactsUpdated,
          ArtifactRepo.list(missionId),
        );
      },
      recordAction: async (partial) => {
        const action = await ActionRepo.create({
          commandRunId,
          type: partial.type,
          target: partial.target,
          payload: partial.payload,
          permission: partial.permission,
          requiresApproval: partial.requiresApproval,
          explanation: partial.explanation,
          resultPreview: partial.resultPreview ?? null,
        });
        if (partial.status) {
          const next = await ActionRepo.setStatus(
            action.id,
            partial.status,
            partial.resultPreview ?? null,
          );
          if (next) this.win.webContents.send(IPC.EvtActionUpdated, next);
        } else {
          this.win.webContents.send(IPC.EvtActionUpdated, action);
        }
        return { id: action.id };
      },
      finalizeAction: async (id, status, resultPreview) => {
        const next = await ActionRepo.setStatus(id, status, resultPreview ?? null);
        if (next) this.win.webContents.send(IPC.EvtActionUpdated, next);
      },
    };
  }

  private async update(id: string, status: CommandRun['status'], resultSummary?: string) {
    const next = await CommandRepo.patch(id, {
      status,
      ...(resultSummary !== undefined ? { resultSummary } : {}),
    });
    if (next) this.emitCommand(next);
  }

  private async updateUsage(
    id: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
  ) {
    const costUsd = estimateCostUsd(model, inputTokens, outputTokens);
    const next = await CommandRepo.patch(id, { inputTokens, outputTokens, costUsd });
    if (next) this.emitCommand(next);
  }

  private emitCommand(run: CommandRun) {
    this.win.webContents.send(IPC.EvtCommandUpdated, run);
  }
}
