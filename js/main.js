(() => {
  'use strict';

  const TASKS_KEY = 'todo.tasks';
  const THEME_KEY = 'todo.theme';
  const $ = (selector, root = document) => root.querySelector(selector);

  const listEl = $('.js-task-list');
  const emptyEl = $('.js-empty');
  const statusEl = $('.js-status');
  const searchEl = $('.js-search');
  const addBtn = $('.js-add-task');
  const template = $('.js-task-template');
  const dialog = $('.js-task-dialog');
  const form = $('.js-task-form');
  const dialogTitle = $('.js-dialog-title');
  const input = $('.js-task-input');
  const errorEl = $('.js-form-error');

  // ---------- хранилище ----------
  function loadTasks() {
    try {
      const raw = JSON.parse(localStorage.getItem(TASKS_KEY));
      if (!Array.isArray(raw)) return [];
      return raw
        .filter((t) => t && Number.isFinite(t.id) && typeof t.title === 'string' && t.title.trim())
        .map((t) => ({ id: t.id, title: t.title, done: t.done === true }));
    } catch {
      return [];
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
    } catch {
      /* хранилище недоступно — работаем без сохранения */
    }
  }

  let tasks = loadTasks();
  let nextId = tasks.reduce((max, t) => Math.max(max, t.id), 0) + 1;
  let query = '';
  let editingId = null;
  let afterClose = null;

  // ---------- вспомогательное ----------
  function announce(message) {
    statusEl.textContent = '';
    setTimeout(() => { statusEl.textContent = message; }, 50);
  }

  // Видимые задачи: фильтр по поиску, выполненные — внизу списка.
  function visibleTasks() {
    const q = query.trim().toLowerCase();
    const found = tasks.filter((t) => t.title.toLowerCase().includes(q));
    return [...found.filter((t) => !t.done), ...found.filter((t) => t.done)];
  }

  function focusTask(id, selector) {
    const el = $(`[data-id="${id}"] ${selector}`, listEl);
    (el || addBtn).focus();
  }

  // ---------- отрисовка (только textContent / setAttribute) ----------
  function createItem(task) {
    const li = template.content.firstElementChild.cloneNode(true);
    const prefix = `task-${task.id}`;
    const check = $('.js-toggle', li);
    const title = $('.js-title', li);
    const edit = $('.js-edit', li);
    const del = $('.js-delete', li);

    li.dataset.id = task.id;
    li.dataset.done = String(task.done);

    check.id = `${prefix}-done`;
    check.checked = task.done;

    title.id = `${prefix}-title`;
    title.htmlFor = check.id;
    title.textContent = task.title;

    edit.id = `${prefix}-edit`;
    edit.setAttribute('aria-labelledby', `${edit.id} ${title.id}`);
    del.id = `${prefix}-delete`;
    del.setAttribute('aria-labelledby', `${del.id} ${title.id}`);
    return li;
  }

  function render() {
    const items = visibleTasks();
    listEl.replaceChildren(...items.map(createItem));
    emptyEl.hidden = items.length > 0;
    emptyEl.textContent = tasks.length
      ? 'Ничего не найдено. Измените поисковый запрос.'
      : 'Задач пока нет. Нажмите «Добавить задачу».';
    return items;
  }

  // ---------- действия ----------
  function toggleTask(id, done) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    task.done = done;
    saveTasks();
    render();
    focusTask(id, '.js-toggle');
    announce(done ? 'Задача выполнена' : 'Задача возвращена в список');
  }

  function deleteTask(id) {
    const before = visibleTasks();
    const index = before.findIndex((t) => t.id === id);
    const neighbour = before[index + 1] || before[index - 1];
    tasks = tasks.filter((t) => t.id !== id);
    saveTasks();
    render();
    if (neighbour) focusTask(neighbour.id, '.js-toggle');
    else addBtn.focus();
    announce('Задача удалена');
  }

  function openDialog(task) {
    editingId = task ? task.id : null;
    dialogTitle.textContent = task ? 'Редактировать задачу' : 'Новая задача';
    input.value = task ? task.title : '';
    input.removeAttribute('aria-invalid');
    errorEl.hidden = true;
    afterClose = task ? () => focusTask(task.id, '.js-edit') : () => addBtn.focus();
    dialog.showModal();
  }

  // ---------- события ----------
  addBtn.addEventListener('click', () => openDialog(null));

  listEl.addEventListener('change', (event) => {
    const check = event.target.closest('.js-toggle');
    if (check) toggleTask(Number(check.closest('[data-task]').dataset.id), check.checked);
  });

  listEl.addEventListener('click', (event) => {
    const btn = event.target.closest('.js-edit, .js-delete');
    if (!btn) return;
    const id = Number(btn.closest('[data-task]').dataset.id);
    if (btn.classList.contains('js-delete')) deleteTask(id);
    else openDialog(tasks.find((t) => t.id === id));
  });

  searchEl.addEventListener('input', () => {
    query = searchEl.value;
    const count = render().length;
    announce(`Найдено задач: ${count}`);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = input.value.trim();
    if (!title) {
      input.setAttribute('aria-invalid', 'true');
      errorEl.hidden = false;
      input.focus();
      return;
    }
    if (editingId === null) {
      tasks.push({ id: nextId++, title, done: false });
      announce('Задача добавлена');
    } else {
      const task = tasks.find((t) => t.id === editingId);
      if (task) task.title = title;
      announce('Задача изменена');
    }
    saveTasks();
    render();
    dialog.close();
  });

  $('.js-close-dialog').addEventListener('click', () => dialog.close());

  // Возврат фокуса при закрытии (Esc, «Отмена», сохранение)
  dialog.addEventListener('close', () => {
    if (afterClose) afterClose();
    afterClose = null;
  });

  // ---------- тема ----------
  const themeBtn = $('.js-theme-toggle');
  if (themeBtn) {
    const apply = (theme) => {
      document.documentElement.dataset.theme = theme;
      themeBtn.setAttribute('aria-pressed', String(theme === 'dark'));
    };
    let saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch { /* нет доступа */ }
    apply(saved === 'dark' ? 'dark' : 'light');
    themeBtn.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      apply(next);
      try { localStorage.setItem(THEME_KEY, next); } catch { /* нет доступа */ }
    });
  }

  render();
})();
