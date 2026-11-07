<div align="center">
  <img src="https://upload.wikimedia.org/wikipedia/commons/a/af/Tux.png" alt="Tux the Penguin" width="140" />
  <h1>DistroScope</h1>
  <p><strong>LFS & Gentoo installation simulator in a strict TUI-style web interface.</strong></p>

  <a href="https://github.com/Dirfiks3/lfs-gentoo-tui">
    <img src="https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=flat-square&logo=javascript" alt="JavaScript" />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="License" />
  </a>
  <a href="#">
    <img src="https://img.shields.io/badge/Status-Active-success?style=flat-square" alt="Status" />
  </a>
</div>

<br />

<div align="center">
  <a href="README.ru.md">Русская версия</a>
</div>

---

## Overview

DistroScope is a browser-based terminal simulator that recreates the process of installing two Linux distributions: **Linux From Scratch (LFS)** and **Gentoo**. The project is built entirely with vanilla JavaScript and does not require a backend. It is designed for educational purposes and to demonstrate the pain and satisfaction of manual Linux installation.

## Features

- **Interactive Terminal:** The installation process requires manual command input. The terminal responds to user commands and returns errors for invalid entries.
- **Realistic Timers:** LFS installation takes **1 hour**, Gentoo takes **30 minutes** (accelerated mode available in code).
- **Dynamic Logs:** Real-time compilation logs with syntax highlighting, simulated package builds, and kernel compilation output.
- **Minimalist Desktop:** After installation, the user is dropped into a lightweight, window-manager-like environment with a functional terminal and `fastfetch`.
- **Strict UI:** No emojis, no gradients, no distractions. Built for focus.

## Preview

<!-- Замени ссылку ниже на реальный скриншот твоего проекта -->
![DistroScope UI Preview](https://via.placeholder.com/1000x500/0a0a0a/ffffff?text=Terminal+Simulator+Screenshot)

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
