// The whole game is a single web page (dist/index.html). The native shell only
// hosts it; there are no custom commands and no plugins.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Mossy's Climb");
}
