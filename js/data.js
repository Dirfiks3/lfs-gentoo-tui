/* ============================================================
   data.js — ЦЕНТРАЛЬНАЯ БАЗА ДАННЫХ ПРОЕКТА LFS-GENTOO-TUI
   Содержит: конфигурацию системы, виртуальную ФС, данные
   для симуляции установки LFS и Gentoo.
   ============================================================ */

"use strict";

// ============================================================================
// 1. ГЛОБАЛЬНЫЕ КОНСТАНТЫ И МЕТАДАННЫЕ
// ============================================================================

const SYSTEM_METADATA = {
    PROJECT_NAME: "lfs-gentoo-tui",
    VERSION: "1.0.4-stable",
    BUILD_DATE: "2026-11-07",
    AUTHOR: "Open Source Community",
    LICENSE: "MIT",
    REPO_URL: "https://github.com/Dirfiks3/lfs-gentoo-tui"
};

// ============================================================================
// 2. ASCII-АРТ И ГРАФИКА
// ============================================================================

const ASCII_ART = {
    consoleBanner: `
 _  __ _____ ____    ____ _____ _   _ _____ _____ ____    _____ _   _ ___ 
| |/ _|  ___/ ___|  / ___| ____| \\ | |_   _| ____/ ___|  |_   _| | | |_ _|
| | |_| |_  \\___ \\ | |  _|  _| |  \\| | | | |  _| \\___ \\    | | | | | || |
| |  _|  _|  ___) || |_| | |___| |\\  | | | | |___ ___) |   | | | |_| || |
|_|_| |_|   |____/  \\____|_____|_| \\_| |_| |_____|____/    |_|  \\___/|___|
    `,
    lfsLogo: [
        "        .---.        ",
        "       /     \\       ",
        "       \\.--./       ",
        "      '._  _'._     ",
        "     L F S · From Scratch ",
    ],
    gentooLogo: [
        "          .,****,,.        ",
        "       ,*************,.    ",
        "     **********************  ",
        "   ****  GENTOO  ~~~~  ***  ",
        "     **********************  ",
        "       '**\",,\"**',         ",
        "          '\"\"\"'            ",
    ],
    tux: [
        "       .--.       ",
        "      |o_o |      ",
        "      |:_/ |      ",
        "     //   \\ \\     ",
        "    (|     | )    ",
        "   /'\\_   _/`\\   ",
        "   \\___)=(___/   ",
    ]
};

// ============================================================================
// 3. ВИРТУАЛЬНАЯ ФАЙЛОВАЯ СИСТЕМА (VFS)
// ============================================================================

const VIRTUAL_FILE_SYSTEM = {
    home: {
        'notes.txt': 'заметки:\n- прочитать Handbook\n- собрать ядро\n- проверить сеть\n- fastfetch',
        '.bashrc': '# ~/.bashrc\nalias ll=\'ls -alF\'\nexport EDITOR=vim',
        'readme.md': '# Добро пожаловать\nУстановлено через lfs-gentoo-tui.',
        'config.ini': '[settings]\ntheme=dark\nfont=monospace'
    },
    etc: {
        'os-release': 'NAME="lfs-gentoo-tui"\nID=lfs-gentoo\nPRETTY_NAME="LFS/Gentoo TUI Simulator"',
        'hostname': 'lfs-gentoo-tui',
        'fstab': '/dev/sda2  /      ext4  defaults  0 1\n/dev/sda1  /boot  vfat  defaults  0 2',
        'make.conf': 'COMMON_FLAGS="-O2 -march=native -pipe"\nMAKEOPTS="-j8"\nUSE="X wayland -systemd"'
    },
    var: {
        'messages': '[ 0.000000] Linux version 6.6.30-tui\n[ 1.402531] OpenRC started'
    }
};

// ============================================================================
// 4. БАЗА ДАННЫХ ПАКЕТОВ
// ============================================================================

const PACKAGE_DATABASE = {
    gentoo: [
        { name: 'sys-apps/portage', version: '3.0.51', size: '12MB' },
        { name: 'sys-devel/gcc', version: '13.2.1-r5', size: '120MB' },
        { name: 'sys-libs/glibc', version: '2.38-r9', size: '45MB' },
        { name: 'sys-kernel/gentoo-sources', version: '6.6.30', size: '150MB' },
        { name: 'app-editors/vim', version: '9.0.2100', size: '18MB' },
        { name: 'sys-apps/fastfetch', version: '2.8.10', size: '1MB' }
    ],
    lfs: [
        { name: 'binutils', version: '2.41', size: '25MB' },
        { name: 'gcc', version: '13.2.0', size: '130MB' },
        { name: 'linux', version: '6.5.9', size: '140MB' },
        { name: 'glibc', version: '2.38', size: '45MB' }
    ]
};

// ============================================================================
// 5. ДАННЫЕ ДЛЯ FASTFETCH
// ============================================================================

function getFetchData(distro) {
    const isGentoo = distro === 'gentoo';
    const baseData = {
        host: 'lfs-gentoo-tui-vm',
        kernel: isGentoo ? '6.6.30-gentoo-tui' : '6.5.9-lfs-tui',
        shell: 'bash 5.2.15',
        resolution: window.innerWidth + 'x' + window.innerHeight,
        cpu: 'AMD Ryzen 7 5800H (16) @ 3.20GHz',
        gpu: 'Virtual GPU (llvmpipe)',
        memory: Math.floor(1200 + Math.random() * 900) + 'MiB / 16384MiB',
        disk: '42.1GiB / 128GiB'
    };

    if (isGentoo) {
        return {
            ...baseData,
            os: 'Gentoo Base System release 2.14',
            packages: '842 (portage)',
            de: 'OpenRC + i3wm',
            wm: 'i3wm',
            logoColor: '#a855f7'
        };
    } else {
        return {
            ...baseData,
            os: 'Linux From Scratch 12.2',
            packages: '152 (lfs-book)',
            de: 'SysVinit + custom WM',
            wm: 'Custom WM',
            logoColor: '#4af626'
        };
    }
}

const FETCH_COLORS = ['#00aaff', '#00ccff', '#33ffcc', '#66ff66', '#ffff33', '#ffaa00', '#ff5555', '#ff3399'];

// ============================================================================
// 6. LFS: РЕАЛЬНЫЕ ШАГИ (строго по книге LFS 12.2)
// ============================================================================

const LFS_STEPS = [
    {
        phase: 'PARTITIONING & MOUNTING',
        weight: 4,
        commands: [
            { cmd: 'fdisk /dev/sda', out: ['Welcome to fdisk (util-linux 2.38.1).', 'Changes will remain in memory only, until you decide to write them.'], delay: 100 },
            { cmd: 'mkfs.ext4 /dev/sda2', out: ['mke2fs 1.47.0 (5-Feb-2023)', 'Creating filesystem with 33291264 4k blocks...', 'Writing superblocks and filesystem accounting information: done'], delay: 100 },
            { cmd: 'mount /dev/sda2 /mnt', out: [] },
            { cmd: 'mkdir -v /mnt/boot && mount /dev/sda1 /mnt/boot', out: ['mkdir: created directory \'/mnt/boot\''] }
        ]
    },
    {
        phase: 'LFS USER & ENVIRONMENT',
        weight: 4,
        commands: [
            { cmd: 'groupadd lfs', out: [] },
            { cmd: 'useradd -s /bin/bash -g lfs -m -k /dev/null lfs', out: [] },
            { cmd: 'su - lfs', out: ['lfs@livecd:~$'] },
            { cmd: 'cat > ~/.bash_profile << "EOF"\nexec env -i HOME=$HOME TERM=$TERM PS1=\'\\u:\\w\\$ \' /bin/bash\nEOF', out: ['lfs@livecd:~$'] }
        ]
    },
    {
        phase: 'BINUTILS PASS 1',
        weight: 6,
        commands: [
            { cmd: 'cd $LFS/sources', out: [] },
            { cmd: 'tar -xf binutils-2.41.tar.xz', out: [] },
            { cmd: 'cd binutils-2.41 && mkdir -v build && cd build', out: ['mkdir: created directory \'build\''] },
            { cmd: '../configure --prefix=$LFS/tools --with-sysroot=$LFS --target=$LFS_TGT --disable-nls --disable-werror', out: ['checking for a BSD-compatible install... /usr/bin/install -c', 'checking whether build environment is sane... yes'] },
            { cmd: 'make', out: ['  CC      libiberty/regex.o', '  CC      bfd/archive.o', '  CCLD    bfd/libbfd.la'] },
            { cmd: 'make install', out: ['Making install in libiberty', 'Making install in bfd'] }
        ]
    },
    {
        phase: 'GCC PASS 1',
        weight: 8,
        commands: [
            { cmd: 'tar -xf gcc-13.2.0.tar.xz', out: [] },
            { cmd: 'cd gcc-13.2.0', out: [] },
            { cmd: 'tar -xf ../mpfr-4.2.0.tar.xz && mv -v mpfr-4.2.0 mpfr', out: ['renamed \'mpfr-4.2.0\' -> \'mpfr\''] },
            { cmd: 'tar -xf ../gmp-6.3.0.tar.xz && mv -v gmp-6.3.0 gmp', out: ['renamed \'gmp-6.3.0\' -> \'gmp\''] },
            { cmd: 'tar -xf ../mpc-1.3.1.tar.gz && mv -v mpc-1.3.1 mpc', out: ['renamed \'mpc-1.3.1\' -> \'mpc\''] },
            { cmd: 'mkdir -v build && cd build', out: ['mkdir: created directory \'build\''] },
            { cmd: '../configure --target=$LFS_TGT --prefix=$LFS/tools --with-glibc-version=2.38 --with-sysroot=$LFS --with-newlib --without-headers --enable-default-pie --enable-default-ssp --disable-nls --disable-shared --disable-multilib --disable-threads --disable-libatomic --disable-libgomp --disable-libquadmath --disable-libssp --disable-libvtv --disable-libstdcxx --enable-languages=c,c++', out: ['checking build system type... x86_64-pc-linux-gnu'] },
            { cmd: 'make', out: ['  CC      gcc/main.o', '  LD      cc1', '  CXX     cc1plus'] },
            { cmd: 'make install', out: ['Making install in fixincludes'] }
        ]
    },
    {
        phase: 'CHROOT & FINAL SYSTEM',
        weight: 10,
        commands: [
            { cmd: 'chroot "$LFS" /usr/bin/env -i HOME=/root TERM="$TERM" PS1=\'(lfs chroot) \\u:\\w\\$ \' PATH=/usr/bin:/usr/sbin /bin/bash --login', out: [] },
            { cmd: 'mkdir -pv /{boot,home,mnt,opt,srv}', out: ['mkdir: created directory \'/boot\'', 'mkdir: created directory \'/home\'', 'mkdir: created directory \'/mnt\'', 'mkdir: created directory \'/opt\'', 'mkdir: created directory \'/srv\''] },
            { cmd: 'mkdir -pv /etc/{opt,sysconfig}', out: ['mkdir: created directory \'/etc/opt\'', 'mkdir: created directory \'/etc/sysconfig\''] },
            { cmd: 'cd /sources && tar -xf glibc-2.38.tar.xz && cd glibc-2.38 && mkdir build && cd build', out: [] },
            { cmd: '../configure --prefix=/usr --disable-werror --enable-kernel=4.14 --enable-stack-protector=strong --with-headers=/usr/include libc_cv_slibdir=/usr/lib', out: ['checking for gcc... gcc', 'checking for suffix of object files... o'] },
            { cmd: 'make && make install', out: ['  CC      assert/assert.o', '  CC      ctype/ctype.o', 'Installing header files... done'] }
        ]
    },
    {
        phase: 'KERNEL COMPILATION',
        weight: 12,
        commands: [
            { cmd: 'cd /sources && tar -xf linux-6.5.9.tar.xz && cd linux-6.5.9', out: [] },
            { cmd: 'make mrproper', out: ['CLEAN   .config', 'CLEAN   arch/x86/boot'] },
            { cmd: 'make menuconfig', out: ['*** End of the configuration.', '*** Execute \'make\' to build the kernel.'] },
            { cmd: 'make -j$(nproc)', out: ['  CC      init/main.o', '  CC      arch/x86/kernel/head_64.o', '  LD      vmlinux', '  OBJCOPY arch/x86/boot/compressed/vmlinux.bin', 'Kernel: arch/x86/boot/bzImage is ready'] },
            { cmd: 'make modules_install', out: ['  INSTALL drivers/...', '  DEPMOD  6.5.9'] },
            { cmd: 'cp -iv arch/x86/boot/bzImage /boot/vmlinuz-6.5.9-lfs', out: ['\'arch/x86/boot/bzImage\' -> \'/boot/vmlinuz-6.5.9-lfs\''] }
        ]
    },
    {
        phase: 'GRUB & FINALIZE',
        weight: 6,
        commands: [
            { cmd: 'grub-install --target=x86_64-efi --efi-directory=/boot --bootloader-id=LFS', out: ['Installation finished. No error reported.'] },
            { cmd: 'grub-mkconfig -o /boot/grub/grub.cfg', out: ['Generating grub configuration file ...', 'Found linux image: /boot/vmlinuz-6.5.9-lfs', 'done'] },
            { cmd: 'exit', out: [] },
            { cmd: 'umount -R /mnt', out: [] },
            { cmd: 'reboot', out: ['[  OK  ] Reached target Multi-User System.', '[  OK  ] Startup finished in 4.2s.'] }
        ]
    }
];

// ============================================================================
// 7. GENTOO: РЕАЛЬНЫЕ ШАГИ (строго по Gentoo Handbook)
// ============================================================================

const GENTOO_STEPS = [
    {
        phase: 'PARTITIONING',
        weight: 4,
        commands: [
            { cmd: 'fdisk /dev/sda', out: ['Welcome to fdisk (util-linux 2.38.1).', 'Command (m for help): n', 'Created a new partition 3 of type \'Linux\' and of size 128G.'] },
            { cmd: 'mkfs.ext4 /dev/sda3', out: ['mke2fs 1.47.0 (5-Feb-2023)', 'Creating filesystem with 33554432 4k blocks...'] },
            { cmd: 'mount /dev/sda3 /mnt/gentoo', out: [] }
        ]
    },
    {
        phase: 'STAGE3 EXTRACTION',
        weight: 6,
        commands: [
            { cmd: 'cd /mnt/gentoo', out: [] },
            { cmd: 'wget https://distfiles.gentoo.org/releases/amd64/autobuilds/current-stage3-amd64-openrc/stage3-amd64-openrc-20231105T170102Z.tar.xz', out: ['Resolving distfiles.gentoo.org... 140.211.166.134', 'stage3-amd64-openrc-20231105T170102Z.tar.xz  100%[=====================================>] 311M  12.4MB/s   in 25s'] },
            { cmd: 'tar xpvf stage3-*.tar.xz --xattrs-include=\'*.*\' --numeric-owner', out: ['x etc/','x bin/','x usr/','Extracting 41208 files... ok'] }
        ]
    },
    {
        phase: 'CHROOT & PORTAGE',
        weight: 8,
        commands: [
            { cmd: 'cp --dereference /etc/resolv.conf /mnt/gentoo/etc/', out: [] },
            { cmd: 'mount --types proc /proc /mnt/gentoo/proc', out: [] },
            { cmd: 'mount --rbind /sys /mnt/gentoo/sys && mount --make-rslave /mnt/gentoo/sys', out: [] },
            { cmd: 'chroot /mnt/gentoo /bin/bash', out: [] },
            { cmd: 'source /etc/profile', out: [] },
            { cmd: 'export PS1="(chroot) ${PS1}"', out: [] },
            { cmd: 'emerge-webrsync', out: ['>>> Syncing repository \'gentoo\' into \'default\'...', 'Fetching most recent snapshot ...', 'Trying to retrieve 20231105 snapshot from https://distfiles.gentoo.org/snapshots ...', '>>> Sync finished'] },
            { cmd: 'emerge --ask --verbose --update --deep --newuse @world', out: ['These are the packages that would be merged, in order:', '[ebuild  N    ] sys-apps/portage-3.0.51', '>>> Emerging (1 of 214) sys-apps/portage-3.0.51', '>>> Installing (1 of 214) sys-apps/portage-3.0.51', 'Done!  All merges completed.'] }
        ]
    },
    {
        phase: 'KERNEL COMPILATION',
        weight: 10,
        commands: [
            { cmd: 'emerge --ask sys-kernel/gentoo-sources', out: ['>>> Emerging (1 of 1) sys-kernel/gentoo-sources-6.6.30', '>>> Installing (1 of 1) sys-kernel/gentoo-sources-6.6.30'] },
            { cmd: 'cd /usr/src/linux', out: [] },
            { cmd: 'make menuconfig', out: ['HOSTCC  scripts/basic/fixdep', '*** End of the configuration.', '*** Execute \'make\' to build the kernel.'] },
            { cmd: 'make -j8', out: ['  CC      init/main.o', '  CC      arch/x86/kernel/head_64.o', '  LD      vmlinux', '  BZIMAGE arch/x86/boot/bzImage is ready (#1)'] },
            { cmd: 'make modules_install', out: ['  DEPMOD  6.6.30-gentoo'] },
            { cmd: 'make install', out: ['sh ./arch/x86/boot/install.sh 6.6.30-gentoo arch/x86/boot/bzImage System.map "/boot"'] }
        ]
    },
    {
        phase: 'FSTAB & BOOTLOADER',
        weight: 6,
        commands: [
            { cmd: 'nano -w /etc/fstab', out: ['[В редакторе вы добавляете UUID=... / ext4 defaults,noatime 0 1]'] },
            { cmd: 'passwd', out: ['New password:', 'Retype new password:', 'passwd: password updated successfully'] },
            { cmd: 'emerge --ask sys-boot/grub', out: ['>>> Emerging (1 of 1) sys-boot/grub-2.06-r6', '>>> Installing (1 of 1) sys-boot/grub-2.06-r6'] },
            { cmd: 'grub-install --target=x86_64-efi --efi-directory=/boot', out: ['Installation finished. No error reported.'] },
            { cmd: 'grub-mkconfig -o /boot/grub/grub.cfg', out: ['Generating grub configuration file ...', 'Found Gentoo GNU/Linux: 6.6.30-gentoo', 'done'] }
        ]
    },
    {
        phase: 'REBOOT',
        weight: 4,
        commands: [
            { cmd: 'exit', out: [] },
            { cmd: 'umount -R /mnt/gentoo', out: [] },
            { cmd: 'reboot', out: [' * Starting sshd ... [ ok ]', ' * Mounting local filesystems ... [ ok ]', ' * OpenRC 0.51 starting up', 'Gentoo GNU/Linux 6.6.30-gentoo tty1  localhost login:'] }
        ]
    }
];

// ============================================================================
// 8. ЭКСПОРТ ДАННЫХ
// ============================================================================

window.DS_DATA = {
    META: SYSTEM_METADATA,
    ASCII: ASCII_ART,
    VFS: VIRTUAL_FILE_SYSTEM,
    PACKAGES: PACKAGE_DATABASE,
    
    // Шаги установки
    LFS_STEPS: LFS_STEPS,
    GENTOO_STEPS: GENTOO_STEPS,
    
    getFetchData: getFetchData,
    FF_COLORS: FETCH_COLORS
};

console.log(`%c[DATA] База данных ${SYSTEM_METADATA.PROJECT_NAME} загружена. Формат: strict commands.`, 'color: #4af626; font-weight: bold;');
