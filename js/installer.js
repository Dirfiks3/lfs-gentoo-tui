(function () {
  const D = window.DS_DATA;

  // Команды, которые должен ввести пользователь для каждого шага
  const LFS_CMDS = ["fdisk", "su", "tar", "make", "make", "make", "tar", "make", "grub-install", "reboot"];
  const GENTOO_CMDS = ["timedatectl", "wget", "nano", "chroot", "emerge", "emerge", "nano", "grub-install", "reboot"];

  // Фоновый шум (чтобы терминал не казался мертвым)
  const NOISE = [
    '  CC       foo/bar.o', '  CCLD     libtool', '  AR       lib.a',
    '  GEN      config.h', 'make[2]: Entering directory `/usr/src/...\'',
    'compiling... 89%', 'linking stage...', 'checking for stdlib.h... yes',
    'mv -f .deps/Tmp-stampT ...', '  INSTALL    bin/prog',
    '[ 97%] Built target all', 'touch stamp-h1', 'sed -e s/@VERSION@/1.0/ ...',
    'gzip -9f man1/prog.1', 'strip --strip-unneeded lib.so',
  ];

  // Состояние
  let currentStepIndex = 0;
  let currentDistro = 'lfs';
  let isRunning = false;
  let sessionTotalTime = 0;
  let totalWeight = 0;
  let currentSteps = [];

  // Таймеры
  let currentStepStartTime = 0;
  let accumulatedTime = 0;
  let clockInterval = null;
  let progressInterval = null;
  let noiseInterval = null;

  const $ = (id) => document.getElementById(id);

  // Защита от XSS
  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Подсветка синтаксиса в терминале
  function colorize(line) {
    let html = esc(line);
    if (/^\$ |^# |^lfs:~\$ |^\(chroot\)/.test(line)) {
      html = '<span class="log-cmd">' + html + '</span>';
    } else if (/^(>>>|\[|Checking|checking|Creating|Installing|Generating|Writing|распаковано|Пакетов|Kernel:|Resolving|stage3|These|Available|DEPMOD|Calculating|gcc \(|New password|\* |mke2fs|Found|Installation)/.test(line)) {
      html = '<span class="log-out">' + html + '</span>';
    } else if (/OK|ok|PASS|Done|done|finished|reboot/.test(line)) {
      html = '<span class="log-ok">' + html + '</span>';
    } else {
      html = '<span class="log-info">' + html + '</span>';
    }
    return html;
  }

  // Вывод строки в терминал с автоскроллом и защитой от переполнения DOM
  function appendLine(text) {
    const term = $('install-term');
    if (!term) return;
    
    const div = document.createElement('div');
    div.className = 'log-line';
    div.innerHTML = colorize(text);
    term.appendChild(div);
    
    // Автоскролл вниз
    term.scrollTop = term.scrollHeight;
    
    // Ограничение в 4000 строк, чтобы браузер не завис
    while (term.children.length > 4000) {
      term.removeChild(term.firstChild);
    }
  }

  function randomNoise() {
    return NOISE[Math.floor(Math.random() * NOISE.length)];
  }

  // Форматирование времени (00:00:00)
  function formatTime(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    return `${h}:${m}:${sec}`;
  }

  // Обработка ввода команд
  function handleInput(event) {
    if (event.key !== 'Enter' || !isRunning) return;

    const inputField = $('install-input');
    const command = inputField.value.trim().toLowerCase();
    if (!command) return;

    // Выводим введенную команду в консоль
    appendLine(`root@livecd:~# ${inputField.value}`);
    inputField.value = '';

    // Проверяем, совпадает ли ввод с ожидаемой командой
    const expectedCmd = currentDistro === 'gentoo' ? GENTOO_CMDS[currentStepIndex] : LFS_CMDS[currentStepIndex];

    if (expectedCmd && !command.includes(expectedCmd.toLowerCase())) {
      appendLine(`bash: ${command}: command not found`);
      return;
    }

    // Если команда верная — блокируем инпут и запускаем шаг
    inputField.disabled = true;
    runStep();
  }

  // Запуск текущего шага
  function runStep() {
    const step = currentSteps[currentStepIndex];
    const progressFill = $('install-progress');
    const statusPhase = $('status-phase');
    
    statusPhase.textContent = step.phase;
    appendLine(`═══════════ ${step.phase} ═══════════`);
    
    // Выводим логи шага из data.js
    if (step.lines && step.lines.length > 0) {
      step.lines.forEach((line, index) => {
        setTimeout(() => {
          appendLine(line);
        }, (index + 1) * (100 + Math.random() * 150)); 
      });
    }

    // Считаем время для этого шага
    const weight = step.weight || 1;
    const stepDuration = (weight / totalWeight) * sessionTotalTime;
    
    // ВАЖНО: Фиксируем время старта шага, чтобы таймер не улетал в космос
    currentStepStartTime = Date.now();

    // 1. Запускаем фоновый шум (компиляция)
    clearInterval(noiseInterval);
    noiseInterval = setInterval(() => {
      if (Date.now() - currentStepStartTime < stepDuration) {
        const burst = 1 + Math.floor(Math.random() * 3);
        for (let n = 0; n < burst; n++) {
          setTimeout(() => appendLine(randomNoise()), n * (200 + Math.random() * 400));
        }
      }
    }, 1500 + Math.random() * 2500);

    // 2. Запускаем прогресс-бар
    clearInterval(progressInterval);
    progressInterval = setInterval(() => {
      const elapsed = Date.now() - currentStepStartTime;
      const stepProgress = Math.min(1, elapsed / stepDuration);
      const totalProgress = (currentStepIndex + stepProgress) / currentSteps.length;
      
      progressFill.style.width = `${(totalProgress * 100).toFixed(1)}%`;
      $('status-percent').textContent = `${(totalProgress * 100).toFixed(1)}%`;

      // Если время шага вышло
      if (stepProgress >= 1) {
        clearInterval(progressInterval);
        clearInterval(noiseInterval);
        
        accumulatedTime += stepDuration;
        currentStepIndex++;

        if (currentStepIndex < currentSteps.length) {
          // Переходим к следующему шагу
          const inputField = $('install-input');
          inputField.disabled = false;
          inputField.focus();
          
          const nextCmd = currentDistro === 'gentoo' ? GENTOO_CMDS[currentStepIndex] : LFS_CMDS[currentStepIndex];
          appendLine(`[Подсказка: введи "${nextCmd}"]`);
        } else {
          // Установка завершена
          finishInstallation();
        }
      }
    }, 100);
  }

  // Завершение установки
  function finishInstallation() {
    isRunning = false;
    clearInterval(clockInterval);
    clearInterval(noiseInterval);
    clearInterval(progressInterval);
    
    $('status-phase').textContent = 'DONE';
    $('install-progress').style.width = '100%';
    $('status-percent').textContent = '100%';
    
    appendLine('');
    appendLine('██████████████████████████████ 100%');
    appendLine(currentDistro === 'gentoo' ? 'Gentoo установлена. Добро пожаловать.' : 'LFS собрана. Ты буквально построил Linux сам.');
    appendLine('Загрузка рабочего окружения...');
    
    // Прячем строку ввода
    $('install-inputline').style.display = 'none';

    // Перекидываем на рабочий стол через 3 секунды
    setTimeout(() => {
      if (window.DS_APP && window.DS_APP.goDesktop) {
        window.DS_APP.goDesktop();
      }
    }, 3000);
  }

  // Старт симуляции
  function start(distro) {
    if (isRunning) return;
    isRunning = true;
    currentDistro = distro;
    currentStepIndex = 0;
    accumulatedTime = 0;

    // Тайминги: LFS = 1 час, Gentoo = 30 минут
    sessionTotalTime = distro === 'lfs' ? 60 * 60 * 1000 : 30 * 60 * 1000;

    currentSteps = distro === 'gentoo' ? D.GENTOO_STEPS : D.LFS_STEPS;
    totalWeight = currentSteps.reduce((acc, s) => acc + (s.weight || 1), 0);

    // Очищаем терминал
    const term = $('install-term');
    if (term) term.innerHTML = '';
    
    // Настраиваем UI и поле ввода
    const inputField = $('install-input');
    inputField.disabled = false;
    $('install-inputline').style.display = 'flex';
    inputField.focus();
    
    inputField.removeEventListener('keydown', handleInput);
    inputField.addEventListener('keydown', handleInput);

    $('install-title').textContent = distro === 'gentoo' 
      ? 'root@livecd: / # emerge -av @world' 
      : 'lfs@livecd: / # make -j$(nproc)';

    // Приветствие
    appendLine('GNU Bash 5.2 — сессия установки запущена.');
    appendLine(distro === 'gentoo'
      ? '# Установка Gentoo по Handbook. Поехали. (30 минут)'
      : '# Linux From Scratch. Ни один пакет не скачан бинарным. (1 час)');
    appendLine('⏳ Не закрывай вкладку!');
    
    // Подсказка для первой команды
    const firstCmd = distro === 'gentoo' ? GENTOO_CMDS[0] : LFS_CMDS[0];
    appendLine(`[Подсказка: введи "${firstCmd}"]`);

    // Глобальный таймер (часы и ETA)
    clearInterval(clockInterval);
    clockInterval = setInterval(() => {
      if (!isRunning) return;
      
      // Считаем прошедшее время (пройденные шаги + текущий)
      const elapsed = accumulatedTime + (Date.now() - currentStepStartTime);
      const remaining = Math.max(0, sessionTotalTime - elapsed);
      
      $('install-clock').textContent = formatTime(elapsed);
      $('status-eta').textContent = `ETA: ${formatTime(remaining)}`;
    }, 1000);
  }

  // Остановка (если понадобится)
  function stop() {
    isRunning = false;
    clearInterval(clockInterval);
    clearInterval(progressInterval);
    clearInterval(noiseInterval);
  }

  // Экспорт в глобальную область
  window.DS_INSTALLER = { start, stop };
})();
