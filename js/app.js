/* ============================================================
   app.js — склейка всего проекта. Переключение экранов.
   ============================================================ */

(function () {
  const $ = (id) => document.getElementById(id);

  // Переключение активного экрана
  function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(screenId).classList.add('active');
  }

  // Инициализация при загрузке страницы
  function init() {
    // 1. Находим все карточки выбора (LFS и Gentoo)
    const cards = document.querySelectorAll('.card');
    
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const distro = card.getAttribute('data-distro'); // 'lfs' или 'gentoo'
        
        // Переключаем экран на терминал
        showScreen('screen-install');
        
        // Запускаем установку из installer.js
        if (window.DS_INSTALLER && window.DS_INSTALLER.start) {
          window.DS_INSTALLER.start(distro);
        } else {
          console.error("Ошибка: installer.js не загружен!");
        }
      });
    });

    // 2. Кнопка Пуск на рабочем столе (просто скрывает/показывает окна)
    const startBtn = $('start-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        // Принудительно сворачиваем все окна
        document.querySelectorAll('.app-window').forEach(win => {
          win.classList.add('minimized');
        });
        // Обновляем панель задач
        if (window.DS_DESKTOP && window.DS_DESKTOP.updateTaskActive) {
             // Если функция экспортирована
        }
      });
    }
  }

  // Функция для перехода на рабочий стол (её вызывает installer.js)
  function goDesktop() {
    showScreen('screen-desktop');
    
    // Определяем, что мы ставили, по тексту в терминале
    const installTitle = $('install-title').textContent;
    const distro = installTitle.includes('Gentoo') ? 'gentoo' : 'lfs';

    // Запускаем инициализацию рабочего стола
    if (window.DS_DESKTOP && window.DS_DESKTOP.initDesktop) {
      window.DS_DESKTOP.initDesktop(distro);
    } else {
      console.error("Ошибка: desktop.js не загружен!");
    }
  }

  // Экспортируем функцию goDesktop, чтобы installer.js мог её вызвать
  window.DS_APP = { goDesktop };

  // Запускаем инициализацию, когда страница полностью загрузится
  document.addEventListener('DOMContentLoaded', init);
  
})();
