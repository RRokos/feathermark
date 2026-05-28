use log::{info, error};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::Duration;
use std::thread;
use notify::{Watcher, RecommendedWatcher, RecursiveMode, Event, Config};
use tauri::{Manager, Emitter, State, WebviewUrl, WebviewWindowBuilder};
use std::process::Command as StdCommand;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileResult {
    pub content: String,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MarkdownFileEntry {
    pub name: String,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub path: String,
    pub file_name: String,
    pub line_number: usize,
    pub line_text: String,
}

pub struct AppState {
    pub pending_file_path: Mutex<Option<String>>,
    pub watcher_stop_signals: Mutex<HashMap<String, Arc<AtomicBool>>>,
    pub window_counter: AtomicU64,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            pending_file_path: Mutex::new(None),
            watcher_stop_signals: Mutex::new(HashMap::new()),
            window_counter: AtomicU64::new(0),
        }
    }
}

/// Lock a mutex, recovering from poisoning instead of panicking.
fn lock<T>(m: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// Normalize a path: resolve relative paths against CWD.
fn normalize_path(path: &str) -> PathBuf {
    let p = PathBuf::from(path);
    if p.is_absolute() {
        p
    } else {
        std::env::current_dir().unwrap_or_default().join(p)
    }
}

#[tauri::command]
fn read_file(path: String) -> Result<FileResult, String> {
    info!("Reading file: {}", path);

    let path_buf = normalize_path(&path);

    if !path_buf.exists() {
        error!("File not found: {}", path_buf.display());
        return Err(format!("File not found: {}", path));
    }

    if !path_buf.is_file() {
        error!("Path is not a file: {}", path_buf.display());
        return Err(format!("Path is not a file: {}", path));
    }

    match fs::read_to_string(&path_buf) {
        Ok(content) => {
            info!("Successfully read file: {} ({} bytes)", path_buf.display(), content.len());
            Ok(FileResult {
                content,
                path: path_buf.to_string_lossy().to_string(),
            })
        }
        Err(e) => {
            error!("Failed to read file {}: {}", path_buf.display(), e);
            Err(format!("Failed to read file: {}", e))
        }
    }
}

#[tauri::command]
fn read_directory(path: String) -> Result<Vec<DirEntry>, String> {
    info!("Reading directory: {}", path);

    let path_buf = normalize_path(&path);

    if !path_buf.exists() {
        error!("Directory not found: {}", path_buf.display());
        return Err(format!("Directory not found: {}", path));
    }

    if !path_buf.is_dir() {
        error!("Path is not a directory: {}", path_buf.display());
        return Err(format!("Path is not a directory: {}", path));
    }

    let mut entries: Vec<DirEntry> = Vec::new();

    match fs::read_dir(&path_buf) {
        Ok(dir) => {
            for entry in dir {
                if let Ok(entry) = entry {
                    let file_name = entry.file_name().to_string_lossy().to_string();
                    // Skip hidden files/directories
                    if file_name.starts_with('.') {
                        continue;
                    }

                    let entry_path = entry.path();
                    let is_dir = entry_path.is_dir();

                    entries.push(DirEntry {
                        name: file_name,
                        path: entry_path.to_string_lossy().to_string(),
                        is_dir,
                    });
                }
            }
        }
        Err(e) => {
            error!("Failed to read directory {}: {}", path_buf.display(), e);
            return Err(format!("Failed to read directory: {}", e));
        }
    }

    // Sort: directories first, then files, both alphabetically
    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    info!("Read {} entries from directory: {}", entries.len(), path_buf.display());
    Ok(entries)
}

#[tauri::command]
fn get_pending_file_path(state: State<'_, AppState>) -> Option<String> {
    let mut pending = lock(&state.pending_file_path);
    pending.take()
}

#[tauri::command]
fn get_file_path(path: String) -> Result<String, String> {
    let path_buf = PathBuf::from(&path);
    match path_buf.canonicalize() {
        Ok(p) => Ok(p.to_string_lossy().to_string()),
        Err(e) => Err(format!("Failed to get path: {}", e))
    }
}

fn collect_markdown_files(dir: &PathBuf, results: &mut Vec<MarkdownFileEntry>, depth: u32) {
    if depth == 0 {
        return;
    }
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();

            // Skip hidden
            if name.starts_with('.') {
                continue;
            }

            if path.is_dir() {
                collect_markdown_files(&path, results, depth - 1);
            } else {
                let name_lower = name.to_lowercase();
                if name_lower.ends_with(".md") || name_lower.ends_with(".markdown") {
                    results.push(MarkdownFileEntry {
                        name,
                        path: path.to_string_lossy().to_string(),
                    });
                }
            }
        }
    }
}

#[tauri::command]
fn list_markdown_files(root: String) -> Result<Vec<MarkdownFileEntry>, String> {
    info!("Listing markdown files in: {}", root);

    let root_path = normalize_path(&root);
    if !root_path.is_dir() {
        return Err(format!("Not a directory: {}", root));
    }

    let mut results: Vec<MarkdownFileEntry> = Vec::new();
    collect_markdown_files(&root_path, &mut results, 20);

    // Sort alphabetically by name
    results.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    info!("Found {} markdown files", results.len());
    Ok(results)
}

#[tauri::command]
fn search_files(root: String, query: String) -> Result<Vec<SearchResult>, String> {
    info!("Searching for '{}' in: {}", query, root);

    let root_path = normalize_path(&root);
    if !root_path.is_dir() {
        return Err(format!("Not a directory: {}", root));
    }

    let query_lower = query.to_lowercase();
    let mut results: Vec<SearchResult> = Vec::new();
    let mut md_files: Vec<MarkdownFileEntry> = Vec::new();
    collect_markdown_files(&root_path, &mut md_files, 20);

    for file_entry in &md_files {
        if results.len() >= 100 {
            break;
        }

        if let Ok(content) = fs::read_to_string(&file_entry.path) {
            for (i, line) in content.lines().enumerate() {
                if results.len() >= 100 {
                    break;
                }
                if line.to_lowercase().contains(&query_lower) {
                    results.push(SearchResult {
                        path: file_entry.path.clone(),
                        file_name: file_entry.name.clone(),
                        line_number: i + 1,
                        line_text: line.trim().to_string(),
                    });
                }
            }
        }
    }

    info!("Found {} search results", results.len());
    Ok(results)
}

#[tauri::command]
fn watch_file(window: tauri::Window, path: String, state: State<'_, AppState>) -> Result<(), String> {
    info!("Starting to watch file: {} (window: {})", path, window.label());

    let path_buf = PathBuf::from(&path);
    if !path_buf.exists() {
        return Err(format!("File not found: {}", path));
    }

    let window_label = window.label().to_string();

    // Stop previous watcher for this window
    {
        let mut signals = lock(&state.watcher_stop_signals);
        if let Some(old_signal) = signals.remove(&window_label) {
            old_signal.store(true, Ordering::Relaxed);
        }
    }

    // Create new stop signal for this window's watcher
    let stop_signal = Arc::new(AtomicBool::new(false));
    {
        let mut signals = lock(&state.watcher_stop_signals);
        signals.insert(window_label.clone(), Arc::clone(&stop_signal));
    }

    let window_clone = window.clone();
    let path_clone = path.clone();

    thread::spawn(move || {
        let watcher_result = RecommendedWatcher::new(
            move |res: Result<Event, notify::Error>| {
                if let Ok(event) = res {
                    if let notify::EventKind::Modify(_) = event.kind {
                        info!("File modified externally: {}", path_clone);
                        let _ = window_clone.emit("file-changed", &path_clone);
                    }
                }
            },
            Config::default(),
        );

        match watcher_result {
            Ok(mut watcher) => {
                if let Err(e) = watcher.watch(path_buf.as_path(), RecursiveMode::NonRecursive) {
                    error!("Failed to watch file: {:?}", e);
                    return;
                }

                while !stop_signal.load(Ordering::Relaxed) {
                    thread::sleep(Duration::from_millis(500));
                }

                info!("Watcher stopped for: {} (window: {})", path_buf.display(), window_label);
            }
            Err(e) => {
                error!("Failed to create watcher: {:?}", e);
            }
        }
    });

    Ok(())
}

#[tauri::command]
fn open_in_editor(path: String, editor: String) -> Result<(), String> {
    info!("Opening {} with editor: {}", path, editor);

    let path_buf = PathBuf::from(&path);
    if !path_buf.exists() {
        return Err(format!("File not found: {}", path));
    }

    if editor.is_empty() {
        // No editor specified — use system default via cmd /c start
        StdCommand::new("cmd")
            .args(["/c", "start", "", &path])
            .spawn()
            .map_err(|e| format!("Failed to open with system default: {}", e))?;
        return Ok(());
    }

    // Try the editor command directly first (works for full paths and PATH commands)
    if let Ok(_) = StdCommand::new(&editor).arg(&path).spawn() {
        return Ok(());
    }

    // If that failed, try common installation paths on Windows
    let candidates: Vec<String> = match editor.to_lowercase().as_str() {
        "code" | "vscode" => vec![
            format!("{}\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe",
                    std::env::var("USERPROFILE").unwrap_or_default()),
            "C:\\Program Files\\Microsoft VS Code\\Code.exe".to_string(),
        ],
        "notepad++" => vec![
            "C:\\Program Files\\Notepad++\\notepad++.exe".to_string(),
            "C:\\Program Files (x86)\\Notepad++\\notepad++.exe".to_string(),
        ],
        _ => vec![],
    };

    for candidate in &candidates {
        if PathBuf::from(candidate).exists() {
            if let Ok(_) = StdCommand::new(candidate).arg(&path).spawn() {
                return Ok(());
            }
        }
    }

    Err(format!("Editor '{}' not found. Try using the full path in Settings.", editor))
}

#[tauri::command]
fn show_in_folder(path: String) -> Result<(), String> {
    use std::os::windows::process::CommandExt;

    let path_buf = PathBuf::from(&path);
    if !path_buf.exists() {
        return Err(format!("File not found: {}", path));
    }

    // Canonicalize to absolute path, then normalize to backslashes.
    // Explorer requires backslash separators and won't accept the
    // `\\?\` UNC prefix that canonicalize() returns on Windows.
    let canonical = path_buf
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize path: {}", e))?;
    let canonical_str = canonical.to_string_lossy();
    let normalized = canonical_str
        .strip_prefix(r"\\?\")
        .unwrap_or(&canonical_str)
        .replace('/', "\\");

    // Windows Explorer /select, requires `/select,` OUTSIDE the quoted path.
    StdCommand::new("explorer")
        .raw_arg(format!("/select,\"{}\"", normalized))
        .spawn()
        .map_err(|e| format!("Failed to open folder: {}", e))?;

    Ok(())
}

fn create_file_window(app: &tauri::AppHandle, file_path: &str) -> Result<(), String> {
    let state = app.state::<AppState>();
    let counter = state.window_counter.fetch_add(1, Ordering::Relaxed);
    let label = format!("file-{}", counter);
    let encoded = urlencoding::encode(file_path);
    let url = format!("/?file={}", encoded);

    let file_name = std::path::Path::new(file_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Untitled".to_string());

    let window = WebviewWindowBuilder::new(app, &label, WebviewUrl::App(url.into()))
        .title(format!("Feathermark — {}", file_name))
        .inner_size(1200.0, 800.0)
        .min_inner_size(800.0, 600.0)
        .center()
        .build()
        .map_err(|e| format!("Failed to create window: {}", e))?;

    // Stop watcher thread when window is closed
    let app_handle = app.clone();
    let label_for_close = label.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { .. } = event {
            let state = app_handle.state::<AppState>();
            let mut signals = lock(&state.watcher_stop_signals);
            if let Some(signal) = signals.remove(&label_for_close) {
                signal.store(true, Ordering::Relaxed);
                info!("Watcher stopped for closed window: {}", label_for_close);
            }
        }
    });

    info!("Created new window '{}' for file: {}", label, file_path);
    Ok(())
}

#[tauri::command]
#[allow(non_snake_case)]
fn open_in_new_window(app: tauri::AppHandle, filePath: String) -> Result<(), String> {
    // Spawn on a separate thread to avoid blocking the IPC handler.
    // WebviewWindowBuilder::build() posts to the main thread and waits;
    // if called from an IPC thread, it can deadlock the event loop.
    thread::spawn(move || {
        if let Err(e) = create_file_window(&app, &filePath) {
            error!("Failed to create new window: {}", e);
        }
    });
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            info!("Single instance triggered with args: {:?}", argv);

            if argv.len() > 1 {
                let file_path = argv[1].clone();
                let app_clone = app.clone();
                // Spawn on separate thread to avoid blocking the event loop
                thread::spawn(move || {
                    if let Err(e) = create_file_window(&app_clone, &file_path) {
                        error!("Failed to create new window: {}", e);
                        if let Some(window) = app_clone.get_webview_window("main") {
                            let _ = window.emit("open-file", file_path);
                        }
                    }
                });
            } else {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_focus();
                }
            }
        }))
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .setup(|app| {
            info!("Feathermark starting up...");

            let args: Vec<String> = std::env::args().collect();
            info!("Command line args: {:?}", args);

            if args.len() > 1 {
                let file_path = args[1].clone();
                info!("Storing pending file path: {}", file_path);

                let state = app.state::<AppState>();
                let mut pending = lock(&state.pending_file_path);
                *pending = Some(file_path);
            }

            // Register close handler for main window watcher cleanup
            if let Some(main_window) = app.get_webview_window("main") {
                let app_handle = app.handle().clone();
                main_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { .. } = event {
                        let state = app_handle.state::<AppState>();
                        let mut signals = lock(&state.watcher_stop_signals);
                        if let Some(signal) = signals.remove("main") {
                            signal.store(true, Ordering::Relaxed);
                            info!("Watcher stopped for main window");
                        }
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![read_file, read_directory, get_file_path, get_pending_file_path, watch_file, list_markdown_files, search_files, open_in_editor, open_in_new_window, show_in_folder])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
