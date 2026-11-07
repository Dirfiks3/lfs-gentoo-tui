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

DistroScope is a browser-based terminal simulator that recreates the grueling process of installing **Linux From Scratch (LFS)** and **Gentoo**. The project is built entirely with vanilla JavaScript, requires no backend, and works directly in your browser. 

## The Philosophy

Why build a simulator for something you can just download as an ISO? Because distro-hopping is easy, but compiling your own kernel from scratch is a rite of passage. DistroScope was built to capture that specific feeling: the anxiety of manual partitioning, the endless scrolling of `make` output, and the pure satisfaction when `[  OK  ] Reached target Multi-User System` finally appears on the screen.

## Preview

```text
┌────────────────────────────────────────────────────────┐
│ root@livecd ~ # emerge -av @world — Gentoo    00:14:32 │
├────────────────────────────────────────────────────────┤
│ Calculating dependencies... done!                      │
│ [ebuild N] sys-kernel/gentoo-sources-6.6.30            │
│ [ebuild N] sys-devel/gcc-13.2.1-r5                     │
│ >>> Emerging (1 of 214) app-arch/bzip2-1.0.8-r5        │
│   CC       foo/bar.o                                   │
│   CCLD     libtool                                     │
│ >>> Jobs for 214 merges started at task progress 4%    │
│                                                        │
│ [████████████████████░░░░░░░░░░░░░░░░░░░] 42.1%        │
└────────────────────────────────────────────────────────┘
