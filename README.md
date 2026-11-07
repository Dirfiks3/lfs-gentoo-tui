<div align="center">
  <img src="https://upload.wikimedia.org/wikipedia/commons/a/af/Tux.png" alt="Tux" width="120" />
  <h1>lfs-gentoo-tui</h1>
  <p><strong>Strict TUI-style web simulator for Linux From Scratch and Gentoo.</strong></p>
  
  <img src="https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=flat-square&logo=javascript" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/Status-Active-success?style=flat-square" />
</div>

<br />

<div align="center">
  <a href="READMEru.md">Русская версия (Russian)</a> | 
  <a href="help.md">Documentation / Guide</a>
</div>

---

## Overview
**lfs-gentoo-tui** is a browser-based terminal simulator. No backend, no frameworks, just vanilla JS. It recreates the pain and satisfaction of manual Linux installation.

### Why?
Because compiling your own kernel from scratch is a rite of passage. I built this to capture the anxiety of manual partitioning and the joy of a successful `make`.

## Core Features
- **Interactive Terminal:** Type commands manually to progress. Type garbage and get a `command not found`.
- **Realistic Timers:** LFS takes 10 minutes, Gentoo takes 10 minutes of real time.
- **Dynamic Logs:** Real-time compilation noise and kernel build outputs.
- **Setup Wizard:** After compiling, choose your DE: **KDE, GNOME, XFCE, or i3wm**. The UI and settings adapt to your choice.
- **Full Desktop:** Custom window manager (drag, snap), functional terminal (`fastfetch`, `htop`), and file manager.

## Documentation
Need help navigating the installation or understanding the commands? 
Check out the **[Full Guide & Commands (help.md)](help.md)**. It contains step-by-step instructions for both LFS and Gentoo, along with links to the official real-world manuals.

## Getting Started
No builds required. Just clone and open.

1. Clone the repo: `git clone https://github.com/Dirfiks3/lfs-gentoo-tui.git`
2. Open `index.html` in any modern browser.

### Commands
Inside the simulated desktop terminal:
`help`, `fastfetch`, `ls`, `cat <file>`, `htop`, `reboot`, `clear`.

## License & Usage (Important)
MIT License.

**You CAN:** Fork it, take the HTML/CSS boilerplate, and build your own stuff.
**You SHOULD NOT:** Copy the project 1:1 and claim it as your own. The simulation logic and DE wizard were built specifically for this project. Respect the idea.
