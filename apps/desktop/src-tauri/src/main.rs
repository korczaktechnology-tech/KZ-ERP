#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let mut args = std::env::args();
    let _ = args.next();
    if args.next().as_deref() == Some("--kz-update-watchdog") {
        if let Some(marker) = args.next() {
            kz_erp_lib::run_update_watchdog(&marker);
        }
        return;
    }
    kz_erp_lib::run();
}
