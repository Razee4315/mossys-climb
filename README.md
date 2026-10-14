# Mossy's Climb

A pixel-art platformer about climbing a very tall mountain. Stormbeak the thunder crow stole the
Dawn Gem and flew to the summit. Pick a climber and go get it back.

## Play it

- **Android:** download the latest `.apk` from the [Releases](../../releases) page (Android 7.0+, 64-bit).
  Every push to `main` builds a new one in GitHub Actions.
- **Browser (phone or PC):** play on GitHub Pages, at the address shown on the repository's About panel.
- **Offline on a PC:** open `04-platformer.html`. It's one self-contained file.

Progress and settings save automatically.

## Controls

| Action            | Keyboard              | Gamepad          | Phone / tablet        |
|-------------------|-----------------------|------------------|-----------------------|
| Move              | Arrows / WASD         | D-pad / stick    | Left thumb: ◀ ▶ (slide between them) |
| Jump (hold = higher) | Space / Z / Up     | A                | Right thumb: anywhere on the right |
| Power             | X / Shift / J         | X / B / RB       | POWER button          |
| Drop through plank| Down + Jump           | Down + A         | ▼ + ▲                 |
| Look down         | Hold Down             | Hold Down        | Hold ▼                |
| Retry checkpoint  | R                     | Select           | Pause menu            |
| Pause             | Esc / P               | Start            | ❚❚ (top right) or Back |
| Mute / Fullscreen | M / F                 |                  | Options menu          |

The game pauses itself when the window loses focus or the app goes to the background.
On phones the touch zones are deliberately large: the whole left 45% of the screen is movement and
the whole lower right is jump (except the POWER button). Button size and vibration are in Options.

## Climbers

| Climber | Hearts | Power |
|---------|--------|-------|
| **Mossy** (tree frog) | 3 | Wall grip: slower wall slide, higher wall kicks |
| **Pip** (bluebird) | 3 | Flutter: double jump |
| **Ember** (fox) | 3 | Dash: sideways burst that also defeats enemies |
| **Bruno** (bear cub) | 5 | Ground slam: smashes down, even through spiky foes |
| **Golden Mossy** (secret) | 3 | All powers. Unlocked by beating Stormbeak |

## The climb: 8 levels, bottom to summit

1. **Mossy Meadow**: tutorial with signposts. Cracked ground hides a gem cave, and the goal flag runs away.
2. **Whisperwood**: wall jumps, springs, canopy planks, wasps, snapper plants, moving platforms, crumbling bridges, a secret room, and an ambush from the treetops.
3. **Glowcap Caverns**: dynamic lighting, stalactites, bats, spiky hedgehogs, *lights out*, and a boulder chase.
4. **Magma Shaft**: a vertical climb with rising lava on your heels.
5. **Sky Ruins**: stone crushers, an elevator, a gem that grows legs and runs, a pop-up spike trap and an earthquake.
6. **Frostbite Peaks**: slippery ice, sudden wind gusts and an avalanche.
7. **Thunder Spire**: a vertical tower in a storm with telegraphed lightning strikes, storm winds and a crusher.
8. **Stormbeak's Roost**: a 3-phase boss fight.

Each level awards three stars: clear, collect all gems, and beat the par time. Best times, gems and
deaths are tracked per level on the mountain map.

Damage rules: spikes and pits cost one heart and return you to the last safe ground. Enemies cost
one heart with knockback. Rising lava, crushers and boulders are instant. Checkpoint flags refill
your hearts. **Assist mode** (Options) gives infinite hearts.

## Project layout (for developers)

```
04-platformer.html     the built game (generated, do not edit by hand)
src/                   game source modules + shell.html
tools/build.js         bundles src/ into 04-platformer.html and dist/index.html
tools/verify.js        proves every level is beatable (see below)
tools/make-icon.js     renders app-icon.png from the game's sprite data
tools/android/         patch script for the generated Android project
src-tauri/             Tauri 2 shell for the Android (and desktop) app
.github/workflows/     android.yml (APK + release), pages.yml (web version)
backup/                the original version of the game
```

Build after changing anything in `src/`:

```bash
node tools/build.js
```

### Android app (built only in CI)

Pushing to `main` runs `.github/workflows/android.yml`. It works in this order:

1. Bumps the patch version (in `tauri.conf.json`, `package.json` and `Cargo.toml`) if there are new commits since the last tag.
2. Builds the page, generates icons from `app-icon.png`, and runs `tauri android init`.
3. Patches the generated project with `tools/android/patch-android.mjs`: release signing, launcher icons, landscape lock,
   immersive fullscreen, keep-screen-on, a dark splash, and the display name.
4. Builds a release arm64 APK and attaches it to a GitHub Release.

The project is not built locally, and `src-tauri/gen/` is not committed: every Android customisation lives in the patch script.

Without signing secrets, APKs are signed with a cached CI debug key, so builds named `-testkey` install over each other.
To sign with a permanent key, add these repository secrets:
`ANDROID_KEYSTORE_B64` (a base64 `.jks`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD`.
Switching keys needs one uninstall on devices that have a `-testkey` build.

The Android back button pauses the game and goes back in menus. On the title screen, pressing back twice exits.

### Level verifier

`tools/verify.js` runs the game's real physics headlessly and searches every input sequence for the
slowest, power-less climber. It checks that the finish, every gem, checkpoint and heart is reachable.
It also checks that you can't get soft-locked: the finish must be reachable from every checkpoint and
from the bottom of every collapsing floor. Static checks run too, such as enemies standing on ground,
signs matching their texts, and event markers existing.

```bash
node tools/verify.js        # all levels (a few minutes)
node tools/verify.js 4      # just level 4
```

### Debug URL options

- `04-platformer.html?level=3` jumps straight into level 3
- `04-platformer.html?sprites` shows the sprite sheet
- `04-platformer.html?debug` exposes `window.MC` for deterministic stepping from the console
