# UI / UX

How the app looks, what users do, and what the in-world reactions are. Companion to `ARCHITECTURE.md` (the systems) and `PLAN.md` (the build order).

## Layout

Single-screen app, three panels:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  rts-agent   ·   Room: demo   ·   3 devs online   ·   [share link]      │
├──────────────┬──────────────────────────────────────┬───────────────────┤
│              │                                      │                   │
│  ROSTER      │            GAME WORLD                │    INSPECTOR      │
│              │                                      │                   │
│  ▢ Frontend  │   ░░░░░░░░░░░░░░░░░░░░░░░░          │   Bob (Frontend)  │
│  ▢ Backend   │   ░░░░░██░░░░░░░░░░░░░░░░          │   🔨 working · 42% │
│  ▢ Tester    │   ░░░██🟢░░░░░░░░░░░░░░░          │                   │
│  ▢ Refactor  │   ░░░░░░░░░░░░░░░░░░░░░░░          │   Transcript:     │
│  ▢ DevOps    │   ░░░░░░░░░░🔵░░░░░░░░░░          │   • read App.tsx  │
│              │   ░░░░░░░░░░░░░░░░░░░░░░░          │   • wrote Btn.tsx │
│  ↔ drag to   │                                      │   • running tests │
│    spawn     │                                      │                   │
│              │                                      │   [type a hint…]  │
└──────────────┴──────────────────────────────────────┴───────────────────┘
```

- **Roster (left)** — preset character cards. Click to preview, drag to spawn.
- **Game world (center)** — top-down tilemap, agents as sprites, ambient items.
- **Inspector (right)** — appears when an agent is selected; shows status, transcript, message input. Empty state shows room overview.

Mobile is out of scope. Desktop only.

## Preset characters

Each character is a `.md` file in `/characters/` at the repo root. Both the client (for the roster card) and the agent runner (for the system prompt) read from this directory.

```
/characters/
  frontend.md
  backend.md
  tester.md
  refactorer.md
  devops.md
```

### `.md` file format

```md
---
id: frontend
name: Frontend Specialist
icon: /assets/chars/frontend.png
color: "#4ECDC4"
shortBio: React, TypeScript, accessible UI
---

# Frontend Specialist

You are an expert frontend developer. You specialize in React, TypeScript,
component composition, and accessible UI.

## Strengths
- React component patterns
- State management (useState, useReducer, Convex queries)
- Tailwind / CSS-in-JS
- a11y (semantic HTML, keyboard nav)

## How you work
- Always read existing components before writing new ones — match the codebase style.
- Prefer composition over inheritance.
- Run the type checker after every meaningful change.
- When unsure, ask a clarifying question rather than guessing.
```

- **Frontmatter** drives the roster card (id, name, icon, color, shortBio).
- **Body** is concatenated onto the agent's system prompt by the runner. Keep it concise — every token costs tokens-per-second on the demo.

### Initial roster (5 presets, hackathon scope)

| Preset | Specialty (short bio) | Sprite hint |
|---|---|---|
| **Frontend Specialist** | React, TypeScript, accessible UI | Tunic + scroll |
| **Backend Specialist** | APIs, data models, Convex/Postgres | Hammer + crate |
| **Tester** | Unit + integration tests, repro bugs | Magnifying glass |
| **Refactorer** | Cleanups, dead code, renames | Broom |
| **DevOps** | Deploy scripts, CI, env config | Wrench + gears |

5 is enough to make the roster feel intentional without burning prompt-engineering hours. Stretch: archetype editor in the UI to mint custom ones.

## Workflows

### W1 — Spawn an agent (drag-and-drop)

The headline interaction. Should feel game-like.

1. **Pick up.** User mousedowns on a character card. Card lifts (~4px translateY, soft shadow). Cursor changes to grab. A translucent **ghost** of the character sprite follows the cursor.
2. **Hover the world.** As the cursor enters the canvas, the ghost snaps to the tile under the cursor. A **placement reticle** (pulsing tile outline in the character's color) shows where they'll land. Invalid tiles (water, occupied) gray out the reticle.
3. **Drop.** On mouseup over a valid tile, the spawn modal opens, prefilled:
   ```
   ┌───────────────────────────────────────┐
   │  Spawn Frontend Specialist            │
   │                                       │
   │  Name (optional):  [ Bob          ]   │
   │  Task:                                │
   │  ┌────────────────────────────────┐   │
   │  │ build a login page in React    │   │
   │  │                                │   │
   │  └────────────────────────────────┘   │
   │                                       │
   │             [Cancel]   [Spawn ⤵]      │
   └───────────────────────────────────────┘
   ```
4. **Submit.** Modal closes. Character **drops in** at the chosen tile with a small bounce-and-squash (Framer Motion or CSS keyframes — 250ms total). A short dust puff appears under them on landing.
5. **Walk to workshop.** Agent then walks (straight-line tween, ~600ms) toward the nearest workshop tile and starts working.

Cancel paths: pressing Esc during drag, dropping outside the canvas, or closing the modal — all return the card to its slot with a quick spring-back.

**Animation budget:** Framer Motion for HUD transitions, CSS keyframes for sprite drops, R3F `useFrame` (or Phaser tweens) for in-world movement. Don't over-engineer — every animation should be ≤300ms.

### W2 — Inspect an agent

- **Click** an agent sprite → inspector slides in from the right (~200ms).
- Inspector shows: portrait, name, character preset, current status (icon + label), progress bar, transcript (live, auto-scroll), and a message input at the bottom.
- **Click outside** or press Esc → inspector slides out.
- The selected agent gets a subtle **selection ring** (the user's color) on the canvas.

### W3 — Talk to an agent

- Type in the inspector input → press Enter (Shift+Enter for newline) → message appended to transcript with `role: "user"`.
- Visual cue on the agent sprite: a small **chat bubble** pops above their head for 1.5s with the first ~30 chars of the message.
- Multiple users can message the same agent. Their messages are color-tagged in the transcript by user color.

### W4 — Recover a stuck agent

- Agent enters `stuck` state → sprite color desaturates ~40%, a `?` bubble pops in above the head with a gentle bob.
- The card in the roster gets a faint pulse to draw the eye if no agent is selected.
- Clicking the agent opens the inspector with the input **focused** by default — the obvious next action is "type a hint."

### W5 — Agent finishes

- Status flips to `done` → walk back to a random "celebration" tile, plant a flag with the agent's color, brief sparkle.
- Sprite stays in the world (so the demo has visible "completed work"). Inspector still works for reviewing the transcript.
- Optional: a top-bar toast: `"Bob (Frontend) finished: build a login page"`.

### W6 — Multi-user presence

- Top bar shows online users: colored dots + initials.
- Each user has a unique color, used for: their cursor (subtle ghost cursor visible to others on the canvas — stretch), their messages in transcripts, their agents' selection ring.
- No auth — just type your name on first load, store in localStorage.

### W7 — Cancel / cleanup

- Right-click on an agent → small context menu: `Cancel`, `Rename`, `Recenter camera`.
- `Cancel` → confirm modal → agent fades out (300ms), Daytona sandbox is deleted, row removed from Convex. Flag stays only on `done`, not `cancel`.

## Visual states (cheat sheet)

| State | Sprite | Overlay | Sound (stretch) |
|---|---|---|---|
| `idle` | gentle 2-frame bob | — | — |
| `working` | walk cycle | progress ring (0–100%) | pickaxe taps |
| `stuck` | desaturated, slight droop | `?` bubble | confused murmur |
| `done` | bright, flag planted | sparkle burst | tada chime |
| `error` | red flash 200ms, then dim | `!` bubble | low buzz |

## Empty / error states

- **No agents in room:** game world shows the map; a centered hint says `Drag a character from the left to spawn your first agent.`
- **Convex disconnected:** banner across the top in user color: `Reconnecting…`. Existing sprites stay; spawning is disabled until reconnect.
- **Agent runner offline:** banner: `Agents are queued — runner is offline.` Spawned agents sit at `idle` with a small `⏳` overlay until the runner comes back and claims them.
- **OpenAI rate-limited:** the affected agent flips to `error` with a tooltip explaining; user can hit `Retry` in the inspector.

## Accessibility (light pass — hackathon scope)

- Roster cards are real `<button>`s; drag is augmented, not the only spawn path. Pressing Enter on a focused card opens the spawn modal with the cursor at the center tile.
- Inspector and modal are keyboard-navigable; Esc closes.
- Color is never the only signal — every status has an icon too.

## What we're explicitly NOT doing (hackathon)

- Custom character creation in-app (presets only)
- Drag-to-move existing agents (they pathfind themselves once spawned)
- Voice / TTS for agent output
- Multiple rooms in one tab
- Mobile / touch / responsive layout
- Theming / dark mode toggle (we'll just pick one)

## Build order (maps to PLAN.md)

| When | UI work |
|---|---|
| H1 | Convex client wired; roster shows hardcoded list of 2 character cards |
| H2 | Game canvas renders sprites at agent positions from Convex |
| H3 | Spawn modal (no drag yet — button on card opens it directly); end-to-end fake agent visible |
| H4 | Inspector panel with transcript + message input |
| H5 | Stuck visual + chat-back loop |
| H6 | Drag-and-drop spawn (replace the spawn button), drop animation, asset swap-in |
| H7 | Status visuals (progress ring, ?-bubble, sparkle), user color avatars in top bar |
| H8 | Polish pass: empty states, error banners, keyboard a11y |

Drag-and-drop is intentionally H6 — the click-to-spawn modal in H3 is the MVP path so the demo loop works even if drag interactions break.
