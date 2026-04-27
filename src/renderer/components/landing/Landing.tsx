import { ArrowRight } from 'lucide-react';
import { useForgeStore } from '../../state/store';
import { enterFreeRoam } from '../../lib/scope';
import { cn } from '../../lib/cn';

/**
 * Frame 1 — the app's entry point after first-run onboarding.
 *
 * Full-bleed background image with a dark gradient mask. A glassmorphism
 * panel holds the hero + two mode cards. White type on the dark canvas.
 * Chrome row (rendered by the shell) picks up a glass variant on this
 * route, not the solid white pill used on dashboard/tab views.
 *
 * Clicking the Forge logo anywhere in the app returns here.
 */
export function Landing() {
  const tabs = useForgeStore((s) => s.tabs);
  const missions = useForgeStore((s) => s.missions);
  const setView = useForgeStore((s) => s.setView);
  const selectWorkspace = useForgeStore((s) => s.selectWorkspace);
  const selectMission = useForgeStore((s) => s.selectMission);
  const toast = useForgeStore((s) => s.toast);

  const freeRoamTabCount = tabs.filter((t) => !t.missionId).length;
  const missionCount = missions.length;

  async function onFreeRoam() {
    try {
      await enterFreeRoam();
    } catch (err) {
      toast('error', `couldn't open a tab: ${String(err)}`);
    }
  }

  function onMissions() {
    selectMission(null);
    selectWorkspace(null);
    setView('dashboard');
  }

  return (
    <div className="relative min-h-full w-full flex flex-col">
      {/* Background image + gradient is rendered by AppShell behind the
          whole view so it extends up beneath the chrome row. */}

      {/* Content — centered glass panel. Animation stack:
          1. animate-panel-in plays once on mount (mount drift — transform).
          2. animate-float runs forever on the same element — animates
             `top` (not transform) so the panel's backdrop-filter can
             still see through to the AppShell-level background image.
             Any ancestor transform here would isolate the blur. */}
      <div className="relative flex-1 flex items-center justify-center px-10 py-16">
        <div
          className={cn(
            'relative flex flex-col gap-6 p-10 rounded-[24px]',
            'bg-white/25 border border-white/25',
            'backdrop-blur-[20px]',
            'shadow-[0_4px_50px_0_rgba(0,0,0,0.4)]',
          )}
          style={{
            width: 600,
            // Two animations composed inline: the mount drift (transform-based)
            // runs once, then the ambient top-based float takes over. A single
            // Tailwind `animate-*` class can't compose both because each one
            // resets the full `animation` shorthand.
            animation:
              'panel-in 820ms cubic-bezier(0.19, 1, 0.22, 1) both, float 8s ease-in-out 820ms infinite',
          }}
        >
          {/* Hero */}
          <div
            className="flex flex-col gap-4 max-w-[580px] animate-card-in"
            style={{ animationDelay: '140ms' }}
          >
            <h1 className="font-display font-medium text-white leading-[1] text-[40px]">
              How would you like to forge
              <span className="text-accent">.</span>
            </h1>
            <p className="font-display text-[16px] text-white leading-relaxed">
              To begin — do you want to free roam or work on a mission?
            </p>
          </div>

          {/* Mode cards stacked */}
          <div className="flex flex-col gap-4">
            <div
              className="animate-card-in"
              style={{ animationDelay: '280ms' }}
            >
              <ModeCard
                eyebrow="Browse mode"
                title="Free Roam"
                description="Just browse. No goals, no agents — the page is yours."
                chip={
                  freeRoamTabCount === 0
                    ? 'Open'
                    : `${freeRoamTabCount} Active Tab${
                        freeRoamTabCount === 1 ? '' : 's'
                      }`
                }
                onClick={() => void onFreeRoam()}
              />
            </div>
            <div
              className="animate-card-in"
              style={{ animationDelay: '380ms' }}
            >
              <ModeCard
                eyebrow="Mission Mode"
                title="Missions"
                description="Set a goal. Forge plans, browses, and works alongside you."
                chip={
                  missionCount === 0
                    ? 'Start one'
                    : `${missionCount} Active Mission${
                        missionCount === 1 ? '' : 's'
                      }`
                }
                onClick={onMissions}
              />
            </div>
          </div>

          {/* Shortcut hint — ⌘T jumps straight into Free Roam from here. */}
          <div
            className="animate-card-in flex items-center justify-center gap-2 pt-1"
            style={{ animationDelay: '480ms' }}
          >
            <span className="font-mono text-[11px] uppercase tracking-caps text-white/60">
              tip
            </span>
            <span className="text-white/40">·</span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-white/70">
              <GlassKbd>⌘</GlassKbd>
              <GlassKbd>T</GlassKbd>
              <span className="uppercase tracking-caps">opens free roam</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModeCard({
  eyebrow,
  title,
  description,
  chip,
  onClick,
}: {
  eyebrow: string;
  title: string;
  description: string;
  chip: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group w-full p-6 rounded-[16px] text-left',
        'bg-white/70 backdrop-blur-[10px] border border-[#d8d8d8]',
        'flex items-start gap-4',
        'transition-[background,transform] duration-160 ease-precise',
        'hover:bg-white/80 active:translate-y-px',
      )}
    >
      {/* Left: eyebrow + title + description, bottom-aligned within the card */}
      <div className="flex-1 min-w-0 flex flex-col gap-3 justify-end self-stretch">
        <span className="font-mono text-[12px] uppercase tracking-caps text-[#777]">
          {eyebrow}
        </span>
        <div className="flex flex-col gap-1.5">
          <span className="font-display font-medium text-[24px] text-black leading-none">
            {title}
          </span>
          <span className="font-display text-[13px] text-[#666] leading-snug">
            {description}
          </span>
        </div>
      </div>
      {/* Right: chip top, arrow bottom */}
      <div className="flex flex-col items-end justify-between self-stretch gap-6">
        <span className="inline-flex items-center bg-accent rounded-pill px-3 py-1.5 font-mono text-[12px] uppercase tracking-caps text-accent-ink whitespace-nowrap">
          {chip}
        </span>
        <ArrowRight
          className="h-4 w-4 text-black transition-transform group-hover:translate-x-0.5"
          strokeWidth={1.5}
        />
      </div>
    </button>
  );
}

function GlassKbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-[5px] font-mono text-[10px] text-white/85 border border-white/30 rounded-[3px] bg-white/15">
      {children}
    </kbd>
  );
}
