# lfs-gentoo-tui — Guide & Commands

Welcome to **lfs-gentoo-tui**.

This project is a **simplified trainer**. In the real world, installing Linux From Scratch (LFS) or Gentoo takes several hours (or even days), demands precise knowledge, and can easily result in data loss if you make a mistake.

Our simulator recreates the logic and sequence of these steps in a safe browser environment. You can learn the process, see how the commands work, and feel like a system administrator without risking your actual computer.

---

## Supported Commands

You can enter these commands in the terminal during installation (if you get stuck) and on the desktop after it's finished.

- `help` — Show this guide (in the installation terminal).
- `fastfetch` — Display system information (similar to neofetch).
- `ls` — List files in the current directory.
- `cat <file>` — Read the contents of a text file (e.g., `cat notes.txt`).
- `htop` — Open the system monitor (on the desktop).
- `emerge <pkg>` — Attempt to install a package (only works for `fastfetch`).
- `clear` — Clear the terminal screen.
- `reboot` — Reboot the simulator.
- `exit` — Close the terminal window (on the desktop).

---

## Step-by-Step: Linux From Scratch (LFS)

In the simulator, you need to type key commands to advance through the phases. Here is what happens at each step:

1. **PARTITIONING**
   - Command: `fdisk`
   - Real world: Creating partitions, formatting to ext4, mounting.
2. **LFS UTILITIES**
   - Command: `su`
   - Real world: Creating the `lfs` user, downloading binutils source code.
3. **COMPILER BOOTSTRAP**
   - Command: `tar`
   - Real world: Building GCC, Glibc, and the Linux kernel to create a working toolchain.
4. **CORE SYSTEM**
   - Command: `make`
   - Real world: Compiling hundreds of packages (bash, coreutils, grep, etc.).
5. **GRUB & FINALIZE**
   - Command: `reboot`
   - Real world: Installing GRUB, generating the config, and rebooting.

*Official LFS Book:* [https://www.linuxfromscratch.org/lfs/](https://www.linuxfromscratch.org/lfs/)

---

## Step-by-Step: Gentoo Linux

The Gentoo process is different because you use Portage (the package manager) to compile the entire "world" from source.

1. **NETWORKTIME SYNC**
   - Command: `timedatectl`
   - Real world: Configuring NTP, partitioning the disk, and mounting.
2. **STAGE3 DOWNLOAD**
   - Command: `wget`
   - Real world: Downloading and extracting the stage3 tarball.
3. **PORTAGE CONFIG**
   - Command: `nano`
   - Real world: Editing `make.conf` (USE flags, CFLAGS) and running `emerge --sync`.
4. **WORLD @system**
   - Command: `emerge`
   - Real world: `emerge -av @world` — compiling the entire system from source optimized for your hardware.
5. **REBOOT**
   - Command: `reboot`
   - Real world: Configuring the bootloader and booting into your fresh system.

*Official Gentoo Handbook:* [https://wiki.gentoo.org/wiki/Handbook:Main_Page](https://wiki.gentoo.org/wiki/Handbook:Main_Page)

---

## What's Next?

After the installation finishes (the simulation takes exactly 10 minutes of real time), you will be dropped into the desktop environment.
Try this:
1. Open the terminal and type `fastfetch`.
2. Change your Desktop Environment in the settings.
3. Run `htop` to see the fake processes in action.
