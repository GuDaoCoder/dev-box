// Windows 发布构建不显示额外控制台窗口，请勿删除。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    devbox_desktop_lib::run()
}
