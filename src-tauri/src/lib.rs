use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::Manager;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

struct BackendProcess(Mutex<Option<Child>>);

fn is_port_in_use(port: &str) -> bool {
    let addr = format!("127.0.0.1:{}", port);
    std::net::TcpStream::connect(addr).is_ok()
}

fn spawn_sidecar() -> Option<Child> {
    let port = "5000";

    // 0. Si el backend ya está activo en el puerto 5000 (ej. modo desarrollo con Flask/Vite), omitir spawn
    if is_port_in_use(port) {
        println!("[KuriScribe Desktop] Backend ya se encuentra activo en el puerto {}. Omitiendo spawn de sidecar.", port);
        return None;
    }

    // 1. Intento por ruta de recursos / sidecar en producción
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let candidate_paths = vec![
                exe_dir.join("server-x86_64-pc-windows-msvc.exe"),
                exe_dir.join("server.exe"),
                exe_dir.join("bin").join("server-x86_64-pc-windows-msvc.exe"),
                exe_dir.join("resources").join("server-x86_64-pc-windows-msvc.exe"),
            ];

            for path in candidate_paths {
                if path.exists() {
                    let mut cmd = Command::new(&path);
                    cmd.env("PORT", port);
                    #[cfg(windows)]
                    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW: Oculta la ventana de consola en Windows

                    match cmd.spawn() {
                        Ok(child) => {
                            println!("[KuriScribe Desktop] Backend Python iniciado exitosamente desde {:?}", path);
                            return Some(child);
                        }
                        Err(e) => {
                            eprintln!("[KuriScribe Desktop] Error al iniciar backend en {:?}: {}", path, e);
                        }
                    }
                }
            }
        }
    }

    // 2. Intento relativo para desarrollo local (src-tauri/bin/)
    let dev_paths = vec![
        std::path::PathBuf::from("src-tauri/bin/server-x86_64-pc-windows-msvc.exe"),
        std::path::PathBuf::from("bin/server-x86_64-pc-windows-msvc.exe"),
    ];

    for path in dev_paths {
        if path.exists() {
            let mut cmd = Command::new(&path);
            cmd.env("PORT", port);
            #[cfg(windows)]
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

            match cmd.spawn() {
                Ok(child) => {
                    println!("[KuriScribe Desktop] Backend Python (Dev) iniciado exitosamente desde {:?}", path);
                    return Some(child);
                }
                Err(e) => {
                    eprintln!("[KuriScribe Desktop] Error al iniciar backend (Dev) en {:?}: {}", path, e);
                }
            }
        }
    }

    eprintln!("[KuriScribe Desktop] Advertencia: No se pudo localizar el binario del backend.");
    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(BackendProcess(Mutex::new(None)))
        .setup(|app| {
            let child = spawn_sidecar();
            if let Some(state) = app.try_state::<BackendProcess>() {
                if let Ok(mut guard) = state.0.lock() {
                    *guard = child;
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if window.label() == "main" {
                    if let Some(state) = window.try_state::<BackendProcess>() {
                        if let Ok(mut guard) = state.0.lock() {
                            if let Some(mut child) = guard.take() {
                                let _ = child.kill();
                                let _ = child.wait();
                                println!("[KuriScribe Desktop] Proceso backend finalizado.");
                            }
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running KuriScribe desktop application");
}
