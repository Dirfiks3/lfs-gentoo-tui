/* ============================================================
   installer.js — ЯДРО СИСТЕМЫ УСТАНОВКИ LFS-GENTOO-TUI
   Строгая последовательность команд (1 в 1 как в Handbook).
   Совместим со старым форматом data.js через адаптер.
   ============================================================ */

"use strict";

(function () {
    // ========================================================================
    // 0. КОНСТАНТЫ И КОНФИГ
    // ========================================================================

    const D = window.DS_DATA || {};
    const LOG = (window.DS_APP && window.DS_APP.logger) ? window.DS_APP.logger : console;

    const CFG = {
        DEFAULT_CMD_DELAY: 350,      // мс между строкой вывода
        MAX_DOM_LINES: 800,          // защита от переполнения терминала
        NOISE_TICK_RATE: 900,        // как часто шумит "компиляция"
        COLORS: {
            CMD:  '#4af626',          // ввод команды
            OUT:  '#cccccc',          // обычный вывод
            OK:   '#4af626',          // успех
            ERR:  '#ff5f56',          // ошибка
            INFO: '#58a6ff'           // подсказка
        }
    };

    // ========================================================================
    // 1. СОСТОЯНИЕ
    // ========================================================================

    const State = {
        distro: 'lfs',
        steps: [],
        stepIndex: 0,
        commandIndex: 0,
        isRunning: false,
        isWaiting: false,           // true во время вывода команды
        phaseStart: 0,
        timers: { clock: null },
        stats: { commandsTyped: 0, errorsMade: 0 }
    };

    // ========================================================================
    // 2. УТИЛИТЫ
    // ========================================================================

    const Utils = {
        $: (id) => document.getElementById(id),

        // Никакого innerHTML для пользовательских данных. Только textContent.
        esc: (s) => String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;'),

        sleep: (ms) => new Promise(r => setTimeout(r, ms)),
        pick: (arr) => arr[Math.floor(Math.random() * arr.length)],

        formatTime: (ms) => {
            const s = Math.max(0, Math.floor(ms / 1000));
            return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
                .map(n => String(n).padStart(2, '0')).join(':');
        }
    };

    // ========================================================================
    // 3. ТЕРМИНАЛ (безопасный)
    // ========================================================================

    const Term = {
        clear() {
            const t = Utils.$('install-term');
            if (t) t.innerHTML = '';
        },

        line(text, mode) {
            const t = Utils.$('install-term');
            if (!t) return;

            const div = document.createElement('div');
            const colorKey = (mode || 'out').toUpperCase();
            div.className = 'log-line log-' + (mode || 'out');
            div.style.color = CFG.COLORS[colorKey] || CFG.COLORS.OUT;
            // textContent — XSS невозможен
            div.textContent = (text === '' || text == null) ? '\u00a0' : String(text);

            t.appendChild(div);
            t.scrollTop = t.scrollHeight;
            while (t.children.length > CFG.MAX_DOM_LINES) t.removeChild(t.firstChild);
        },

        blank() { this.line('\u00a0', 'out'); },

        async stream(lines, delay) {
            for (const ln of lines) {
                if (!State.isRunning) return;
                Term.line(ln, 'out');
                await Utils.sleep(delay || CFG.DEFAULT_CMD_DELAY);
            }
        },

        status(phase, percent, eta) {
            const p  = Utils.$('status-phase');
            const pc = Utils.$('status-percent');
            const e  = Utils.$('status-eta');
            if (p)  p.textContent  = phase;
            if (pc) pc.textContent = percent.toFixed(1) + '%';
            if (e)  e.textContent  = 'ETA: ' + eta;
        },

        progress(percent) {
            const f = Utils.$('install-progress');
            if (f) f.style.width = Math.min(100, Math.max(0, percent)) + '%';
        }
    };

    // ========================================================================
    // 4. ШУМ КОМПИЛЯЦИИ (строго по фазе, не рандом)
    // ========================================================================

    const Noise = {
        timer: null,
        pools: {
            partition: [
                '[1234.567] sd 0:0:0:0: [sda] Attached SCSI disk',
                'Partition table created.'
            ],
            extract: [
                'Extracting archive...',
                'Files written: 41208',
                'Hard links: 0'
            ],
            config: [
                'Syncing repository...',
                '>>> Sync finished'
            ],
            compile: [
                '  CC      kernel/sched/core.o',
                '  LD      vmlinux.o',
                '  CCLD    libc.so.6',
                '  AR      libstdc++.a'
            ],
            emerge: [
                '>>> Emerging (2 of 214) dev-libs/openssl-3.0.9',
                '>>> Unpacking source...',
                '>>> Compiling source...',
                ' * Applying patch...'
            ],
            install: [
                '>>> Installing (2 of 214) dev-libs/openssl-3.0.9',
                'strip: x86_64-pc-linux-gnu-strip --strip-unneeded'
            ],
            boot: [
                'Installing GRUB to /dev/sda...',
                'Generating grub.cfg...'
            ]
        },

        pickKey(phaseName) {
            const n = (phaseName || '').toUpperCase();
            if (/PARTITION|DISK|FSTAB/.test(n))         return 'partition';
            if (/STAGE|EXTRACT|DOWNLOAD/.test(n))       return 'extract';
            if (/SYNC|PORTAGE|CONFIG|PROFILE/.test(n))  return 'config';
            if (/KERNEL|GCC|BINUTILS|CORE/.test(n))     return 'compile';
            if (/WORLD|SYSTEM|EMERGE/.test(n))          return 'emerge';
            if (/GRUB|BOOT|REBOOT|FINAL/.test(n))       return 'boot';
            return null;
        },

        start(phaseName) {
            this.stop();
            const key = this.pickKey(phaseName);
            if (!key) return;
            const pool = this.pools[key];
            this.timer = setInterval(() => {
                if (!State.isRunning || !State.isWaiting) return;
                if (Math.random() > 0.5) Term.line(Utils.pick(pool), 'out');
            }, CFG.NOISE_TICK_RATE);
        },

        stop() {
            if (this.timer) { clearInterval(this.timer); this.timer = null; }
        }
    };

    // ========================================================================
    // 5. ПАРСЕР (СТРОГИЙ)
    // ========================================================================

    const Parser = {
        normalize: (s) => String(s || '').trim().replace(/\s+/g, ' '),

        // Точное совпадение. Единственное исключение — префикс sudo.
        match(input, expected) {
            const a = this.normalize(input);
            const b = this.normalize(expected);
            if (a === b) return true;
            if (a === 'sudo ' + b) return true;
            if (b === 'sudo ' + a) return true;
            return false;
        },

        async onKey(e) {
            if (e.key !== 'Enter') return;
            if (!State.isRunning || State.isWaiting) return;

            const input = Utils.$('install-input');
            if (!input || input.disabled) return;

            const raw = input.value.trim();
            if (!raw) return;

            const step = State.steps[State.stepIndex];
            if (!step || !step.commands || !step.commands[State.commandIndex]) return;

            const expected = step.commands[State.commandIndex];

            Term.line('root@livecd:~# ' + raw, 'cmd');
            input.value = '';
            State.stats.commandsTyped++;

            if (!Parser.match(raw, expected.cmd)) {
                State.stats.errorsMade++;
                Term.line('bash: ' + raw.split(' ')[0] + ': command not found', 'err');
                if (State.stats.errorsMade % 3 === 0) {
                    Term.line('[Подсказка: попробуй "' + expected.cmd + '"]', 'info');
                }
                return;
            }

            // Команда верна
            State.commandIndex++;
            input.disabled = true;
            State.isWaiting = true;

            // Прогресс обновляем сразу при вводе
            const pctStep = State.commandIndex / step.commands.length;
            const overall = ((State.stepIndex + pctStep) / State.steps.length) * 100;
            Term.progress(overall);
            Term.status(step.phase, overall, Utils.formatTime(
                (step.weight || 1) * 60000 * (1 - pctStep)
            ));

            Noise.start(step.phase);

            if (expected.out && expected.out.length) {
                await Term.stream(expected.out, expected.delay || CFG.DEFAULT_CMD_DELAY);
            } else {
                await Utils.sleep(300);
            }

            if (!State.isRunning) return;
            Noise.stop();
            State.isWaiting = false;

            if (State.commandIndex >= step.commands.length) {
                await Engine.completeStep();
            } else {
                input.disabled = false;
                input.focus();
                Term.line('[Подсказка: следующая команда "' + step.commands[State.commandIndex].cmd + '"]', 'info');
            }
        }
    };

    // ========================================================================
    // 6. ДВИЖОК
    // ========================================================================

    const Engine = {
        startStep() {
            if (!State.isRunning) return;
            const step = State.steps[State.stepIndex];
            if (!step || !step.commands || !step.commands.length) {
                LOG.error && LOG.error('INSTALLER', 'Пустой шаг: ' + State.stepIndex);
                this.finish();
                return;
            }

            State.commandIndex = 0;
            State.phaseStart = Date.now();

            Term.blank();
            Term.line('═══════════ [ ФАЗА: ' + step.phase + ' ] ═══════════', 'info');
            Term.line('[Подсказка: введи "' + step.commands[0].cmd + '"]', 'info');

            const input = Utils.$('install-input');
            if (input) { input.disabled = false; input.focus(); }
        },

        async completeStep() {
            if (!State.isRunning) return;

            const step = State.steps[State.stepIndex];
            Term.line('[ OK ] Фаза "' + step.phase + '" завершена.', 'ok');

            State.stepIndex++;

            if (State.stepIndex >= State.steps.length) {
                return this.finish();
            }

            await Utils.sleep(400);
            if (!State.isRunning) return;
            this.startStep();
        },

        finish() {
            State.isRunning = false;
            State.isWaiting = false;
            Noise.stop();
            if (State.timers.clock) { clearInterval(State.timers.clock); State.timers.clock = null; }

            Term.progress(100);
            Term.status('DONE', 100, '00:00:00');

            Term.blank();
            Term.line('════════════════════════════════════', 'ok');
            Term.line(State.distro === 'gentoo'
                ? 'Gentoo Linux успешно установлен.'
                : 'LFS успешно собран. Ты построил ядро сам.', 'ok');
            Term.line('════════════════════════════════════', 'ok');
            Term.line('Команд введено: ' + State.stats.commandsTyped +
                      ' | Ошибок: ' + State.stats.errorsMade, 'info');
            Term.line('Загрузка рабочего окружения...', 'info');

            const il = Utils.$('install-inputline');
            if (il) il.style.display = 'none';
            const inp = Utils.$('install-input');
            if (inp) inp.disabled = true;

            setTimeout(() => {
                if (window.DS_APP && window.DS_APP.goDesktop) {
                    window.DS_APP.goDesktop();
                }
            }, 2500);
        },

        startClock() {
            if (State.timers.clock) clearInterval(State.timers.clock);
            State.timers.clock = setInterval(() => {
                if (!State.isRunning) return;
                const step = State.steps[State.stepIndex];
                if (!step || !step.commands) return;
                const pctStep = State.commandIndex / step.commands.length;
                const overall = ((State.stepIndex + pctStep) / State.steps.length) * 100;
                Term.status(step.phase, overall, Utils.formatTime(
                    (step.weight || 1) * 60000 * (1 - pctStep)
                ));
            }, 1000);
        }
    };

    // ========================================================================
    // 7. АДАПТЕР СТАРОГО ФОРМАТА DATA.JS
    // Старый: { phase, weight, cmd, lines }
    // Новый:  { phase, weight, commands: [{cmd, out, delay}] }
    // ========================================================================

    function normalizeSteps(rawSteps) {
        return (rawSteps || []).map(s => {
            if (Array.isArray(s.commands)) return s;
            return {
                phase: s.phase || 'UNKNOWN',
                weight: s.weight || 1,
                commands: [{
                    cmd: s.cmd || 'make',
                    out: Array.isArray(s.lines) ? s.lines : [],
                    delay: 120
                }]
            };
        });
    }

    // ========================================================================
    // 8. КОНТРОЛЛЕР
    // ========================================================================

    const Controller = {
        start(distro) {
            if (State.isRunning) return;

            const raw = distro === 'gentoo' ? D.GENTOO_STEPS : D.LFS_STEPS;
            if (!raw || !raw.length) {
                LOG.error && LOG.error('INSTALLER', 'Не найдены шаги для: ' + distro);
                Term.line('Ошибка: данные установки не найдены.', 'err');
                return;
            }

            State.steps = normalizeSteps(raw);
            State.distro = distro;
            State.stepIndex = 0;
            State.commandIndex = 0;
            State.isRunning = true;
            State.isWaiting = false;
            State.stats = { commandsTyped: 0, errorsMade: 0 };

            Term.clear();
            Term.progress(0);
            Term.status('START', 0, '--:--:--');

            Term.line('GNU Bash 5.2.15 (x86_64-pc-linux-gnu)', 'out');
            Term.line('Начинаем установку ' + (distro === 'gentoo' ? 'Gentoo Linux' : 'Linux From Scratch') + '...', 'out');
            Term.line('Вводи команды вручную. Опечатки не прощаются.', 'info');

            const input = Utils.$('install-input');
            if (input) {
                input.value = '';
                input.disabled = true;          // откроется в startStep
                input.onkeydown = (e) => Parser.onKey(e);
            }

            const il = Utils.$('install-inputline');
            if (il) il.style.display = 'flex';

            const title = Utils.$('install-title');
            if (title) title.textContent = distro === 'gentoo' ? 'root@livecd' : 'lfs@livecd';

            Engine.startClock();
            setTimeout(() => Engine.startStep(), 300);
        },

        stop() {
            State.isRunning = false;
            State.isWaiting = false;
            Noise.stop();
            if (State.timers.clock) { clearInterval(State.timers.clock); State.timers.clock = null; }
            Term.line('УСТАНОВКА ПРЕРВАНА.', 'err');
        }
    };

    // ========================================================================
    // 9. ЭКСПОРТ
    // ========================================================================

    window.DS_INSTALLER = {
        start: Controller.start.bind(Controller),
        stop: Controller.stop.bind(Controller)
    };

    if (LOG && typeof LOG.info === 'function') {
        LOG.info('INSTALLER', 'installer.js loaded (strict command mode).');
    } else {
        console.log('[INSTALLER] loaded (strict command mode).');
    }

})();
