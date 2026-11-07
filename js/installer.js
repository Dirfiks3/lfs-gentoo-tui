/* ============================================================
   installer.js — ЯДРО СИСТЕМЫ УСТАНОВКИ LFS-GENTOO-TUI
   Проект: lfs-gentoo-tui
   Файл: installer.js
   Строк: ~1600
   Описание: Главный контроллер процесса установки. Обрабатывает
   ввод команд пользователя, управляет таймерами, генерирует
   фоновые процессы компиляции, взаимодействует с data.js.
   ============================================================ */

"use strict";

(function () {
    // ========================================================================
    // 0. ГЛОБАЛЬНЫЕ ЗАВИСИМОСТИ И КОНСТАНТЫ
    // ========================================================================

    const D = window.DS_DATA;
    const LOG = window.DS_APP ? window.DS_APP.logger : console;

    /**
     * Основные настройки установщика
     */
    const INSTALLER_CONFIG = {
        // Время установки в миллисекундах (1 час для LFS, 30 мин для Gentoo)
        LFS_DURATION: 60 * 60 * 1000,
        GENTOO_DURATION: 30 * 60 * 1000,
        
        // Максимальное количество строк в DOM (защита от зависания браузера)
        MAX_DOM_LINES: 3500,
        
        // Частота обновления прогресс-бара (мс)
        PROGRESS_TICK_RATE: 100,
        
        // Частота генерации фонового шума (мс)
        NOISE_TICK_RATE: 2500,
        
        // Частота обновления монитора железа (мс)
        HARDWARE_TICK_RATE: 8000,
        
        // Цвета для подсветки
        COLORS: {
            CMD: '#4af626',
            OUT: '#ffffff',
            OK: '#4af626',
            ERR: '#ff5f56',
            INFO: '#58a6ff',
            DIM: '#666666',
            WARN: '#ffbd2e'
        }
    };

    /**
     * Словарь команд для парсера (позволяет вводить синонимы)
     */
    const COMMAND_SYNONYMS = {
        'make': ['make', 'compile', 'build', 'gmake'],
        'emerge': ['emerge', 'install', 'apt', 'pacman', 'dnf'],
        'fdisk': ['fdisk', 'parted', 'cfdisk', 'gdisk'],
        'tar': ['tar', 'unzip', 'extract', 'untar'],
        'su': ['su', 'sudo', 'login'],
        'nano': ['nano', 'vim', 'vi', 'edit'],
        'chroot': ['chroot', 'env', 'switch'],
        'wget': ['wget', 'curl', 'download', 'fetch'],
        'grub-install': ['grub-install', 'grub', 'bootloader'],
        'reboot': ['reboot', 'shutdown', 'exit', 'poweroff']
    };

    /**
     * Состояние системы в реальном времени
     */
    const InstallState = {
        distro: 'lfs',           // 'lfs' или 'gentoo'
        isRunning: false,        // Идет ли процесс
        currentPhaseIndex: 0,    // Индекс текущей фазы
        currentStep: null,       // Текущий объект шага
        totalWeight: 0,          // Общий вес всех шагов
        sessionTotalTime: 0,     // Общее время сессии (мс)
        
        // Тайминги
        phaseStartTime: 0,       // Время старта текущей фазы
        accumulatedTime: 0,      // Накопленное время прошлых фаз
        
        // Интервалы
        timers: {
            clock: null,         // Таймер обратного отсчета
            progress: null,      // Таймер полосы прогресса
            noise: null,         // Таймер фонового шума
            hardware: null       // Таймер мониторинга железа
        },

        // Статистика
        stats: {
            linesPrinted: 0,
            commandsTyped: 0,
            errorsMade: 0,
            startTime: 0
        }
    };

    // ========================================================================
    // 1. УТИЛИТЫ И ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
    // ========================================================================

    const Utils = {
        /**
         * Получение элемента по ID
         */
        $: function(id) {
            return document.getElementById(id);
        },

        /**
         * Экранирование HTML-тегов (защита от XSS)
         */
        escapeHtml: function(str) {
            if (typeof str !== 'string') return '';
            return str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        },

        /**
         * Форматирование времени в формат ЧЧ:ММ:СС
         */
        formatTime: function(ms) {
            const totalSeconds = Math.max(0, Math.floor(ms / 1000));
            const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
            const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
            const seconds = String(totalSeconds % 60).padStart(2, '0');
            return `${hours}:${minutes}:${seconds}`;
        },

        /**
         * Случайное число в диапазоне
         */
        randomInt: function(min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        },

        /**
         * Случайный элемент массива
         */
        randomChoice: function(arr) {
            return arr[Math.floor(Math.random() * arr.length)];
        },

        /**
         * Задержка (Promise)
         */
        sleep: function(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
    };

    // ========================================================================
    // 2. МЕНЕДЖЕР ВЫВОДА В ТЕРМИНАЛ (Terminal UI Manager)
    // ========================================================================

    const TerminalUI = {
        /**
         * Очистка терминала
         */
        clear: function() {
            const term = Utils.$('install-term');
            if (term) term.innerHTML = '';
            InstallState.stats.linesPrinted = 0;
        },

        /**
         * Определение цвета и CSS-класса для строки на основе её содержимого
         */
        colorize: function(line) {
            const escaped = Utils.escapeHtml(line);
            
            // Команды
            if (/^\$ |^# |^lfs:~\$ |^\(chroot\)/.test(line)) {
                return `<span class="log-cmd" style="color:${INSTALLER_CONFIG.COLORS.CMD}">${escaped}</span>`;
            }
            
            // Ошибки и предупреждения
            if (/error|failed|fatal|warning/i.test(line)) {
                return `<span class="log-err" style="color:${INSTALL_CONFIG.COLORS.ERR}">${escaped}</span>`;
            }
            
            // Успешное завершение
            if (/OK|ok|PASS|Done|done|finished|success/i.test(line)) {
                return `<span class="log-ok" style="color:${INSTALLER_CONFIG.COLORS.OK}">${escaped}</span>`;
            }
            
            // Системная информация
            if (/^(>>>|\[|Checking|checking|Creating|Installing|Generating|Writing|Пакетов|Kernel:|Resolving|stage3|These|Available|DEPMOD|Calculating|gcc \(|New password|\* |mke2fs|Found|Installation)/.test(line)) {
                return `<span class="log-out" style="color:${INSTALLER_CONFIG.COLORS.OUT}">${escaped}</span>`;
            }
            
            // Всё остальное (информация)
            return `<span class="log-info" style="color:${INSTALLER_CONFIG.COLORS.INFO}">${escaped}</span>`;
        },

        /**
         * Добавление строки в терминал с автоскроллом
         */
        appendLine: function(text, isRaw = false) {
            const term = Utils.$('install-term');
            if (!term) return;

            const div = document.createElement('div');
            div.className = 'log-line';
            div.innerHTML = isRaw ? text : this.colorize(text);
            
            // Вставка перед строкой ввода, если она видима
            const inputline = Utils.$('install-inputline');
            if (inputline && inputline.style.display !== 'none') {
                term.insertBefore(div, inputline);
            } else {
                term.appendChild(div);
            }
            
            // Автоскролл
            term.scrollTop = term.scrollHeight;
            
            // Защита от переполнения DOM
            while (term.children.length > INSTALLER_CONFIG.MAX_DOM_LINES) {
                term.removeChild(term.firstChild);
            }
            
            InstallState.stats.linesPrinted++;
        },

        /**
         * Вывод пустой строки
         */
        appendEmptyLine: function() {
            this.appendLine('', true);
        },

        /**
         * Обновление статус-бара
         */
        updateStatusBar: function(phase, percent, eta) {
            const phaseEl = Utils.$('status-phase');
            const percentEl = Utils.$('status-percent');
            const etaEl = Utils.$('status-eta');

            if (phaseEl) phaseEl.textContent = phase;
            if (percentEl) percentEl.textContent = `${percent.toFixed(1)}%`;
            if (etaEl) etaEl.textContent = `ETA: ${eta}`;
        },

        /**
         * Обновление прогресс-бара
         */
        updateProgressBar: function(percent) {
            const fill = Utils.$('install-progress');
            if (fill) fill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
        }
    };

    // ========================================================================
    // 3. ГЕНЕРАТОР ФОНОВОГО ШУМА (Noise Generator)
    // ========================================================================

    const NoiseGenerator = {
        // Базы данных шумов для разных фаз
        NOISE_DB: {
            partitioning: [
                'sd 0:0:0:0: [sda] Attached SCSI disk',
                'EXT4-fs (sda2): mounted filesystem with ordered data mode',
                'Partition #1 contains a ext4 signature',
                'Allocating group tables: done'
            ],
            compiling: [
                '  CC      kernel/sched/core.o',
                '  CC      drivers/gpu/drm/i915/i915_drv.o',
                '  LD      vmlinux.o',
                '  MODPOST 320 modules',
                '  CCLD    libc.so.6',
                '  AR      libbfd.a',
                'In file included from /usr/include/stdio.h:34:0,',
                'checking whether gcc accepts -g... yes',
                'config.status: creating Makefile',
                'make[1]: Nothing to be done for \'all\'.',
                'mv -f .deps/Tmp-stampT .deps/Tmp-stamp',
                'gzip -9f man1/prog.1',
                'strip --strip-unneeded lib.so'
            ],
            emerging: [
                '>>> Emerging (2 of 214) dev-libs/openssl-3.0.9-r2',
                '>>> Downloading \'https://gentoo.osuosl.org/distfiles/openssl-3.0.9.tar.gz\'',
                '>>> Unpacking source...',
                '>>> Source unpacked in /var/tmp/portage/dev-libs/openssl-3.0.9-r2/work',
                '>>> Compiling source in /var/tmp/portage/dev-libs/openssl-3.0.9-r2/work/openssl-3.0.9 ...',
                ' * Applying openssl-1.0.2a-parallel-build.patch ...',
                ' * Checking for gcc ...',
                'configure: creating ./config.data',
                'make: Entering directory \'/var/tmp/portage...\'',
                'install: cannot stat \'foo\': No such file or directory'
            ],
            kernel: [
                '  CALL    scripts/checksyscalls.sh',
                '  CC      init/do_mounts_initrd.o',
                '  LD      init/mounts.o',
                '  CC      arch/x86/kernel/head_64.o',
                '  CC      arch/x86/kernel/head64.o',
                '  AS      arch/x86/kernel/head_64.o',
                '  LD      arch/x86/kernel/head_64.o',
                '  LDS     arch/x86/kernel/vmlinux.lds',
                '  CC      kernel/fork.o',
                '  CC      kernel/exit.o',
                '  CC      kernel/panic.o',
                '  BZIMAGE arch/x86/boot/bzImage',
                'Kernel: arch/x86/boot/bzImage is ready  (#1)'
            ]
        },

        /**
         * Получить шум на основе текущей фазы
         */
        getNoise: function(phaseName) {
            const phase = phaseName.toLowerCase();
            let pool = this.NOISE_DB.compiling; // По умолчанию компиляция

            if (phase.includes('partition')) pool = this.NOISE_DB.partitioning;
            else if (phase.includes('world') || phase.includes('system')) pool = this.NOISE_DB.emerging;
            else if (phase.includes('kernel')) pool = this.NOISE_DB.kernel;

            return Utils.randomChoice(pool);
        },

        /**
         * Запуск генерации шума
         */
        start: function() {
            this.stop(); // Очищаем старые таймеры
            
            InstallState.timers.noise = setInterval(() => {
                if (!InstallState.isRunning || !InstallState.currentStep) return;

                // 30% шанс пропустить тик
                if (Math.random() > 0.7) return;

                const burst = Utils.randomInt(1, 3);
                for (let i = 0; i < burst; i++) {
                    setTimeout(() => {
                        if (InstallState.isRunning) {
                            TerminalUI.appendLine(this.getNoise(InstallState.currentStep.phase));
                        }
                    }, i * 300);
                }
            }, INSTALLER_CONFIG.NOISE_TICK_RATE);
        },

        /**
         * Остановка генерации шума
         */
        stop: function() {
            if (InstallState.timers.noise) {
                clearInterval(InstallState.timers.noise);
                InstallState.timers.noise = null;
            }
        }
    };

    // ========================================================================
    // 4. МОНИТОР ЖЕЛЕЗА (Hardware Monitor)
    // ========================================================================

    const HardwareMonitor = {
        start: function() {
            this.stop();
            
            InstallState.timers.hardware = setInterval(() => {
                if (!InstallState.isRunning) return;

                // Генерируем случайное событие
                const roll = Math.random();
                
                if (roll > 0.8) {
                    const temp = Utils.randomInt(55, 85);
                    TerminalUI.appendLine(`[TEMP] CPU: ${temp}°C | Fan: ${Utils.randomInt(1200, 3000)} RPM`);
                } else if (roll > 0.6) {
                    const ram = (Math.random() * 4 + 1.5).toFixed(1);
                    TerminalUI.appendLine(`[RAM] Used: ${ram}GB / 16GB | Swap: 0MB`);
                } else if (roll > 0.4) {
                    const load = (Math.random() * 8).toFixed(2);
                    TerminalUI.appendLine(`[LOAD] Average: ${load}, ${load}, ${load}`);
                }

            }, INSTALLER_CONFIG.HARDWARE_TICK_RATE);
        },

        stop: function() {
            if (InstallState.timers.hardware) {
                clearInterval(InstallState.timers.hardware);
                InstallState.timers.hardware = null;
            }
        }
    };

    // ========================================================================
    // 5. ПАРСЕР КОМАНД (Command Parser)
    // ========================================================================

    const CommandParser = {
        /**
         * Проверка, является ли введенная команда правильной
         */
        validate: function(input, expectedCmd) {
            if (!input || !expectedCmd) return false;

            const cleanInput = input.trim().toLowerCase();
            const cleanExpected = expectedCmd.toLowerCase();

            // Проверяем точное совпадение
            if (cleanInput === cleanExpected) return true;

            // Проверяем вхождение (например, "make -j8" содержит "make")
            if (cleanInput.includes(cleanExpected)) return true;

            // Проверяем синонимы
            const synonyms = COMMAND_SYNONYMS[cleanExpected] || [];
            for (const syn of synonyms) {
                if (cleanInput.includes(syn)) return true;
            }

            return false;
        },

        /**
         * Обработка ввода
         */
        handleInput: function(event) {
            if (event.key !== 'Enter') return;

            const inputField = Utils.$('install-input');
            if (!inputField || inputField.disabled) return;

            const rawInput = inputField.value.trim();
            if (!rawInput) return;

            // Выводим введенную команду
            TerminalUI.appendLine(`root@livecd:~# ${rawInput}`, true);
            inputField.value = '';
            InstallState.stats.commandsTyped++;

            // Проверяем команду
            if (!InstallState.currentStep) return;

            const expected = InstallState.currentStep.cmd || '';
            const isValid = this.validate(rawInput, expected);

            if (!isValid) {
                InstallState.stats.errorsMade++;
                TerminalUI.appendLine(`bash: ${rawInput.split(' ')[0]}: command not found`, true);
                
                // Если ошибок слишком много, даем подсказку
                if (InstallState.stats.errorsMade % 3 === 0) {
                    TerminalUI.appendLine(`[Подсказка: попробуй ввести "${expected}"]`, true);
                }
                return;
            }

            // Команда верная - запускаем шаг
            inputField.disabled = true;
            SimulationEngine.executeStep();
        }
    };

    // ========================================================================
    // 6. ДВИЖОК СИМУЛЯЦИИ (Simulation Engine)
    // ========================================================================

    const SimulationEngine = {
        /**
         * Инициализация шага
         */
        executeStep: function() {
            const step = InstallState.currentStep;
            if (!step) return;

            // Выводим заголовок фазы
            TerminalUI.appendEmptyLine();
            TerminalUI.appendLine(`═══════════ [ ФАЗА: ${step.phase} ] ═══════════`);
            TerminalUI.appendLine(`Starting: ${step.phase}...`);

            // Вычисляем время для этого шага
            const weight = step.weight || 1;
            const stepDuration = (weight / InstallState.totalWeight) * InstallState.sessionTotalTime;
            
            InstallState.phaseStartTime = Date.now();

            // Выводим логи шага (с задержкой)
            if (step.lines && step.lines.length > 0) {
                step.lines.forEach((line, index) => {
                    setTimeout(() => {
                        if (InstallState.isRunning) {
                            TerminalUI.appendLine(line);
                        }
                    }, (index + 1) * Utils.randomInt(80, 150)); 
                });
            }

            // Запускаем фоновый шум
            NoiseGenerator.start();

            // Запускаем прогресс-бар
            this.startProgressTimer(stepDuration);
        },

        /**
         * Таймер прогресса
         */
        startProgressTimer: function(stepDuration) {
            if (InstallState.timers.progress) {
                clearInterval(InstallState.timers.progress);
            }

            InstallState.timers.progress = setInterval(() => {
                if (!InstallState.isRunning) return;

                const elapsed = Date.now() - InstallState.phaseStartTime;
                const stepProgress = Math.min(1, elapsed / stepDuration);
                const totalProgress = (InstallState.currentPhaseIndex + stepProgress) / InstallState.currentPhaseIndex.totalSteps;

                // Обновляем UI
                TerminalUI.updateProgressBar(totalProgress * 100);
                
                // Обновляем статус (оставшееся время для ЭТОГО шага)
                const remainingMs = Math.max(0, stepDuration - elapsed);
                TerminalUI.updateStatusBar(
                    InstallState.currentStep.phase, 
                    totalProgress * 100, 
                    Utils.formatTime(remainingMs)
                );

                // Проверка завершения шага
                if (stepProgress >= 1) {
                    this.completeStep(stepDuration);
                }

            }, INSTALLER_CONFIG.PROGRESS_TICK_RATE);
        },

        /**
         * Завершение текущего шага
         */
        completeStep: function(stepDuration) {
            clearInterval(InstallState.timers.progress);
            NoiseGenerator.stop();

            InstallState.accumulatedTime += stepDuration;
            InstallState.currentPhaseIndex++;

            const steps = InstallState.distro === 'gentoo' ? D.GENTOO_STEPS : D.LFS_STEPS;

            if (InstallState.currentPhaseIndex < steps.length) {
                // Переход к следующему шагу
                InstallState.currentStep = steps[InstallState.currentPhaseIndex];
                
                const inputField = Utils.$('install-input');
                if (inputField) {
                    inputField.disabled = false;
                    inputField.focus();
                }

                TerminalUI.appendEmptyLine();
                TerminalUI.appendLine(`[УСПЕХ] Фаза завершена.`);
                TerminalUI.appendLine(`[Подсказка: введи "${InstallState.currentStep.cmd}"]`);
                
            } else {
                // Установка завершена полностью
                this.finishInstallation();
            }
        },

        /**
         * Завершение всей установки
         */
        finishInstallation: function() {
            InstallState.isRunning = false;
            HardwareMonitor.stop();
            NoiseGenerator.stop();

            TerminalUI.updateStatusBar('DONE', 100, '00:00:00');
            TerminalUI.updateProgressBar(100);

            TerminalUI.appendEmptyLine();
            TerminalUI.appendLine('██████████████████████████████ 100%', true);
            TerminalUI.appendLine('════════════════════════════════════');
            TerminalUI.appendLine(InstallState.distro === 'gentoo' 
                ? 'Gentoo Linux успешно установлена.' 
                : 'LFS успешно собрана. Ты построил ядро сам.', true);
            TerminalUI.appendLine('════════════════════════════════════');
            TerminalUI.appendLine('Загрузка рабочего окружения...');

            const inputline = Utils.$('install-inputline');
            if (inputline) inputline.style.display = 'none';

            // Переход на рабочий стол
            setTimeout(() => {
                if (window.DS_APP && window.DS_APP.goDesktop) {
                    window.DS_APP.goDesktop();
                }
            }, 4000);
        }
    };

    // ========================================================================
    // 7. ГЛАВНЫЙ КОНТРОЛЛЕР (Main Controller)
    // ========================================================================

    const InstallerController = {
        /**
         * Запуск процесса установки
         */
        start: function(distro) {
            if (InstallState.isRunning) return;
            
            LOG.info("INSTALLER", `Starting installation for ${distro}`);
            
            // Сброс состояния
            InstallState.isRunning = true;
            InstallState.distro = distro;
            InstallState.currentPhaseIndex = 0;
            InstallState.accumulatedTime = 0;
            InstallState.stats = { linesPrinted: 0, commandsTyped: 0, errorsMade: 0, startTime: Date.now() };

            // Установка времени
            InstallState.sessionTotalTime = distro === 'lfs' 
                ? INSTALLER_CONFIG.LFS_DURATION 
                : INSTALLER_CONFIG.GENTOO_DURATION;

            // Загрузка шагов
            const steps = distro === 'gentoo' ? D.GENTOO_STEPS : D.LFS_STEPS;
            InstallState.currentStep = steps[0];
            InstallState.totalWeight = steps.reduce((acc, s) => acc + (s.weight || 1), 0);
            
            // Добавляем свойство totalSteps для прогресс-бара
            InstallState.currentPhaseIndex.totalSteps = steps.length; 

            // Очистка UI
            TerminalUI.clear();

            // Настройка поля ввода
            const inputField = Utils.$('install-input');
            inputField.disabled = false;
            inputField.value = '';
            inputField.removeEventListener('keydown', CommandParser.handleInput.bind(CommandParser));
            inputField.addEventListener('keydown', CommandParser.handleInput.bind(CommandParser));
            
            const inputline = Utils.$('install-inputline');
            if (inputline) inputline.style.display = 'flex';
            
            setTimeout(() => inputField.focus(), 100);

            // Заголовок
            const titleEl = Utils.$('install-title');
            if (titleEl) {
                titleEl.textContent = distro === 'gentoo' 
                    ? 'root@livecd: / # emerge -av @world' 
                    : 'lfs@livecd: / # make -j$(nproc)';
            }

            // Приветствие
            TerminalUI.appendLine('GNU Bash 5.2.15 (x86_64-pc-linux-gnu)', true);
            TerminalUI.appendLine(`Начинаем установку ${distro === 'gentoo' ? 'Gentoo' : 'Linux From Scratch'}...`);
            TerminalUI.appendLine(`Время процесса: ${Utils.formatTime(InstallState.sessionTotalTime)}`);
            TerminalUI.appendLine('Внимание: вам нужно вводить команды вручную.');
            TerminalUI.appendEmptyLine();
            TerminalUI.appendLine(`[Подсказка: введи "${InstallState.currentStep.cmd}"]`);

            // Запуск фоновых процессов
            HardwareMonitor.start();

            // Запуск глобального таймера ETA
            this.startGlobalClock();
        },

        /**
         * Глобальный таймер
         */
        startGlobalClock: function() {
            if (InstallState.timers.clock) {
                clearInterval(InstallState.timers.clock);
            }

            InstallState.timers.clock = setInterval(() => {
                if (!InstallState.isRunning) return;

                const elapsed = InstallState.accumulatedTime + (Date.now() - InstallState.phaseStartTime);
                const remaining = Math.max(0, InstallState.sessionTotalTime - elapsed);
                
                // Обновляем ETA в статусбаре
                const etaEl = Utils.$('status-eta');
                if (etaEl) {
                    etaEl.textContent = `ETA: ${Utils.formatTime(remaining)}`;
                }

            }, 1000);
        },

        /**
         * Остановка (в случае сбоя)
         */
        stop: function() {
            LOG.warn("INSTALLER", "Installation aborted by user or error.");
            InstallState.isRunning = false;
            
            clearInterval(InstallState.timers.clock);
            clearInterval(InstallState.timers.progress);
            NoiseGenerator.stop();
            HardwareMonitor.stop();

            TerminalUI.appendLine('УСТАНОВКА ПРЕРВАНА.', true);
        }
    };

    // ========================================================================
    // 8. ТОЧКА ВХОДА (Export)
    // ========================================================================

    window.DS_INSTALLER = {
        start: InstallerController.start.bind(InstallerController),
        stop: InstallerController.stop.bind(InstallerController)
    };

    LOG.info("INSTALLER", "installer.js module loaded successfully. System ready.");

})();
