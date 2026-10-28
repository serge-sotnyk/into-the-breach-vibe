# IRON GRID

**English** | [Українська](README.uk.md)

A turn-based mech tactics game for the browser, built as a tribute to *Into the Breach*. Command three mechs on compact 8×8 islands, read the Vek's telegraphed attacks, and use positioning, pushes and the terrain to keep the civilian power grid alive across an island campaign that ends in a two-part final battle.

All art (isometric dioramas, mechs, Vek, effects) and all sound (effects and ambient music) are generated in code. No external assets. The game is available in English and Ukrainian.

## How it started

What I missed most in the original *Into the Breach* was a way to save the game: manual saves I could come back to. So I decided to try vibe-coding my own version, as an experiment in the spirit of [opus-55-effort-comparison](https://github.com/Barty-Bart/opus-55-effort-comparison).

This was the very first prompt, the one the whole project grew from:

> Build a complete, polished, playable browser clone of Into the Breach. Capture the experience of commanding three distinct mechs in compact turn-based battles, anticipating clearly telegraphed enemy attacks, using positioning and pushes to protect civilian buildings and the power grid, and upgrading your squad through an island campaign with a final battle. Include manual saving and loading with multiple persistent save slots, available between islands. Saved campaigns must survive browser restarts and remain loadable after defeat. Make the implementation decisions yourself. Prioritize an enjoyable game, clear tactical feedback, strong visual presentation and systems that work together. Test it yourself before finishing, and leave it running so I can play it.

## Run it

```bash
npm install
npm run dev
```

Then open http://127.0.0.1:5173.

Other scripts:

| Script | What it does |
| --- | --- |
| `npm test` | Engine, campaign, save/load and translation tests, including full headless campaigns |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Production build into `dist/` |
| `npm run balance` | Opt-in balance report: the auto-pilot plays dozens of battles per squad and tier |

Add `?debug` to the URL for debug keys in battle: `P` toggles the auto-pilot, `F9` wins the current battle instantly.

## How it plays

- **The turn.** The Vek move first and show exactly what they will hit: red striped tiles, arrows, damage numbers and an attack order. Then each of your mechs may move once and use one weapon (or repair). When you end your turn, the Vek attacks resolve in order.
- **Pushes are the core tool.** Vek attacks are stored relative to the attacker, so pushing a Vek moves its attack with it. Pushing units into each other or into obstacles deals 1 bump damage. Ground Vek drown in water and anything falls into chasms.
- **The grid.** Each point of building damage drains grid power. At zero the timeline is lost. Grid defense gives each hit a chance to be resisted.
- **Status effects and terrain.** Fire, smoke, A.C.I.D., ice, shields, webs, forests that ignite, sand that turns to smoke, ice that cracks into water, lava. There are eight environmental hazards (air strikes, lightning, tidal waves, seismic collapses, sandstorms, ice storms, acid rain, volcanic rain).
- **Preview everything.** Hover any target to see the exact outcome: damage, pushes, kills, grid loss. Hover an enemy to isolate its attack. `Z` undoes a move and **Reset Turn** rewinds a whole turn once per battle.

### Squads

| Squad | Mechs | Style |
| --- | --- | --- |
| Ironclad | Brawler (Piston Fist), Cannon (Breaker Cannon), Mortar (Arc Mortar) | Classic push and bombard |
| Tempest | Judo (Vice Throw), Gravity (Grav Well), Phase (Phase Swap + Shield Dome) | Throw, pull and swap Vek into hazards |
| Inferno | Flame (Flamethrower), Meteor (Firestorm Mortar), Arc (Arc Whip) | Fire-immune mechs, burning ground, chain lightning |

### Campaign

Four islands (Verdant Reach, Dune Sprawl, Glacier Spire, Cinder Works) with their own terrain, Vek, hazards and leader. Defend three regions, then hold the island's headquarters against its Hive leader to secure it (destroying the leader is a bonus objective). Bonus objectives pay out reputation, grid power, reactor cores and new pilots. After each island, spend reputation in the shop; reactor cores power weapons and upgrades in the Hangar. Pilots level up but die with their mech. Secure two islands to unlock the Hive Caldera final assault: hold the rim, then defend the Breach Bomb against the Hive Tyrant.

### Saving

- **Manual saves:** six slots, available from the world map between islands (Save Game). Loading is available from the title screen, the world map and the defeat screen.
- **Persistence:** saves live in `localStorage` (`irongrid.v1.slot.N`), so they survive browser restarts. Losing a campaign never touches manual saves.
- **Continue:** the current run also auto-saves (between missions and at the start of every turn in battle) to a separate key, so **Continue** on the title screen resumes after closing the tab. It is cleared when a run ends.

## Languages

On first launch the game follows your browser language. Switch it at any time in Settings, or with the EN / УКР buttons on the title screen; the current screen, even a battle in progress, redraws in place.

All text lives in `src/i18n/`:

- `en.ts` is the source dictionary. Data text (units, weapons, islands…) is keyed by the data id.
- `uk.ts` is the Ukrainian translation. The type checker rejects missing, extra or wrongly shaped keys, and `tests/i18n.test.ts` checks placeholders, markup and plural forms.
- `glossary.uk.md` fixes the Ukrainian terminology and style.

To add a language, translate `uk.ts` into a new file, register it in `LANGS` in `src/i18n/index.ts` and in the test, and add a font subset in `src/main.ts` if its script needs one (Chakra Petch covers Latin, Tektur adds Cyrillic).

## Controls

| Input | Action |
| --- | --- |
| Left click | Select, move, fire |
| Right click / `Esc` | Cancel, open the pause menu |
| `1` `2` | Arm weapon slot |
| `R` | Repair (+1 HP, removes fire and A.C.I.D.) |
| `Tab` | Next mech |
| `Z` | Undo move |
| `Space` / `Enter` | End turn |
| `A` | Toggle attack order numbers |
| `F` | Skip the current animation sequence |

## Code map

- `src/game/battle/` — the rules engine. `effects.ts` resolves damage, pushes, terrain and status effects; `attacks.ts` turns weapons into effect lists; `ai.ts` plans Vek moves by simulating every option; `turn.ts` runs the turn structure; `preview.ts` simulates outcomes for the UI.
- `src/game/campaign/` — islands, missions, rewards, shop, hangar, pilots, and save slots.
- `src/render/` — the isometric canvas renderer, procedural sprites, particles and the animation player that replays recorded battle steps.
- `src/ui/` — screens (title, squad select, world map, island map, battle HUD, shop, end screens) and modals (hangar, saves, results, settings, help).
- `src/i18n/` — dictionaries, plural rules and lookups for data names; the game logic only hands out ids and message keys.
- `src/audio/` — WebAudio synthesizer for sound effects and music.
