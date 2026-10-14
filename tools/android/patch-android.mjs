// Patches the generated Android project (src-tauri/gen/android) after `tauri android init`.
// gen/ is not committed, so every customisation lives here. Each patch is anchored on text
// that exists in the tauri-cli 2.12.x template, is idempotent, and fails loudly (printing the
// file) when an anchor is missing instead of silently writing something broken.
//
//   node tools/android/patch-android.mjs [path/to/gen/android]
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2] || 'src-tauri/gen/android';
const APP = path.join(ROOT, 'app');
const RES = path.join(APP, 'src/main/res');
const ICONS = process.env.ICONS_DIR || 'src-tauri/icons/android';
const DISPLAY_NAME = "Mossy\\'s Climb"; // Android string resources need the apostrophe escaped
const BG = '#FF0A0812';

const read = (f) => fs.readFileSync(f, 'utf8');
function fail(msg, file) {
  console.error(`\n✗ patch-android: ${msg}`);
  if (file && fs.existsSync(file)) console.error(`---- ${file} ----\n${read(file)}\n---- end ----`);
  process.exit(1);
}
function need(text, anchor, file) { if (!text.includes(anchor)) fail(`anchor not found: ${JSON.stringify(anchor)}`, file); }
function balanced(text, file) {
  const code = text.replace(/\/\/.*$/gm, '').replace(/"(?:\\.|[^"\\])*"/g, '""');
  let depth = 0;
  for (const ch of code) { if (ch === '{') depth++; if (ch === '}') depth--; if (depth < 0) fail('unbalanced braces (closing before opening)', file); }
  if (depth !== 0) fail(`unbalanced braces (depth ${depth})`, file);
}
function findFile(dir, name) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { const r = findFile(p, name); if (r) return r; } else if (e.name === name) return p;
  }
  return null;
}
const done = [];

// ---------------------------------------------------------------- 1. release signing
// The template's release build type has no signingConfig, which yields an unsigned APK
// Android refuses to install. Use keystore.properties when CI provides one, else the debug key.
{
  const f = path.join(APP, 'build.gradle.kts');
  let s = read(f);
  if (!s.includes('signingConfigs')) {
    need(s, '    defaultConfig {', f);
    need(s, 'getByName("release") {', f);
    need(s, 'import java.util.Properties', f);
    s = s.replace('    defaultConfig {', `    signingConfigs {
        create("release") {
            val ksFile = rootProject.file("keystore.properties")
            if (ksFile.exists()) {
                val ksProps = Properties()
                ksFile.inputStream().use { ksProps.load(it) }
                keyAlias = ksProps.getProperty("keyAlias")
                keyPassword = ksProps.getProperty("keyPassword")
                storeFile = file(ksProps.getProperty("storeFile"))
                storePassword = ksProps.getProperty("storePassword")
            }
        }
    }
    defaultConfig {`);
    s = s.replace('getByName("release") {', `getByName("release") {
            signingConfig = if (rootProject.file("keystore.properties").exists())
                signingConfigs.getByName("release") else signingConfigs.getByName("debug")`);
    balanced(s, f);
    fs.writeFileSync(f, s);
  }
  done.push('release signing (keystore or debug key)');
}

// ---------------------------------------------------------------- 2. launcher icons
// `tauri android init` renders the template's own Tauri-logo mipmaps; copy ours over them.
{
  if (!fs.existsSync(ICONS)) fail(`icon source ${ICONS} missing (run "tauri icon app-icon.png" first)`);
  let n = 0;
  const copyDir = (src, dst) => {
    fs.mkdirSync(dst, { recursive: true });
    for (const e of fs.readdirSync(src, { withFileTypes: true })) {
      const a = path.join(src, e.name), b = path.join(dst, e.name);
      if (e.isDirectory()) copyDir(a, b); else { fs.copyFileSync(a, b); n++; }
    }
  };
  copyDir(ICONS, RES);
  // adaptive icon: make sure the round variant exists too
  const any = path.join(RES, 'mipmap-anydpi-v26');
  if (fs.existsSync(path.join(any, 'ic_launcher.xml')) && !fs.existsSync(path.join(any, 'ic_launcher_round.xml'))) {
    fs.copyFileSync(path.join(any, 'ic_launcher.xml'), path.join(any, 'ic_launcher_round.xml')); n++;
  }
  // the background colour must be defined exactly once
  const iconBg = path.join(RES, 'values/ic_launcher_background.xml');
  const colors = path.join(RES, 'values/colors.xml');
  if (fs.existsSync(iconBg) && read(colors).includes('name="ic_launcher_background"')) fail('ic_launcher_background defined twice', colors);
  done.push(`launcher icons (${n} files)`);
}

// ---------------------------------------------------------------- 3. manifest
{
  const f = path.join(APP, 'src/main/AndroidManifest.xml');
  let s = read(f);
  need(s, 'android:name=".MainActivity"', f);
  if (!s.includes('android:screenOrientation')) s = s.replace('android:name=".MainActivity"', 'android:name=".MainActivity"\n            android:screenOrientation="sensorLandscape"');
  need(s, '<uses-permission android:name="android.permission.INTERNET" />', f);
  if (!s.includes('android.permission.VIBRATE')) s = s.replace('<uses-permission android:name="android.permission.INTERNET" />', '<uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.VIBRATE" />');
  need(s, '<application', f);
  if (!s.includes('android:appCategory')) s = s.replace('<application', '<application\n        android:appCategory="game"');
  fs.writeFileSync(f, s);
  done.push('manifest (landscape, vibrate, game category)');
}

// ---------------------------------------------------------------- 4. colours, theme, splash
// A dark window background means no white flash between the splash and the first frame.
{
  const colors = path.join(RES, 'values/colors.xml');
  let c = read(colors);
  need(c, '</resources>', colors);
  if (!c.includes('name="game_bg"')) c = c.replace('</resources>', `    <color name="game_bg">${BG}</color>\n</resources>`);
  fs.writeFileSync(colors, c);

  const base = path.join(RES, 'values/themes.xml');
  const t = read(base);
  const m = t.match(/<style name="([^"]+)" parent="([^"]+)">/);
  if (!m) fail('theme style not found', base);
  const [, styleName, parent] = m;
  for (const dir of ['values', 'values-night']) {
    const f = path.join(RES, dir, 'themes.xml');
    if (!fs.existsSync(f)) continue;
    let s = read(f);
    need(s, '</style>', f);
    if (!s.includes('game_bg')) s = s.replace('</style>', '        <item name="android:windowBackground">@color/game_bg</item>\n        <item name="android:statusBarColor">@android:color/transparent</item>\n        <item name="android:navigationBarColor">@android:color/transparent</item>\n    </style>');
    fs.writeFileSync(f, s);
  }
  // Android 12+ splash screen background (API 31 attribute -> its own resource folders)
  for (const dir of ['values-v31', 'values-night-v31']) {
    fs.mkdirSync(path.join(RES, dir), { recursive: true });
    fs.writeFileSync(path.join(RES, dir, 'themes.xml'), `<resources>
    <style name="${styleName}" parent="${parent}">
        <item name="android:windowBackground">@color/game_bg</item>
        <item name="android:windowSplashScreenBackground">@color/game_bg</item>
        <item name="android:statusBarColor">@android:color/transparent</item>
        <item name="android:navigationBarColor">@android:color/transparent</item>
    </style>
</resources>
`);
  }
  done.push(`theme "${styleName}" (dark window + splash)`);
}

// ---------------------------------------------------------------- 5. display name
{
  const f = path.join(RES, 'values/strings.xml');
  let s = read(f);
  for (const key of ['app_name', 'main_activity_title']) {
    const re = new RegExp(`(<string name="${key}">)[^<]*(</string>)`);
    if (!re.test(s)) fail(`string ${key} not found`, f);
    s = s.replace(re, `$1${DISPLAY_NAME}$2`);
  }
  fs.writeFileSync(f, s);
  done.push(`display name ${DISPLAY_NAME}`);
}

// ---------------------------------------------------------------- 6. MainActivity: immersive
// Fullscreen (system bars hidden, swipe to peek), keep the screen awake while playing,
// and draw into the camera cutout in landscape. Fully-qualified names avoid touching imports.
{
  const f = findFile(path.join(APP, 'src/main/java'), 'MainActivity.kt');
  if (!f) fail('MainActivity.kt not found');
  let s = read(f);
  if (!s.includes('hideSystemBars')) {
    need(s, 'class MainActivity : TauriActivity() {', f);
    need(s, 'super.onCreate(savedInstanceState)', f);
    s = s.replace('super.onCreate(savedInstanceState)', `super.onCreate(savedInstanceState)
    window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    if (android.os.Build.VERSION.SDK_INT >= 28) {
      val lp = window.attributes
      lp.layoutInDisplayCutoutMode = android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
      window.attributes = lp
    }
    hideSystemBars()`);
    const last = s.lastIndexOf('}');
    if (last < 0) fail('no closing brace', f);
    s = s.slice(0, last).replace(/\s*$/, '\n') + `
  private fun hideSystemBars() {
    val controller = androidx.core.view.WindowCompat.getInsetsController(window, window.decorView)
    controller.hide(androidx.core.view.WindowInsetsCompat.Type.systemBars())
    controller.systemBarsBehavior = androidx.core.view.WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) hideSystemBars()
  }
}
`;
    balanced(s, f);
    // the new methods must be inside the class body
    const cls = s.indexOf('class MainActivity');
    if (s.indexOf('private fun hideSystemBars') < cls) fail('hideSystemBars landed outside the class', f);
    fs.writeFileSync(f, s);
  }
  done.push('MainActivity (immersive, keep screen on, cutout)');
}

console.log('patch-android: ok\n  - ' + done.join('\n  - '));
