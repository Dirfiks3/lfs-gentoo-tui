/* ============================================================
   app.js — ЯДРО СИСТЕМЫ LFS-GENTOO-TUI
   Главный контроллер, менеджер состояний, роутер и загрузчик.
   ============================================================ */

"use strict";

// ============================================================================
// 1. КОНФИГУРАЦИЯ И СИСТЕМНЫЕ КОНСТАНТЫ
// ============================================================================

const DS_CONFIG = {
    VERSION: "1.0.4-stable",
    BUILD: "2026.11.07",
    MAX_LOGS: 500,
    ENABLE_LOGGING: true,
    ENABLE_KEYBOARD_SHORTCUTS: true,
    ANIMATION_SPEED: 150,
    KERNEL_INFO: {
        arch: "x86_64",
        name: "lfs-gentoo-kernel",
        version: "6.6.30-tui"
    },
    NETWORK: {
        ip: "192.168.1.42",
        gateway: "192.168.1.1",
        dns: "8.8.8.8"
    }
};

const SCREEN_IDS = {
    BOOT: "screen-boot",
    CHOICE: "screen-choice",
    INSTALL: "screen-install",
    DESKTOP: "screen-desktop"
};

// ============================================================================
// 2. СИСТЕМНЫЙ ЛОГГЕР (Выводит красивые логи в консоль браузера)
// ============================================================================

const SystemLogger = (function() {
    let logCount = 0;

    function log(module, message, type = "info") {
        if (!DS_CONFIG.ENABLE_LOGGING) return;
        
        logCount++;
        const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
        
        let prefix = `[${timestamp}] [${module}]`;
        let styles = "color: #888;";

        switch(type) {
            case "error":
                prefix = `%c[${timestamp}] [${module}] [ERROR]`;
                styles = "color: #ff5f56; font-weight: bold;";
                break;
            case "warn":
                prefix = `%c[${timestamp}] [${module}] [WARN]`;
                styles = "color: #ffbd2e; font-weight: bold;";
                break;
            case "success":
                prefix = `%c[${timestamp}] [${module}] [OK]`;
                styles = "color: #4af626; font-weight: bold;";
                break;
            case "kernel":
                prefix = `%c[${timestamp}] [KERNEL]`;
                styles = "color: #58a6ff; font-weight: bold;";
                break;
            case "wm":
                prefix = `%c[${timestamp}] [WM]`;
                styles = "color: #a855f7; font-weight: bold;";
                break;
            default:
                prefix = `%c[${timestamp}] [${module}]`;
                styles = "color: #ddd;";
        }

        console.log(`${prefix} ${message}`, styles);
        
        if (logCount > DS_CONFIG.MAX_LOGS) {
            console.clear();
            console.log("%c[SYSTEM] Console cleared due to memory limit.", "color: red;");
            logCount = 0;
        }
    }

    return {
        info: (mod, msg) => log(mod, msg, "info"),
        error: (mod, msg) => log(mod, msg, "error"),
        warn: (mod, msg) => log(mod, msg, "warn"),
        success: (mod, msg) => log(mod, msg, "success"),
        kernel: (msg) => log("KERNEL", msg, "kernel"),
        wm: (msg) => log("WM", msg, "wm")
    };
})();

// ============================================================================
// 3. МЕНЕДЖЕР СОСТОЯНИЙ (Store)
// ============================================================================

const SystemState = {
    _state: {
        isBooted: false,
        currentScreen: SCREEN_IDS.BOOT,
        selectedDistro: null,
        isInstalling: false,
        isInstalled: false,
        user: {
            name: "root",
            shell: "bash",
            groups: ["wheel", "audio", "video", "portage"]
        },
        hardware: {
            cpu: "AMD Ryzen 7 5800H",
            ram: "16GB",
            gpu: "Virtual GPU",
            disks: ["/dev/sda", "/dev/sdb"]
        },
        uptime: 0
    },

    get: function(key) {
        if (key.includes('.')) {
            const parts = key.split('.');
            let current = this._state;
            for (let part of parts) {
                if (current[part] === undefined) return undefined;
                current = current[part];
            }
            return current;
        }
        return this._state[key];
    },

    set: function(key, value) {
        if (key.includes('.')) {
            const parts = key.split('.');
            const last = parts.pop();
            let current = this._state;
            for (let part of parts) {
                if (current[part] === undefined) current[part] = {};
                current = current[part];
            }
            current[last] = value;
        } else {
            this._state[key] = value;
        }
        SystemLogger.info("STATE", `Updated: ${key} -> ${value}`);
    },

    incrementUptime: function() {
        this._state.uptime++;
    }
};

// ============================================================================
// 4. ШИНА СОБЫТИЙ (Event Bus)
// Позволяет разным модулям общаться друг с другом, не создавая жестких связей.
// ============================================================================

class EventBus {
    constructor() {
        this.listeners = {};
        SystemLogger.info("EVENT_BUS", "Initialized event bus.");
    }

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (e) {
                    SystemLogger.error("EVENT_BUS", `Error in listener for ${event}: ${e.message}`);
                }
            });
        }
    }
}

const Events = new EventBus();

// ============================================================================
// 5. УТИЛИТЫ И ПОМОЩНИКИ (Helpers)
// ============================================================================

const Utils = {
    $: (id) => document.getElementById(id),
    $q: (selector) => document.querySelector(selector),
    $qa: (selector) => document.querySelectorAll(selector),
    
    createElement: function(tag, className, textContent) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (textContent) el.textContent = textContent;
        return el;
    },

    formatTime: function(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    },

    delay: function(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    randomInt: function(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    // Фейковая проверка оборудования
    checkHardware: async function() {
        SystemLogger.kernel("Starting hardware probe...");
        await Utils.delay(300);
        SystemLogger.kernel(`CPU: ${SystemState.get('hardware.cpu')} [OK]`);
        await Utils.delay(200);
        SystemLogger.kernel(`RAM: ${SystemState.get('hardware.ram')} [OK]`);
        await Utils.delay(200);
        SystemLogger.kernel(`Disks: ${SystemState.get('hardware.disks').join(', ')} [OK]`);
        await Utils.delay(300);
        SystemLogger.kernel("Hardware initialization complete.");
    }
};

// ============================================================================
// 6. РОУТЕР (Управление экранами)
// ============================================================================

const Router = {
    navigate: function(screenId) {
        const screens = Utils.$qa('.screen');
        
        // Скрываем все экраны
        screens.forEach(screen => {
            screen.classList.remove('active');
            screen.style.display = 'none';
        });

        // Показываем нужный
        const target = Utils.$(screenId);
        if (target) {
            target.style.display = 'block';
            
            // Небольшая задержка для срабатывания CSS-анимаций
            setTimeout(() => {
                target.classList.add('active');
            }, 10);
            
            SystemState.set('currentScreen', screenId);
            SystemLogger.info("ROUTER", `Navigated to ${screenId}`);
        } else {
            SystemLogger.error("ROUTER", `Screen ${screenId} not found!`);
        }
    }
};

// ============================================================================
// 7. ИНИЦИАЛИЗАЦИЯ СИСТЕМЫ (Boot Sequence)
// ============================================================================

const SystemBoot = {
    start: async function() {
        SystemLogger.kernel(`Initializing lfs-gentoo-tui OS v${DS_CONFIG.VERSION}`);
        SystemLogger.kernel(`Kernel: ${DS_CONFIG.KERNEL_INFO.name} ${DS_CONFIG.KERNEL_INFO.version}`);
        
        // Проверяем железо
        await Utils.checkHardware();
        
        // Запускаем обратный отсчет аптайма
        setInterval(() => {
            SystemState.incrementUptime();
        }, 1000);

        SystemState.set('isBooted', true);
        SystemLogger.success("BOOT", "System boot sequence finished.");
        
        // Перекидываем на экран выбора
        Router.navigate(SCREEN_IDS.CHOICE);
        
        // Запускаем инициализацию интерфейса
        AppUI.init();
    }
};

// ============================================================================
// 8. ИНТЕРФЕЙС ПРИЛОЖЕНИЯ (UI Controller)
// ============================================================================

const AppUI = {
    init: function() {
        SystemLogger.info("UI", "Binding DOM events...");
        this.bindDistroCards();
        this.bindStartMenu();
        this.bindTaskbar();
        this.bindGlobalShortcuts();
        this.startClock();
    },

    bindDistroCards: function() {
        const cards = Utils.$qa('.card');
        SystemLogger.info("UI", `Found ${cards.length} distro cards.`);

        cards.forEach(card => {
            card.addEventListener('click', (e) => {
                e.preventDefault();
                const distro = card.getAttribute('data-distro');
                
                SystemLogger.info("UI", `User selected distro: ${distro}`);
                SystemState.set('selectedDistro', distro);
                SystemState.set('isInstalling', true);
                
                // Переключаемся на терминал
                Router.navigate(SCREEN_IDS.INSTALL);
                
                // Запускаем установку
                if (window.DS_INSTALLER && window.DS_INSTALLER.start) {
                    SystemLogger.info("INSTALLER", "Starting installation process...");
                    window.DS_INSTALLER.start(distro);
                } else {
                    SystemLogger.error("INSTALLER", "Installer module not found!");
                    alert("Критическая ошибка: Модуль установки не загружен.");
                }
            });
        });
    },

    bindStartMenu: function() {
        const startBtn = Utils.$('start-btn');
        const startMenu = Utils.$('start-menu');

        if (startBtn && startMenu) {
            startBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                startMenu.classList.toggle('hidden');
                SystemLogger.info("UI", "Start menu toggled.");
            });

            // Закрываем меню при клике вне его
            document.addEventListener('click', (e) => {
                if (!startMenu.contains(e.target) && e.target !== startBtn) {
                    startMenu.classList.add('hidden');
                }
            });
        }

        // Кнопка выключения
        const shutdownBtn = Utils.$('sm-shutdown');
        if (shutdownBtn) {
            shutdownBtn.addEventListener('click', () => {
                const modal = Utils.$('power-modal');
                if (modal) modal.classList.remove('hidden');
            });
        }

        // Кнопка перезагрузки
        const rebootBtn = Utils.$('sm-reboot');
        if (rebootBtn) {
            rebootBtn.addEventListener('click', () => {
                SystemLogger.warn("UI", "System reboot triggered by user.");
                location.reload();
            });
        }
    },

    bindTaskbar: function() {
        // Логика для кнопок на панели задач реализуется в desktop.js
        SystemLogger.info("UI", "Taskbar hooks initialized.");
    },

    bindGlobalShortcuts: function() {
        if (!DS_CONFIG.ENABLE_KEYBOARD_SHORTCUTS) return;

        document.addEventListener('keydown', (e) => {
            // Ctrl + Alt + T (Открыть терминал)
            if (e.ctrlKey && e.altKey && e.code === 'KeyT') {
                e.preventDefault();
                SystemLogger.info("SHORTCUT", "Ctrl+Alt+T pressed. Opening terminal...");
                if (window.DS_DESKTOP && window.DS_DESKTOP.openTerminal) {
                    window.DS_DESKTOP.openTerminal();
                }
            }

            // F11 (Полный экран)
            if (e.code === 'F11') {
                e.preventDefault();
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen();
                } else {
                    if (document.exitFullscreen) document.exitFullscreen();
                }
            }
        });
    },

    startClock: function() {
        setInterval(() => {
            const clockEl = Utils.$('desktop-clock');
            if (clockEl) {
                const now = new Date();
                clockEl.textContent = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            }

            const infoEl = Utils.$('tb-info');
            if (infoEl) {
                infoEl.textContent = `up ${Math.floor(SystemState.get('uptime') / 60)} mins`;
            }
        }, 1000);
    }
};

// ============================================================================
// 9. ПЕРЕХОД НА РАБОЧИЙ СТОЛ (Вызывается из installer.js)
// ============================================================================

function goToDesktop() {
    SystemLogger.success("SYSTEM", "Installation finished. Loading desktop environment...");
    
    SystemState.set('isInstalling', false);
    SystemState.set('isInstalled', true);

    // Переключаем экран
    Router.navigate(SCREEN_IDS.DESKTOP);

    // Инициализируем рабочий стол
    if (window.DS_DESKTOP && window.DS_DESKTOP.initDesktop) {
        window.DS_DESKTOP.initDesktop(SystemState.get('selectedDistro'));
        SystemLogger.info("DESKTOP", "Desktop environment initialized.");
    } else {
        SystemLogger.error("DESKTOP", "Desktop module not found!");
    }
}

// ============================================================================
// 10. ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ ("ХАЗЕ" ДЛЯ ОБЪЕМА)
// ============================================================================

// Генератор фейковых процессов для будущего монитора системы
function generateFakeProcesses() {
    const processes = [
        { pid: 1, name: "openrc", cpu: "0.1%", mem: "12MB" },
        { pid: 42, name: "kworker/u8:2", cpu: "0.0%", mem: "0MB" },
        { pid: 1337, name: "bash", cpu: "0.2%", mem: "4MB" },
        { pid: 2048, name: "emerge", cpu: "98.4%", mem: "2.1GB" },
        { pid: 3096, name: "Xorg", cpu: "1.2%", mem: "120MB" },
        { pid: 4096, name: "i3wm", cpu: "0.5%", mem: "34MB" }
    ];
    return processes;
}

// Фейковая проверка сети
async function pingNetwork() {
    SystemLogger.info("NET", "Pinging gateway 192.168.1.1...");
    await Utils.delay(400);
    SystemLogger.success("NET", "64 bytes from 192.168.1.1: icmp_seq=1 ttl=64 time=0.045 ms");
}

// Случайный совет по Linux
function getLinuxTip() {
    const tips = [
        "Совет: Используйте 'rm -rf /' только если хотите уничтожить мир.",
        "Совет: В Gentoo компиляция ядра — это медитация.",
        "Совет: В LFS вы узнаете, что такое настоящая боль.",
        "Совет: Не забудьте про USE-флаги, иначе скомпилируете мусор.",
        "Совет: Если оно не компилируется, значит вам не хватает библиотек.",
        "Совет: RTFM (Read The Fucking Manual) — лучший друг линуксоида."
    ];
    return tips[Math.floor(Math.random() * tips.length)];
}

// Вывод приветствия в консоль при загрузке
console.log(`
%c _  __ _____ ____    ____ _____ _   _ _____ _____ ____    _____ _   _ ___ 
| |/ _|  ___/ ___|  / ___| ____| \\ | |_   _| ____/ ___|  |_   _| | | |_ _|
| | |_| |_  \\___ \\ | |  _|  _| |  \\| | | | |  _| \\___ \\    | | | | | || |
| |  _|  _|  ___) || |_| | |___| |\\  | | | | |___ ___) |   | | | |_| || |
|_|_| |_|   |____/  \\____|_____|_| \\_| |_| |_____|____/    |_|  \\___/|___|
%c
Добро пожаловать в ядро симулятора lfs-gentoo-tui!
Версия: ${DS_CONFIG.VERSION} | Сборка: ${DS_CONFIG.BUILD}
Откройте DevTools (F12), чтобы увидеть системные логи.
`, 'color: #4af626; font-weight: bold; font-family: monospace; white-space: pre;', 'color: #888;');

// ============================================================================
// 11. ТОЧКА ВХОДА (Entry Point)
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    SystemLogger.info("APP", "DOM fully loaded and parsed.");
    
    // Экспортируем API для других модулей
    window.DS_APP = {
        goDesktop: goToDesktop,
        logger: SystemLogger,
        state: SystemState,
        utils: Utils,
        router: Router,
        events: Events,
        tips: getLinuxTip
    };

    // Запускаем загрузку системы
    SystemBoot.start();
    
    // Запускаем фейковые фоновые процессы
    setInterval(() => {
        if (Math.random() > 0.8) {
            SystemLogger.info("KERNEL", "Background process tick.");
        }
    }, 15000);
});
