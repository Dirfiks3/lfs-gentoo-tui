/* ============================================================
   desktop.js — ОКОННЫЙ МЕНЕДЖЕР И СРЕДА РАБОЧЕГО СТОЛА
   Проект: lfs-gentoo-tui
   Файл: desktop.js
   Строк: ~1500
   Включает: Выбор DE, управление окнами, терминал, файлы, 
   системный монитор, гибкие настройки под каждое DE.
   ============================================================ */

"use strict";

(function () {
    // ========================================================================
    // 0. БАЗОВЫЕ ЗАВИСИМОСТИ И ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
    // ========================================================================
    
    const D = window.DS_DATA;
    const LOG = window.DS_APP ? window.DS_APP.logger : console;
    
    let distro = "lfs";
    let currentDEKey = "i3";
    let bootTime = Date.now();
    let winSeq = 100;
    let zIndexCounter = 10;

    // Хранилище открытых окон
    const openWindows = {}; 

    // Утилиты для работы с DOM
    const $ = (id) => document.getElementById(id);
    const qs = (sel) => document.querySelector(sel);
    const qsa = (sel) => document.querySelectorAll(sel);
    
    function esc(s) {
        if (typeof s !== 'string') return '';
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // ========================================================================
    // 1. КОНФИГУРАЦИИ СРЕД РАБОЧЕГО СТОЛА (DESKTOP ENVIRONMENTS)
    // ========================================================================
    
    const DESKTOP_ENVIRONMENTS = {
        i3: {
            id: "i3",
            name: "i3wm (Custom)",
            desc: "Тайловый менеджер. Только клавиатура, только хардкор, черный фон.",
            theme: "theme-i3",
            wallpaper: "#000000",
            accent: "#4af626", // Зеленый
            font: "'Fira Code', monospace",
            terminalName: "xterm",
            fileManagerName: "ranger",
            windowStyle: { radius: "0px", border: "1px solid #333", shadow: "none" },
            settingsLayout: "text" // Настройки в виде текста
        },
        kde: {
            id: "kde",
            name: "KDE Plasma",
            desc: "Максимальная гибкость. Много анимаций, красивые виджеты.",
            theme: "theme-kde",
            wallpaper: "linear-gradient(135deg, #1a0b2e 0%, #0d0d0d 100%)",
            accent: "#3daee9", // Голубой
            font: "'Segoe UI', system-ui, sans-serif",
            terminalName: "Konsole",
            fileManagerName: "Dolphin",
            windowStyle: { radius: "8px", border: "1px solid #555", shadow: "0 10px 30px rgba(0,0,0,0.8)" },
            settingsLayout: "gui" // Настройки в виде GUI со слайдерами
        },
        gnome: {
            id: "gnome",
            name: "GNOME",
            desc: "Минимализм, плавность и удобство для повседневной работы.",
            theme: "theme-gnome",
            wallpaper: "linear-gradient(135deg, #2b2b2b 0%, #111111 100%)",
            accent: "#e95420", // Оранжевый Ubuntu
            font: "'Ubuntu', system-ui, sans-serif",
            terminalName: "GNOME Terminal",
            fileManagerName: "Nautilus",
            windowStyle: { radius: "12px", border: "none", shadow: "0 5px 15px rgba(0,0,0,0.5)" },
            settingsLayout: "mobile" // Настройки как в телефоне
        },
        xfce: {
            id: "xfce",
            name: "XFCE",
            desc: "Классика. Быстро, стабильно, без лишних наворотов.",
            theme: "theme-xfce",
            wallpaper: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
            accent: "#2ecc71", // Зеленый
            font: "'Arial', sans-serif",
            terminalName: "Xfce Terminal",
            fileManagerName: "Thunar",
            windowStyle: { radius: "4px", border: "1px solid #444", shadow: "0 2px 10px rgba(0,0,0,0.5)" },
            settingsLayout: "compact" // Компактные настройки
        }
    };

    // Текущие настройки системы (сохраняются при смене DE)
    const SYSTEM_SETTINGS = {
        userName: "lfs-user",
        hostName: "lfs-gentoo-tui",
        fontScale: 100, // Проценты
        animations: true,
        transparency: false,
        nightLight: false,
        autoHidePanel: false,
        i3Gaps: 10,
        i3Border: 2,
        backgroundUrl: "",
        volume: 75,
        networkEnabled: true
    };

    // ========================================================================
    // 2. МЕНЕДЖЕР ОКОН (WINDOW MANAGER)
    // ========================================================================
    
    const WM = {
        // Создание нового окна
        createWindow: function(options) {
            const { title, icon, width = '600px', height = '400px', x, y, contentHtml, onClose } = options;
            
            const id = 'win-' + (++winSeq);
            
            const node = document.createElement('div');
            node.className = 'app-window';
            node.dataset.winId = id;
            node.style.width = width;
            node.style.height = height;
            node.style.left = x ? `${x}px` : `${80 + (winSeq % 5) * 30}px`;
            node.style.top = y ? `${y}px` : `${60 + (winSeq % 5) * 30}px`;
            node.style.zIndex = ++zIndexCounter;
            
            // Применяем стиль окна в зависимости от DE
            const de = DESKTOP_ENVIRONMENTS[currentDEKey];
            node.style.borderRadius = de.windowStyle.radius;
            node.style.border = de.windowStyle.border;
            node.style.boxShadow = de.windowStyle.shadow;

            // Шапка окна
            const titleBar = document.createElement('div');
            titleBar.className = 'win-titlebar';
            titleBar.innerHTML = `
                <div class="win-title-left">
                    <span class="win-icon">${icon || '>_'}</span>
                    <span class="win-title">${esc(title)}</span>
                </div>
                <div class="win-controls">
                    <button class="win-btn win-min">_</button>
                    <button class="win-btn win-max">□</button>
                    <button class="win-btn win-close">X</button>
                </div>
            `;
            
            // Тело окна
            const body = document.createElement('div');
            body.className = 'win-body';
            if (contentHtml) body.innerHTML = contentHtml;
            
            node.appendChild(titleBar);
            node.appendChild(body);
            $('windows-container').appendChild(node);

            // Кнопка на панели задач
            const taskBtn = document.createElement('button');
            taskBtn.className = 'tb-win';
            taskBtn.textContent = title;
            taskBtn.onclick = () => this.toggleWindow(id);
            $('taskbar-windows').appendChild(taskBtn);

            // Состояние
            openWindows[id] = {
                el: node,
                taskEl: taskBtn,
                isMaximized: false,
                isMinimized: false,
                prevRect: {},
                onClose: onClose
            };

            // События
            node.addEventListener('mousedown', () => this.focusWindow(id));
            
            titleBar.querySelector('.win-close').onclick = (e) => { e.stopPropagation(); this.closeWindow(id); };
            titleBar.querySelector('.win-min').onclick = (e) => { e.stopPropagation(); this.minimizeWindow(id); };
            titleBar.querySelector('.win-max').onclick = (e) => { e.stopPropagation(); this.maximizeWindow(id); };

            // Перетаскивание и Snap to Edges
            this.makeDraggable(node, titleBar, id);

            this.focusWindow(id);
            LOG.info("WM", `Window created: ${id} (${title})`);
            return node;
        },

        focusWindow: function(id) {
            Object.keys(openWindows).forEach(wId => {
                openWindows[wId].el.classList.remove('focused');
            });
            
            const w = openWindows[id];
            if (w) {
                w.el.classList.add('focused');
                w.el.style.zIndex = ++zIndexCounter;
                if (w.isMinimized) {
                    w.el.style.display = 'flex';
                    w.isMinimized = false;
                }
            }
            this.updateTaskbar();
        },

        closeWindow: function(id) {
            const w = openWindows[id];
            if (!w) return;
            
            if (typeof w.onClose === 'function') w.onClose();
            
            // Анимация закрытия
            w.el.style.opacity = '0';
            w.el.style.transform = 'scale(0.95)';
            w.el.style.transition = 'all 0.2s ease';
            
            setTimeout(() => {
                w.el.remove();
                w.taskEl.remove();
                delete openWindows[id];
                
                // Фокус на другое окно
                const remaining = Object.keys(openWindows);
                if (remaining.length > 0) {
                    remaining.sort((a, b) => openWindows[b].el.style.zIndex - openWindows[a].el.style.zIndex);
                    this.focusWindow(remaining[0]);
                } else {
                    this.updateTaskbar();
                }
            }, 200);
            LOG.info("WM", `Window closed: ${id}`);
        },

        minimizeWindow: function(id) {
            const w = openWindows[id];
            if (!w) return;
            w.el.style.display = 'none';
            w.isMinimized = true;
            this.updateTaskbar();
        },

        maximizeWindow: function(id) {
            const w = openWindows[id];
            if (!w) return;

            if (w.isMaximized) {
                // Восстановление
                w.el.style.left = w.prevRect.left;
                w.el.style.top = w.prevRect.top;
                w.el.style.width = w.prevRect.width;
                w.el.style.height = w.prevRect.height;
                w.isMaximized = false;
            } else {
                // Сохранение позиции
                w.prevRect = {
                    left: w.el.style.left,
                    top: w.el.style.top,
                    width: w.el.style.width,
                    height: w.el.style.height
                };
                // Разворот
                w.el.style.left = '0';
                w.el.style.top = '0';
                w.el.style.width = '100vw';
                w.el.style.height = 'calc(100vh - 44px)';
                w.isMaximized = true;
            }
            this.focusWindow(id);
        },

        toggleWindow: function(id) {
            const w = openWindows[id];
            if (!w) return;

            if (w.el.classList.contains('focused') && !w.isMinimized) {
                this.minimizeWindow(id);
            } else {
                w.el.style.display = 'flex';
                w.isMinimized = false;
                this.focusWindow(id);
            }
        },

        updateTaskbar: function() {
            Object.keys(openWindows).forEach(id => {
                const w = openWindows[id];
                const isFocused = w.el.classList.contains('focused') && !w.isMinimized;
                w.taskEl.classList.toggle('active', isFocused);
            });
        },

        makeDraggable: function(el, handle, id) {
            let isDragging = false;
            let startX, startY, startLeft, startTop;

            handle.addEventListener('mousedown', (e) => {
                if (e.target.closest('.win-btn')) return;
                const w = openWindows[id];
                if (w && w.isMaximized) return;

                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                startLeft = el.offsetLeft;
                startTop = el.offsetTop;
                
                // Поднимаем окно наверх при начале перетаскивания
                WM.focusWindow(id);
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                
                el.style.left = `${startLeft + dx}px`;
                el.style.top = `${Math.max(0, startTop + dy)}px`;
            });

            document.addEventListener('mouseup', (e) => {
                if (!isDragging) return;
                isDragging = false;
                
                // Snap to Edges (прилипание)
                const snapThreshold = 20;
                if (e.clientY <= snapThreshold) {
                    // Прилипание к верху = Максимизация
                    WM.maximizeWindow(id);
                } else if (e.clientX <= snapThreshold) {
                    // Прилипание влево = Левая половина
                    el.style.left = '0';
                    el.style.top = '0';
                    el.style.width = '50vw';
                    el.style.height = 'calc(100vh - 44px)';
                } else if (e.clientX >= window.innerWidth - snapThreshold) {
                    // Прилипание вправо = Правая половина
                    el.style.left = '50vw';
                    el.style.top = '0';
                    el.style.width = '50vw';
                    el.style.height = 'calc(100vh - 44px)';
                }
            });
        }
    };

    // ========================================================================
    // 3. ПРИЛОЖЕНИЯ (APPS)
    // ========================================================================

    const Apps = {
        // ---------------------------------------------------------
        // ТЕРМИНАЛ
        // ---------------------------------------------------------
        openTerminal: function() {
            const de = DESKTOP_ENVIRONMENTS[currentDEKey];
            
            const html = `
                <div class="term-app">
                    <div class="term-out"></div>
                    <div class="term-inputline">
                        <span class="prompt"></span>
                        <input class="term-in" spellcheck="false" autocomplete="off" />
                    </div>
                </div>
            `;

            const node = WM.createWindow({
                title: de.terminalName,
                icon: '>_',
                width: '750px',
                height: '480px',
                contentHtml: html
            });

            const out = node.querySelector('.term-out');
            const input = node.querySelector('.term-in');
            const prompt = node.querySelector('.prompt');
            
            const userName = distro === 'gentoo' ? 'root' : 'lfs';
            prompt.textContent = `${userName}@${SYSTEM_SETTINGS.hostName}:~$`;
            prompt.style.color = de.accent;

            const history = [];
            let historyIndex = -1;

            this.printToTerminal(out, `GNU bash, version 5.2.15 (lfs-gentoo-tui)`);
            this.printToTerminal(out, `Type <b>help</b> to see available commands.`);
            this.printToTerminal(out, `Desktop Environment: ${de.name}`);

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const cmd = input.value.trim();
                    this.printToTerminal(out, `<span style="color:${de.accent}">${esc(prompt.textContent)}</span> ${esc(cmd)}`);
                    
                    if (cmd) {
                        history.push(cmd);
                        historyIndex = history.length;
                    }
                    input.value = '';
                    this.executeCommand(cmd, out, node);
                    
                } else if (e.key === 'ArrowUp') {
                    if (historyIndex > 0) {
                        historyIndex--;
                        input.value = history[historyIndex];
                    }
                    e.preventDefault();
                } else if (e.key === 'ArrowDown') {
                    if (historyIndex < history.length - 1) {
                        historyIndex++;
                        input.value = history[historyIndex];
                    } else {
                        historyIndex = history.length;
                        input.value = '';
                    }
                    e.preventDefault();
                }
            });

            setTimeout(() => input.focus(), 100);
            node.querySelector('.win-body').addEventListener('click', () => input.focus());
        },

        printToTerminal: function(out, html) {
            const div = document.createElement('div');
            div.className = 't-line';
            div.innerHTML = html || '&nbsp;';
            out.appendChild(div);
            out.scrollTop = out.scrollHeight;
        },

        executeCommand: async function(rawCmd, out, windowNode) {
            const args = rawCmd.split(/\s+/);
            const cmd = args[0].toLowerCase();
            const arg = args[1];
            const de = DESKTOP_ENVIRONMENTS[currentDEKey];

            switch (cmd) {
                case '':
                    break;
                case 'help':
                    this.printToTerminal(out, 'Доступные команды:');
                    this.printToTerminal(out, '  <b>fastfetch</b> - Информация о системе');
                    this.printToTerminal(out, '  <b>ls</b> - Список файлов в домашней директории');
                    this.printToTerminal(out, '  <b>cat &lt;file&gt;</b> - Прочитать файл');
                    this.printToTerminal(out, '  <b>htop</b> - Открыть монитор системы');
                    this.printToTerminal(out, '  <b>uname -a</b> - Информация о ядре');
                    this.printToTerminal(out, '  <b>clear</b> - Очистить терминал');
                    this.printToTerminal(out, '  <b>exit</b> - Закрыть терминал');
                    break;

                case 'ls':
                    const files = Object.keys(D.VFS.home);
                    this.printToTerminal(out, files.map(f => `<span style="color:${de.accent}">${f}</span>`).join('   '));
                    break;

                case 'cat':
                    if (!arg) {
                        this.printToTerminal(out, 'usage: cat &lt;filename&gt;');
                    } else if (D.VFS.home[arg]) {
                        D.VFS.home[arg].split('\n').forEach(line => this.printToTerminal(out, esc(line)));
                    } else {
                        this.printToTerminal(out, `cat: ${esc(arg)}: No such file or directory`);
                    }
                    break;

                case 'htop':
                    this.printToTerminal(out, 'Starting System Monitor...');
                    Apps.openSystemMonitor();
                    break;

                case 'pwd':
                    this.printToTerminal(out, `/home/${distro === 'gentoo' ? 'root' : 'lfs'}`);
                    break;

                case 'uname':
                    if (arg === '-a') {
                        this.printToTerminal(out, `Linux ${SYSTEM_SETTINGS.hostName} 6.6.30-tui #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux`);
                    } else {
                        this.printToTerminal(out, 'Linux');
                    }
                    break;

                case 'clear':
                    out.innerHTML = '';
                    break;

                case 'exit':
                    WM.closeWindow(windowNode.dataset.winId);
                    break;

                case 'fastfetch':
                    this.runFastfetch(out, de);
                    break;

                default:
                    this.printToTerminal(out, `bash: ${esc(cmd)}: command not found`);
            }
        },

        runFastfetch: function(out, de) {
            const data = D.getFetchData(distro);
            const logo = distro === 'gentoo' ? D.ASCII.gentooLogo : D.ASCII.lfsLogo;
            
            const infoLines = [
                `${SYSTEM_SETTINGS.userName}@${SYSTEM_SETTINGS.hostName}`,
                `-------------------`,
                `OS: ${data.os}`,
                `Host: ${data.host}`,
                `Kernel: ${data.kernel}`,
                `Uptime: ${Math.floor((Date.now() - bootTime) / 60000)} mins`,
                `Packages: ${data.packages}`,
                `Shell: ${data.shell}`,
                `Resolution: ${data.resolution}`,
                `DE: ${de.name}`,
                `WM: ${de.name}`,
                `Terminal: ${de.terminalName}`,
                `CPU: ${data.cpu}`,
                `GPU: ${data.gpu}`,
                `Memory: ${data.memory}`
            ];

            let html = '<pre class="ff-pre" style="line-height: 1.2; font-family: monospace;">\n';
            const maxLines = Math.max(logo.length, infoLines.length);
            
            for (let i = 0; i < maxLines; i++) {
                const logoPart = (logo[i] || '').padEnd(30);
                const infoPart = infoLines[i] || '';
                
                // Красим логотип в цвет акцента DE
                html += `<span style="color:${de.accent}; font-weight:bold;">${esc(logoPart)}</span><span style="color:#ddd">${esc(infoPart)}</span>\n`;
            }
            html += '</pre>';
            
            this.printToTerminal(out, html);
        },

        // ---------------------------------------------------------
        // ФАЙЛОВЫЙ МЕНЕДЖЕР
        // ---------------------------------------------------------
        openFiles: function() {
            const de = DESKTOP_ENVIRONMENTS[currentDEKey];
            
            const html = `
                <div class="files-app">
                    <div class="files-toolbar">
                        <button class="toolbar-btn">←</button>
                        <button class="toolbar-btn">→</button>
                        <button class="toolbar-btn">↑</button>
                        <input type="text" class="files-path" value="/home/user/" readonly>
                    </div>
                    <div class="files-grid"></div>
                </div>
            `;

            const node = WM.createWindow({
                title: de.fileManagerName,
                icon: '[DIR]',
                width: '650px',
                height: '450px',
                contentHtml: html
            });

            const grid = node.querySelector('.files-grid');
            const files = Object.keys(D.VFS.home);
            
            grid.innerHTML = '';
            files.forEach(fileName => {
                const item = document.createElement('div');
                item.className = 'file-item';
                item.innerHTML = `
                    <div class="file-icon" style="color:${de.accent}">[TXT]</div>
                    <div class="file-name">${fileName}</div>
                `;
                item.onclick = () => {
                    Apps.openTextEditor(fileName, D.VFS.home[fileName]);
                };
                grid.appendChild(item);
            });
        },

        // ---------------------------------------------------------
        // ТЕКСТОВЫЙ РЕДАКТОР
        // ---------------------------------------------------------
        openTextEditor: function(title, content) {
            const html = `
                <div class="editor-app">
                    <div class="editor-toolbar">
                        <button class="btn-save">Сохранить</button>
                        <span class="editor-status">Изменено</span>
                    </div>
                    <textarea class="editor-area" spellcheck="false">${esc(content)}</textarea>
                </div>
            `;

            const node = WM.createWindow({
                title: title,
                icon: '[TXT]',
                width: '600px',
                height: '450px',
                contentHtml: html
            });

            const textarea = node.querySelector('.editor-area');
            const status = node.querySelector('.editor-status');
            const saveBtn = node.querySelector('.btn-save');

            textarea.addEventListener('input', () => {
                status.textContent = "Не сохранено";
                status.style.color = "#ff5f56";
            });

            saveBtn.onclick = () => {
                // Имитация сохранения
                status.textContent = "Сохранено";
                status.style.color = "#4af626";
                D.VFS.home[title] = textarea.value; // Обновляем нашу базу данных
                setTimeout(() => { status.textContent = ""; }, 2000);
            };
        },

        // ---------------------------------------------------------
        // МОНИТОР СИСТЕМЫ (HTOP)
        // ---------------------------------------------------------
        openSystemMonitor: function() {
            const de = DESKTOP_ENVIRONMENTS[currentDEKey];
            
            const html = `
                <div class="sysmon-app" style="background:#000; color:#fff; font-family:monospace; height:100%; display:flex; flex-direction:column;">
                    <div class="sysmon-header" style="padding:10px; border-bottom:1px solid #333; display:flex; justify-content:space-between;">
                        <span style="color:${de.accent}">System Monitor</span>
                        <span id="sysmon-time">00:00:00</span>
                    </div>
                    <div class="sysmon-cpu" style="padding:10px; border-bottom:1px solid #333;">
                        <div>CPU: [<span id="cpu-bar" style="color:${de.accent}">||||||||||</span>] <span id="cpu-pct">0%</span></div>
                        <div>MEM: [<span id="mem-bar" style="color:${de.accent}">||||||||||</span>] <span id="mem-pct">0%</span></div>
                    </div>
                    <div class="sysmon-procs" style="flex:1; overflow-y:auto; padding:10px;">
                        <table style="width:100%; text-align:left; border-collapse:collapse;">
                            <thead>
                                <tr style="border-bottom:1px solid #444;">
                                    <th>PID</th><th>USER</th><th>CPU%</th><th>MEM%</th><th>COMMAND</th>
                                </tr>
                            </thead>
                            <tbody id="proc-list"></tbody>
                        </table>
                    </div>
                </div>
            `;

            const node = WM.createWindow({
                title: "htop",
                icon: '[SYS]',
                width: '700px',
                height: '500px',
                contentHtml: html,
                onClose: () => { clearInterval(sysmonInterval); }
            });

            const procList = node.querySelector('#proc-list');
            const cpuBar = node.querySelector('#cpu-bar');
            const cpuPct = node.querySelector('#cpu-pct');
            const memBar = node.querySelector('#mem-bar');
            const memPct = node.querySelector('#mem-pct');
            const timeDisplay = node.querySelector('#sysmon-time');

            // Имитация процессов
            const generateProc = (pid, name) => {
                return {
                    pid, name,
                    user: Math.random() > 0.8 ? 'root' : (distro === 'gentoo' ? 'portage' : 'lfs'),
                    cpu: (Math.random() * (name === 'emerge' || name === 'gcc' ? 90 : 5)).toFixed(1),
                    mem: (Math.random() * 5).toFixed(1)
                };
            };

            const procs = [
                { pid: 1, name: 'init', user: 'root' },
                { pid: 2, name: 'kthreadd', user: 'root' },
                { pid: 404, name: 'dbus-daemon', user: 'messagebus' },
                { pid: 1337, name: 'bash', user: distro === 'gentoo' ? 'root' : 'lfs' },
                { pid: 2048, name: 'emerge', user: 'root' },
                { pid: 2049, name: 'gcc', user: 'portage' },
                { pid: 3000, name: 'Xorg', user: 'root' },
                { pid: 3001, name: de.name, user: distro === 'gentoo' ? 'root' : 'lfs' }
            ];

            let tick = 0;
            const sysmonInterval = setInterval(() => {
                tick++;
                timeDisplay.textContent = new Date().toLocaleTimeString();

                // Рандомим графики
                const load = Math.floor(Math.random() * 20) + (distro === 'gentoo' ? 70 : 10); 
                const bars = Math.floor(load / 10);
                cpuBar.textContent = "|".repeat(bars) + ".".repeat(10 - bars);
                cpuPct.textContent = load + "%";
                cpuPct.style.color = load > 80 ? '#ff5f56' : de.accent;

                const mem = Math.floor(Math.random() * 10) + 40;
                const memBars = Math.floor(mem / 10);
                memBar.textContent = "|".repeat(memBars) + ".".repeat(10 - memBars);
                memPct.textContent = mem + "%";

                // Обновляем процессы
                if (tick % 2 === 0) {
                    procList.innerHTML = '';
                    procs.forEach(p => {
                        const stats = generateProc(p.pid, p.name);
                        procList.innerHTML += `
                            <tr>
                                <td style="color:#888">${stats.pid}</td>
                                <td style="color:${de.accent}">${stats.user}</td>
                                <td>${stats.cpu}</td>
                                <td>${stats.mem}</td>
                                <td>${stats.name}</td>
                            </tr>
                        `;
                    });
                }
            }, 1000);
        },

        // ---------------------------------------------------------
        // НАСТРОЙКИ СИСТЕМЫ (С ГИБКИМ ИНТЕРФЕЙСОМ)
        // ---------------------------------------------------------
        openSettings: function() {
            const de = DESKTOP_ENVIRONMENTS[currentDEKey];
            let contentHtml = '';
            let settingsBody = null;

            // ГЕНЕРАЦИЯ UI В ЗАВИСИМОСТИ ОТ DE
            if (de.settingsLayout === 'text') {
                // Стиль i3: Текстовый конфиг
                contentHtml = `
                    <div class="settings-app settings-text" style="padding:20px; font-family:monospace; background:#000; color:#fff; height:100%;">
                        <h2 style="color:${de.accent}; margin-bottom:15px;"># ~/.config/i3/config</h2>
                        <div style="margin-bottom:10px;">
                            <label style="display:inline-block; width:200px;">set $mod </label>
                            <input type="text" value="Mod4" style="background:#111; border:1px solid #333; color:#fff; padding:5px;">
                        </div>
                        <div style="margin-bottom:10px;">
                            <label style="display:inline-block; width:200px;">font pango:monospace </label>
                            <input type="text" id="set-font-size" value="${SYSTEM_SETTINGS.fontScale}" style="width:60px; background:#111; border:1px solid #333; color:#fff; padding:5px;">
                        </div>
                        <div style="margin-bottom:10px;">
                            <label style="display:inline-block; width:200px;">gaps inner </label>
                            <input type="text" id="set-gaps" value="${SYSTEM_SETTINGS.i3Gaps}" style="width:60px; background:#111; border:1px solid #333; color:#fff; padding:5px;">
                        </div>
                        <div style="margin-bottom:10px;">
                            <label style="display:inline-block; width:200px;">default_border pixel </label>
                            <input type="text" id="set-border" value="${SYSTEM_SETTINGS.i3Border}" style="width:60px; background:#111; border:1px solid #333; color:#fff; padding:5px;">
                        </div>
                        <div style="margin-top:30px;">
                            <button id="btn-save-text" style="background:${de.accent}; color:#000; border:none; padding:8px 15px; cursor:pointer; font-weight:bold;">Сохранить (Reload i3)</button>
                        </div>
                    </div>
                `;
            } 
            else if (de.settingsLayout === 'gui') {
                // Стиль KDE: Боковое меню и ползунки
                contentHtml = `
                    <div class="settings-app settings-gui" style="display:flex; height:100%; background:#1e1e1e; color:#fff;">
                        <div class="settings-sidebar" style="width:200px; background:#111; border-right:1px solid #333; padding:10px 0;">
                            <div class="set-tab active" style="padding:10px 20px; background:#333; border-left:3px solid ${de.accent};">Внешний вид</div>
                            <div class="set-tab" style="padding:10px 20px; color:#888;">Сеть</div>
                            <div class="set-tab" style="padding:10px 20px; color:#888;">Пользователи</div>
                            <div class="set-tab" style="padding:10px 20px; color:#888;">О системе</div>
                        </div>
                        <div class="settings-content" style="flex:1; padding:30px;">
                            <h2 style="color:${de.accent}; margin-bottom:20px;">Внешний вид</h2>
                            
                            <div class="setting-group" style="margin-bottom:20px;">
                                <label style="display:block; margin-bottom:5px;">Масштаб шрифта</label>
                                <input type="range" id="set-font-slider" min="80" max="150" value="${SYSTEM_SETTINGS.fontScale}" style="width:100%;">
                                <span id="font-val" style="color:${de.accent}">${SYSTEM_SETTINGS.fontScale}%</span>
                            </div>

                            <div class="setting-group" style="margin-bottom:20px; display:flex; justify-content:space-between; align-items:center;">
                                <label>Прозрачность окон</label>
                                <input type="checkbox" id="set-transp" ${SYSTEM_SETTINGS.transparency ? 'checked' : ''} style="width:20px; height:20px; accent-color:${de.accent};">
                            </div>

                            <div class="setting-group" style="margin-bottom:20px; display:flex; justify-content:space-between; align-items:center;">
                                <label>Ночной свет</label>
                                <input type="checkbox" id="set-night" ${SYSTEM_SETTINGS.nightLight ? 'checked' : ''} style="width:20px; height:20px; accent-color:${de.accent};">
                            </div>
                        </div>
                    </div>
                `;
            }
            else if (de.settingsLayout === 'mobile') {
                // Стиль GNOME: Мобильные карточки
                contentHtml = `
                    <div class="settings-app settings-mobile" style="background:#f5f5f5; color:#000; height:100%; padding:20px; overflow-y:auto; font-family:'Ubuntu', sans-serif;">
                        <h2 style="margin-bottom:20px; font-size:24px;">Настройки</h2>
                        
                        <div class="mobile-card" style="background:#fff; border-radius:10px; padding:15px; margin-bottom:15px; box-shadow:0 2px 5px rgba(0,0,0,0.1); display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <div style="font-weight:bold;">Ночной свет</div>
                                <div style="font-size:12px; color:#666;">Уменьшает синий цвет экрана</div>
                            </div>
                            <input type="checkbox" id="set-night" ${SYSTEM_SETTINGS.nightLight ? 'checked' : ''} style="width:24px; height:24px; accent-color:${de.accent};">
                        </div>

                        <div class="mobile-card" style="background:#fff; border-radius:10px; padding:15px; margin-bottom:15px; box-shadow:0 2px 5px rgba(0,0,0,0.1); display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <div style="font-weight:bold;">Wi-Fi</div>
                                <div style="font-size:12px; color:#666;">${SYSTEM_SETTINGS.networkEnabled ? 'Подключено к lfs-gentoo-net' : 'Отключено'}</div>
                            </div>
                            <input type="checkbox" id="set-network" ${SYSTEM_SETTINGS.networkEnabled ? 'checked' : ''} style="width:24px; height:24px; accent-color:${de.accent};">
                        </div>

                        <div class="mobile-card" style="background:#fff; border-radius:10px; padding:15px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
                            <div style="font-weight:bold; margin-bottom:10px;">Размер шрифта</div>
                            <input type="range" id="set-font-slider" min="80" max="150" value="${SYSTEM_SETTINGS.fontScale}" style="width:100%; accent-color:${de.accent};">
                        </div>
                    </div>
                `;
            }
            else {
                // Стиль XFCE: Компактный
                contentHtml = `
                    <div class="settings-app settings-compact" style="background:#2a2a2a; color:#ccc; height:100%; padding:15px;">
                        <h3 style="color:${de.accent}; margin-bottom:15px; border-bottom:1px solid #444; padding-bottom:10px;">Настройки системы</h3>
                        <div style="display:grid; grid-template-columns: 150px 1fr; gap:10px; align-items:center;">
                            <label>Сглаживание шрифтов:</label>
                            <input type="checkbox" checked>
                            
                            <label>Масштаб:</label>
                            <input type="range" id="set-font-slider" min="80" max="150" value="${SYSTEM_SETTINGS.fontScale}">
                            
                            <label>Автоскрытие панели:</label>
                            <input type="checkbox" id="set-autohide" ${SYSTEM_SETTINGS.autoHidePanel ? 'checked' : ''}>
                        </div>
                    </div>
                `;
            }

            // Создаем окно
            const node = WM.createWindow({
                title: "System Settings",
                icon: "[CFG]",
                width: de.settingsLayout === 'text' ? '650px' : '750px',
                height: '500px',
                contentHtml: contentHtml
            });

            // Привязка обработчиков в зависимости от UI
            if (de.settingsLayout === 'text') {
                const saveBtn = node.querySelector('#btn-save-text');
                if (saveBtn) {
                    saveBtn.onclick = () => {
                        SYSTEM_SETTINGS.i3Gaps = node.querySelector('#set-gaps').value;
                        SYSTEM_SETTINGS.i3Border = node.querySelector('#set-border').value;
                        SYSTEM_SETTINGS.fontScale = node.querySelector('#set-font-size').value;
                        alert("i3 config reloaded successfully!");
                    };
                }
            } else {
                // Общие обработчики для GUI
                const fontSlider = node.querySelector('#set-font-slider');
                const fontVal = node.querySelector('#font-val');
                if (fontSlider) {
                    fontSlider.oninput = (e) => {
                        SYSTEM_SETTINGS.fontScale = e.target.value;
                        if (fontVal) fontVal.textContent = e.target.value + "%";
                        document.body.style.fontSize = (parseInt(e.target.value) / 100 * 16) + "px";
                    };
                }

                const nightToggle = node.querySelector('#set-night');
                if (nightToggle) {
                    nightToggle.onchange = (e) => {
                        SYSTEM_SETTINGS.nightLight = e.target.checked;
                        document.documentElement.style.filter = e.target.checked ? "sepia(0.3) hue-rotate(-20deg)" : "none";
                    };
                }

                const transpToggle = node.querySelector('#set-transp');
                if (transpToggle) {
                    transpToggle.onchange = (e) => {
                        SYSTEM_SETTINGS.transparency = e.target.checked;
                        // Тут можно применить класс к окнам
                    };
                }
            }
        }
    };

    // ========================================================================
    // 4. УПРАВЛЕНИЕ СРЕДОЙ (DESKTOP ENVIRONMENT MANAGER)
    // ========================================================================

    const DesktopManager = {
        applyDE: function(deKey) {
            const de = DESKTOP_ENVIRONMENTS[deKey];
            if (!de) return;

            currentDEKey = deKey;
            LOG.info("DE", `Applying desktop environment: ${de.name}`);

            // Смена CSS-переменных
            document.documentElement.style.setProperty('--de-accent', de.accent);
            document.documentElement.style.setProperty('--de-font', de.font);

            // Обновляем фон
            const bg = $('desktop-bg');
            if (bg) {
                bg.style.background = de.wallpaper;
                // Если обои - картинка
                if (de.wallpaper.startsWith('url')) {
                    bg.style.backgroundSize = 'cover';
                    bg.style.backgroundPosition = 'center';
                }
            }

            // Обновляем иконку меню "Пуск"
            const startIcon = qs('#start-btn svg');
            if (startIcon) startIcon.style.stroke = de.accent;
            
            const deName = $('de-name');
            if (deName) deName.textContent = de.name;

            // Применяем шрифт
            document.body.style.fontFamily = de.font;
        },

        showSetupWizard: function() {
            const overlay = document.createElement('div');
            overlay.className = 'setup-overlay';
            overlay.style.cssText = `
                position: fixed; inset: 0; background: rgba(0,0,0,0.95);
                z-index: 9999; display: flex; align-items: center; justify-content: center;
                flex-direction: column; font-family: monospace; color: #fff;
            `;

            overlay.innerHTML = `
                <div style="text-align: center; max-width: 900px; padding: 20px;">
                    <h1 style="color: #4af626; margin-bottom: 10px; font-size: 32px;">Установка завершена!</h1>
                    <p style="color: #888; margin-bottom: 40px; font-size: 16px;">Базовая система собрана. Выберите среду рабочего стола для дальнейшей работы.</p>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                        ${Object.keys(DESKTOP_ENVIRONMENTS).map(key => {
                            const de = DESKTOP_ENVIRONMENTS[key];
                            return `
                                <button class="de-select-btn" data-de="${key}" style="padding: 25px; background: #111; border: 2px solid #333; color: #fff; cursor: pointer; text-align: left; transition: 0.2s; border-radius: 8px;">
                                    <h2 style="color: ${de.accent}; margin-bottom: 10px; font-size: 24px;">${de.name}</h2>
                                    <p style="font-size: 14px; color: #aaa; line-height: 1.4;">${de.desc}</p>
                                    <div style="margin-top: 15px; font-size: 12px; color: #666;">Terminal: ${de.terminalName} | Files: ${de.fileManagerName}</div>
                                </button>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            overlay.querySelectorAll('.de-select-btn').forEach(btn => {
                btn.onmouseenter = () => btn.style.borderColor = '#fff';
                btn.onmouseleave = () => btn.style.borderColor = '#333';
                
                btn.onclick = () => {
                    const deKey = btn.getAttribute('data-de');
                    this.applyDE(deKey);
                    
                    overlay.style.opacity = '0';
                    overlay.style.transition = 'opacity 0.5s';
                    setTimeout(() => overlay.remove(), 500);
                    
                    setTimeout(() => Apps.openTerminal(), 800);
                    
                    const toast = $('welcome-toast');
                    if (toast) {
                        toast.classList.remove('hidden');
                        setTimeout(() => toast.classList.add('hidden'), 6000);
                    }
                };
            });
        }
    };

    // ========================================================================
    // 5. ИНИЦИАЛИЗАЦИЯ СИСТЕМЫ
    // ========================================================================

    function initTaskbar() {
        const startBtn = $('start-btn');
        const startMenu = $('start-menu');
        
        if (startBtn && startMenu) {
            startBtn.onclick = (e) => {
                e.stopPropagation();
                startMenu.classList.toggle('hidden');
            };
            document.addEventListener('click', () => startMenu.classList.add('hidden'));
            startMenu.onclick = (e) => e.stopPropagation();
        }

        qsa('.desk-icon').forEach(btn => {
            btn.onclick = () => {
                const app = btn.getAttribute('data-app');
                if (app === 'terminal') Apps.openTerminal();
                if (app === 'files') Apps.openFiles();
                if (app === 'settings') Apps.openSettings();
                if (app === 'htop') Apps.openSystemMonitor();
            };
        });

        qsa('.sm-item').forEach(btn => {
            btn.onclick = () => {
                const app = btn.getAttribute('data-app');
                if (app === 'terminal') Apps.openTerminal();
                if (app === 'files') Apps.openFiles();
                if (app === 'settings') Apps.openSettings();
                if (startMenu) startMenu.classList.add('hidden');
            };
        });

        const rebootBtn = $('sm-reboot');
        if (rebootBtn) rebootBtn.onclick = () => location.reload();

        const shutdownBtn = $('sm-shutdown');
        if (shutdownBtn) {
            shutdownBtn.onclick = () => {
                const modal = $('power-modal');
                if (modal) modal.classList.remove('hidden');
            };
        }
    }

    function startClock() {
        setInterval(() => {
            const now = new Date();
            const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            
            const clockEl = $('desktop-clock');
            if (clockEl) clockEl.textContent = timeStr;

            const upEl = $('tb-info');
            if (upEl) {
                const mins = Math.floor((Date.now() - bootTime) / 60000);
                upEl.textContent = `up ${mins} mins`;
            }
        }, 1000);
    }

    function initDesktop(chosenDistro) {
        distro = chosenDistro || 'lfs';
        bootTime = Date.now();
        
        LOG.info("DESKTOP", `Initializing desktop for ${distro}...`);

        initTaskbar();
        startClock();
        DesktopManager.showSetupWizard();
    }

    // Экспорт API
    window.DS_DESKTOP = {
        initDesktop,
        openTerminal: Apps.openTerminal,
        openFiles: Apps.openFiles,
        openSettings: Apps.openSettings,
        openSystemMonitor: Apps.openSystemMonitor
    };

    LOG.info("DESKTOP", "desktop.js module loaded successfully. ~1500 lines of pure logic.");

})();
