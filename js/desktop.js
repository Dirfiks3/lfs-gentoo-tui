/* ============================================================
   desktop.js — рабочий стол, окна, терминал, fastfetch.
   Строгий стиль, без эмодзи и детского сада.
   ============================================================ */

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

  // ---------- Окна ----------
  function createWindow(title, icon, opts = {}) {
    const tpl = $('window-template');
    const node = tpl.content.cloneNode(true).firstElementChild;
    node.querySelector('.win-title').textContent = title;
    node.querySelector('.win-icon').textContent = icon;
    const body = node.querySelector('.win-body');

    node.style.left = (opts.x ?? (60 + (winSeq % 7) * 28)) + 'px';
    node.style.top = (opts.y ?? (50 + (winSeq % 5) * 26)) + 'px';
    if (opts.w) node.style.width = opts.w;
    if (opts.h) node.style.height = opts.h;

    const id = 'win-' + (++winSeq);
    node.dataset.winId = id;
    $('screen-desktop').appendChild(node);

    // Кнопка на панели задач
    const tb = document.createElement('button');
    tb.className = 'tb-win';
    tb.textContent = `[${icon}] ${title}`;
    tb.onclick = () => { node.classList.toggle('minimized'); updateTaskActive(); };
    $('taskbar-windows').appendChild(tb);

    openWindows[id] = { el: node, taskEl: tb };

    node.addEventListener('mousedown', () => focusWin(id));
    node.querySelector('.win-close').onclick = (e) => {
      e.stopPropagation(); closeWin(id);
    };
    node.querySelector('.win-min').onclick = (e) => {
      e.stopPropagation(); node.classList.add('minimized'); updateTaskActive();
    };

    // Перетаскивание за шапку
    makeDraggable(node, node.querySelector('.win-titlebar'));
    focusWin(id);
    updateTaskActive();
    return { node, body, id };
  }

  function focusWin(id) {
    Object.values(openWindows).forEach(w => w.el.classList.remove('focused'));
    const w = openWindows[id];
    if (w) w.el.classList.add('focused');
    updateTaskActive();
  }

  function closeWin(id) {
    const w = openWindows[id];
    if (!w) return;
    w.el.remove(); w.taskEl.remove();
    delete openWindows[id];
  }

  function updateTaskActive() {
    Object.values(openWindows).forEach(w => {
      w.taskEl.classList.toggle('active', w.el.classList.contains('focused') && !w.el.classList.contains('minimized'));
    });
  }

  function makeDraggable(el, handle) {
    let sx, sy, ox, oy, dragging = false;
    handle.addEventListener('mousedown', (e) => {
      if (e.target.closest('.win-btn')) return;
      dragging = true;
      sx = e.clientX; sy = e.clientY;
      ox = el.offsetLeft; oy = el.offsetTop;
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      el.style.left = Math.max(-200, ox + e.clientX - sx) + 'px';
      el.style.top = Math.max(0, oy + e.clientY - sy) + 'px';
    });
    window.addEventListener('mouseup', () => dragging = false);
  }

  // ---------- Терминал ----------
  function openTerminal() {
    const { body } = createWindow('Terminal', '>_', { w: '680px', h: '420px' });
    const wrap = document.createElement('div');
    wrap.className = 'term-app';
    wrap.innerHTML = `<div class="term-out"></div>
      <div class="term-inputline">
        <span class="prompt"></span><input class="term-in" spellcheck="false" autocomplete="off"/>
      </div>`;
    body.appendChild(wrap);

    const out = wrap.querySelector('.term-out');
    const inp = wrap.querySelector('.term-in');
    const promptEl = wrap.querySelector('.prompt');
    const user = distro === 'gentoo' ? 'root' : 'lfs';
    promptEl.textContent = `${user}@distro:~$`;

    const history = []; let histPos = -1;

    print(out, `GNU bash, version 5.2.0 (${distro}-distroscope)`);
    print(out, 'Введи <b>help</b> для списка команд.');
    print(out, '');

    setTimeout(() => inp.focus(), 100);
    wrap.addEventListener('click', () => inp.focus());

    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const cmd = inp.value.trim();
        print(out, `<span class="t-prompt">${esc(promptEl.textContent)}</span> ${esc(cmd)}`);
        if (cmd) { history.push(cmd); histPos = history.length; }
        inp.value = '';
        runCommand(cmd, out, wrap);
        out.scrollTop = out.scrollHeight;
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

  function print(out, html) {
    const d = document.createElement('div');
    d.className = 't-line';
    d.innerHTML = html || '&nbsp;';
    out.appendChild(d);
    out.scrollTop = out.scrollHeight;
    return d;
  }

  // ---------- Команды ----------
  async function runCommand(raw, out, wrap) {
    const parts = raw.split(/\s+/);
    const cmd = (parts[0] || '').toLowerCase();
    const arg = parts[1];

    switch (cmd) {
      case '': break;
      case 'help': {
        print(out, 'Доступные команды:');
        print(out, '  <b>fastfetch</b> / <b>neofetch</b> — инфо о системе');
        print(out, '  <b>ls</b> — файлы | <b>cat</b> имя — прочитать файл');
        print(out, '  <b>uname -a</b> | <b>uptime</b> | <b>date</b> | <b>whoami</b> | <b>pwd</b> | <b>clear</b>');
        print(out, '  <b>emerge pkg</b> — попытка установки пакета');
        print(out, '  <b>reboot</b> — перезагрузка | <b>exit</b> — закрыть окно');
        break;
      }
      case 'ls': {
        const files = Object.keys(D.FS_HOME);
        print(out, files.map(f => f.endsWith('.md') || f.endsWith('.txt')
          ? '<span class="t-file">' + f + '</span>'
          : '<span class="t-dotfile">' + f + '</span>').join('   '));
        break;
      }
      case 'cat': {
        if (!arg) { print(out, 'usage: cat <file>'); break; }
        const content = D.FS_HOME[arg];
        if (content === undefined) { print(out, `cat: ${esc(arg)}: No such file or directory`); break; }
        content.split('\n').forEach(l => print(out, esc(l)));
        break;
      }
      case 'pwd': print(out, '/home/' + (distro === 'gentoo' ? 'root' : 'lfs')); break;
      case 'whoami': print(out, distro === 'gentoo' ? 'root' : 'lfs'); break;
      case 'date': print(out, new Date().toString()); break;
      case 'echo': print(out, esc(parts.slice(1).join(' '))); break;
      case 'uname': {
        const data = D.getFetchData(distro);
        print(out, arg === '-a' ? `Linux distro ${data.kernel} #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux` : 'Linux');
        break;
      }
      case 'uptime': {
        const up = uptimeStr();
        print(out, ` ${new Date().toLocaleTimeString()} up ${up},  1 user,  load average: 0.05, 0.02, 0.01`);
        break;
      }
      case 'clear': {
        wrap.querySelector('.term-out').innerHTML = '';
        break;
      }
      case 'exit': {
        closeWin(wrap.closest('.app-window').dataset.winId);
        break;
      }
      case 'reboot': {
        await doReboot(out);
        break;
      }
      case 'fastfetch': case 'neofetch': case 'fetch': {
        showFetch(out, cmd);
        break;
      }
      case 'sudo': {
        runCommand(parts.slice(1).join(' '), out, wrap);
        break;
      }
      case 'emerge': case 'apt': case 'apt-get': case 'pacman': case 'xbps-install': case 'dnf': case 'yum': {
        const pkg = (arg || '').toLowerCase();
        await installPkg(out, cmd, pkg);
        break;
      }
      case 'vim': case 'nano': {
        print(out, `<i>${cmd}: зачем редактор? Система уже собрана.</i>`);
        break;
      }
      default: {
        print(out, `${esc(cmd)}: command not found. Напиши <b>help</b>.`);
      }
    }
  }

  function uptimeStr() {
    const s = Math.floor((Date.now() - bootTime) / 1000);
    const m = Math.floor(s / 60), h = Math.floor(m / 60);
    if (h > 0) return `${h} hour${h>1?'s':''}, ${m%60} min`;
    if (m > 0) return `${m} min, ${s%60} sec`;
    return `${s} sec`;
  }

  // ---------- Установка пакетов ----------
  async function installPkg(out, mgr, pkg) {
    if (!pkg) { print(out, `usage: ${mgr} <package>`); return; }
    if (D.DOWNLOADABLE.includes(pkg)) {
      print(out, `>>> ${mgr}: fetching ${pkg} ...`);
      for (let p = 0; p <= 100; p += 20) {
        print(out, `[${'#'.repeat(p/5)}${'.'.repeat(20 - p/5)}] ${p}%`);
        await sleep(150);
      }
      print(out, `<b class="t-ok">[OK] ${pkg} installed.</b> Но он уже есть. Набери <b>fastfetch</b>.`);
      return;
    }
    const reasons = [
      `Установка <b>${esc(pkg)}</b>: исходников нет, бинарки не ставим.`,
      `<b>${esc(pkg)}</b>: нужно 4 ГБ зависимостей. Отказано.`,
      `emerge: !!! package '${esc(pkg)}' masked. Разрешён только <b>fastfetch</b>.`,
      `make: *** No rule to make target '${esc(pkg)}'.`
    ];
    print(out, '<b class="t-err">ERROR:</b> установка невозможна.');
    await sleep(300);
    print(out, reasons[Math.floor(Math.random() * reasons.length)]);
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ---------- fastfetch ----------
  function showFetch(out, which) {
    const data = D.getFetchData(distro);
    data.uptime = uptimeStr();

    const logoLines = distro === 'gentoo' ? D.ASCII.gentooLogo : D.ASCII.lfsLogo;
    const infoLines = [
      `${distro === 'gentoo' ? 'gentoo' : 'lfs'}@${distro === 'gentoo' ? 'localhost' : 'distro'}`,
      '─────────────────────',
      `OS: ${data.os}`,
      `Host: ${data.host}`,
      `Kernel: ${data.kernel}`,
      `Uptime: ${data.uptime}`,
      `Packages: ${data.packages}`,
      `Shell: ${data.shell}`,
      `Resolution: ${data.resolution}`,
      `DE: ${data.de}`,
      `WM: ${data.wm}`,
      `Terminal: ${data.terminal}`,
      `CPU: ${data.cpu}`,
      `GPU: ${data.gpu}`,
      `Memory: ${data.memory}`,
      `Disk (/): ${data.disk}`,
    ];

    const rows = Math.max(logoLines.length, infoLines.length);
    const logoW = 30;
    let html = '<div class="ff-block"><pre class="ff-pre">';
    for (let i = 0; i < rows; i++) {
      const logoPart = (logoLines[i] || '').padEnd(logoW);
      const color = D.FF_COLORS[i % D.FF_COLORS.length];
      const infoPart = infoLines[i] || '';
      const label = infoPart.split(':')[0];
      const rest = infoPart.slice(label.length);
      const coloredInfo = infoPart
        ? `<span style="color:${color}">■</span> <span style="color:${color};font-weight:bold">${esc(label)}</span>${esc(rest)}`
        : '';
      html += `<span style="color:${color}">${esc(logoPart)}</span>${coloredInfo}\n`;
    }
    html += '</pre></div>';
    print(out, html);
    printBar(out);
  }

  function printBar(out) {
    const colors = D.FF_COLORS.concat([...D.FF_COLORS].reverse()).slice(0, 8);
    let s = '';
    for (const c of colors) s += `<span style="background:${c};color:${c}">████</span>`;
    print(out, s);
  }

  // ---------- reboot ----------
  async function doReboot(out) {
    print(out, 'Broadcast message: The system is going down for reboot NOW!');
    await sleep(600);
    print(out, ' * Stopping sshd ... [ OK ]');
    await sleep(400);
    print(out, ' * Unmounting filesystems ... [ OK ]');
    await sleep(400);
    print(out, ' * Rebooting');
    await sleep(800);
    bootTime = Date.now();
    out.innerHTML = '';
    print(out, `[ 0.000000] Linux version ${D.getFetchData(distro).kernel}`);
    print(out, '[ OK ] Started DistroScope Desktop Environment.');
    print(out, `${distro.toUpperCase()} restarted. Uptime reset.`);
  }

  // ---------- Приложения на рабочем столе ----------
  function openAbout() {
    const { body } = createWindow('About System', '[i]', { w: '420px' });
    const data = D.getFetchData(distro);
    body.innerHTML = `
      <div class="about-app">
        <h3>${distro === 'gentoo' ? 'Gentoo Linux' : 'Linux From Scratch'}</h3>
        <p>Kernel: <code>${data.kernel}</code></p>
        <p>Packages: <code>${data.packages}</code></p>
        <p>Установлено вручную. Настоящий труд.</p>
        <hr/>
        <p class="dim">DistroScope Simulator v1.0</p>
      </div>`;
  }

  function openFiles() {
    const { body } = createWindow('Files: /home', '[DIR]', { w: '380px' });
    let html = '<div class="files-app"><ul>';
    for (const f of Object.keys(D.FS_HOME)) {
      html += `<li>[TXT] <b>${f}</b><pre class="file-preview">${esc(D.FS_HOME[f])}</pre></li>`;
    }
    html += '</ul></div>';
    body.innerHTML = html;
  }

  function openHandbook() {
    const { body } = createWindow('Handbook', '[MAN]', { w: '460px', h: '380px' });
    body.innerHTML = `<div class="about-app">
      <h3>Что дальше?</h3>
      <ul>
        <li>Открой Terminal → напиши <code>help</code></li>
        <li>Попробуй <code>fastfetch</code>, <code>ls</code>, <code>cat notes.txt</code></li>
        <li>Попробуй <code>emerge firefox</code> — и узнай почему нельзя</li>
        <li><code>reboot</code> для перезагрузки</li>
      </ul></div>`;
  }

  // ---------- Инициализация ----------
  function initDesktop(chosenDistro) {
    distro = chosenDistro;
    bootTime = Date.now();

    // Иконки рабочего стола (строгий стиль)
    const icons = [
      { icon: '>_', label: 'Terminal', fn: openTerminal },
      { icon: '[DIR]', label: 'Files', fn: openFiles },
      { icon: '[i]', label: 'System', fn: openAbout },
      { icon: '[MAN]', label: 'Handbook', fn: openHandbook },
      { icon: '[FF]', label: 'fastfetch', fn: () => { openTerminal(); setTimeout(() => {
          const inp = document.querySelector('.app-window .term-in');
          if (inp) { inp.value = 'fastfetch'; inp.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter'})); }
        }, 400); } },
    ];
    const cont = $('desktop-icons');
    cont.innerHTML = '';
    icons.forEach(ic => {
      const b = document.createElement('button');
      b.className = 'desk-icon';
      b.innerHTML = `<span class="di-img">${ic.icon}</span><span class="di-label">${ic.label}</span>`;
      b.ondblclick = ic.fn;
      b.onclick = ic.fn; // По клику тоже, удобнее
      cont.appendChild(b);
    });

    $('de-name').textContent = distro === 'gentoo' ? 'Gentoo · OpenRC' : 'LFS · SysVinit';

    // Часы + аптайм
    setInterval(() => {
      $('desktop-clock').textContent = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
      $('tb-info').textContent = 'up ' + uptimeStr();
    }, 1000);

    // Приветствие
    const toast = $('welcome-toast');
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 8000);
    toast.onclick = () => toast.classList.add('hidden');

    // Сразу откроем терминал
    setTimeout(openTerminal, 800);
  }

  window.DS_DESKTOP = { initDesktop };
})();
