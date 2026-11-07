(function () {
  const D = window.DS_DATA;
  let distro = 'lfs';
  let bootTime = Date.now();
  let winSeq = 100;
  const openWindows = {}; 

  const $ = (id) => document.getElementById(id);

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ---------- Управление окнами ----------
  function createWindow(title, icon, templateId, opts = {}) {
    const tpl = $(templateId);
    const node = tpl.content.cloneNode(true).firstElementChild;
    
    // Настраиваем шапку окна
    const titleBar = node.querySelector('.win-title');
    if (titleBar) titleBar.textContent = title;
    const iconEl = node.querySelector('.win-icon');
    if (iconEl) iconEl.textContent = icon;

    // Позиция и размеры
    node.style.left = (opts.x ?? (80 + (winSeq % 7) * 30)) + 'px';
    node.style.top = (opts.y ?? (60 + (winSeq % 5) * 30)) + 'px';
    if (opts.w) node.style.width = opts.w;
    if (opts.h) node.style.height = opts.h;

    const id = 'win-' + (++winSeq);
    node.dataset.winId = id;
    $('windows-container').appendChild(node);

    // Кнопка на панели задач
    const tb = document.createElement('button');
    tb.className = 'tb-win';
    tb.textContent = `[${icon}] ${title}`;
    tb.onclick = () => toggleWindow(id);
    $('taskbar-windows').appendChild(tb);

    openWindows[id] = { el: node, taskEl: tb, isMaximized: false, prevRect: null };

    // Обработчики кнопок окна
    node.addEventListener('mousedown', () => focusWin(id));
    
    const closeBtn = node.querySelector('.win-close');
    if (closeBtn) closeBtn.onclick = (e) => { e.stopPropagation(); closeWin(id); };
    
    const minBtn = node.querySelector('.win-min');
    if (minBtn) minBtn.onclick = (e) => { e.stopPropagation(); toggleMinimize(id); };

    const maxBtn = node.querySelector('.win-max');
    if (maxBtn) maxBtn.onclick = (e) => { e.stopPropagation(); toggleMaximize(id); };

    // Перетаскивание за шапку
    const dragHandle = node.querySelector('.win-titlebar');
    if (dragHandle) makeDraggable(node, dragHandle, id);

    focusWin(id);
    return { node, id };
  }

  function focusWin(id) {
    Object.keys(openWindows).forEach(wId => {
      openWindows[wId].el.classList.remove('focused');
    });
    const w = openWindows[id];
    if (w) {
      w.el.classList.add('focused');
      w.el.style.zIndex = ++winSeq; // Поднимаем наверх
      // Если окно было свернуто, разворачиваем
      if (w.el.style.display === 'none') {
        w.el.style.display = 'flex';
      }
    }
    updateTaskActive();
  }

  function closeWin(id) {
    const w = openWindows[id];
    if (!w) return;
    w.el.remove(); 
    w.taskEl.remove();
    delete openWindows[id];
  }

  function toggleMinimize(id) {
    const w = openWindows[id];
    if (!w) return;
    w.el.style.display = 'none';
    updateTaskActive();
  }

  function toggleMaximize(id) {
    const w = openWindows[id];
    if (!w) return;
    
    if (w.isMaximized) {
      // Восстанавливаем
      w.el.style.left = w.prevRect.left;
      w.el.style.top = w.prevRect.top;
      w.el.style.width = w.prevRect.width;
      w.el.style.height = w.prevRect.height;
      w.isMaximized = false;
    } else {
      // Запоминаем текущие координаты
      w.prevRect = {
        left: w.el.style.left,
        top: w.el.style.top,
        width: w.el.style.width,
        height: w.el.style.height
      };
      // Разворачиваем на весь экран (кроме панели задач)
      w.el.style.left = '0';
      w.el.style.top = '0';
      w.el.style.width = '100vw';
      w.el.style.height = 'calc(100vh - 44px)'; // 44px - высота панели задач
      w.isMaximized = true;
    }
    focusWin(id);
  }

  function toggleWindow(id) {
    const w = openWindows[id];
    if (!w) return;
    if (w.el.classList.contains('focused') && w.el.style.display !== 'none') {
      w.el.style.display = 'none'; // Сворачиваем, если активно
    } else {
      w.el.style.display = 'flex';
      focusWin(id);
    }
    updateTaskActive();
  }

  function updateTaskActive() {
    Object.keys(openWindows).forEach(id => {
      const w = openWindows[id];
      const isVisible = w.el.style.display !== 'none';
      const isFocused = w.el.classList.contains('focused');
      w.taskEl.classList.toggle('active', isVisible && isFocused);
    });
  }

  function makeDraggable(el, handle, id) {
    let sx, sy, ox, oy, dragging = false;
    handle.addEventListener('mousedown', (e) => {
      if (e.target.closest('.win-btn')) return; // Игнорируем клики по кнопкам
      const w = openWindows[id];
      if (w.isMaximized) return; // Нельзя таскать развернутое окно

      dragging = true;
      sx = e.clientX; sy = e.clientY;
      ox = el.offsetLeft; oy = el.offsetTop;
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      el.style.left = Math.max(-100, ox + e.clientX - sx) + 'px';
      el.style.top = Math.max(0, oy + e.clientY - sy) + 'px';
    });
    window.addEventListener('mouseup', () => dragging = false);
  }

  // ---------- Логика приложений ----------
  function openTerminal() {
    const { node } = createWindow('Terminal', '>_', 'terminal-app-template', { w: '700px', h: '450px' });
    const out = node.querySelector('.term-out');
    const inp = node.querySelector('.term-in');
    const promptEl = node.querySelector('.prompt');
    const user = distro === 'gentoo' ? 'root' : 'lfs';
    promptEl.textContent = `${user}@distro:~$`;

    const history = []; let histPos = -1;

    printLine(out, `GNU bash, version 5.2.0 (${distro}-distroscope)`);
    printLine(out, 'Введи <b>help</b> для списка команд.');
    
    setTimeout(() => inp.focus(), 100);
    node.addEventListener('click', () => { if(inp) inp.focus(); });

    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const cmd = inp.value.trim();
        printLine(out, `<span class="t-prompt">${esc(promptEl.textContent)}</span> ${esc(cmd)}`);
        if (cmd) { history.push(cmd); histPos = history.length; }
        inp.value = '';
        runCommand(cmd, out, node);
      } else if (e.key === 'ArrowUp') {
        if (histPos > 0) { histPos--; inp.value = history[histPos]; }
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        if (histPos < history.length - 1) { histPos++; inp.value = history[histPos]; }
        else { histPos = history.length; inp.value = ''; }
        e.preventDefault();
      }
    });
  }

  function openFiles() {
    const { node } = createWindow('Files', '[DIR]', 'files-app-template', { w: '450px', h: '350px' });
    const list = node.querySelector('.files-list');
    
    Object.keys(D.FS_HOME).forEach(f => {
      const li = document.createElement('li');
      li.innerHTML = `<span>[TXT]</span> <b>${f}</b>`;
      li.onclick = () => openTextEditor(f, D.FS_HOME[f]);
      list.appendChild(li);
    });
  }

  function openTextEditor(title, content) {
    const { node } = createWindow(title, '[TXT]', 'text-app-template', { w: '500px', h: '400px' });
    const text = node.querySelector('.text-content');
    text.innerHTML = `<pre>${esc(content)}</pre>`;
  }

  function openAbout() {
    const data = D.getFetchData(distro);
    const content = `
      <h3>${distro === 'gentoo' ? 'Gentoo Linux' : 'Linux From Scratch'}</h3>
      <p>Kernel: <code>${data.kernel}</code></p>
      <p>Packages: <code>${data.packages}</code></p>
      <p>Установлено вручную. Настоящий труд.</p>
      <hr/>
      <p>DistroScope Simulator v1.0</p>
    `;
    openTextEditor('About System', content);
  }

  function openHandbook() {
    const content = `Что дальше?
1. Открой Terminal -> напиши help
2. Попробуй fastfetch, ls, cat notes.txt
3. Попробуй emerge firefox — и узнай почему нельзя
4. reboot для перезагрузки`;
    openTextEditor('Handbook', content);
  }

  // ---------- Выполнение команд в терминале ----------
  function printLine(out, html) {
    const d = document.createElement('div');
    d.className = 't-line';
    d.innerHTML = html || '&nbsp;';
    out.appendChild(d);
    out.scrollTop = out.scrollHeight;
  }

  async function runCommand(raw, out, node) {
    const parts = raw.split(/\s+/);
    const cmd = (parts[0] || '').toLowerCase();
    const arg = parts[1];

    switch (cmd) {
      case '': break;
      case 'help':
        printLine(out, 'Команды: fastfetch, ls, cat, uname, uptime, date, whoami, pwd, clear, emerge, reboot, exit');
        break;
      case 'ls':
        printLine(out, Object.keys(D.FS_HOME).join('   '));
        break;
      case 'cat':
        if (!arg || !D.FS_HOME[arg]) printLine(out, `cat: ${arg}: No such file`);
        else D.FS_HOME[arg].split('\n').forEach(l => printLine(out, esc(l)));
        break;
      case 'pwd': printLine(out, '/home/' + (distro === 'gentoo' ? 'root' : 'lfs')); break;
      case 'whoami': printLine(out, distro === 'gentoo' ? 'root' : 'lfs'); break;
      case 'date': printLine(out, new Date().toString()); break;
      case 'clear': out.innerHTML = ''; break;
      case 'exit': closeWin(node.dataset.winId); break;
      case 'uname': printLine(out, arg === '-a' ? `Linux distro ${D.getFetchData(distro).kernel} x86_64 GNU/Linux` : 'Linux'); break;
      case 'uptime': printLine(out, ` up ${Math.floor((Date.now() - bootTime)/60000)} min, 1 user`); break;
      case 'fastfetch': case 'neofetch': case 'fetch': showFetch(out); break;
      case 'sudo': runCommand(parts.slice(1).join(' '), out, node); break;
      case 'emerge': case 'apt': case 'pacman':
        if (arg === 'fastfetch') printLine(out, `<b class="t-ok">[OK] ${arg} уже установлен.</b>`);
        else printLine(out, `<b class="t-err">Ошибка: установка ${arg} невозможна в симуляторе.</b>`);
        break;
      case 'reboot':
        printLine(out, 'Перезагрузка...');
        setTimeout(() => { bootTime = Date.now(); out.innerHTML = ''; printLine(out, 'Система перезагружена.'); }, 1000);
        break;
      default: printLine(out, `${esc(cmd)}: command not found`);
    }
  }

  function showFetch(out) {
    const data = D.getFetchData(distro);
    const logo = distro === 'gentoo' ? D.ASCII.gentooLogo : D.ASCII.lfsLogo;
    const info = [
      `${distro}@distro`, `OS: ${data.os}`, `Kernel: ${data.kernel}`, 
      `Uptime: ${Math.floor((Date.now() - bootTime)/60000)} min`, 
      `Packages: ${data.packages}`, `Shell: ${data.shell}`, `CPU: ${data.cpu}`, `Memory: ${data.memory}`
    ];
    
    let html = '<div class="ff-block"><pre class="ff-pre">\n';
    for (let i = 0; i < Math.max(logo.length, info.length); i++) {
      const l = (logo[i] || '').padEnd(30);
      const inf = info[i] || '';
      html += `<span style="color:#4af626">${esc(l)}</span>${esc(inf)}\n`;
    }
    html += '</pre></div>';
    printLine(out, html);
  }

  // ---------- Инициализация ----------
  function initDesktop(chosenDistro) {
    distro = chosenDistro;
    bootTime = Date.now();

    $('de-name').textContent = distro === 'gentoo' ? 'Gentoo · OpenRC' : 'LFS · SysVinit';

    // Часы
    setInterval(() => {
      $('desktop-clock').textContent = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
      $('tb-info').textContent = 'up ' + Math.floor((Date.now() - bootTime)/60000) + ' mins';
    }, 1000);

    // Приветствие
    const toast = $('welcome-toast');
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 8000);

    setTimeout(openTerminal, 500);
  }

  window.DS_DESKTOP = { initDesktop, openTerminal, openFiles, openAbout, openHandbook };
})();
