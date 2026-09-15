# ⚡ RAM Pulse - Desktop Memory Telemetry & Optimizer Widget

A sleek, real-time floating desktop widget for **Windows and Linux (Ubuntu)** that monitors physical and virtual memory pressure and frees memory with a single click.

Built with **Electron**, **Node.js** — Win32 APIs / .NET diagnostics on Windows, `/proc/meminfo` + `ps` on Linux.

---

## ✨ Features

- **⚡ Real-Time Memory Telemetry**: Sub-second system memory status tracking Total, Available, Used, Standby/Cached, and Commit Charge limits.
- **🚀 1-Click Memory Boost**: Windows — working-set trimming via Win32 `EmptyWorkingSet`. Linux — `sync` + `drop_caches` (safe, never kills processes).
- **📈 60s Live Spline Graph**: Smooth, reactive canvas graph displaying 60 seconds of memory load trends.
- **📊 Top Memory Processes**: Live ranking of the top 5 memory-consuming applications and background processes with PID and RAM usage.
- **🛡️ Auto-Boost Mode**: Automatically triggers memory trimming when system RAM usage exceeds 85%.
- **🎨 Glassmorphism & Frameless UI**: Draggable floating widget with Dark Mode toggle and Always-on-Top pinning.
- **⚡ Dual Mode Architecture**:
  - **Electron Standalone App**: Native frameless window with direct IPC.
  - **Web / Browser Mode**: Built-in HTTP and WebSocket server for lightweight browser or PWA execution.

---

## 🛠️ Tech Stack & Architecture

- **Runtime**: Electron 34 / Node.js
- **Frontend**: Vanilla HTML5, CSS3 Glassmorphism tokens, Canvas 2D spline rendering
- **System Telemetry Engine**: Windows — native Win32 `GlobalMemoryStatusEx` + .NET `System.Diagnostics.Process`. Linux — Node `os` + `/proc/meminfo` + `ps`.
- **Networking**: WebSockets (`ws`) + REST API fallback

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- Windows 10/11 (PowerShell built-in) **or** Ubuntu 22.04/24.04+

### Installation

```bash
git clone https://github.com/satyabhan007/RAM-Pulse.git
cd RAM-Pulse
npm install
```

### Launching the Widget — Windows

#### 1. Electron Floating Desktop Widget (Recommended)
Double-click `Launch_Electron_Widget.bat` or run:
```bash
npm start
```

#### 2. Create Desktop Shortcut
Double-click `create_shortcut.bat` to create a `RAM Pulse Widget` shortcut directly on your Windows Desktop.

#### 3. Lightweight Web / Edge Mode
Double-click `Launch_Desktop_Widget.bat` or run:
```bash
node server.js
```
Then navigate to `http://localhost:3888` in your browser or run it in Edge App mode.

### Launching the Widget — Linux (Ubuntu)

One-shot setup (deps, passwordless `drop_caches` rule, app-menu + autostart entries, smoke test):

```bash
bash scripts/install_linux.sh
```

Then either:

```bash
./launch_linux.sh       # Electron widget (+ web server fallback)
# or browser-only:
npm run web             # → http://localhost:3888
# verify everything:
npm run smoke
```

> Linux "Boost" runs `sync` + `echo 3 > /proc/sys/vm/drop_caches` (uses `sudo -n` when the `install_linux.sh` sudoers rule exists, otherwise sync-only). No processes are ever killed.

---

## 📂 Project Structure

```
RAM-Pulse/
├── index.html                 # Widget UI markup
├── styles.css                 # Glassmorphism theme and dark mode CSS
├── renderer.js                # Dual-bridge frontend logic & canvas chart
├── main.js                    # Electron main process & IPC handlers (Windows + Linux)
├── preload.js                 # Secure context bridge
├── server.js                  # Standalone HTTP & WebSocket server (Windows + Linux)
├── package.json               # Project manifest and dependencies
├── launch_linux.sh            # Linux one-shot launcher (Electron + web fallback)
├── create_shortcut.bat        # Windows desktop shortcut generator
├── Launch_Electron_Widget.bat # Electron launcher batch script (Windows)
├── Launch_Desktop_Widget.bat  # Web/Edge mode launcher batch script (Windows)
└── scripts/
    ├── get_memory.ps1         # High-speed Win32 memory status script
    ├── optimize_memory.ps1    # Win32 working-set trimming script
    ├── collect_memory.js      # Cross-platform Node telemetry bridge
    ├── smoke_test.js          # 6-check smoke suite (telemetry + HTTP)
    └── install_linux.sh       # Linux setup: deps, sudoers, desktop entries
```

---

## 📄 License

MIT License. Feel free to use, modify, and distribute.
