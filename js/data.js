/* ============================================================
   data.js — константы, тексты логов установки, ASCII-арт,
   данные для fastfetch и файлы «системы».
   ============================================================ */

const INSTALL_DURATION_MS = 60 * 60 * 1000; 

// ---------- ASCII-баннеры ----------
const ASCII = {
  banner: [
    ' ___  _ _ ___  ___  ___  ___  ___  ___ ',
    '|  \\| | | . ||_ -||_ ||  _|| . || __|',
    '| \\ / | | | || __|__ ||__ | | ||__ |',
    '|__|\\____/___||___||___||___||___||___|',
  ].join('\n'),
  lfsLogo: [
    '        .---.        ',
    '       /     \\       ',
    '       \\.--./       ',
    '      \'._  _\'._     ',
    '     L F S · From Scratch ',
  ],
  gentooLogo: [
    '          .,****,,.        ',
    '       ,*************,.    ',
    '     **********************  ',
    '   ****  GENTOO  ~~~~  ***  ',
    '     **********************  ',
    '       \'**",,"**\',         ',
    '          \'"""\'            ',
  ],
  tux: [
    '       .--.       ',
    '      |o_o |      ',
    '      |:_/ |      ',
    '     //   \\ \\     ',
    '    (|     | )    ',
    "   /'\\_   _/`\\   ",
    '   \\___)=(___/   ',
  ],
};

// ---------- Шаги установки LFS ----------
const LFS_STEPS = [
  { phase: 'PARTITIONING', weight: 4, lines: [
    '$ fdisk -l /dev/sda',
    'Диск /dev/sda: 128 GiB, 137438953472 bytes',
    '$ parted /dev/sda mklabel gpt',
    '$ parted /dev/sda mkpart primary ext4 1MiB 513MiB   # /boot',
    '$ parted /dev/sda mkpart primary ext4 513MiB 100%    # /',
    '$ mkfs.ext4 /dev/sda2',
    'Creating filesystem with 33291264 4k blocks...',
    'mke2fs 1.47.0 (5-Feb-2023)',
    '$ mount /dev/sda2 /mnt && mkdir -p /mnt/{boot,dev,proc,sys,run}',
  ]},
  { phase: 'LFS UTILITIES', weight: 6, lines: [
    '# groupadd -f -g 1001 lfs',
    '# useradd -s /bin/bash -g lfs -m -k /dev/null lfs',
    '$ su - lfs',
    'lfs:~$ tar -xf binutils-2.41.tar.xz',
    'lfs:~$ cd binutils-build && ../binutils-2.41/configure --prefix=/tools',
    'checking build system type... x86_64-pc-linux-gnu',
    'lfs:~$ make -j$(nproc)',
    'lfs:~$ make install',
    'Пакетов в /tools: +1',
  ]},
  { phase: 'COMPILER BOOTSTRAP', weight: 14, lines: [
    'lfs:~$ tar -xf gcc-13.2.0.tar.xz && mkdir gcc-build',
    'lfs:~$ ../gcc-13.2.0/configure --prefix=/tools --disable-multilib',
    'lfs:~$ make && make install          # stage 1.4b',
    'g++: warning: working... это долго, потерпи',
    'lfs:~$ tar -xf linux-6.5.9.tar.xz',
    'lfs:~$ make headers-install',
    'Installing kernel headers to /tools/include ... ok',
    'lfs:~$ tar -xf glibc-2.38.tar.xz',
    'lfs:~$ ../glibc-2.38/configure --prefix=/tools --enable-kernel=4.19',
    'lfs:~$ make -j8 && make install && make check',
    '+ 386 PASS, 0 FAIL',
    'lfs:~$ change gcc specs (LINKER) ... done',
    'lfs:~$ rebuild gcc against new glibc ... stage 2.5',
  ]},
  { phase: 'BINUTILS ROUND 2', weight: 8, lines: [
    'lfs:~$ binutils-2.41 pass 2: configure',
    'lfs:~$ make tooldir=/usr && make tooldir=/usr install',
    'Generating ld ... ok', 'Generating as ... ok',
  ]},
  { phase: 'GCC ROUND 2', weight: 12, lines: [
    'lfs:~$ gcc-13.2.0 pass 2: configure --with-build-sysroot=/',
    'lfs:~$ make -j8',
    '[ 12%] building libstdc++... [ 47%] building cc1... [ 88%] linking',
    'lfs:~$ make install && /tools/bin/gcc --version',
    'gcc (GCC) 13.2.0 — теперь у тебя настоящий компилятор',
  ]},
  { phase: 'CORE SYSTEM', weight: 18, lines: [
    'lfs:~$ make glibc-2.38 nptl, libc, libm, libresolv ...',
    'lfs:~$ make zlib bzip2 xz zstd file coreutils diffutils findutils',
    'lfs:~$ make grep sed gawk bash shadow util-linux gettext elfutils',
    'lfs:~$ make bison flex bc openssl iproute2 kmod pam acl attr',
    'lfs:~$ make expat libffi perl python3 sqlite tzdata',
    '[###.......] perl: make test — 2483 тестов OK',
    '[#####.....] python3: ./configure --enable-shared',
    '[#######...] systemd-254: meson setup build',
    'lfs:~$ make e2fsprogs procps sysvinit man-db vim',
  ]},
  { phase: 'SYSVINIT SCRIPTS', weight: 4, lines: [
    'lfs:~$ tar -xf sysvinit-scripts-12.1.tar.xz',
    'lfs:~$ cd src/etc/rc.d && cp rc.d/* /etc/rc.d/',
    'Writing /etc/inittab, /etc/fstab, /etc/passwd, /etc/group ...',
    'Writing /etc/os-release ... ID=lfs',
  ]},
  { phase: 'KERNEL 6.5.9', weight: 14, lines: [
    'lfs:~$ make menuconfig',
    '*** End of the configuration. Execute \'make\' to build the kernel.',
    'lfs:~$ make -j8 bzImage modules',
    '  CC      init/main.o', '  LD      vmlinux.a', '  OBJCOPY arch/x86/boot/compressed/vmlinux.bin',
    '  LINK    arch/x86/boot/bzImage',
    'Kernel: arch/x86/boot/bzImage is ready  (#1)',
    'lfs:~$ make modules_install && make install',
    'Installing /boot/vmlinuz-6.5.9-lfs ... System.map ... config',
  ]},
  { phase: 'GRUB & FINALIZE', weight: 6, lines: [
    'lfs:~$ grub-install --target=x86_64-efi --efi-directory=/boot --bootloader-id=LFS',
    'Installation finished. No error reported.',
    'lfs:~$ grub-mkconfig -o /boot/grub/grub.cfg',
    'Generating grub configuration file ... found GNU/Linux: LFS-6.5.9',
    '# exit     # выход из chroot',
    '# umount -R /mnt',
    '# reboot',
    '[  OK  ] Reached target Multi-User System.',
    '[  OK  ] Startup finished in 4.2s.',
  ]},
];

// ---------- Шаги установки Gentoo ----------
const GENTOO_STEPS = [
  { phase: 'NETWORKTIME SYNC', weight: 3, lines: [
    '# timedatectl set-ntp true',
    '# date', 'Fri Nov  7 00:00:00 UTC 2026',
    '# fdisk -l /dev/sda && mkfs.ext4 /dev/sda2',
    '# mount /dev/sda2 /mnt/gentoo',
  ]},
  { phase: 'STAGE3 DOWNLOAD', weight: 6, lines: [
    '# cd /mnt/gentoo',
    '# wget https://gentoo.osuosl.org/releases/amd64/autobuilds/stage3-amd64-openrc.tar.xz',
    'Resolving gentoo.osuosl.org... 140.211.166.109',
    'stage3-amd64-openrc.tar.xz  100%[=========>] 641.2M  12.4MB/s',
    '# tar xpvf stage3-*.tar.xz --xattrs-include=\'*.*\' --numeric-owner',
    'распаковано 41 208 файлов ... ok',
  ]},
  { phase: 'PORTAGE CONFIG', weight: 8, lines: [
    '# nano -w /etc/portage/make.conf',
    'COMMON_FLAGS="-O2 -march=native -pipe"',
    'CPU_FLAGS_X86="aes avx avx2 fma3 mmx sse sse2 sse3 ssse3"',
    'GRUB_PLATFORMS="efi-64"  MAKEOPTS="-j8"  USE="-systemd"',
    '# emerge --sync --quiet',
    '>>> Syncing repository \'gentoo\' into \'default\'...',
    'Available snapshot sha256 signatures checked. ok',
    '# emaint world-update',
    '# profile-set 23   (default/linux/amd64/23.0/no-multilib)',
  ]},
  { phase: 'CHROOT', weight: 4, lines: [
    '# mount --types proc /proc /mnt/gentoo/proc',
    '# mount --rbind /sys /mnt/gentoo/sys && mount --make-rslave ...',
    '# cp --dereference /etc/resolv.conf /mnt/gentoo/etc/',
    '# chroot /mnt/gentoo /bin/bash && source /etc/profile && PS1="(chroot) ${PS1}"',
    '(chroot) livecd / #',
  ]},
  { phase: 'WORLD @system', weight: 22, lines: [
    '(chroot) # emerge-webrsync',
    '(chroot) # emerge --ask --verbose --update --deep --newuse @world',
    'These are the packages that would be merged:',
    '[ebuild  N    ] sys-kernel/gentoo-sources-6.6.30  USE="-build -symlink"',
    '[ebuild  N    ] sys-devel/gcc-13.2.1-r5           USE="fortran nls openmp pie"',
    '[ebuild  N    ] sys-libs/glibc-2.38-r9',
    '[ebuild  N    ] sys-apps/portage-3.0.51',
    '>>> Emerging (1 of 214) app-arch/bzip2-1.0.8-r5',
    '>>> Jobs for 214 merges started at task progress 4%',
    '>>> Emerging (57 of 214) dev-libs/openssl-3.0.9-r2',
    '>>> Emerging (120 of 214) media-libs/mesa-23.2.1  USE="llvm vulkan wayland"',
    '>>> Emerging (181 of 214) sys-apps/systemd-utils? нет, мы на OpenRC :)',
    '>>> Emerging (214 of 214) app-editors/vim-core ... Done!',
    'Calculating dependencies... done!  All merges completed.',
  ]},
  { phase: 'KERNEL gentoo-sources', weight: 12, lines: [
    '(chroot) # echo sys-kernel/gentoo-sources >> /etc/portage/package.accept_keywords',
    '(chroot) # emerge --ask sys-kernel/gentoo-sources',
    '(chroot) # cd /usr/src/linux && make localyesconfig && make -j8',
    '  LD      vmlinux', '  BZIMAGE arch/x86/boot/bzImage is ready (#1)',
    '(chroot) # make modules_install',
    'DEPMOD 6.6.30-gentoo ... ok',
  ]},
  { phase: 'FSTAB & TC', weight: 6, lines: [
    '(chroot) # nano -w /etc/fstab   # UUID=... / ext4 defaults,noatime 0 1',
    '(chroot) # rc-update add sshd default',
    '(chroot) # passwd', 'New password: ********  Retype: ********  passwd: OK',
    '(chroot) # echo "GENTOO" > /etc/conf.d/hostname',
  ]},
  { phase: 'GRUB INSTALL', weight: 6, lines: [
    '(chroot) # emerge --ask sys-boot/grub',
    '(chroot) # grub-install --target=x86_64-efi --efi-directory=/boot',
    'Installation finished. No error reported.',
    '(chroot) # grub-mkconfig -o /boot/grub/grub.cfg',
    'Found Gentoo GNU/Linux: 6.6.30-gentoo',
  ]},
  { phase: 'REBOOT', weight: 4, lines: [
    '(chroot) # exit',
    '# umount -R /mnt/gentoo',
    '# reboot',
    ' * Starting sshd ... [ ok ]',
    ' * Mounting local filesystems ... [ ok ]',
    ' * OpenRC 0.51 starting up',
    'Gentoo GNU/Linux 6.6.30-gentoo tty1  localhost login:',
  ]},
];

// ---------- «Скачиваемые» пакеты терминала ----------
const DOWNLOADABLE = ['fastfetch']; 

// ---------- Файлы домашней директории ----------
const FS_HOME = {
  'notes.txt': 'заметки:\n- не забыть прочитать Handbook\n- после установки собрать ядро ещё раз с CONFIG_BTRFS_FS\n- fastfetch уже стоит ;)',
  '.bashrc': '# ~/.bashrc\nalias ll=\'ls -alF\'\nexport EDITOR=vim\nPS1=\'\\u@distro:\\w$ \'\n# дописано тобой во время установки',
  'readme.md': '# Мой Linux\nУстановлено вручную через симулятор.\nЯдро собрано сам. Ни один бинарник не пострадал.',
};

// ---------- Данные для fastfetch ----------
function getFetchData(distro) {
  const d = distro === 'gentoo';
  return {
    os: d ? 'Gentoo Base System release 2.14' : 'Linux From Scratch 12.2 (x86_64)',
    host: 'DistroScope Virtual Machine',
    kernel: d ? '6.6.30-gentoo-dist' : '6.5.9-lfs',
    uptime: null, 
    packages: d ? '842 (portage)' : '152 (LFS book)',
    shell: 'bash 5.2',
    resolution: window.innerWidth + 'x' + window.innerHeight,
    de: d ? 'OpenRC + i3-like WM' : 'SysVinit + custom WM',
    wm: 'DistroScopeWM',
    terminal: 'html-term',
    cpu: 'AMD Ryzen 7 5800H (16) @ 3.2GHz',
    gpu: 'Virtual GPU',
    memory: Math.floor(1200 + Math.random() * 900) + 'MiB / 16384MiB',
    disk: '42.1GiB / 128GiB',
    logoColor: d ? 'ff00ff' : '00aaff',
  };
}

// цвета полоски fastfetch
const FF_COLORS = ['#00aaff', '#00ccff', '#33ffcc', '#66ff66', '#ffff33', '#ffaa00', '#ff5555', '#ff3399'];

window.DS_DATA = { INSTALL_DURATION_MS, ASCII, LFS_STEPS, GENTOO_STEPS, DOWNLOADABLE, FS_HOME, getFetchData, FF_COLORS };
