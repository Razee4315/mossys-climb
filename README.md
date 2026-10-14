<p align="center">
  <img src="docs/logo.svg" alt="Mossy's Climb" width="440">
</p>

<p align="center">
  <b>A tiny pixel-art platformer about climbing a very tall mountain.</b><br>
  Stormbeak the thunder crow stole the Dawn Gem and flew to the summit. Go get it back.
</p>

<p align="center">
  <a href="https://razee4315.github.io/mossys-climb/"><img src="https://img.shields.io/badge/▶_PLAY-in_your_browser-a6f27c?style=for-the-badge&labelColor=1a1428" alt="Play in your browser"></a>
  <a href="https://github.com/Razee4315/mossys-climb/releases/latest"><img src="https://img.shields.io/github/v/release/Razee4315/mossys-climb?style=for-the-badge&label=Android%20APK&color=ffd84a&labelColor=1a1428" alt="Download the Android APK"></a>
</p>

<table>
  <tr>
    <td><img src="docs/ruins.png" alt="Sky Ruins: a gem grows legs and runs"></td>
    <td><img src="docs/boss.png" alt="Stormbeak's Roost: the boss fight"></td>
  </tr>
  <tr>
    <td><img src="docs/frost.png" alt="Frostbite Peaks: ice, wind and spikes"></td>
    <td><img src="docs/climbers.png" alt="Choose your climber"></td>
  </tr>
</table>

## What's up the mountain

- **8 levels**, from a sleepy meadow to a storm-wrapped summit, with a **3-phase boss** at the top.
- **5 climbers**, each with a power: Mossy grips walls, Pip double-jumps, Ember dashes, Bruno slams. The fifth is a secret.
- **Things that don't play fair:** a goal flag that runs away, a gem that grows legs, a boulder chase, rising lava, an avalanche and the lights going out.
- **3 stars per level:** finish it, grab every gem, and beat the par time.
- **No engine, no libraries, no image files.** Every sprite, tune and sound effect is generated in code.
- **Every level is proven beatable** by a bot that searches every possible move.

## Controls

| | Keyboard | Phone |
|---|---|---|
| Move | Arrows / WASD | Left side of the screen |
| Jump (hold = higher) | Space / Z | Right side of the screen |
| Power | X / Shift | POWER button |
| Pause | Esc / P | ❚❚ or Back |

Gamepads work too. Progress saves automatically.

<details>
<summary><b>For developers</b></summary>

<br>

```bash
node tools/build.js       # bundle src/ into 04-platformer.html and dist/index.html
node tools/verify.js 4    # prove level 4 is beatable (a few minutes per level)
```

- `src/` holds the game modules and `shell.html`. Never edit `04-platformer.html` by hand.
- `src-tauri/` is the Tauri 2 shell. The Android APK is built **only in GitHub Actions**: every push to `main` bumps the version, builds an arm64 APK, and publishes a release. All Android tweaks live in `tools/android/patch-android.mjs`.
- Optional repo secrets for a permanent signing key: `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
- Debug URLs: `?level=3` jumps to a level, `?sprites` shows the sprite sheet, and `?debug` exposes `window.MC`.

</details>
