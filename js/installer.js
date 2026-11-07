/* ============================================================
   installer.js — ЯДРО СИСТЕМЫ УСТАНОВКИ LFS-GENTOO-TUI
   Проект: lfs-gentoo-tui
   Файл: installer.js
   Строк: ~900
   Описание: Главный контроллер процесса установки. 
   Время установки установлено на 10 минут для обоих дистрибутивов.
   Исправлены фатальные ошибки DOM и логики таймеров.
   ============================================================ */

"use strict";

(function () {
    // ========================================================================
    // 0. КОНФИГУРАЦИЯ И КОНСТАНТЫ
    // ========================================================================

    const D = window.DS_DATA;
    const LOG = window.DS_APP ? window.DS_APP.logger : console;

    const INSTALLER_CONFIG = {
        // Общее время установки: 10 минут для обоих дистрибутивов
        TOTAL_DURATION_MS: 10 * 60 * 1000, 
        
        // Максимальное количество строк в терминале (защита от зависания)
        MAX_DOM_LINES: 3000,
        
        // Частота обновления прогресс-бара
        PROGRESS_TICK_RATE: 100,
        
        // Частота генерации фонового шума компиляции
        NOISE_TICK_RATE: 2000,
        
        // Цвета (синхронизированы с CSS)
        COLORS: {
            CMD: '#4af626',
            OUT: '#cccccc',
            OK: '#4af626',
            ERR: '#ff5f56',
            INFO: '#58a6ff',
            DIM: '#888888'
        }
    };

    // Словарь синонимов для команд
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

    // ========================================================================
    // 1. СОСТОЯНИЕ СИСТЕМЫ (STATE)
    // ========================================================================

    const InstallState = {
        distro: 'lfs',
        isRunning: false,
        currentPhaseIndex: 0,
        totalSteps: 0,
        currentStep: null,
        totalWeight: 0,
        sessionTotalTime: 0,
        
        // Тайминги
        phaseStartTime: 0,
        accumulatedTime: 0,
        
        // Интервалы
        timers: {
            clock: null,
            progress: null,
            noise: null
        },

        // Статистика
        stats: {
            linesPrinted: 0,
            commandsTyped: 0,
            errorsMade: 0
        }
    };

    // ========================================================================
    // 2. УТИЛИТЫ (UTILS)
    // ========================================================================

    const Utils = {
        $: (id) => document.getElementById(id),

        escapeHtml: function(str) {
            if (typeof str !== 'string') return '';
            return str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        },

        formatTime: function(ms) {
            const totalSeconds = Math.max(0, Math.floor(ms / 1000));
            const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
            const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
            const seconds = String(totalSeconds % 60).padStart(2, '0');
            return `${hours}:${minutes}:${seconds}`;
        },

        randomInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
        randomChoice: (arr) => arr[Math.floor(Math.random() * arr.length)]
    };

    // ========================================================================
    // 3. УПРАВЛЕНИЕ ТЕРМИНАЛОМ (TERMINAL UI)
    // ========================================================================

    const TerminalUI = {
        clear: function() {
            const term = Utils.$('install-term');
            if (term) term.innerHTML = '';
            InstallState.stats.linesPrinted = 0;
        },

        colorize: function(line) {
            const escaped = Utils.escapeHtml(line);
            
            if (/^\$ |^# |^lfs:~\$ |^\(chroot\)/.test(line)) {
                return `<span style="color:${INSTALLER_CONFIG.COLORS.CMD}">${escaped}</span>`;
            }
            if (/error|failed|fatal|warning/i.test(line)) {
                return `<span style="color:${INSTALLER_CONFIG.COLORS.ERR}">${escaped}</span>`;
            }
            if (/OK|ok|PASS|Done|done|finished|success/i.test(line)) {
                return `<span style="color:${INSTALLER_CONFIG.COLORS.OK}">${escaped}</span>`;
            }
            return `<span style="color:${INSTALLER_CONFIG.COLORS.OUT}">${escaped}</span>`;
        },

        appendLine: function(text, isRaw = false) {
            const term = Utils.$('install-term');
            if (!term) return;

            const div = document.createElement('div');
            div.className = 'log-line';
            div.innerHTML = isRaw ? text : this.colorize(text);
            
            // Безопасное добавление (так как инпут теперь ВНЕ терминала)
            term.appendChild(div);
            
            // Автоскролл вниз
            term.scrollTop = term.scrollHeight;
            
            // Защита от переполнения DOM
            while (term.children.length > INSTALLER_CONFIG.MAX_DOM_LINES) {
                term.removeChild(term.firstChild);
            }
            
            InstallState.stats.linesPrinted++;
        },

        appendEmptyLine: function() {
            this.appendLine('', true);
        },

        updateStatusBar: function(phase, percent, eta) {
            const phaseEl = Utils.$('status-phase');
            const percentEl = Utils.$('status-percent');
            const etaEl = Utils.$('status-eta');

            if (phaseEl) phaseEl.textContent = phase;
            if (percentEl) percentEl.textContent = `${percent.toFixed(1)}%`;
            if (etaEl) etaEl.textContent = `ETA: ${eta}`;
        },

        updateProgressBar: function(percent) {
            const fill = Utils.$('install-progress');
            if (fill) fill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
        }
    };

    // ========================================================================
    // 4. ГЕНЕРАТОР ШУМА (NOISE GENERATOR)
    // ========================================================================

    const NoiseGenerator = {
        NOISE_DB: {
            compiling: ['  CC      kernel/sched/core.o', '  LD      vmlinux.o', '  CCLD    libc.so.6', 'checking whether gcc accepts -g... yes', 'make[1]: Nothing to be done for \'all\'.'],
            emerging: ['>>> Emerging (2 of 214) dev-libs/openssl', '>>> Unpacking source...', '>>> Compiling source ...', ' * Applying patch ...', 'make: Entering directory ...'],
            kernel: ['  CC      init/do_mounts.o', '  CC      arch/x86/kernel/head_64.o', '  LDS     arch/x86/kernel/vmlinux.lds', '  BZIMAGE arch/x86/boot/bzImage']
        },

        getNoise: function(phaseName) {
            const phase = (phaseName || '').toLowerCase();
            let pool = this.NOISE_DB.compiling;
            if (phase.includes('world') || phase.includes('system') || phase.includes('emerge')) pool = this.NOISE_DB.emerging;
            else if (phase.includes('kernel')) pool = this.NOISE_DB.kernel;
            return Utils.randomChoice(pool);
        },

        start: function() {
            this.stop();
            InstallState.timers.noise = setInterval(() => {
                if (!InstallState.isRunning || !InstallState.currentStep) return;
                if (Math.random() > 0.6) {
                    TerminalUI.appendLine(this.getNoise(InstallState.currentStep.phase));
                }
            }, INSTALLER_CONFIG.NOISE_TICK_RATE);
        },

        stop: function() {
            if (InstallState.timers.noise) {
                clearInterval(InstallState.timers.noise);
                InstallState.timers.noise = null;
            }
        }
    };

    // ========================================================================
    // 5. ПАРСЕР КОМАНД (COMMAND PARSER)
    // ========================================================================

    const CommandParser = {
        validate: function(input, expectedCmd) {
            if (!input || !expectedCmd) return false;
            const cleanInput = input.trim().toLowerCase();
            const cleanExpected = expectedCmd.toLowerCase();

            if (cleanInput === cleanExpected || cleanInput.includes(cleanExpected)) return true;

            const synonyms = COMMAND_SYNONYMS[cleanExpected] || [];
            for (const syn of synonyms) {
                if (cleanInput.includes(syn)) return true;
            }
            return false;
        },

        handleInput: function(event) {
            if (event.key !== 'Enter') return;

            const inputField = Utils.$('install-input');
            if (!inputField || inputField.disabled) return;

            const rawInput = inputField.value.trim();
            if (!rawInput) return;

            TerminalUI.appendLine(`root@livecd:~# ${rawInput}`, true);
            inputField.value = '';
            InstallState.stats.commandsTyped++;

            if (!InstallState.currentStep) return;

            const expected = InstallState.currentStep.cmd || '';
            const isValid = CommandParser.validate(rawInput, expected); // Жесткая привязка

            if (!isValid) {
                InstallState.stats.errorsMade++;
                TerminalUI.appendLine(`bash: ${rawInput.split(' ')[0]}: command not found`, true);
                if (InstallState.stats.errorsMade % 3 === 0) {
                    TerminalUI.appendLine(`[Подсказка: попробуй ввести "${expected}"]`, true);
                }
                return;
            }

            inputField.disabled = true;
            SimulationEngine.executeStep();
        }
    };

    // ========================================================================
    // 6. ДВИЖОК СИМУЛЯЦИИ (SIMULATION ENGINE)
    // ========================================================================

    const SimulationEngine = {
        executeStep: function() {
            const step = InstallState.currentStep;
            if (!step) return;

            TerminalUI.appendEmptyLine();
            TerminalUI.appendLine(`═══════════ [ ФАЗА: ${step.phase} ] ═══════════`);
            TerminalUI.appendLine(`Starting: ${step.phase}...`);

            const weight = step.weight || 1;
            // Расчет времени для конкретно этого шага
            const stepDuration = (weight / InstallState.totalWeight) * InstallState.sessionTotalTime;
            
            InstallState.phaseStartTime = Date.now();

            if (step.lines && step.lines.length > 0) {
                step.lines.forEach((line, index) => {
                    setTimeout(() => {
                        if (InstallState.isRunning) TerminalUI.appendLine(line);
                    }, (index + 1) * Utils.randomInt(80, 120)); 
                });
            }

            NoiseGenerator.start();
            this.startProgressTimer(stepDuration);
        },

        startProgressTimer: function(stepDuration) {
            if (InstallState.timers.progress) clearInterval(InstallState.timers.progress);

            InstallState.timers.progress = setInterval(() => {
                if (!InstallState.isRunning) return;

                const elapsed = Date.now() - InstallState.phaseStartTime;
                const stepProgress = Math.min(1, elapsed / stepDuration);
                // Считаем общий прогресс
                const totalProgress = (InstallState.currentPhaseIndex + stepProgress) / InstallState.totalSteps;

                TerminalUI.updateProgressBar(totalProgress * 100);
                
                const remainingMs = Math.max(0, stepDuration - elapsed);
                TerminalUI.updateStatusBar(
                    InstallState.currentStep.phase, 
                    totalProgress * 100, 
                    Utils.formatTime(remainingMs)
                );

                if (stepProgress >= 1) {
                    this.completeStep(stepDuration);
                }
            }, INSTALLER_CONFIG.PROGRESS_TICK_RATE);
        },

        completeStep: function(stepDuration) {
            clearInterval(InstallState.timers.progress);
            NoiseGenerator.stop();

            InstallState.accumulatedTime += stepDuration;
            InstallState.currentPhaseIndex++;

            const steps = InstallState.distro === 'gentoo' ? D.GENTOO_STEPS : D.LFS_STEPS;

            if (InstallState.currentPhaseIndex < steps.length) {
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
                this.finishInstallation();
            }
        },

        finishInstallation: function() {
            InstallState.isRunning = false;
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

            setTimeout(() => {
                if (window.DS_APP && window.DS_APP.goDesktop) {
                    window.DS_APP.goDesktop();
                }
            }, 3000);
        }
    };

    // ========================================================================
    // 7. ГЛАВНЫЙ КОНТРОЛЛЕР (MAIN CONTROLLER)
    // ========================================================================

    const InstallerController = {
        start: function(distro) {
            if (InstallState.isRunning) return;
            
            InstallState.isRunning = true;
            InstallState.distro = distro;
            InstallState.currentPhaseIndex = 0;
            InstallState.accumulatedTime = 0;
            InstallState.stats = { linesPrinted: 0, commandsTyped: 0, errorsMade: 0 };
            
            // Устанавливаем 10 минут для обоих
            InstallState.sessionTotalTime = INSTALLER_CONFIG.TOTAL_DURATION_MS;

            const steps = distro === 'gentoo' ? D.GENTOO_STEPS : D.LFS_STEPS;
            InstallState.currentStep = steps[0];
            InstallState.totalSteps = steps.length;
            InstallState.totalWeight = steps.reduce((acc, s) => acc + (s.weight || 1), 0);

            TerminalUI.clear();

            const inputField = Utils.$('install-input');
            if (inputField) {
                inputField.disabled = false;
                inputField.value = '';
                // Используем onkeydown, чтобы избежать дублирования событий
                inputField.onkeydown = CommandParser.handleInput;
            }
            
            const inputline = Utils.$('install-inputline');
            if (inputline) inputline.style.display = 'flex';
            
            setTimeout(() => { if (inputField) inputField.focus(); }, 100);

            const titleEl = Utils.$('install-title');
            if (titleEl) {
                titleEl.textContent = distro === 'gentoo' ? 'root@livecd: / # emerge' : 'lfs@livecd: / # make';
            }

            TerminalUI.appendLine('GNU Bash 5.2.15 (x86_64-pc-linux-gnu)', true);
            TerminalUI.appendLine(`Начинаем установку ${distro === 'gentoo' ? 'Gentoo' : 'Linux From Scratch'}...`);
            TerminalUI.appendLine(`Время процесса: ${Utils.formatTime(InstallState.sessionTotalTime)}`);
            TerminalUI.appendLine('Внимание: вам нужно вводить команды вручную.');
            TerminalUI.appendEmptyLine();
            TerminalUI.appendLine(`[Подсказка: введи "${InstallState.currentStep.cmd}"]`);

            this.startGlobalClock();
        },

        startGlobalClock: function() {
            if (InstallState.timers.clock) clearInterval(InstallState.timers.clock);

            InstallState.timers.clock = setInterval(() => {
                if (!InstallState.isRunning) return;

                // Считаем оставшееся время от ОБЩЕГО времени сессии
                const elapsed = InstallState.accumulatedTime + (Date.now() - InstallState.phaseStartTime);
                const remaining = Math.max(0, InstallState.sessionTotalTime - elapsed);
                
                const etaEl = Utils.$('status-eta');
                if (etaEl) etaEl.textContent = `ETA: ${Utils.formatTime(remaining)}`;
            }, 1000);
        },

        stop: function() {
            InstallState.isRunning = false;
            clearInterval(InstallState.timers.clock);
            clearInterval(InstallState.timers.progress);
            NoiseGenerator.stop();
            TerminalUI.appendLine('УСТАНОВКА ПРЕРВАНА.', true);
        }
    };

    // ========================================================================
    // 8. ЭКСПОРТ
    // ========================================================================

    window.DS_INSTALLER = {
        start: InstallerController.start.bind(InstallerController),
        stop: InstallerController.stop.bind(InstallerController)
    };

    LOG.info("INSTALLER", "installer.js module loaded successfully. Time set to 10 minutes.");

})();
