# ⚡ RAM Pulse - Desktop Memory Telemetry & Optimizer Widget

A sleek, real-time floating desktop widget for Windows that monitors physical and virtual memory pressure and trims working set memory with a single click.

Built with **Electron**, **Node.js**, and high-performance **Win32 APIs / .NET diagnostics**.

---

## ✨ Features

- **⚡ Real-Time Memory Telemetry**: Sub-second system memory status tracking Total, Available, Used, Standby/Cached, and Commit Charge limits.
- **🚀 1-Click Memory Boost**: Instant working-set memory trimming across active user processes via Win32 `EmptyWorkingSet`.
- **📈 60s Live Spline Graph**: Smooth, reactive canvas graph displaying 60 seconds of memory load trends.
- **📊 Top Memory Processes**: Live ranking of the top 5 memory-consuming applications and background processes with PID and RAM usage.
- **🛡️ Auto-Boost Mode**: Automatically triggers memory trimming when system RAM usage exceeds 85%.
- **🎨 Glassmorphism & Frameless UI**: Draggable floating widget with Dark Mode toggle and Always-on-Top pinning.
- **⚡ Dual Mode Architecture**:
  - **Electron Standalone App**: Native frameless window with direct IPC.
  - **Web / Edge App Mode**: Built-in HTTP and WebSocket server for lightweight browser or PWA execution.

---

## 🛠️ Tech Stack & Architecture

- **Runtime**: Electron 34 / Node.js
- **Frontend**: Vanilla HTML5, CSS3 Glassmorphism tokens, Canvas 2D spline rendering
- **System Telemetry Engine**: Native Win32 `GlobalMemoryStatusEx` and .NET `System.Diagnostics.Process` (~100ms query latency)
- **Networking**: WebSockets (`ws`) + REST API fallback

---

## 🚀 Getting Started

### Prerequisites

- Windows 10 / 11
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- PowerShell (built-in on Windows)

### Installation

```bash
git clone https://github.com/satyabhan007/RAM-Pulse.git
cd RAM-Pulse
npm install
```

### Launching the Widget

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

---

## 📂 Project Structure

```
RAM-Pulse/
├── index.html                 # Widget UI markup
├── styles.css                 # Glassmorphism theme and dark mode CSS
├── renderer.js                # Dual-bridge frontend logic & canvas chart
├── main.js                    # Electron main process & IPC handlers
├── preload.js                 # Secure context bridge
├── server.js                  # Standalone HTTP & WebSocket server
├── package.json               # Project manifest and dependencies
├── create_shortcut.bat        # Windows desktop shortcut generator
├── Launch_Electron_Widget.bat # Electron launcher batch script
├── Launch_Desktop_Widget.bat  # Web/Edge mode launcher batch script
└── scripts/
    ├── get_memory.ps1         # High-speed Win32 memory status script
    ├── optimize_memory.ps1    # Win32 working-set trimming script
    └── collect_memory.js      # Node telemetry bridge
```

---

## 📄 License

MIT License. Feel free to use, modify, and distribute.
