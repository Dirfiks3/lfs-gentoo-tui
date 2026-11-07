# DistroScope

**LFS & Gentoo installation simulator in a TUI-style web interface.**

[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=flat-square&logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Active-success?style=flat-square)]()

[Русская версия](README.ru.md)

---

## Overview

DistroScope is a browser-based terminal simulator that recreates the process of installing two Linux distributions: **Linux From Scratch (LFS)** and **Gentoo**. The project is built entirely with vanilla JavaScript and does not require a backend. It is designed for educational purposes and to demonstrate the pain and satisfaction of manual Linux installation.

## Features

- **Interactive Terminal:** The installation process requires manual command input. The terminal responds to user commands and returns errors for invalid entries.
- **Realistic Timers:** LFS installation takes **1 hour**, Gentoo takes **30 minutes** (accelerated mode available in code).
- **Dynamic Logs:** Real-time compilation logs with syntax highlighting, simulated package builds, and kernel compilation output.
- **Minimalist Desktop:** After installation, the user is dropped into a lightweight, window-manager-like environment with a functional terminal and `fastfetch`.
- **Strict UI:** No emojis, no gradients, no distractions. Built for focus.

## Tech Stack

- **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3
- **Fonts:** System monospace stack (no external dependencies)
- **Architecture:** Modular IIFE pattern (`data.js`, `installer.js`, `desktop.js`, `app.js`)

## Getting Started

### Prerequisites

No build tools, package managers, or servers are required. The project runs directly in any modern browser.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Dirfiks3/lfs-gentoo-tui.git
