(() => {
  'use strict';

  /* ============================================================
     1. 常量 / 运行状态
     ============================================================ */
  const AppStorage = window.ShiGuangStorage;
  if (!AppStorage) throw new Error('本地存储模块未加载');
  const APP_VERSION = '1.0.0 · 正式版';
  const MS_DAY = 24 * 60 * 60 * 1000;
  const RING_RADIUS = 57;
  const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

  const PAGES = {
    today: { label: '今日', title: '今日' },
    tasks: { label: '任务', title: '任务' },
    calendar: { label: '日历', title: '日历' },
    messages: { label: '消息', title: '消息' },
    settings: { label: '统计 · 设置', title: '统计 · 设置' }
  };

  const PRIORITIES = {
    p1: { label: '紧急', color: '#d95353', soft: '#fbeaea', rank: 1 },
    p2: { label: '重要', color: '#e18a38', soft: '#fbf0e2', rank: 2 },
    p3: { label: '普通', color: '#4a83bd', soft: '#eaf2fa', rank: 3 },
    p4: { label: '较低', color: '#929b95', soft: '#f0f2ef', rank: 4 }
  };

  const URGENCY_LEVELS = {
    high: { key: 'high', label: '紧急', color: '#d95353', soft: '#fbeaea', rank: 3 },
    normal: { key: 'normal', label: '普通', color: '#e18a38', soft: '#fbf0e2', rank: 2 },
    low: { key: 'low', label: '较低', color: '#929b95', soft: '#f0f2ef', rank: 1 }
  };

  const IMPORTANCE_LEVELS = {
    high: { key: 'high', label: '重要', color: '#d97a51', soft: '#f8e9e0', rank: 3 },
    normal: { key: 'normal', label: '普通', color: '#4a83bd', soft: '#eaf2fa', rank: 2 },
    low: { key: 'low', label: '较低', color: '#929b95', soft: '#f0f2ef', rank: 1 }
  };

  const STATUSES = {
    todo: { label: '待办', color: '#9aa5a0' },
    doing: { label: '进行中', color: '#4a83bd' },
    done: { label: '已完成', color: '#3c876a' }
  };

  const SOURCE_TYPES = {
    group: { label: '群通知', mark: '群', className: 'group' },
    mail: { label: '邮件', mark: '邮', className: 'mail' },
    private: { label: '私信', mark: '私', className: 'private' },
    other: { label: '其他', mark: '记', className: 'other' }
  };

  const TASK_TYPES = {
    task: {
      label: '普通任务',
      short: '任务',
      icon: 'check',
      hint: '有一个截止时间，关注“什么时候要交”。',
      color: '#4a83bd',
      soft: '#eaf2fa'
    },
    event: {
      label: '事件',
      short: '事件',
      icon: 'target',
      hint: '需要在某个时间段本人到场，关注“什么时候要去”。',
      color: '#d97a51',
      soft: '#f8e9e0'
    },
    routine: {
      label: '日程',
      short: '日程',
      icon: 'refresh',
      hint: '每天或每周固定时间重复，关注“什么时候做”。',
      color: '#3c876a',
      soft: '#e8f3ed'
    }
  };

  const AI_PROVIDERS = {
    deepseek: {
      label: 'DeepSeek',
      base: 'https://api.deepseek.com',
      model: 'deepseek-chat',
      note: '兼容 OpenAI 协议，性价比高'
    },
    openai: {
      label: 'OpenAI',
      base: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      note: '官方 OpenAI 接口'
    },
    moonshot: {
      label: 'Moonshot · Kimi',
      base: 'https://api.moonshot.cn/v1',
      model: 'moonshot-v1-8k',
      note: '国内可直连的兼容接口'
    },
    zhipu: {
      label: '智谱 GLM',
      base: 'https://open.bigmodel.cn/api/paas/v4',
      model: 'glm-4-flash',
      note: '智谱开放平台'
    },
    custom: {
      label: '自定义通道',
      base: '',
      model: '',
      note: '任何兼容 Chat Completions 的接口'
    }
  };

  const WEEKDAYS = [
    { value: 0, label: '日' },
    { value: 1, label: '一' },
    { value: 2, label: '二' },
    { value: 3, label: '三' },
    { value: 4, label: '四' },
    { value: 5, label: '五' },
    { value: 6, label: '六' }
  ];

  const MORNING_ITEMS = [
    '查看今日任务，挑出最重要的一件事',
    '清理消息收件箱里的未处理通知',
    '检查未来 3 天的 DDL，预留缓冲',
    '为自己安排一段 25 分钟专注时间'
  ];

  let state = null;
  let isFirstRun = false;
  let storageBroken = false;

  const ui = {
    page: 'today',
    taskView: 'list',
    taskFilters: { q: '', importance: 'all', status: 'all', tag: 'all', sort: 'smart' },
    multiSelect: false,
    selectedTaskIds: [],
    msgFilter: 'all',
    msgQuery: '',
    calMode: 'month',
    calCursor: null,
    quickDraft: '',
    aiParsed: null,
    aiLoading: false,
    aiTimer: null,
    aiValidating: false,
    freeTimeMode: 'choice',
    freeTimeDate: '',
    freeTimeRange: 7,
    pendingApiKey: null,
    pendingConfirm: null,
    lastFocus: null,
    notified: new Set(),
    visionImage: '',
    visionImageName: '',
    visionEvents: [],
    visionLoading: false,
    visionError: '',
    visionController: null
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  /* ============================================================
     2. 基础工具
     ============================================================ */
  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function uid(prefix = 'id') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function icon(name, extra = '') {
    return `<svg class="ico ${extra}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  }

  function toast(message, type = 'info', action = null) {
    const root = $('#toast-root');
    if (!root) return;
    while (root.children.length >= 3) root.firstElementChild.remove();
    const el = document.createElement('div');
    const toastType = ['success', 'error', 'info'].includes(type) ? type : 'info';
    el.className = `toast ${toastType}`;
    const iconName = toastType === 'success' ? 'check' : (toastType === 'error' ? 'alert' : 'info');
    el.innerHTML = `<span class="toast-icon">${icon(iconName)}</span><span class="toast-msg">${esc(message)}</span>`;
    let removed = false;
    const remove = () => {
      if (removed) return;
      removed = true;
      el.classList.add('out');
      setTimeout(() => el.remove(), 220);
    };
    if (action && action.label) {
      const actionButton = document.createElement('button');
      actionButton.type = 'button';
      actionButton.className = 'toast-action';
      actionButton.textContent = action.label;
      actionButton.addEventListener('click', () => {
        try {
          if (typeof action.onClick === 'function') action.onClick();
        } finally {
          remove();
        }
      });
      el.appendChild(actionButton);
    }
    root.appendChild(el);
    setTimeout(remove, 3200);
  }

  function startOfDay(date = new Date()) {
    const d = new Date(date);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function addDays(date, amount) {
    const d = new Date(date);
    d.setDate(d.getDate() + amount);
    return d;
  }

  function addMinutes(date, amount) {
    return new Date(new Date(date).getTime() + amount * 60000);
  }

  function dateKey(date = new Date()) {
    const d = new Date(date);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function fromDateKey(key) {
    const parts = String(key).split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function atTime(day, hours = 23, minutes = 59) {
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes, 0, 0);
  }

  function sameDay(a, b) {
    return dateKey(a) === dateKey(b);
  }

  function dayDiffFromToday(value) {
    const target = startOfDay(new Date(value));
    const today = startOfDay(new Date());
    return Math.round((target - today) / MS_DAY);
  }

  function toDatetimeLocal(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return `${dateKey(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function fromDatetimeLocal(value) {
    if (!value) return '';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
  }

  function weekdayCN(date, style = 'short') {
    const names = style === 'long'
      ? ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
      : ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return names[new Date(date).getDay()];
  }

  function monthDayCN(date) {
    const d = new Date(date);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }

  function friendlyDay(value) {
    if (!value) return '无截止';
    const diff = dayDiffFromToday(value);
    if (diff === 0) return '今天';
    if (diff === 1) return '明天';
    if (diff === 2) return '后天';
    if (diff === -1) return '昨天';
    if (diff === -2) return '前天';
    const d = new Date(value);
    const prefix = d.getFullYear() !== new Date().getFullYear() ? `${d.getFullYear()}年` : '';
    return `${prefix}${d.getMonth() + 1}月${d.getDate()}日 ${weekdayCN(d)}`;
  }

  function dueLabel(task) {
    if (!task || !task.due) return '无截止';
    const d = new Date(task.due);
    const day = friendlyDay(d);
    if (task.dueTimeKnown === false) return day;
    return `${day} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function timeToMinutes(value) {
    const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return 0;
    return Math.max(0, Math.min(23, Number(match[1]))) * 60 + Math.max(0, Math.min(59, Number(match[2])));
  }

  function minutesToTime(value) {
    const total = Math.max(0, Math.min(23 * 60 + 59, Math.round(Number(value) || 0)));
    return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
  }

  function minutesText(value) {
    const total = Math.max(0, Math.round(Number(value) || 0));
    if (total < 60) return `${total} 分钟`;
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    return mins ? `${hours} 小时 ${mins} 分` : `${hours} 小时`;
  }

  function taskTypeMeta(type) {
    return TASK_TYPES[type] || TASK_TYPES.task;
  }

  function routineLabel(task) {
    if (!task || !task.routine) return '';
    const days = Array.isArray(task.routine.days) ? task.routine.days : [];
    if (days.length === 7) return '每天';
    if (days.length === 5 && [1, 2, 3, 4, 5].every(d => days.includes(d))) return '工作日';
    return days.map(d => `周${WEEKDAYS[d] ? WEEKDAYS[d].label : ''}`).join('、') || '未设置日期';
  }

  function taskOccursOn(task, key) {
    if (!task) return false;
    if (task.type !== 'routine') return Boolean(task.due) && dateKey(new Date(task.due)) === key;
    if (!task.routine) return false;
    if (task.routine.from && key < task.routine.from) return false;
    if (task.routine.until && key > task.routine.until) return false;
    return (task.routine.days || []).includes(fromDateKey(key).getDay());
  }

  function taskDoneOn(task, key) {
    if (task.type === 'routine') return Boolean(task.routineDone && task.routineDone[key]);
    return task.status === 'done';
  }

  function taskStartMinute(task) {
    if (task.type === 'routine' && task.routine) return timeToMinutes(task.routine.start);
    if (!task.due) return 24 * 60;
    const d = new Date(task.due);
    return d.getHours() * 60 + d.getMinutes();
  }

  function taskEndMinute(task) {
    if (task.type === 'routine' && task.routine) return timeToMinutes(task.routine.end);
    if (task.type === 'event' && task.end) {
      const end = new Date(task.end);
      return end.getHours() * 60 + end.getMinutes();
    }
    const start = taskStartMinute(task);
    return start + Math.max(30, Number(task.estimate) || 60);
  }

  function eventRangeText(task) {
    if (!task || !task.due) return '';
    const start = new Date(task.due);
    const end = task.end ? new Date(task.end) : null;
    return `${pad2(start.getHours())}:${pad2(start.getMinutes())}${end ? `–${pad2(end.getHours())}:${pad2(end.getMinutes())}` : ''}`;
  }

  function taskScheduleText(task) {
    if (!task) return '';
    if (task.type === 'routine' && task.routine) {
      return `${routineLabel(task)} ${task.routine.start}–${task.routine.end}`;
    }
    if (task.type === 'event') {
      return `${friendlyDay(task.due)} ${eventRangeText(task)}`;
    }
    return task.due ? `截止 ${dueLabel(task)}` : '无截止';
  }

  function taskNextRoutineKey(task, from = new Date()) {
    if (!task || task.type !== 'routine') return '';
    for (let i = 0; i < 14; i += 1) {
      const key = dateKey(addDays(startOfDay(from), i));
      if (taskOccursOn(task, key)) return key;
    }
    return '';
  }

  function taskSortValue(task) {
    if (!task) return Number.MAX_SAFE_INTEGER;
    if (task.type === 'routine') {
      const key = taskNextRoutineKey(task);
      return key ? fromDateKey(key).getTime() + taskStartMinute(task) * 60000 : Number.MAX_SAFE_INTEGER;
    }
    return task.due ? new Date(task.due).getTime() : Number.MAX_SAFE_INTEGER;
  }

  function isDone(task) {
    return task.status === 'done';
  }

  function isOverdue(task) {
    return Boolean(task.due) && !isDone(task) && new Date(task.due).getTime() < Date.now();
  }

  function dueMetaClass(task) {
    if (!task.due || isDone(task)) return '';
    const diff = new Date(task.due).getTime() - Date.now();
    if (diff < 0) return 'due-over';
    if (diff <= 24 * 60 * 60 * 1000) return 'due-soon';
    return '';
  }

  function estimateLabel(minutes) {
    const value = Number(minutes) || 0;
    if (value <= 0) return '';
    if (value < 60) return `${value} 分钟`;
    const hours = value / 60;
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} 小时`;
  }

  function priorityMeta(priority) {
    return PRIORITIES[priority] || PRIORITIES.p3;
  }

  function priorityStyle(priority) {
    const p = priorityMeta(priority);
    return `--p-color:${p.color};--p-soft:${p.soft};`;
  }

  function urgencyMeta(value) {
    return URGENCY_LEVELS[value] || URGENCY_LEVELS.normal;
  }

  function importanceMeta(value) {
    return IMPORTANCE_LEVELS[value] || IMPORTANCE_LEVELS.normal;
  }

  function levelStyle(meta) {
    return `--p-color:${meta.color};--p-soft:${meta.soft};`;
  }

  function effectiveImportance(task) {
    if (IMPORTANCE_LEVELS[task.importance]) return task.importance;
    if (task.priority === 'p1' || task.priority === 'p2') return 'high';
    if (task.priority === 'p4') return 'low';
    return 'normal';
  }

  function autoUrgency(task) {
    if (isDone(task)) return 'low';
    if (task.type === 'routine' && taskDoneOn(task, todayKey())) return 'low';
    let dueMs = Number.NaN;
    if (task.type === 'routine' && task.routine) {
      const key = taskNextRoutineKey(task);
      if (key) {
        const day = fromDateKey(key);
        dueMs = day.getTime() + timeToMinutes(task.routine.start || '09:00') * 60000;
      }
    } else if (task.due) {
      dueMs = new Date(task.due).getTime();
    }
    if (!Number.isFinite(dueMs)) return 'low';
    const diff = dueMs - Date.now();
    if (task.type === 'routine') {
      if (diff <= 2 * 60 * 60 * 1000) return 'high';
      if (diff <= 24 * 60 * 60 * 1000) return 'normal';
      return 'low';
    }
    if (diff <= 24 * 60 * 60 * 1000) return 'high';
    if (diff <= 72 * 60 * 60 * 1000) return 'normal';
    return 'low';
  }

  function effectiveUrgency(task) {
    if (task.urgencySource === 'manual' && URGENCY_LEVELS[task.urgency]) return task.urgency;
    return autoUrgency(task);
  }

  function taskLevelBadges(task, compact = false) {
    const urgency = urgencyMeta(effectiveUrgency(task));
    const importance = importanceMeta(effectiveImportance(task));
    return `
      <span class="level-badges${compact ? ' compact' : ''}">
        <span class="priority-badge urgency-badge" style="${levelStyle(urgency)}" title="紧急度：${urgency.label}">${urgency.label}</span>
        <span class="priority-badge importance-badge" style="${levelStyle(importance)}" title="重要度：${importance.label}">${importance.label}</span>
      </span>`;
  }

  function tagsHTML(tags, max = 3) {
    if (!Array.isArray(tags) || !tags.length) return '';
    const visible = tags.slice(0, max).map(tag => `<span class="tag">${esc(tag)}</span>`).join('');
    const more = tags.length > max ? `<span class="tag">+${tags.length - max}</span>` : '';
    return visible + more;
  }

  function todayKey() {
    return dateKey(new Date());
  }

  function getUnprocessedMessages() {
    return state.messages.filter(m => !m.processed);
  }

  function getTodayTasks() {
    const key = todayKey();
    return state.tasks
      .filter(t => taskOccursOn(t, key))
      .sort((a, b) => {
        const doneDelta = Number(taskDoneOn(a, key)) - Number(taskDoneOn(b, key));
        if (doneDelta !== 0) return doneDelta;
        return taskStartMinute(a) - taskStartMinute(b);
      });
  }

  function getOverdueTasks() {
    const start = startOfDay(new Date()).getTime();
    return state.tasks
      .filter(t => t.type !== 'routine' && t.due && !isDone(t) && new Date(t.due).getTime() < start)
      .sort(taskSortByDue);
  }

  function taskSortByDue(a, b) {
    const av = taskSortValue(a);
    const bv = taskSortValue(b);
    if (av === bv) return 0;
    return av - bv;
  }

  function taskSmartSort(a, b) {
    const doneDelta = Number(isDone(a)) - Number(isDone(b));
    if (doneDelta !== 0) return doneDelta;
    const ua = urgencyMeta(effectiveUrgency(a)).rank;
    const ub = urgencyMeta(effectiveUrgency(b)).rank;
    if (ua !== ub) return ub - ua;
    const ia = importanceMeta(effectiveImportance(a)).rank;
    const ib = importanceMeta(effectiveImportance(b)).rank;
    if (ia !== ib) return ib - ia;
    const av = taskSortValue(a);
    const bv = taskSortValue(b);
    if (av !== bv) return av - bv;
    return String(a.title || '').localeCompare(String(b.title || ''), 'zh-CN');
  }

  function taskSortByPriority(a, b) {
    return taskSmartSort(a, b);
  }

  function completionPct(tasks, key = todayKey()) {
    if (!tasks.length) return 0;
    return Math.round(tasks.filter(t => taskDoneOn(t, key)).length / tasks.length * 100);
  }

  function getMorningChecks() {
    const key = todayKey();
    if (!Array.isArray(state.dayChecks[key]) || state.dayChecks[key].length !== MORNING_ITEMS.length) {
      state.dayChecks[key] = MORNING_ITEMS.map(() => false);
    }
    return state.dayChecks[key];
  }

  function pruneOldChecks() {
    const cutoff = addDays(startOfDay(new Date()), -45);
    Object.keys(state.dayChecks || {}).forEach(key => {
      const d = fromDateKey(key);
      if (d < cutoff) delete state.dayChecks[key];
    });
  }

  function weekStart(date = new Date()) {
    const d = startOfDay(date);
    const day = d.getDay() === 0 ? 7 : d.getDay();
    return addDays(d, -(day - 1));
  }

  function weekKey(date = new Date()) {
    return dateKey(weekStart(date));
  }

  function weekRangeLabel(date = new Date()) {
    const start = weekStart(date);
    const end = addDays(start, 6);
    return `${start.getMonth() + 1}月${start.getDate()}日 – ${end.getMonth() + 1}月${end.getDate()}日`;
  }

  function monthRangeLabel(year, month) {
    const last = new Date(year, month + 1, 0);
    return `${month + 1}月1日 – ${month + 1}月${last.getDate()}日`;
  }

  function getReview() {
    return state.reviews[weekKey()] || '';
  }

  function getStats() {
    const today = startOfDay(new Date());
    const weekBegin = weekStart(new Date());
    const regularTasks = state.tasks.filter(t => t.type !== 'routine');
    const incomplete = regularTasks.filter(t => !isDone(t));
    const completed = regularTasks.filter(isDone);
    const todayTasks = getTodayTasks();
    const thisWeekDone = regularTasks.filter(t => {
      if (!t.completedAt) return false;
      return new Date(t.completedAt) >= weekBegin;
    }).length;
    const pendingMinutes = incomplete.reduce((sum, t) => sum + (Number(t.estimate) || 0), 0);
    const completionRate = regularTasks.length
      ? Math.round(completed.length / regularTasks.length * 100)
      : 0;

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const day = addDays(today, -i);
      const count = state.tasks.filter(t => t.completedAt && dateKey(new Date(t.completedAt)) === dateKey(day)).length;
      days.push({
        date: day,
        key: dateKey(day),
        label: i === 0 ? '今天' : weekdayCN(day),
        count,
        isToday: i === 0
      });
    }

    const distribution = Object.keys(IMPORTANCE_LEVELS).map(key => ({
      key,
      ...IMPORTANCE_LEVELS[key],
      count: incomplete.filter(t => effectiveImportance(t) === key).length
    }));

    return {
      total: regularTasks.length,
      completed: completed.length,
      completionRate,
      thisWeekDone,
      pendingMinutes,
      unread: getUnprocessedMessages().length,
      overdue: incomplete.filter(t => t.due && new Date(t.due).getTime() < Date.now()).length,
      todayTasks,
      todayDone: todayTasks.filter(t => taskDoneOn(t, todayKey())).length,
      days,
      distribution
    };
  }

  function detectConflicts() {
    const active = state.tasks.filter(t => t.due && !isDone(t) && t.dueTimeKnown !== false);
    const groups = new Map();
    active.forEach(task => {
      const key = dateKey(new Date(task.due));
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(task);
    });

    const alerts = [];
    groups.forEach(tasks => {
      tasks.sort(taskSortByDue);
      for (let i = 0; i < tasks.length - 1; i++) {
        const gap = new Date(tasks[i + 1].due) - new Date(tasks[i].due);
        if (gap >= 0 && gap <= 90 * 60 * 1000) {
          alerts.push({
            type: 'overlap',
            date: tasks[i].due,
            gap,
            tasks: [tasks[i], tasks[i + 1]]
          });
        }
      }
      if (tasks.length >= 3 && alerts.length === 0) {
        alerts.push({ type: 'cluster', date: tasks[0].due, tasks: tasks.slice(0, 3) });
      }
    });

    return alerts.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  function getUpcomingDeadlines() {
    const tomorrow = addDays(startOfDay(new Date()), 1);
    const end = addDays(tomorrow, 3);
    return state.tasks
      .filter(t => t.due && !isDone(t) && new Date(t.due) >= tomorrow && new Date(t.due) < end)
      .sort(taskSortByDue);
  }

  function getDueSoon() {
    const now = Date.now();
    return state.tasks
      .filter(t => t.due && !isDone(t))
      .filter(t => {
        const diff = new Date(t.due).getTime() - now;
        return diff >= 0 && diff <= 2 * 60 * 60 * 1000;
      })
      .sort(taskSortByDue);
  }

  function greeting() {
    const hour = new Date().getHours();
    if (hour < 5) return '夜深了';
    if (hour < 11) return '早上好';
    if (hour < 14) return '中午好';
    if (hour < 18) return '下午好';
    return '晚上好';
  }

  function downloadFile(filename, content, mime = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  /* ============================================================
     3. 数据：存取 / 规范化
     ============================================================ */
  function defaultSettings() {
    return {
      ai: {
        enabled: false,
        activeKeyId: '',
        keys: []
      },
      schedule: {
        wake: '07:30',
        sleep: '22:30'
      },
      notifyDueSoon: true,
      browserNotify: false,
      morningChecklist: true
    };
  }

  function createEmptyState() {
    return {
      version: 1,
      tasks: [],
      messages: [],
      settings: defaultSettings(),
      dayChecks: {},
      reviews: {}
    };
  }

  function normalizeApiKey(entry) {
    if (!entry || typeof entry !== 'object') return null;
    const key = String(entry.key || '').trim();
    if (!key) return null;
    const provider = AI_PROVIDERS[entry.provider] ? entry.provider : 'custom';
    const meta = AI_PROVIDERS[provider];
    const endpoint = String(entry.endpoint || meta.base || '').trim();
    const model = String(entry.model || meta.model || '').trim();
    return {
      id: String(entry.id || uid('key')),
      provider,
      label: String(entry.label || meta.label || '自定义通道').slice(0, 60),
      endpoint,
      model,
      key,
      createdAt: entry.createdAt && !Number.isNaN(new Date(entry.createdAt).getTime())
        ? new Date(entry.createdAt).toISOString()
        : new Date().toISOString(),
      lastValidatedAt: entry.lastValidatedAt && !Number.isNaN(new Date(entry.lastValidatedAt).getTime())
        ? new Date(entry.lastValidatedAt).toISOString()
        : null
    };
  }

  function normalizeSettings(raw = {}) {
    const base = defaultSettings();
    const rawAi = raw.ai && typeof raw.ai === 'object' ? raw.ai : {};
    let keys = Array.isArray(rawAi.keys)
      ? rawAi.keys.map(normalizeApiKey).filter(Boolean)
      : [];
    if (!keys.length && rawAi.key) {
      const legacyEndpoint = String(rawAi.endpoint || 'https://api.deepseek.com').replace(/\/chat\/completions\/?$/i, '');
      const legacy = normalizeApiKey({
        id: 'key_legacy',
        provider: /deepseek/i.test(legacyEndpoint) ? 'deepseek' : 'custom',
        endpoint: legacyEndpoint,
        model: rawAi.model || 'deepseek-chat',
        key: rawAi.key,
        label: '已保存的 Key'
      });
      if (legacy) keys = [legacy];
    }
    const activeKeyId = keys.some(k => k.id === rawAi.activeKeyId)
      ? rawAi.activeKeyId
      : (keys[0] ? keys[0].id : '');
    const wake = /^\d{2}:\d{2}$/.test(String(raw.schedule && raw.schedule.wake || ''))
      ? String(raw.schedule.wake)
      : base.schedule.wake;
    const sleep = /^\d{2}:\d{2}$/.test(String(raw.schedule && raw.schedule.sleep || ''))
      ? String(raw.schedule.sleep)
      : base.schedule.sleep;
    return {
      ...base,
      ...raw,
      ai: {
        enabled: Boolean(rawAi.enabled && activeKeyId),
        activeKeyId,
        keys
      },
      schedule: { wake, sleep },
      notifyDueSoon: raw.notifyDueSoon !== false,
      morningChecklist: raw.morningChecklist !== false,
      browserNotify: Boolean(raw.browserNotify)
    };
  }

  function mergeSettings(raw = {}) {
    return normalizeSettings(raw);
  }

  function normalizeTask(task) {
    if (!task || typeof task !== 'object') return null;
    const validPriority = PRIORITIES[task.priority] ? task.priority : 'p3';
    const legacyImportance = (validPriority === 'p1' || validPriority === 'p2')
      ? 'high'
      : (validPriority === 'p4' ? 'low' : 'normal');
    const importance = IMPORTANCE_LEVELS[task.importance] ? task.importance : legacyImportance;
    const hasUrgency = Boolean(URGENCY_LEVELS[task.urgency]);
    const urgency = hasUrgency
      ? task.urgency
      : (validPriority === 'p1' ? 'high' : (validPriority === 'p4' ? 'low' : 'normal'));
    const urgencySource = ['auto', 'manual'].includes(task.urgencySource)
      ? task.urgencySource
      : (hasUrgency ? 'manual' : ((validPriority === 'p1' || validPriority === 'p4') ? 'manual' : 'auto'));
    const validStatus = STATUSES[task.status] ? task.status : 'todo';
    const type = TASK_TYPES[task.type] ? task.type : 'task';
    const dueDate = task.due ? new Date(task.due) : null;
    let due = dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate.toISOString() : '';
    const endDate = task.end ? new Date(task.end) : null;
    let end = endDate && !Number.isNaN(endDate.getTime()) ? endDate.toISOString() : '';
    if (type === 'event' && due && !end) {
      end = new Date(new Date(due).getTime() + (Number(task.estimate) || 60) * 60000).toISOString();
    }
    const timeOK = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''));
    let routine = null;
    let routineDone = {};
    let estimate = Math.max(0, Number(task.estimate) || 0);
    if (type === 'routine') {
      due = '';
      const rawRoutine = task.routine && typeof task.routine === 'object' ? task.routine : {};
      const start = timeOK(rawRoutine.start) ? rawRoutine.start : '07:30';
      let finish = timeOK(rawRoutine.end) ? rawRoutine.end : '08:00';
      if (finish <= start) finish = '08:00';
      const days = Array.isArray(rawRoutine.days)
        ? [...new Set(rawRoutine.days.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6))].sort()
        : [];
      const dateOK = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
      routine = {
        start,
        end: finish,
        days: days.length ? days : [0, 1, 2, 3, 4, 5, 6],
        from: dateOK(rawRoutine.from) ? rawRoutine.from : '',
        until: dateOK(rawRoutine.until) ? rawRoutine.until : ''
      };
      estimate = Math.max(0, timeToMinutes(finish) - timeToMinutes(start));
      const rawDone = task.routineDone && typeof task.routineDone === 'object' ? task.routineDone : {};
      routineDone = Object.keys(rawDone)
        .filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key) && rawDone[key])
        .reduce((acc, key) => { acc[key] = true; return acc; }, {});
    }
    return {
      id: String(task.id || uid('t')),
      type,
      title: String(task.title || '未命名任务').slice(0, 240),
      description: String(task.description || ''),
      due,
      end: type === 'event' ? end : '',
      dueTimeKnown: type === 'routine' ? false : task.dueTimeKnown !== false,
      location: String(task.location || '').slice(0, 160),
      priority: validPriority,
      urgency,
      urgencySource,
      importance,
      status: validStatus,
      tags: Array.isArray(task.tags)
        ? [...new Set(task.tags.map(t => String(t).trim()).filter(Boolean))].slice(0, 12)
        : [],
      estimate,
      routine,
      routineDone,
      subtasks: Array.isArray(task.subtasks)
        ? task.subtasks.map(s => ({
            id: String((s && s.id) || uid('s')),
            title: String((s && s.title) || '').trim(),
            done: Boolean(s && s.done)
          })).filter(s => s.title)
        : [],
      sourceMessageId: task.sourceMessageId ? String(task.sourceMessageId) : null,
      createdAt: task.createdAt && !Number.isNaN(new Date(task.createdAt).getTime())
        ? new Date(task.createdAt).toISOString()
        : new Date().toISOString(),
      completedAt: validStatus === 'done'
        ? (task.completedAt && !Number.isNaN(new Date(task.completedAt).getTime())
            ? new Date(task.completedAt).toISOString()
            : new Date().toISOString())
        : null
    };
  }

  function normalizeMessage(message) {
    if (!message || typeof message !== 'object') return null;
    const type = SOURCE_TYPES[message.sourceType] ? message.sourceType : 'other';
    return {
      id: String(message.id || uid('m')),
      source: String(message.source || '未知来源').slice(0, 100),
      sourceType: type,
      content: String(message.content || ''),
      createdAt: message.createdAt && !Number.isNaN(new Date(message.createdAt).getTime())
        ? new Date(message.createdAt).toISOString()
        : new Date().toISOString(),
      processed: Boolean(message.processed),
      taskId: message.taskId ? String(message.taskId) : null
    };
  }

  function normalizeState(raw) {
    const base = createEmptyState();
    if (!raw || typeof raw !== 'object') return base;
    const tasks = Array.isArray(raw.tasks) ? raw.tasks.map(normalizeTask).filter(Boolean) : [];
    const messages = Array.isArray(raw.messages) ? raw.messages.map(normalizeMessage).filter(Boolean) : [];
    const taskIds = new Set(tasks.map(t => t.id));
    const messageIds = new Set(messages.map(m => m.id));

    tasks.forEach(task => {
      if (task.sourceMessageId && !messageIds.has(task.sourceMessageId)) task.sourceMessageId = null;
    });
    messages.forEach(message => {
      if (message.taskId && !taskIds.has(message.taskId)) message.taskId = null;
    });

    return {
      ...base,
      tasks,
      messages,
      settings: mergeSettings(raw.settings || {}),
      dayChecks: raw.dayChecks && typeof raw.dayChecks === 'object' ? raw.dayChecks : {},
      reviews: raw.reviews && typeof raw.reviews === 'object' ? raw.reviews : {}
    };
  }

  function stripDemoRecords(data) {
    let changed = false;
    const sampleTaskIds = new Set();

    data.tasks = data.tasks.filter(task => {
      if (String(task.id || '').startsWith('t_sample_')) {
        sampleTaskIds.add(task.id);
        changed = true;
        return false;
      }
      return true;
    });

    data.messages = data.messages.filter(message => {
      if (String(message.id || '').startsWith('m_sample_')) {
        changed = true;
        return false;
      }
      return true;
    });

    data.messages.forEach(message => {
      if (message.taskId && sampleTaskIds.has(message.taskId)) {
        message.taskId = null;
        changed = true;
      }
    });

    return changed;
  }

  function loadState() {
    const parsed = AppStorage.loadState();
    if (parsed) {
      try {
        const normalized = normalizeState(parsed);
        if (stripDemoRecords(normalized)) {
          try {
            AppStorage.saveState(normalized);
          } catch (error) {
            storageBroken = true;
            console.warn('清理旧示例数据失败：', error);
          }
        }
        return normalized;
      } catch (error) {
        storageBroken = true;
        console.warn('读取本地数据失败：', error);
      }
    }
    if (!AppStorage.isAvailable()) storageBroken = true;
    isFirstRun = true;
    return createEmptyState();
  }

  function saveState() {
    try {
      AppStorage.saveState(state);
    } catch (error) {
      storageBroken = true;
      console.warn('保存本地数据失败：', error);
    }
  }

  /* ============================================================
     4. 自然语言解析
     ============================================================ */
  function parseNaturalLanguage(rawInput, options = {}) {
    const raw = String(rawInput || '').trim();
    const now = new Date();
    const result = {
      title: '',
      description: options.description || '',
      due: '',
      dueTimeKnown: false,
      priority: 'p3',
      importance: 'normal',
      urgency: 'normal',
      urgencySource: 'auto',
      tags: [],
      estimate: 0,
      raw,
      source: options.source || '快速捕获'
    };
    if (!raw) return result;

    let text = ` ${raw.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ')} `;
    const tags = [];

    // 标签：#课程 或 标签课程 / 标签：课程
    text = text.replace(/#([^\s#，,。；;、/]+)/g, (_, tag) => {
      tags.push(tag);
      return ' ';
    });
    text = text.replace(/(?:标签|分类)\s*[:：]?\s*([^\s,，。；;、/]+)/g, (_, tag) => {
      tags.push(tag);
      return ' ';
    });

    // 时长：半小时 / 1.5 小时 / 90 分钟
    let estimate = 0;
    const halfHour = text.match(/(?:预计|大概|大约|约|需要|耗时)?\s*半\s*个?\s*小时/);
    if (halfHour) {
      estimate = 30;
      text = text.replace(halfHour[0], ' ');
    } else {
      const hourMatch = text.match(/(?:预计|大概|大约|约|需要|耗时)?\s*(\d+(?:\.\d+)?)\s*(?:个)?\s*(?:小时|h(?:ours?)?)/i);
      if (hourMatch) {
        estimate = Math.round(parseFloat(hourMatch[1]) * 60);
        text = text.replace(hourMatch[0], ' ');
      } else {
        const minuteMatch = text.match(/(?:预计|大概|大约|约|需要|耗时)?\s*(\d+)\s*(?:分钟|min(?:utes?)?)/i);
        if (minuteMatch) {
          estimate = parseInt(minuteMatch[1], 10);
          text = text.replace(minuteMatch[0], ' ');
        }
      }
    }
    result.estimate = Math.max(0, Math.min(estimate, 24 * 60));

    // 重要度：用户表达；紧急度默认为自动判断，只有明确说“紧急/马上”才手动覆盖
    if (/(?:非常|特别)?重要(?:且|又)?紧急|十万火急|最高优先/.test(text)) {
      result.importance = 'high';
      result.urgency = 'high';
      result.urgencySource = 'manual';
    }
    if (/紧急|尽快|ddl|截止时间紧|马上|立刻/i.test(text)) {
      result.urgency = 'high';
      result.urgencySource = 'manual';
    }
    if (/非常重要|特别重要|重要|高优先/.test(text)) result.importance = 'high';
    if (/不重要|低优先|有空再/.test(text)) result.importance = 'low';
    if (/不急|不着急|时间宽松/.test(text)) {
      result.urgency = 'low';
      result.urgencySource = 'manual';
    }
    result.priority = result.importance === 'high' ? 'p2' : (result.importance === 'low' ? 'p4' : 'p3');
    if (result.urgency === 'high' && result.urgencySource === 'manual') result.priority = 'p1';
    text = text.replace(/(?:非常|特别)?重要(?:且|又)?紧急|十万火急|最高优先|高优先(?:级)?|非常重要|特别重要|不重要|重要|低优先(?:级)?|不着急|不急|紧急|尽快|立刻|马上|ddl/gi, ' ');

    // 时间：15:00 / 下午 3 点 / 3 点半 / 明晚 8 点
    let timeFound = false;
    let hours = null;
    let minutes = 0;
    let period = '';
    let prefixDayOffset = null;
    const timePrefix = '(凌晨|早上|早晨|上午|中午|下午|傍晚|晚上|今晚|明晚|明早|晚)';

    let timeMatch = text.match(new RegExp(`${timePrefix}?\\s*(\\d{1,2})\\s*[:：]\\s*(\\d{1,2})`));
    if (timeMatch) {
      period = timeMatch[1] || '';
      hours = parseInt(timeMatch[2], 10);
      minutes = parseInt(timeMatch[3], 10);
      timeFound = true;
      text = text.replace(timeMatch[0], ' ');
    } else {
      timeMatch = text.match(new RegExp(`${timePrefix}?\\s*(\\d{1,2})\\s*点\\s*(半|\\d{1,2}\\s*分?)?`));
      if (timeMatch) {
        period = timeMatch[1] || '';
        hours = parseInt(timeMatch[2], 10);
        const minutePart = timeMatch[3] || '';
        if (minutePart === '半') minutes = 30;
        else if (minutePart) minutes = parseInt(minutePart, 10) || 0;
        timeFound = true;
        text = text.replace(timeMatch[0], ' ');
      }
    }

    if (timeFound) {
      if (period === '下午' || period === '傍晚' || period === '晚上' || period === '今晚' || period === '明晚' || period === '晚') {
        if (hours < 12) hours += 12;
      } else if (period === '中午') {
        if (hours < 11) hours += 12;
      } else if (period === '凌晨') {
        if (hours === 12) hours = 0;
      }
      if (hours === 24) hours = 0;
      if (hours > 23) hours = 23;
      if (minutes > 59) minutes = 59;
      if (period === '今晚') prefixDayOffset = 0;
      if (period === '明晚' || period === '明早') prefixDayOffset = 1;
    }

    // 日期：相对日期、星期、绝对日期
    let dateFound = false;
    let dateObject = null;
    let offset = null;
    const relMatch = text.match(/(大后天|后天|明天|明日|明早|明晚|今天|今日|今晚)/);
    if (relMatch) {
      const map = { 大后天: 3, 后天: 2, 明天: 1, 明日: 1, 明早: 1, 明晚: 1, 今天: 0, 今日: 0, 今晚: 0 };
      offset = map[relMatch[1]];
      dateObject = addDays(startOfDay(now), offset);
      dateFound = true;
      text = text.replace(relMatch[0], ' ');
    } else {
      const weekMatch = text.match(/(下下|下|本|这)?\s*(?:周|星期|礼拜)\s*([一二三四五六日天])/);
      if (weekMatch) {
        const weekdayMap = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7 };
        const target = weekdayMap[weekMatch[2]];
        const current = now.getDay() === 0 ? 7 : now.getDay();
        let diff = target - current;
        if (weekMatch[1] === '下') diff += 7;
        if (weekMatch[1] === '下下') diff += 14;
        if (!weekMatch[1] && diff < 0) diff += 7;
        if (!weekMatch[1] && diff === 0 && timeFound) {
          const candidate = atTime(now, hours, minutes);
          if (candidate.getTime() <= now.getTime()) diff += 7;
        }
        dateObject = addDays(startOfDay(now), diff);
        dateFound = true;
        text = text.replace(weekMatch[0], ' ');
      } else {
        const fullDate = text.match(/(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})\s*[日号]?/);
        const shortDate = fullDate ? null : text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]?/);
        if (fullDate) {
          dateObject = new Date(parseInt(fullDate[1], 10), parseInt(fullDate[2], 10) - 1, parseInt(fullDate[3], 10));
          dateFound = true;
          text = text.replace(fullDate[0], ' ');
        } else if (shortDate) {
          dateObject = new Date(now.getFullYear(), parseInt(shortDate[1], 10) - 1, parseInt(shortDate[2], 10));
          dateFound = true;
          text = text.replace(shortDate[0], ' ');
        }
      }
    }

    let finalDate = null;
    let dueKnown = false;
    if (dateFound && dateObject) {
      finalDate = atTime(dateObject, timeFound ? hours : 23, timeFound ? minutes : 59);
      dueKnown = Boolean(timeFound);
    } else if (timeFound) {
      const baseOffset = prefixDayOffset == null ? 0 : prefixDayOffset;
      let candidate = atTime(addDays(startOfDay(now), baseOffset), hours, minutes);
      if (prefixDayOffset == null && candidate.getTime() <= now.getTime()) {
        candidate = addDays(candidate, 1);
      }
      finalDate = candidate;
      dueKnown = true;
    } else if (prefixDayOffset != null) {
      finalDate = atTime(addDays(startOfDay(now), prefixDayOffset), 23, 59);
      dueKnown = false;
    } else if (dateFound && !dateObject && offset != null) {
      finalDate = atTime(addDays(startOfDay(now), offset), 23, 59);
      dueKnown = false;
    }

    if (finalDate) {
      result.due = finalDate.toISOString();
      result.dueTimeKnown = dueKnown;
    }

    // 清理标题残留
    let title = text
      .replace(/(?:帮我|提醒我|记得|请务必|麻烦|请在|要在)\s*/g, ' ')
      .replace(/(?:截止时间|截止日期|截止|ddl)\s*/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (timeFound) {
      title = title.replace(/^[前之]\s*/, ' ');
    }
    title = title
      .replace(/^[\s,，。；;、:：\-—~～·]+/, '')
      .replace(/[\s,，。；;、:：\-—~～·]+$/, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!title) title = raw.replace(/\s+/g, ' ').slice(0, 60);
    result.title = title.slice(0, 120);
    result.tags = [...new Set(tags.map(tag => tag.replace(/[。；;，,、]$/g, '').trim()).filter(Boolean))].slice(0, 6);
    return result;
  }

  function messageTaskTitle(raw) {
    let text = String(raw || '')
      .replace(/【[^】]*】/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) return '未命名任务';

    text = text.replace(/^[^：:]{0,16}(?:通知|提醒|公告)\s*[：:]\s*/, '');
    let title = text.split(/[。！？!?\n]/)[0].trim();
    const colonIndex = title.search(/[：:](?!\d)/);
    if (colonIndex > 3) title = title.slice(0, colonIndex).trim();

    title = title
      .replace(/^(?:关于|通知|提醒|公告|转达)\s*/, '')
      .replace(/^(?:请(?:于|在)?|记得|务必|麻烦|劳烦)\s*/, '')
      .replace(/^(?:(?:本|这|下下|下)?(?:周|星期|礼拜)[一二三四五六日天]?|今天|今日|明天|明日|后天|大后天)?\s*(?:凌晨|早上|早晨|上午|中午|下午|傍晚|晚上|今晚|明晚|明早|晚)?\s*(?:\d{1,2}\s*[:：]\s*\d{1,2}|\d{1,2}\s*[点时]\s*(?:半|\d{1,2}\s*分?)?)?\s*(?:之前|前)?\s*/, '')
      .replace(/^(?:请|记得|务必|麻烦|劳烦)\s*/, '')
      .replace(/^(?:召开|举行|举办|组织|参加)\s*/, '')
      .replace(/(?:的)?(?:通知|提醒|公告)$/g, '')
      .trim();

    const commaIndex = title.search(/[，,；;]/);
    if (commaIndex > 3) title = title.slice(0, commaIndex).trim();

    const cutIndex = title.search(/(?:截止|到期|(?<!申)请|记得|务必|需要|要求|预计|标签|分类)/);
    if (cutIndex > 3) title = title.slice(0, cutIndex).trim();
    title = title
      .replace(/(?:这|本|下)?(?:周|星期)(?:内|前)?$/g, '')
      .replace(/(?:这|本|下)?(?:周|星期)?(?:内|前)?(?:截止|到期)$/g, '')
      .replace(/(?:已|已经)?(?:收到|查收|完成)$/g, '')
      .replace(/^[\s,，。；;、:：\-—~～·]+/, '')
      .replace(/[\s,，。；;、:：\-—~～·]+$/, '')
      .replace(/\s+/g, ' ')
      .trim();

    return (title || text.replace(/\s+/g, ' ').trim()).slice(0, 60);
  }

  function normalizeAIParsed(obj, fallback) {
    if (!obj || typeof obj !== 'object') return fallback;
    const merged = { ...fallback };
    if (obj.title && String(obj.title).trim()) merged.title = String(obj.title).trim().slice(0, 120);
    if (IMPORTANCE_LEVELS[obj.importance]) merged.importance = obj.importance;
    else if (obj.priority && PRIORITIES[obj.priority]) {
      merged.importance = (obj.priority === 'p1' || obj.priority === 'p2') ? 'high' : (obj.priority === 'p4' ? 'low' : 'normal');
    }
    if (URGENCY_LEVELS[obj.urgency]) {
      merged.urgency = obj.urgency;
      merged.urgencySource = 'manual';
    } else if (obj.urgency === 'auto') {
      merged.urgencySource = 'auto';
    }
    merged.priority = merged.importance === 'high' ? 'p2' : (merged.importance === 'low' ? 'p4' : 'p3');
    if (merged.urgencySource === 'manual' && merged.urgency === 'high') merged.priority = 'p1';
    if (obj.estimate != null) merged.estimate = Math.max(0, Math.min(24 * 60, Number(obj.estimate) || 0));
    if (Array.isArray(obj.tags)) {
      merged.tags = [...new Set(obj.tags.map(t => String(t).trim()).filter(Boolean))].slice(0, 6);
    }
    if (obj.description) merged.description = String(obj.description);
    if (obj.due) {
      const due = new Date(obj.due);
      if (!Number.isNaN(due.getTime())) {
        merged.due = due.toISOString();
        merged.dueTimeKnown = true;
      }
    }
    return merged;
  }

  function getActiveAIKey(settings = state.settings) {
    if (!settings || !settings.ai) return null;
    return (settings.ai.keys || []).find(k => k.id === settings.ai.activeKeyId)
      || (settings.ai.keys || [])[0]
      || null;
  }

  function chatEndpointFor(entry) {
    if (!entry) return '';
    const endpoint = String(entry.endpoint || '').trim().replace(/\/+$/, '');
    if (!endpoint) return '';
    if (/\/chat\/completions$/i.test(endpoint)) return endpoint;
    return `${endpoint}/chat/completions`;
  }

  function modelsEndpointFor(entry) {
    if (!entry) return '';
    const endpoint = String(entry.endpoint || '').trim().replace(/\/+$/, '');
    if (!endpoint) return '';
    if (/\/chat\/completions$/i.test(endpoint)) return endpoint.replace(/\/chat\/completions$/i, '/models');
    return `${endpoint}/models`;
  }

  function maskApiKey(key) {
    const value = String(key || '');
    if (value.length <= 8) return `${value.slice(0, 2)}••••`;
    return `${value.slice(0, 3)}••••••••${value.slice(-4)}`;
  }

  async function runAIParse(options = {}) {
    const silent = Boolean(options.silent);
    const input = $('#quick-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) {
      if (!silent) toast('先写下一点什么，再让 AI 帮你解析', 'info');
      if (!silent) input.focus();
      return;
    }
    const config = getActiveAIKey();
    if (!state.settings.ai.enabled || !config) {
      if (!silent) {
        toast('AI 增强没有打开，或还没有可用的 API Key', 'info', {
          label: '去设置',
          onClick: () => { location.hash = 'settings'; }
        });
      }
      return;
    }
    if (ui.aiLoading) return;
    ui.aiLoading = true;
    updateCapturePreview();
    const localParsed = parseNaturalLanguage(text);
    try {
      const response = await fetch(chatEndpointFor(config), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.key.trim()}`
        },
        body: JSON.stringify({
          model: config.model || 'deepseek-chat',
          temperature: 0.1,
          messages: [
            {
              role: 'system',
              content: '你是一个中文任务解析助手。只输出 JSON，不要输出 Markdown 代码块或解释。字段必须为：title 字符串、due ISO8601 字符串或空字符串、importance 为 high/normal/low 之一、urgency 为 high/normal/low 之一、tags 字符串数组、estimate 分钟数字、description 字符串。当前时间：' + new Date().toISOString() + '，时区 Asia/Shanghai。importance 表示任务本身的重要程度（high=重要，normal=普通，low=较低），默认 normal；urgency 表示时间上的紧急程度，请结合截止时间、预计耗时和任务复杂度判断，不要只按天数机械判断。'
            },
            { role: 'user', content: text }
          ]
        })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      let content = data && data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : '';
      content = String(content).replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
      const parsed = normalizeAIParsed(JSON.parse(content), localParsed);
      if (!input.value.trim() || input.value.trim() === text) {
        ui.aiParsed = { text, data: parsed };
      }
      if (!silent) toast('AI 已识别任务要素，确认后即可捕获', 'success');
    } catch (error) {
      console.warn('AI 解析失败：', error);
      if (!silent) {
        ui.aiParsed = null;
        toast('AI 解析失败，已保留本地规则解析结果', 'error');
      }
    } finally {
      ui.aiLoading = false;
      updateCapturePreview();
    }
  }

  function queueAIQuickParse() {
    if (ui.aiTimer) clearTimeout(ui.aiTimer);
    const input = $('#quick-input');
    if (!input || !state.settings.ai.enabled || !getActiveAIKey()) return;
    const text = input.value.trim();
    if (text.length < 6) return;
    if (ui.aiParsed && ui.aiParsed.text === text) return;
    ui.aiTimer = setTimeout(() => {
      const current = $('#quick-input');
      if (!current || current.value.trim() !== text) return;
      runAIParse({ silent: true });
    }, 1100);
  }

  /* ============================================================
     5. 通用渲染与 chrome
     ============================================================ */
  function pageHead(eyebrow, title, subtitle, actions = '') {
    return `
      <div class="page-head">
        <div>
          <div class="eyebrow">${eyebrow}</div>
          <h1>${title}</h1>
          ${subtitle ? `<p class="page-sub">${subtitle}</p>` : ''}
        </div>
        <div class="head-actions">${actions}</div>
      </div>`;
  }

  function newTaskButton(label = '新建任务') {
    return `<button class="btn btn-primary" data-action="new-task">${icon('plus')}<span class="btn-label">${label}</span></button>`;
  }

  function emptyState(title, description, action = '') {
    return `
      <div class="empty">
        <div class="empty-orb">${icon('coffee')}</div>
        <strong>${esc(title)}</strong>
        <p>${esc(description)}</p>
        ${action}
      </div>`;
  }

  function renderParsePreview(parsed, raw, isAI = false) {
    if (!raw || !raw.trim()) {
      return `<span class="preview-label">自动识别</span><span class="parse-chip">时间 · 重要度 · 紧急度 · 时长 · 标签</span>`;
    }
    const temp = {
      due: parsed.due,
      type: 'task',
      status: 'todo',
      importance: parsed.importance,
      urgency: parsed.urgency,
      urgencySource: parsed.urgencySource
    };
    const importance = importanceMeta(effectiveImportance(temp));
    const urgency = urgencyMeta(effectiveUrgency(temp));
    return `
      <span class="preview-label">${isAI ? 'AI 识别' : '识别为'}</span>
      <span class="parse-chip title-chip" title="${esc(parsed.title)}">${esc(parsed.title)}</span>
      <span class="parse-chip">${icon('clock')}${parsed.due ? esc(dueLabel(parsed)) : '无截止'}</span>
      <span class="parse-chip" style="${levelStyle(urgency)}">${icon('flame')}急 ${urgency.label}</span>
      <span class="parse-chip" style="${levelStyle(importance)}">${icon('target')}重 ${importance.label}</span>
      ${parsed.estimate ? `<span class="parse-chip">${icon('clock')}${estimateLabel(parsed.estimate)}</span>` : ''}
      ${parsed.tags.map(tag => `<span class="parse-chip">#${esc(tag)}</span>`).join('')}
    `;
  }

  function updateCapturePreview() {
    const input = $('#quick-input');
    const preview = $('#capture-preview');
    if (!input || !preview) return;
    const rawness = input.value;
    ui.quickDraft = rawness;
    let parsed;
    let isAI = false;
    if (ui.aiParsed && ui.aiParsed.text === rawness.trim()) {
      parsed = ui.aiParsed.data;
      isAI = true;
    } else {
      parsed = parseNaturalLanguage(rawness);
    }
    preview.innerHTML = renderParsePreview(parsed, rawness, isAI);
    const toggle = $('[data-action="toggle-ai-quick"]');
    if (toggle) {
      toggle.classList.toggle('on', state.settings.ai.enabled);
      toggle.setAttribute('aria-checked', String(state.settings.ai.enabled));
      toggle.disabled = ui.aiLoading;
    }
    const label = $('.ai-toggle-label');
    if (label) label.classList.toggle('is-loading', ui.aiLoading);
  }

  function updateChrome() {
    const page = ui.page;
    $$('[data-nav]').forEach(el => {
      el.classList.toggle('active', el.dataset.nav === page);
      if (el.dataset.nav === page) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    });

    const activeTasks = state.tasks.filter(t => !isDone(t)).length;
    const unread = getUnprocessedMessages().length;
    $$('[data-badge="tasks"]').forEach(el => {
      el.textContent = activeTasks > 99 ? '99+' : String(activeTasks);
      el.classList.toggle('hidden', activeTasks === 0);
    });
    $$('[data-badge="messages"]').forEach(el => {
      el.textContent = unread > 99 ? '99+' : String(unread);
      el.classList.toggle('hidden', unread === 0);
    });

    const today = getTodayTasks();
    const pct = completionPct(today);
    const pctEl = $('#side-progress-pct');
    const barEl = $('#side-progress-bar');
    const textEl = $('#side-progress-text');
    if (pctEl) pctEl.textContent = `${pct}%`;
    if (barEl) barEl.style.width = `${pct}%`;
    if (textEl) {
      textEl.textContent = today.length
        ? `今天已完成 ${today.filter(isDone).length} / ${today.length} 件，保持自己的节奏。`
        : '今天没有硬性截止，适合推进长期目标。';
    }

    document.title = `${PAGES[page] ? PAGES[page].title : '今日'} · 拾光`;
  }

  /* ============================================================
     6. 今日页
     ============================================================ */
  function renderDeadlineItem(task) {
    const d = new Date(task.due);
    const urgency = urgencyMeta(effectiveUrgency(task));
    const importance = importanceMeta(effectiveImportance(task));
    return `
      <div class="deadline-item" style="${levelStyle(urgency)}">
        <div class="date-tile">
          <strong>${d.getDate()}</strong>
          <span>${weekdayCN(d)}</span>
        </div>
        <div class="deadline-main">
          <button class="deadline-title" data-action="edit-task" data-id="${esc(task.id)}">${esc(task.title)}</button>
          <div class="deadline-meta">
            <span class="deadline-dot"></span>
            <span class="deadline-time">${esc(friendlyDay(d))} · ${pad2(d.getHours())}:${pad2(d.getMinutes())}</span>
            <span style="color:${urgency.color};">急 ${urgency.label}</span>
            <span style="color:${importance.color};">重 ${importance.label}</span>
          </div>
        </div>
      </div>`;
  }

  function renderMessageMini(message) {
    const type = SOURCE_TYPES[message.sourceType] || SOURCE_TYPES.other;
    return `
      <button class="msg-mini" data-action="open-messages" style="text-align:left;width:100%;">
        <span class="msg-source-icon ${type.className}">${type.mark}</span>
        <span class="msg-mini-main">
          <span class="msg-mini-source"><strong>${esc(message.source)}</strong><span>${esc(shortMessageTime(message.createdAt))}</span></span>
          <span class="msg-mini-text">${esc(message.content)}</span>
        </span>
      </button>`;
  }

  function shortMessageTime(value) {
    const d = new Date(value);
    if (sameDay(d, new Date())) return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  function renderConflictPanel() {
    const conflicts = detectConflicts().slice(0, 2);
    if (!conflicts.length) return '';
    return `
      <section class="panel alert-panel" style="grid-column:1;">
        <div class="panel-head">
          <div class="panel-title">
            <span class="panel-icon">${icon('alert')}</span>
            <div>
              <h3>时间冲突提醒</h3>
              <div class="panel-sub">提前看见，才能从容安排</div>
            </div>
          </div>
        </div>
        <div class="alert-list">
          ${conflicts.map(conflict => {
            const gapMinutes = Math.max(0, Math.round((new Date(conflict.tasks[1].due) - new Date(conflict.tasks[0].due)) / 60000));
            const desc = conflict.type === 'cluster'
              ? `<strong>${esc(friendlyDay(conflict.date))}</strong> 截止任务比较密集，建议提前排序。`
              : `<strong>${esc(friendlyDay(conflict.date))}</strong> 两个截止时间仅相隔 <strong>${gapMinutes} 分钟</strong>，留出的缓冲可能不够。`;
            return `
              <div class="alert-item">
                <span class="alert-mark"></span>
                <div class="alert-body">
                  ${desc}
                  <div class="alert-tasks">
                    ${conflict.tasks.map(t => `<button class="alert-task-chip" data-action="edit-task" data-id="${esc(t.id)}">${esc(t.title)}</button>`).join('')}
                  </div>
                </div>
              </div>`;
          }).join('')}
        </div>
      </section>`;
  }

  function renderToday() {
    const now = new Date();
    const key = todayKey();
    const todayTasks = getTodayTasks();
    const overdue = getOverdueTasks();
    const todayDone = todayTasks.filter(t => taskDoneOn(t, key)).length;
    const pct = completionPct(todayTasks, key);
    const unread = getUnprocessedMessages().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const upcoming = getUpcomingDeadlines();
    const dueSoon = getDueSoon();
    const checks = getMorningChecks();
    const checkedCount = checks.filter(Boolean).length;
    const conflicts = detectConflicts();
    const focusTasks = [...overdue, ...todayTasks]
      .filter((task, index, arr) => arr.findIndex(t => t.id === task.id) === index)
      .sort((a, b) => {
        const aDone = taskDoneOn(a, key);
        const bDone = taskDoneOn(b, key);
        if (aDone !== bDone) return aDone ? 1 : -1;
        return taskSortByDue(a, b);
      });
    const todayIncomplete = todayTasks.filter(t => !taskDoneOn(t, key)).length;
    const heroLine = todayTasks.length
      ? `今天有 <strong>${todayIncomplete}</strong> 件待完成${overdue.length ? `，另有 <strong>${overdue.length}</strong> 件逾期` : '，整体节奏还不错'}。`
      : (overdue.length ? `有 <strong>${overdue.length}</strong> 件任务已经逾期，先处理最要紧的一件。` : '没有硬性截止，适合推进长期目标或留一点空白。');
    const ringDash = Math.max(0, Math.min(100, pct)) / 100 * RING_CIRCUMFERENCE;

    return `
      <div class="page today-page">
        ${pageHead(
          `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 · ${weekdayCN(now, 'long')}`,
          `${greeting()}，<em>今天也从容一点</em>`,
          '把任务、DDL 和消息放在同一个视线里，少一点遗忘，多一点掌控。',
          `<button class="icon-btn" data-action="request-notification" title="开启提醒" aria-label="开启提醒">${icon('bell')}</button>${newTaskButton()}`
        )}

        <section class="today-hero">
          <div class="hero-copy">
            <div class="hero-kicker"><span class="dot"></span> TODAY FOCUS · 今日焦点</div>
            <h2 class="hero-title">把重要的事，<br><em>先放进今天</em></h2>
            <p class="hero-desc">${heroLine} 不用一次完成所有事情，先完成下一步就好。</p>
            <div class="hero-meta">
              <span class="hero-chip">${icon('list')}<strong>${todayTasks.length}</strong> 项今日任务</span>
              <span class="hero-chip">${icon('inbox')}<strong>${unread.length}</strong> 条未处理消息</span>
              ${conflicts.length ? `<span class="hero-chip warn">${icon('alert')}<strong>${conflicts.length}</strong> 个时间冲突</span>` : `<span class="hero-chip">${icon('check')}节奏清晰</span>`}
            </div>
          </div>
          <div class="hero-progress">
            <div class="ring-wrap">
              <svg viewBox="0 0 132 132" aria-hidden="true">
                <circle class="ring-track" cx="66" cy="66" r="${RING_RADIUS}"></circle>
                <circle class="ring-value" cx="66" cy="66" r="${RING_RADIUS}" pathLength="100" stroke-dasharray="${pct} 100"></circle>
              </svg>
              <div class="ring-center">
                <strong>${pct}<small>%</small></strong>
                <span>今日进度</span>
              </div>
            </div>
            <div class="ring-foot"><strong>${todayDone} / ${todayTasks.length}</strong> 项已完成</div>
          </div>
          <div class="hero-dots"></div>
        </section>

        <section class="capture-card" id="quick-capture">
          <div class="capture-main">
            <span class="capture-spark">${icon('sparkles')}</span>
            <form class="quick-form" data-form="quick-capture">
              <label class="sr-only" for="quick-input">快速捕获任务</label>
              <input class="quick-input" id="quick-input" name="quick" value="${esc(ui.quickDraft)}" autocomplete="off" placeholder="试试：明天下午3点交高数作业，重要，预计2小时，标签课程">
              <button class="capture-btn" type="submit">${icon('plus')}捕获</button>
            </form>
          </div>
          <div class="capture-bottom">
            <div class="capture-preview" id="capture-preview"></div>
            <div class="capture-tools">
              <button class="vision-trigger" type="button" data-action="open-vision" title="上传日程表截图，智能识别为任务">${icon('image')}识图导入</button>
              <span class="tool-divider"></span>
              <span class="ai-toggle-label">${icon('sparkles')}AI 增强</span>
              <button class="toggle toggle-sm ${state.settings.ai.enabled ? 'on' : ''}" type="button" data-action="toggle-ai-quick" role="switch" aria-checked="${state.settings.ai.enabled}" aria-label="快速捕获时启用 AI 增强"></button>
            </div>
          </div>
          <div class="example-row" style="padding:8px 3px 0 47px;">
            <span class="example-label">试试：</span>
            <button class="example-btn" data-action="use-example" data-example="明天下午3点交高数作业，重要，预计2小时，标签课程">明天下午3点交高数作业…</button>
            <button class="example-btn" data-action="use-example" data-example="周五晚8点前提交比赛报名表，紧急，标签比赛">周五晚8点提交比赛报名…</button>
            <button class="example-btn" data-action="use-example" data-example="下周一上午10点小组汇报，预计90分钟，标签课程">下周一上午10点小组汇报…</button>
          </div>
        </section>

        ${dueSoon.length ? `
          <div class="reminder-strip">
            <span class="reminder-icon">${icon('bell')}</span>
            <div><strong>接下来 2 小时有 ${dueSoon.length} 个截止：</strong> <span>${dueSoon.slice(0, 2).map(t => esc(t.title)).join('、')}${dueSoon.length > 2 ? ' 等' : ''}。现在开始还来得及。</span></div>
            <button class="link-btn reminder-action" data-action="edit-task" data-id="${esc(dueSoon[0].id)}">查看 ${icon('arrow-right')}</button>
          </div>` : ''}

        <div class="dash-grid">
          <div class="stack">
            <section class="panel today-panel">
              <div class="panel-head">
                <div class="panel-title">
                  <span class="panel-icon">${icon('sun')}</span>
                  <div>
                    <h3>今日聚焦</h3>
                    <div class="panel-sub">${todayTasks.length ? `今日 ${todayTasks.length} 项 · 已完成 ${todayDone} 项` : '今天没有设定 DDL'}</div>
                  </div>
                </div>
                <a class="link-btn" href="#tasks">全部任务 ${icon('arrow-right')}</a>
              </div>
              ${focusTasks.length ? `<div class="task-list">${focusTasks.map(t => renderTaskRow(t)).join('')}</div>` : emptyState('今天还是一张白纸', '从上面的输入框捕获一件小事，或者给自己留一点休息。', `<button class="btn btn-soft btn-sm" data-action="new-task">${icon('plus')}添加今日任务</button>`)}
            </section>

            ${state.settings.morningChecklist ? `
              <section class="panel morning-panel">
                <div class="panel-head">
                  <div class="panel-title">
                    <span class="panel-icon">${icon('sunrise')}</span>
                    <div>
                      <h3>每日晨间清单</h3>
                      <div class="panel-sub">用 2 分钟，把今天安顿好</div>
                    </div>
                  </div>
                  <span class="count-badge">${checkedCount}/${MORNING_ITEMS.length}</span>
                </div>
                <div class="checklist">
                  ${MORNING_ITEMS.map((item, index) => `
                    <div class="check-item ${checks[index] ? 'done' : ''}">
                      <button class="check-box ${checks[index] ? 'checked' : ''}" data-action="toggle-checklist" data-index="${index}" aria-label="${checks[index] ? '取消完成' : '标记完成'}：${esc(item)}" aria-pressed="${Boolean(checks[index])}">${icon('check')}</button>
                      <span>${esc(item)}</span>
                    </div>`).join('')}
                </div>
                <div class="checklist-foot">
                  <span>${checkedCount === MORNING_ITEMS.length ? '今日晨间准备完成 ✦' : '完成后，今天会更有方向。'}</span>
                  <span class="mini-meter"><span style="width:${checkedCount / MORNING_ITEMS.length * 100}%"></span></span>
                </div>
              </section>` : ''}
          </div>

          <div class="stack">
            ${renderConflictPanel()}
            <section class="panel ddl-panel">
              <div class="panel-head">
                <div class="panel-title">
                  <span class="panel-icon">${icon('calendar')}</span>
                  <div>
                    <h3>未来 3 天 DDL</h3>
                    <div class="panel-sub">提前看到，才好安排</div>
                  </div>
                </div>
                <a class="link-btn" href="#calendar">日历 ${icon('arrow-right')}</a>
              </div>
              ${upcoming.length ? `<div class="deadline-list">${upcoming.slice(0, 5).map(renderDeadlineItem).join('')}</div>` : `<div class="empty compact inline"><div class="empty-orb">${icon('coffee')}</div><strong>未来三天很清爽</strong><p>没有新的 DDL，适合推进自己的长期计划。</p></div>`}
            </section>

            <section class="panel messages-panel">
              <div class="panel-head">
                <div class="panel-title">
                  <span class="panel-icon">${icon('inbox')}</span>
                  <div>
                    <h3>未处理消息</h3>
                    <div class="panel-sub">${unread.length ? `${unread.length} 条消息等待处理` : '收件箱已经清空'}</div>
                  </div>
                </div>
                <a class="link-btn" href="#messages">收件箱 ${icon('arrow-right')}</a>
              </div>
              ${unread.length ? `<div class="msg-mini-list">${unread.slice(0, 3).map(renderMessageMini).join('')}</div>` : `<div class="empty compact inline"><div class="empty-orb">${icon('check')}</div><strong>消息都处理完了</strong><p>新的群通知、邮件和待办可以随时粘贴进来。</p></div>`}
            </section>
          </div>
        </div>
      </div>`;
  }

  /* ============================================================
     7. 任务页：列表 / 看板 / 四象限
     ============================================================ */
  function getFilteredTasks(ignoreStatus = false) {
    const filters = ui.taskFilters;
    const q = filters.q.trim().toLowerCase();
    let tasks = state.tasks.slice();

    if (q) {
      tasks = tasks.filter(task =>
        task.title.toLowerCase().includes(q) ||
        task.description.toLowerCase().includes(q) ||
        task.tags.some(tag => tag.toLowerCase().includes(q))
      );
    }
    if (filters.importance !== 'all') {
      tasks = tasks.filter(task => effectiveImportance(task) === filters.importance);
    }
    if (filters.tag !== 'all') {
      tasks = tasks.filter(task => task.tags.includes(filters.tag));
    }
    if (!ignoreStatus) {
      if (filters.status === 'active') tasks = tasks.filter(task => !isDone(task));
      if (filters.status === 'done') tasks = tasks.filter(isDone);
    }

    tasks.sort(taskSmartSort);
    return tasks;
  }

  function renderTaskRow(task, options = {}) {
    const typeMeta = taskTypeMeta(task.type);
    const occurrenceKey = task.type === 'routine' ? taskNextRoutineKey(task) : '';
    const done = task.type === 'routine'
      ? Boolean(occurrenceKey && taskDoneOn(task, occurrenceKey))
      : isDone(task);
    const urgency = urgencyMeta(effectiveUrgency(task));
    const subtasks = task.subtasks || [];
    const doneSubtasks = subtasks.filter(s => s.done).length;
    const selecting = ui.page === 'tasks' && ui.multiSelect && !options.disableSelect;
    const selected = selecting && ui.selectedTaskIds.includes(task.id);
    const sourceMessage = task.sourceMessageId
      ? state.messages.find(m => m.id === task.sourceMessageId)
      : null;
    return `
      <div class="task-row priority-edge ${done ? 'is-done' : ''} ${selected ? 'is-selected' : ''} type-${esc(task.type || 'task')}" style="${levelStyle(urgency)}" data-task-row="${esc(task.id)}">
        ${selecting ? `
          <label class="task-select-wrap" title="选择任务">
            <input type="checkbox" class="task-select" data-task-select="${esc(task.id)}" ${selected ? 'checked' : ''} aria-label="选择任务：${esc(task.title)}">
          </label>` : `
          <button class="task-check ${done ? 'checked' : ''}" data-action="toggle-task" data-id="${esc(task.id)}" ${occurrenceKey ? `data-date="${esc(occurrenceKey)}"` : ''} aria-label="${done ? '标记为未完成' : '标记为已完成'}" aria-pressed="${done}">
            ${icon('check')}
          </button>`}
        <div class="task-main">
          ${selecting
            ? `<span class="task-title">${esc(task.title)}</span>`
            : `<button class="task-title" data-action="edit-task" data-id="${esc(task.id)}">${esc(task.title)}</button>`}
          <div class="task-meta">
            <span class="type-chip type-${esc(task.type || 'task')}" style="--type-color:${typeMeta.color};--type-soft:${typeMeta.soft};">${icon(typeMeta.icon)}${typeMeta.short}</span>
            <span class="meta-item ${dueMetaClass(task)}">${icon(task.type === 'routine' ? 'refresh' : 'clock')}${esc(taskScheduleText(task))}</span>
            ${task.type === 'event' && task.location ? `<span class="meta-item">${icon('pin')}${esc(task.location)}</span>` : ''}
            ${task.estimate && task.type !== 'routine' ? `<span class="meta-item">${icon('target')}${estimateLabel(task.estimate)}</span>` : ''}
            ${tagsHTML(task.tags, options.maxTags || 3)}
            ${sourceMessage ? `<span class="source-note">${icon('inbox')}来自消息</span>` : ''}
          </div>
          ${subtasks.length ? `
            <div class="subtask-line">
              <div class="sub-progress"><span style="width:${Math.round(doneSubtasks / subtasks.length * 100)}%"></span></div>
              <span>${doneSubtasks}/${subtasks.length} 个子任务</span>
            </div>` : ''}
        </div>
        ${taskLevelBadges(task, true)}
        ${selecting ? '' : `
        <div class="task-side">
          <button class="icon-btn" data-action="edit-task" data-id="${esc(task.id)}" title="编辑任务" aria-label="编辑任务">${icon('edit')}</button>
          ${options.hideDelete ? '' : `<button class="icon-btn danger" data-action="delete-task" data-id="${esc(task.id)}" title="删除任务" aria-label="删除任务">${icon('trash')}</button>`}
        </div>`}
      </div>`;
  }

  function renderTaskList() {
    const tasks = getFilteredTasks();
    if (!tasks.length) {
      return `<div class="list-panel">${emptyState(
        '没有找到匹配的任务',
        '换一个关键词，或清除筛选条件看看全部任务。',
        `<button class="btn btn-soft btn-sm" data-action="clear-task-filters">${icon('refresh')}清除筛选</button>`
      )}</div>`;
    }
    return `
      <div class="list-panel">
        <div class="task-list">${tasks.map(task => renderTaskRow(task)).join('')}</div>
      </div>`;
  }

  function renderKanbanCard(task) {
    const typeMeta = taskTypeMeta(task.type);
    const occurrenceKey = task.type === 'routine' ? taskNextRoutineKey(task) : '';
    const done = task.type === 'routine'
      ? Boolean(occurrenceKey && taskDoneOn(task, occurrenceKey))
      : isDone(task);
    const subtasks = task.subtasks || [];
    const doneSubs = subtasks.filter(s => s.done).length;
    const dueClass = isOverdue(task) ? 'over' : (dueMetaClass(task) === 'due-soon' ? 'soon' : '');
    return `
      <article class="kanban-card ${done ? 'is-done' : ''}" draggable="${task.type === 'routine' ? 'false' : 'true'}" data-task-id="${esc(task.id)}" data-task-board-card="${esc(task.id)}" style="${levelStyle(urgencyMeta(effectiveUrgency(task)))}">
        <div class="kanban-card-top">
          <button class="kanban-card-title" data-action="edit-task" data-id="${esc(task.id)}" style="display:block;flex:1;text-align:left;padding:0;color:var(--ink);font-size:11.5px;font-weight:600;line-height:1.5;">${esc(task.title)}</button>
          ${taskLevelBadges(task, true)}
        </div>
        <div class="kanban-meta">
          <span class="type-chip type-${esc(task.type || 'task')}" style="--type-color:${typeMeta.color};--type-soft:${typeMeta.soft};">${icon(typeMeta.icon)}${typeMeta.short}</span>
          <span class="kanban-due ${dueClass}">${icon('clock')}${esc(taskScheduleText(task))}</span>
          ${task.estimate && task.type !== 'routine' ? `<span>${icon('target')}${estimateLabel(task.estimate)}</span>` : ''}
        </div>
        ${task.tags.length ? `<div class="kanban-tags">${tagsHTML(task.tags, 2)}</div>` : ''}
        <div class="kanban-footer">
          <span style="font-size:8.5px;color:var(--faint);">${subtasks.length ? `${doneSubs}/${subtasks.length} 子任务` : (task.description ? '有备注' : '')}</span>
          <div style="display:flex;align-items:center;gap:1px;">
            <button class="icon-btn" data-action="toggle-task" data-id="${esc(task.id)}" ${occurrenceKey ? `data-date="${esc(occurrenceKey)}"` : ''} title="${done ? '标记为未完成' : '标记为已完成'}" aria-label="${done ? '标记为未完成' : '标记为已完成'}" style="width:25px;height:25px;">${icon('check')}</button>
            <button class="icon-btn" data-action="edit-task" data-id="${esc(task.id)}" title="编辑任务" aria-label="编辑任务" style="width:25px;height:25px;">${icon('edit')}</button>
          </div>
        </div>
      </article>`;
  }

  function renderTaskBoard() {
    const tasks = getFilteredTasks();
    return `
      <div class="kanban">
        ${Object.keys(STATUSES).map(statusKey => {
          const meta = STATUSES[statusKey];
          const columnTasks = tasks.filter(t => t.status === statusKey).sort(taskSmartSort);
          return `
            <section class="kanban-col" data-drop-status="${statusKey}">
              <div class="kanban-head">
                <div class="kanban-title"><span class="status-dot ${statusKey}"></span>${meta.label}</div>
                <span class="kanban-count">${columnTasks.length}</span>
              </div>
              <div class="kanban-cards">
                ${columnTasks.length
                  ? columnTasks.map(renderKanbanCard).join('')
                  : `<div class="empty compact inline" style="min-height:88px;padding:10px;"><p style="font-size:9.5px;">把任务拖到这里</p></div>`}
              </div>
              <button class="kanban-add" data-action="new-task" data-status="${statusKey}">${icon('plus')}添加任务</button>
            </section>`;
        }).join('')}
      </div>`;
  }

  function renderMatrix() {
    const key = todayKey();
    const tasks = getFilteredTasks(true).filter(task => !taskDoneOn(task, key));
    const quadrants = {
      q1: { title: '重要且紧急', hint: '立即处理', items: [] },
      q2: { title: '重要不紧急', hint: '安排时间', items: [] },
      q3: { title: '紧急不重要', hint: '快速处理', items: [] },
      q4: { title: '不重要不紧急', hint: '有空再做', items: [] }
    };
    tasks.forEach(task => {
      const important = effectiveImportance(task) === 'high';
      const urgent = effectiveUrgency(task) === 'high';
      const quadrant = important && urgent ? 'q1' : (important ? 'q2' : (urgent ? 'q3' : 'q4'));
      quadrants[quadrant].items.push(task);
    });

    return `
      <div class="matrix-head">
        <div style="font-size:10.5px;color:var(--muted);">${tasks.length ? `未完成任务 ${tasks.length} 项，按紧急度 → 重要度 → 截止时间排序。` : '没有未完成任务。'}</div>
        <div class="matrix-legend">紧急度按时间自动判断，可手动调整 · 重要度由你设置</div>
      </div>
      <div class="matrix">
        ${Object.keys(quadrants).map(key => {
          const q = quadrants[key];
          q.items.sort(taskSmartSort);
          return `
            <section class="quadrant ${key}">
              <div class="quadrant-head">
                <div class="quadrant-title"><strong>${q.title}</strong><span>${q.hint} · ${q.items.length} 项</span></div>
                <span class="quadrant-count">${q.items.length}</span>
              </div>
              <div class="quadrant-list">
                ${q.items.length
                  ? q.items.map(task => `
                    <button class="quadrant-task" data-action="edit-task" data-id="${esc(task.id)}" style="${levelStyle(urgencyMeta(effectiveUrgency(task)))}">
                      <span class="dot"></span>
                      <span class="quadrant-copy">${esc(task.title)}<br><small style="color:var(--faint);font-size:8.5px;">${esc(taskTypeMeta(task.type).short)} · ${esc(taskScheduleText(task))}</small></span>
                      ${taskLevelBadges(task, true)}
                    </button>`).join('')
                  : `<div class="quadrant-empty">${key === 'q1' ? '很好，暂时没有火烧眉毛的事' : '这里还是空的'}</div>`}
              </div>
            </section>`;
        }).join('')}
      </div>`;
  }

  function renderTaskResults() {
    if (ui.taskView === 'board') return renderTaskBoard();
    if (ui.taskView === 'matrix') return renderMatrix();
    return renderTaskList();
  }

  function updateTaskResults() {
    const container = $('#task-results');
    if (container) container.innerHTML = renderTaskResults();
    const count = $('#task-result-count');
    if (count) {
      const total = getFilteredTasks(ui.taskView === 'matrix').filter(t => ui.taskView !== 'matrix' || !taskDoneOn(t, todayKey())).length;
      count.innerHTML = `共 <strong>${total}</strong> 项`;
    }
    if (ui.multiSelect) syncTaskSelectionUI();
  }

  function renderTasksPage() {
    const allTags = [...new Set(state.tasks.flatMap(t => t.tags))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
    const filters = ui.taskFilters;
    const filtered = getFilteredTasks();
    const resultCount = ui.taskView === 'matrix'
      ? getFilteredTasks(true).filter(t => !taskDoneOn(t, todayKey())).length
      : filtered.length;
    const selectedCount = ui.selectedTaskIds.filter(id => filtered.some(task => task.id === id)).length;
    return `
      <div class="page">
        ${pageHead(
          'TASK SPACE · 任务空间',
          '把每件事，放到<em>对的位置</em>',
          '列表看细节，看板看流转，四象限看取舍。',
          newTaskButton()
        )}
        <div class="page-toolbar">
          <div class="segmented" role="group" aria-label="切换任务视图">
            <button class="segment ${ui.taskView === 'list' ? 'active' : ''}" data-action="task-view" data-view="list">${icon('list')}列表</button>
            <button class="segment ${ui.taskView === 'board' ? 'active' : ''}" data-action="task-view" data-view="board">${icon('columns')}看板</button>
            <button class="segment ${ui.taskView === 'matrix' ? 'active' : ''}" data-action="task-view" data-view="matrix">${icon('quad')}四象限</button>
          </div>
          <div style="margin-left:auto;display:flex;align-items:center;gap:8px;">
            <button class="btn ${ui.multiSelect ? 'btn-soft' : 'btn-ghost'} btn-sm" data-action="toggle-multi-select" aria-pressed="${ui.multiSelect}">
              ${icon(ui.multiSelect ? 'x' : 'check')}${ui.multiSelect ? '退出多选' : '多选'}
            </button>
            ${ui.multiSelect ? '' : `<span style="display:inline-flex;align-items:center;gap:5px;color:var(--faint);font-size:9.5px;">${icon('drag', 'sm')} 看板卡片可拖动</span>`}
          </div>
        </div>
        <div class="toolbar">
          <label class="search-box">
            ${icon('search')}
            <input type="search" data-task-search value="${esc(filters.q)}" placeholder="搜索标题、描述或标签…" aria-label="搜索任务">
          </label>
          <select class="filter-select" data-task-filter="importance" aria-label="按重要度筛选">
            <option value="all" ${filters.importance === 'all' ? 'selected' : ''}>全部重要度</option>
            ${Object.keys(IMPORTANCE_LEVELS).map(key => `<option value="${key}" ${filters.importance === key ? 'selected' : ''}>${IMPORTANCE_LEVELS[key].label}</option>`).join('')}
          </select>
          <select class="filter-select" data-task-filter="status" aria-label="按状态筛选">
            <option value="all" ${filters.status === 'all' ? 'selected' : ''}>全部状态</option>
            <option value="active" ${filters.status === 'active' ? 'selected' : ''}>未完成</option>
            <option value="done" ${filters.status === 'done' ? 'selected' : ''}>已完成</option>
          </select>
          <select class="filter-select" data-task-filter="tag" aria-label="按标签筛选">
            <option value="all" ${filters.tag === 'all' ? 'selected' : ''}>全部标签</option>
            ${allTags.map(tag => `<option value="${esc(tag)}" ${filters.tag === tag ? 'selected' : ''}>${esc(tag)}</option>`).join('')}
          </select>
          <div class="toolbar-sep"></div>
          <span class="toolbar-sort">智能排序：紧急度 → 重要度 → 截止</span>
          <span class="toolbar-count" id="task-result-count">共 <strong>${resultCount}</strong> 项</span>
        </div>
        ${ui.multiSelect ? `
          <div class="bulk-bar" id="bulk-bar">
            <label class="bulk-all">
              <input type="checkbox" id="task-select-all" aria-label="全选当前结果">
              <span>全选当前</span>
            </label>
            <span class="bulk-count">已选 <strong id="bulk-selected-count">${selectedCount}</strong> 项</span>
            <span class="bulk-spacer"></span>
            <button class="btn btn-danger btn-sm" data-action="delete-selected" id="bulk-delete" ${selectedCount ? '' : 'disabled'}>
              ${icon('trash')}删除选中
            </button>
          </div>` : ''}
        <div class="task-results" id="task-results">${renderTaskResults()}</div>
      </div>`;
  }

  /* ============================================================
     8. 日历页
     ============================================================ */
  function renderCalendarPage() {
    const now = new Date();
    if (!ui.calCursor || Number.isNaN(new Date(ui.calCursor).getTime())) {
      ui.calCursor = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    const cursor = ui.calCursor;
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7;
    const gridStart = addDays(first, -offset);

    const cells = [];
    for (let i = 0; i < 42; i++) {
      const day = addDays(gridStart, i);
      const key = dateKey(day);
      const tasks = state.tasks
        .filter(t => taskOccursOn(t, key))
        .sort((a, b) => taskStartMinute(a) - taskStartMinute(b) || taskSortByDue(a, b));
      const routines = tasks.filter(t => t.type === 'routine');
      const others = tasks.filter(t => t.type !== 'routine');
      const MAX_ROWS = 4;
      const rowBudget = tasks.length > MAX_ROWS ? MAX_ROWS - 1 : MAX_ROWS;
      let visibleTasks;
      if (!routines.length) {
        visibleTasks = others.slice(0, rowBudget);
      } else if (!others.length) {
        visibleTasks = routines.slice(0, rowBudget);
      } else {
        const routineSlots = Math.min(routines.length, Math.max(1, rowBudget - others.length));
        visibleTasks = [
          ...others.slice(0, rowBudget - routineSlots),
          ...routines.slice(0, routineSlots)
        ].sort((a, b) => taskStartMinute(a) - taskStartMinute(b) || taskSortByDue(a, b));
      }
      const inMonth = day.getMonth() === month;
      const isToday = key === todayKey();
      cells.push({ day, key, tasks, visibleTasks, hiddenCount: tasks.length - visibleTasks.length, inMonth, isToday });
    }
    const monthTasks = cells.filter(cell => cell.inMonth).reduce((sum, cell) => sum + cell.tasks.length, 0);

    return `
      <div class="page">
        ${pageHead(
          'CALENDAR · 时间分布',
          '看清 DDL，<em>留住余量</em>',
          '月历用来观察整体节奏，时间轴用来安排接下来两周。',
          newTaskButton()
        )}
        <div class="calendar-top" style="margin-bottom:14px;">
          <div class="segmented" role="group" aria-label="日历模式">
            <button class="segment ${ui.calMode === 'month' ? 'active' : ''}" data-action="calendar-mode" data-mode="month">${icon('calendar')}月历</button>
            <button class="segment ${ui.calMode === 'timeline' ? 'active' : ''}" data-action="calendar-mode" data-mode="timeline">${icon('clock')}时间轴</button>
          </div>
          <div style="font-size:10px;color:var(--faint);">${ui.calMode === 'month' ? `本月 ${monthTasks} 个安排` : '未来 14 天 · 从今天开始'}</div>
        </div>
        ${ui.calMode === 'timeline' ? renderTimeline() : `
          <section class="calendar-shell">
            <div class="calendar-top">
              <div class="month-nav">
                <button class="icon-btn" data-action="calendar-prev" aria-label="上个月">${icon('chevron-left')}</button>
                <div class="month-title">${year}年 ${month + 1}月<span>${monthRangeLabel(year, month)}</span></div>
                <button class="icon-btn" data-action="calendar-next" aria-label="下个月">${icon('chevron-right')}</button>
              </div>
              <button class="btn btn-ghost btn-sm" data-action="calendar-today">${icon('target')}回到今天</button>
            </div>
            <div class="cal-weekdays">
              ${['一', '二', '三', '四', '五', '六', '日'].map((d, i) => `<div class="cal-weekday ${i >= 5 ? 'weekend' : ''}">周${d}</div>`).join('')}
            </div>
            <div class="cal-grid">
              ${cells.map(cell => `
                <div class="cal-cell ${cell.inMonth ? '' : 'is-other'} ${cell.isToday ? 'is-today' : ''}" data-cal-day="${cell.key}" data-action="open-day" data-date="${cell.key}" role="button" tabindex="0" aria-current="${cell.isToday ? 'date' : 'false'}" aria-label="${cell.day.getMonth() + 1}月${cell.day.getDate()}日${cell.isToday ? '，今天' : ''}，${cell.tasks.length} 项安排">
                  <span class="cal-daynum">${cell.day.getDate()}${cell.isToday ? '<em>今天</em>' : ''}</span>
                  <div class="cal-tasks">
                    ${cell.visibleTasks.map(task => `
                      <button class="cal-task type-${esc(task.type || 'task')} ${task.type === 'routine' ? 'is-routine' : ''} ${taskDoneOn(task, cell.key) ? 'is-done' : ''}" data-action="edit-task" data-id="${esc(task.id)}" title="${esc(task.title)} · ${esc(taskScheduleText(task))}" style="--type-color:${taskTypeMeta(task.type).color};${levelStyle(urgencyMeta(effectiveUrgency(task)))}">
                        <span class="dot"></span>${esc(task.title)}
                      </button>`).join('')}
                    ${cell.hiddenCount > 0 ? `<button class="cal-more" data-action="open-day" data-date="${cell.key}">+${cell.hiddenCount} 项</button>` : ''}
                  </div>
                </div>`).join('')}
            </div>
            <div class="calendar-foot">
              <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                <button class="btn btn-soft btn-sm free-time-trigger" data-action="open-free-time">${icon('sparkles')}一键识别空闲时刻</button>
                <div class="cal-legend" title="紧急度">
                  ${Object.keys(URGENCY_LEVELS).map(key => `<span style="${levelStyle(URGENCY_LEVELS[key])}"><i></i>急 ${URGENCY_LEVELS[key].label}</span>`).join('')}
                </div>
              </div>
              <span>点击日期查看当天每小时安排 · 任务可直接编辑</span>
            </div>
          </section>`}
      </div>`;
  }

  function renderTimeline() {
    const days = [];
    const start = startOfDay(new Date());
    for (let i = 0; i < 14; i++) {
      const day = addDays(start, i);
      const key = dateKey(day);
      const tasks = state.tasks
        .filter(t => taskOccursOn(t, key))
        .sort((a, b) => taskStartMinute(a) - taskStartMinute(b) || taskSortByDue(a, b));
      days.push({ day, key, tasks, isToday: i === 0 });
    }
    const total = days.reduce((sum, d) => sum + d.tasks.length, 0);
    return `
      <section class="calendar-shell">
        <div class="calendar-top">
          <div>
            <div class="month-title" style="text-align:left;min-width:0;font-size:16px;">未来 14 天<span style="display:block;font-size:9px;margin:3px 0 0;">从 ${monthDayCN(start)} 开始 · 共 ${total} 项安排</span></div>
          </div>
          <div style="display:flex;gap:7px;flex-wrap:wrap;">
            <button class="btn btn-ghost btn-sm" data-action="open-free-time">${icon('sparkles')}识别空闲</button>
            <button class="btn btn-ghost btn-sm" data-action="new-task">${icon('plus')}添加任务</button>
          </div>
        </div>
        ${total ? `<div class="timeline">
          ${days.map(entry => `
            <div class="timeline-day ${entry.isToday ? 'is-today' : ''}">
              <span class="timeline-node"></span>
              <div class="timeline-date">
                <strong>${monthDayCN(entry.day)}</strong>
                <span>${weekdayCN(entry.day)}</span>
              </div>
              <div class="timeline-items">
                ${entry.tasks.length ? entry.tasks.map(task => {
                  const done = taskDoneOn(task, entry.key);
                  const meta = taskTypeMeta(task.type);
                  return `
                  <button class="timeline-item type-${esc(task.type || 'task')} ${done ? 'is-done' : ''}" data-action="edit-task" data-id="${esc(task.id)}" style="--type-color:${meta.color};${levelStyle(urgencyMeta(effectiveUrgency(task)))}">
                    <span class="timeline-time">${task.type === 'routine' ? task.routine.start : (task.dueTimeKnown === false ? '全天' : pad2(new Date(task.due).getHours()) + ':' + pad2(new Date(task.due).getMinutes()))}</span>
                    <span class="timeline-bar"></span>
                    <span class="timeline-main">
                      <strong>${esc(task.title)}</strong>
                      <span>${meta.short} · 急 ${urgencyMeta(effectiveUrgency(task)).label} · 重 ${importanceMeta(effectiveImportance(task)).label}${task.type === 'event' && task.location ? ' · ' + esc(task.location) : ''}${task.tags.length ? ' · ' + esc(task.tags.slice(0, 2).join(' / ')) : ''}</span>
                    </span>
                    ${done ? `<span class="status-pill done">已完成</span>` : `<span class="status-pill">${task.type === 'routine' ? '日程' : '待办'}</span>`}
                  </button>`;
                }).join('') : `<div class="timeline-none">这一天没有安排</div>`}
              </div>
            </div>`).join('')}
        </div>` : emptyState('未来 14 天没有安排', '可以提前安排一点长期目标，或者享受一段没有截止的轻盈时间。', `<button class="btn btn-soft btn-sm" data-action="new-task">${icon('plus')}安排一件事</button>`)}
      </section>`;
  }

  function getBusyIntervals(key) {
    const intervals = [];
    state.tasks.forEach(task => {
      if (task.type === 'routine' && taskOccursOn(task, key) && task.routine) {
        const start = timeToMinutes(task.routine.start);
        const end = timeToMinutes(task.routine.end);
        if (end > start) intervals.push([start, end]);
        return;
      }
      if (task.type === 'event' && task.due) {
        const startDate = new Date(task.due);
        const endDate = task.end ? new Date(task.end) : new Date(startDate.getTime() + 60 * 60 * 1000);
        const startKey = dateKey(startDate);
        const endKey = dateKey(endDate);
        if (key < startKey || key > endKey) return;
        let start = key === startKey ? startDate.getHours() * 60 + startDate.getMinutes() : 0;
        let end = key === endKey ? endDate.getHours() * 60 + endDate.getMinutes() : 24 * 60;
        if (key === endKey && endDate.getHours() === 0 && endDate.getMinutes() === 0) end = 24 * 60;
        start = Math.max(0, Math.min(1440, start));
        end = Math.max(0, Math.min(1440, end));
        if (end > start) intervals.push([start, end]);
      }
    });
    intervals.sort((a, b) => a[0] - b[0]);
    const merged = [];
    intervals.forEach(interval => {
      const last = merged[merged.length - 1];
      if (!last || interval[0] > last[1]) merged.push([...interval]);
      else last[1] = Math.max(last[1], interval[1]);
    });
    return merged;
  }

  function getAwakeWindow() {
    const schedule = state.settings.schedule || {};
    const wake = timeToMinutes(schedule.wake || '07:30');
    const sleep = timeToMinutes(schedule.sleep || '22:30');
    return sleep > wake ? { wake, sleep } : { wake: 7 * 60 + 30, sleep: 22 * 60 + 30 };
  }

  function getFreeBlocks(key, minBlock = 30) {
    const awake = getAwakeWindow();
    const busy = getBusyIntervals(key)
      .map(([start, end]) => [Math.max(start, awake.wake), Math.min(end, awake.sleep)])
      .filter(([start, end]) => end > start);
    const blocks = [];
    let cursor = awake.wake;
    busy.forEach(([start, end]) => {
      if (start > cursor && start - cursor >= minBlock) blocks.push({ start: cursor, end: start });
      cursor = Math.max(cursor, end);
    });
    if (awake.sleep > cursor && awake.sleep - cursor >= minBlock) blocks.push({ start: cursor, end: awake.sleep });
    return blocks;
  }

  function dayTaskReminders(key) {
    return state.tasks
      .filter(task => task.type === 'task' && task.due && dateKey(new Date(task.due)) === key)
      .sort(taskSortByDue);
  }

  function freeBlockHTML(key, block) {
    return `
      <button class="free-block" data-action="new-task" data-date="${key}" data-time="${minutesToTime(block.start)}" title="在这个空档安排任务">
        <strong>${minutesToTime(block.start)} – ${minutesToTime(block.end)}</strong>
        <span>${minutesText(block.end - block.start)} 空余 ${icon('plus')}</span>
      </button>`;
  }

  function freeTimeQuestionHTML() {
    const isDay = ui.freeTimeMode !== 'range';
    return `
      <div class="free-time-modes" role="group" aria-label="查询空闲的方式">
        <button class="free-time-mode ${isDay ? 'active' : ''}" data-action="free-time-mode" data-mode="day">${icon('calendar')}未来某一天</button>
        <button class="free-time-mode ${!isDay ? 'active' : ''}" data-action="free-time-mode" data-mode="range">${icon('list')}未来一段时间</button>
      </div>
      <div class="free-time-question ${isDay ? '' : 'is-range'}">
        ${isDay ? `
          <label class="field">
            <span>查看哪一天</span>
            <input class="input" type="date" id="free-time-date" value="${esc(ui.freeTimeDate || dateKey(addDays(new Date(), 1)))}">
          </label>` : `
          <label class="field">
            <span>从哪天开始</span>
            <input class="input" type="date" id="free-time-start" value="${esc(ui.freeTimeDate || todayKey())}">
          </label>
          <label class="field">
            <span>未来几天 <em>1–30</em></span>
            <input class="input" type="number" id="free-time-range" min="1" max="30" value="${Number(ui.freeTimeRange) || 7}">
          </label>`}
        <label class="field">
          <span>最短空档</span>
          <select class="select" id="free-time-min">
            <option value="30">30 分钟</option>
            <option value="60" selected>1 小时</option>
            <option value="90">1.5 小时</option>
            <option value="120">2 小时</option>
          </select>
        </label>
        <button class="btn btn-primary free-time-run" data-action="free-time-run">${icon('sparkles')}开始识别</button>
      </div>
      <div id="free-time-result" class="free-time-result">
        <div class="free-time-hint">${icon('info')}会按你的作息排除事件与固定日程，只把真正能用的时间列出来；普通任务的 DDL 会单独提醒，不占用空档。</div>
      </div>`;
  }

  function openFreeTimeModal() {
    if (!ui.freeTimeDate) ui.freeTimeDate = dateKey(addDays(new Date(), 1));
    if (!ui.freeTimeMode) ui.freeTimeMode = 'day';
    if (!ui.freeTimeRange) ui.freeTimeRange = 7;
    openModal(`
      <div class="modal-overlay">
        <div class="modal medium free-time-modal" role="dialog" aria-modal="true" aria-labelledby="free-time-title">
          <div class="modal-head">
            <div>
              <h2 id="free-time-title">一键识别空闲时刻</h2>
              <p>先选查询范围，再让拾光按作息和已有安排，找出真正可用的空档。</p>
            </div>
            <button class="modal-close" type="button" data-action="close-modal" aria-label="关闭">${icon('x')}</button>
          </div>
          <div class="modal-body" id="free-time-body">${freeTimeQuestionHTML()}</div>
        </div>
      </div>`);
  }

  function runFreeTimeSearch() {
    const result = $('#free-time-result');
    if (!result) return;
    const minBlock = Number($('#free-time-min')?.value) || 60;
    if (ui.freeTimeMode === 'range') {
      const start = $('#free-time-start')?.value || todayKey();
      const days = Math.max(1, Math.min(30, Number($('#free-time-range')?.value) || 7));
      ui.freeTimeDate = start;
      ui.freeTimeRange = days;
      const rows = [];
      const reminders = [];
      for (let i = 0; i < days; i++) {
        const key = dateKey(addDays(fromDateKey(start), i));
        const blocks = getFreeBlocks(key, minBlock);
        dayTaskReminders(key).forEach(task => reminders.push({ key, task }));
        rows.push(`
          <div class="free-day-row ${key === todayKey() ? 'is-today' : ''}">
            <div class="free-day-label"><strong>${monthDayCN(fromDateKey(key))}</strong><span>${weekdayCN(fromDateKey(key))}</span></div>
            <div class="free-blocks">${blocks.length ? blocks.map(block => freeBlockHTML(key, block)).join('') : '<span class="free-empty">没有足够长的空档</span>'}</div>
          </div>`);
      }
      result.innerHTML = `
        <div class="free-summary">${icon('calendar')}未来 ${days} 天 · 每天至少 ${minutesText(minBlock)} 的空档</div>
        <div class="free-day-list">${rows.join('')}</div>
        ${reminders.length ? `
          <div class="free-reminders">
            <div class="free-reminders-head">${icon('alert')}期间的任务 DDL</div>
            ${reminders.map(({ key, task }) => `<button class="free-reminder" data-action="edit-task" data-id="${esc(task.id)}"><strong>${esc(task.title)}</strong><span>${monthDayCN(fromDateKey(key))} ${task.dueTimeKnown === false ? '全天' : pad2(new Date(task.due).getHours()) + ':' + pad2(new Date(task.due).getMinutes())}</span></button>`).join('')}
          </div>` : ''}`;
      return;
    }
    const key = $('#free-time-date')?.value || dateKey(addDays(new Date(), 1));
    ui.freeTimeDate = key;
    const blocks = getFreeBlocks(key, minBlock);
    const reminders = dayTaskReminders(key);
    result.innerHTML = `
      <div class="free-summary">${icon('sun')}${monthDayCN(fromDateKey(key))} · ${weekdayCN(fromDateKey(key))} · 作息 ${state.settings.schedule.wake}–${state.settings.schedule.sleep}</div>
      <div class="free-blocks free-blocks-day">${blocks.length ? blocks.map(block => freeBlockHTML(key, block)).join('') : '<div class="empty compact inline" style="min-height:72px;"><p style="font-size:10px;">这一天没有满足条件的空档，试试缩短最小时长。</p></div>'}</div>
      ${reminders.length ? `
        <div class="free-reminders">
          <div class="free-reminders-head">${icon('alert')}这天的任务 DDL</div>
          ${reminders.map(task => `<button class="free-reminder" data-action="edit-task" data-id="${esc(task.id)}"><strong>${esc(task.title)}</strong><span>${task.dueTimeKnown === false ? '全天' : pad2(new Date(task.due).getHours()) + ':' + pad2(new Date(task.due).getMinutes())}</span></button>`).join('')}
        </div>` : ''}`;
  }

  function openDayModal(key) {
    const date = fromDateKey(key);
    const tasks = state.tasks
      .filter(t => taskOccursOn(t, key))
      .sort((a, b) => taskStartMinute(a) - taskStartMinute(b) || taskSortByDue(a, b));
    const blocking = tasks.filter(t => t.type === 'event' || t.type === 'routine');
    const deadlines = tasks.filter(t => t.type === 'task');
    const awake = getAwakeWindow();
    const now = new Date();
    const isToday = key === todayKey();
    const blocks = blocking.map(task => {
      let start = taskStartMinute(task);
      let end = taskEndMinute(task);
      if (task.type === 'event' && task.due) {
        const startDate = new Date(task.due);
        const endDate = task.end ? new Date(task.end) : new Date(startDate.getTime() + 3600000);
        if (dateKey(startDate) < key) start = 0;
        if (dateKey(endDate) > key) end = 24 * 60;
      }
      start = Math.max(0, Math.min(1440, start));
      end = Math.max(start + 15, Math.min(1440, end));
      const top = start / 60 * 64;
      const height = Math.max(32, (end - start) / 60 * 64 - 4);
      const done = taskDoneOn(task, key);
      return `
        <button class="schedule-block type-${esc(task.type)} ${done ? 'is-done' : ''}" data-action="edit-task" data-id="${esc(task.id)}" style="top:${top}px;height:${height}px;--type-color:${taskTypeMeta(task.type).color};${levelStyle(urgencyMeta(effectiveUrgency(task)))}">
          <strong>${esc(task.title)}</strong>
          <span>${minutesToTime(start)}–${minutesToTime(end)}${task.type === 'event' && task.location ? ' · ' + esc(task.location) : ''}</span>
          ${done ? `<em>${icon('check')}已完成</em>` : ''}
        </button>`;
    }).join('');
    const deadlineMarks = deadlines.map(task => {
      const d = new Date(task.due);
      const top = (d.getHours() * 60 + d.getMinutes()) / 60 * 64;
      return `<button class="schedule-deadline" data-action="edit-task" data-id="${esc(task.id)}" style="top:${top}px;${levelStyle(urgencyMeta(effectiveUrgency(task)))}"><span>${pad2(d.getHours())}:${pad2(d.getMinutes())}</span>${esc(task.title)}</button>`;
    }).join('');
    const hourRows = Array.from({ length: 24 }, (_, hour) => {
      const minute = hour * 60;
      const rest = minute < awake.wake || minute >= awake.sleep;
      return `<div class="schedule-hour ${rest ? 'is-rest' : ''}" data-action="new-task" data-date="${key}" data-time="${pad2(hour)}:00"><span class="schedule-hour-label">${pad2(hour)}:00</span><span class="schedule-hour-line"></span></div>`;
    }).join('');
    const nowLine = isToday
      ? `<div class="schedule-now" style="top:${(now.getHours() * 60 + now.getMinutes()) / 60 * 64}px;"><span>现在</span></div>`
      : '';
    openModal(`
      <div class="modal-overlay">
        <div class="modal large day-modal" role="dialog" aria-modal="true" aria-labelledby="day-modal-title">
          <div class="modal-head">
            <div>
              <h2 id="day-modal-title">${date.getMonth() + 1} 月 ${date.getDate()} 日 · ${weekdayCN(date, 'long')}</h2>
              <p>${isToday ? '今天' : (key < todayKey() ? '过去的安排' : '未来的安排')} · ${tasks.length ? `${tasks.length} 项安排` : '没有安排'} · 作息 ${state.settings.schedule.wake}–${state.settings.schedule.sleep}</p>
            </div>
            <div class="day-nav">
              <button class="icon-btn" data-action="day-shift" data-date="${dateKey(addDays(date, -1))}" aria-label="前一天">${icon('chevron-left')}</button>
              <button class="btn btn-ghost btn-sm" data-action="open-day" data-date="${todayKey()}">今天</button>
              <button class="icon-btn" data-action="day-shift" data-date="${dateKey(addDays(date, 1))}" aria-label="后一天">${icon('chevron-right')}</button>
              <button class="modal-close" type="button" data-action="close-modal" aria-label="关闭">${icon('x')}</button>
            </div>
          </div>
          <div class="modal-body day-modal-body">
            <div class="day-schedule-wrap">
              <div class="day-schedule">
                ${hourRows}
                <div class="schedule-layer">${blocks}${deadlineMarks}${nowLine}</div>
              </div>
            </div>
            ${!tasks.length ? `<div class="day-empty-hint">${icon('calendar')}这一天还空着，可以点任意时间安排一件事。</div>` : ''}
          </div>
          <div class="modal-foot">
            <span style="font-size:9px;color:var(--faint);">点击空白时段可安排任务 · 点击色块可编辑</span>
            <div class="modal-foot-right">
              <button class="btn btn-ghost btn-sm" type="button" data-action="open-free-time">${icon('sparkles')}识别空闲</button>
              <button class="btn btn-primary btn-sm" type="button" data-action="new-task" data-date="${key}">${icon('plus')}添加任务</button>
            </div>
          </div>
        </div>
      </div>`);
    const scrollDayToFocus = () => {
      const wrap = document.querySelector('.day-schedule-wrap');
      if (!wrap) return;
      const focusMinute = isToday ? now.getHours() * 60 + now.getMinutes() : awake.wake;
      wrap.scrollTop = Math.max(0, focusMinute / 60 * 64 - 120);
    };
    setTimeout(scrollDayToFocus, 60);
    setTimeout(scrollDayToFocus, 320);
  }

  /* ============================================================
     9. 消息收件箱
     ============================================================ */
  function formatMessageTime(value) {
    const d = new Date(value);
    const diff = dayDiffFromToday(d);
    if (diff === 0) return `今天 ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    if (diff === -1) return `昨天 ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    return `${d.getMonth() + 1}月${d.getDate()}日 ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function getFilteredMessages() {
    const q = ui.msgQuery.trim().toLowerCase();
    let messages = state.messages.slice();
    if (ui.msgFilter === 'unprocessed') messages = messages.filter(m => !m.processed);
    if (ui.msgFilter === 'processed') messages = messages.filter(m => m.processed);
    if (q) {
      messages = messages.filter(m =>
        m.content.toLowerCase().includes(q) ||
        m.source.toLowerCase().includes(q)
      );
    }
    return messages.sort((a, b) => {
      if (a.processed !== b.processed) return a.processed ? 1 : -1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  function renderMessageCard(message) {
    const type = SOURCE_TYPES[message.sourceType] || SOURCE_TYPES.other;
    const linkedTask = message.taskId ? state.tasks.find(t => t.id === message.taskId) : null;
    return `
      <article class="message-card ${message.processed ? '' : 'unprocessed'}" data-message-card="${esc(message.id)}">
        <div class="message-card-top">
          <span class="msg-source-icon ${type.className}">${type.mark}</span>
          <div class="message-head-main">
            <div class="message-source-line">
              <strong>${esc(message.source)}</strong>
              <span class="message-time">${esc(formatMessageTime(message.createdAt))}</span>
              <span class="status-pill ${message.processed ? 'done' : 'pending'}">${message.processed ? '已处理' : '未处理'}</span>
            </div>
          </div>
        </div>
        <div class="message-content">${esc(message.content)}</div>
        ${linkedTask ? `
          <div class="message-linked">
            ${icon('link')}
            <span>已关联任务：</span>
            <button data-action="edit-task" data-id="${esc(linkedTask.id)}">${esc(linkedTask.title)}</button>
            ${isDone(linkedTask) ? '<span class="status-pill done">已完成</span>' : ''}
          </div>` : ''}
        <div class="message-actions">
          ${linkedTask
            ? `<button class="btn btn-soft btn-sm" data-action="edit-task" data-id="${esc(linkedTask.id)}">${icon('edit')}查看任务</button>`
            : `<button class="btn btn-soft btn-sm" data-action="convert-message" data-id="${esc(message.id)}">${icon('plus')}转为任务</button>`}
          <button class="btn btn-ghost btn-sm" data-action="link-message" data-id="${esc(message.id)}">${icon('link')}${linkedTask ? '更换关联' : '关联任务'}</button>
          <button class="btn btn-ghost btn-sm" data-action="toggle-message" data-id="${esc(message.id)}">${message.processed ? '标记未处理' : '标记已处理'}</button>
          <button class="icon-btn danger" data-action="delete-message" data-id="${esc(message.id)}" title="删除消息" aria-label="删除消息">${icon('trash')}</button>
        </div>
      </article>`;
  }

  function renderMessageList() {
    const messages = getFilteredMessages();
    if (!messages.length) {
      return `<div class="message-empty">${emptyState(
        ui.msgQuery ? '没有匹配的消息' : '收件箱很干净',
        ui.msgQuery ? '换一个关键词再试试。' : '把群通知、邮件或待办消息粘贴到左边，之后就不会忘记了。'
      )}</div>`;
    }
    return `<div class="message-list">${messages.map(renderMessageCard).join('')}</div>`;
  }

  function updateMessageList() {
    const container = $('#message-list');
    if (container) container.innerHTML = renderMessageList();
    const count = $('#message-count');
    if (count) {
      const filtered = getFilteredMessages().length;
      const unread = state.messages.filter(m => !m.processed).length;
      count.innerHTML = `显示 <strong>${filtered}</strong> 条 · 未处理 <strong>${unread}</strong> 条`;
    }
  }

  function renderMessagesPage() {
    const unread = state.messages.filter(m => !m.processed).length;
    const converted = state.messages.filter(m => m.taskId).length;
    const filtered = getFilteredMessages();
    return `
      <div class="page">
        ${pageHead(
          'INBOX · 消息收件箱',
          '把通知，<em>变成下一步</em>',
          '先收进来，再决定处理或转成任务，不必靠记忆。',
          `<button class="btn btn-ghost" data-action="focus-compose">${icon('plus')}粘贴消息</button>`
        )}
        <div class="message-layout">
          <section class="panel compose-panel">
            <div class="panel-head">
              <div class="panel-title">
                <span class="panel-icon">${icon('inbox')}</span>
                <div><h3>收一条新消息</h3><div class="panel-sub">群通知、邮件、私信都可以</div></div>
              </div>
            </div>
            <form class="compose-form" data-form="message">
              <textarea class="compose-textarea" name="content" required placeholder="把群通知或邮件内容粘贴到这里…&#10;&#10;例如：社团活动策划案请于明天 15:30 前发我，记得补充预算和分工。"></textarea>
              <div class="compose-row">
                <input class="input" name="source" required placeholder="来源，例如：高数课程群" maxlength="80">
                <select class="source-select" name="sourceType" aria-label="消息类型">
                  <option value="group">群通知</option>
                  <option value="mail">邮件</option>
                  <option value="private">私信</option>
                  <option value="other">其他</option>
                </select>
              </div>
              <div class="compose-hint">${icon('shield')}保存来源和收取时间；内容只存储在这台设备的浏览器里。</div>
              <button class="btn btn-primary btn-block" type="submit">${icon('inbox')}保存到收件箱</button>
            </form>
          </section>

          <section>
            <div class="message-summary-strip">
              <span class="summary-chip accent">${icon('inbox')}未处理 <strong>${unread}</strong></span>
              <span class="summary-chip">全部消息 <strong>${state.messages.length}</strong></span>
              <span class="summary-chip">${icon('link')}已关联任务 <strong>${converted}</strong></span>
            </div>
            <div class="inbox-head">
              <div class="inbox-filters" role="group" aria-label="消息筛选">
                <button class="inbox-filter ${ui.msgFilter === 'all' ? 'active' : ''}" data-action="msg-filter" data-filter="all">全部</button>
                <button class="inbox-filter ${ui.msgFilter === 'unprocessed' ? 'active' : ''}" data-action="msg-filter" data-filter="unprocessed">未处理</button>
                <button class="inbox-filter ${ui.msgFilter === 'processed' ? 'active' : ''}" data-action="msg-filter" data-filter="processed">已处理</button>
              </div>
              <label class="search-box">
                ${icon('search')}
                <input type="search" data-message-search value="${esc(ui.msgQuery)}" placeholder="搜索消息或来源…" aria-label="搜索消息">
              </label>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:9px;color:var(--faint);font-size:9px;" id="message-count">
              显示 <strong>${filtered.length}</strong> 条 · 未处理 <strong>${unread}</strong> 条
            </div>
            <div id="message-list">${renderMessageList()}</div>
          </section>
        </div>
      </div>`;
  }


  /* ============================================================
     10. 统计与设置页
     ============================================================ */
  function notificationSupported() {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  function notificationPermission() {
    if (!notificationSupported()) return 'unsupported';
    return Notification.permission;
  }

  function permissionText(permission) {
    return ({
      granted: '已授权',
      denied: '已拒绝',
      default: '未授权',
      unsupported: '浏览器不支持'
    })[permission] || '未授权';
  }

  function permissionClass(permission) {
    return permission === 'granted' ? 'granted' : (permission === 'denied' ? 'denied' : '');
  }

  function dataSizeLabel() {
    try {
      const bytes = new Blob([JSON.stringify(state)]).size;
      if (bytes < 1024) return `${bytes} B`;
      return `${(bytes / 1024).toFixed(1)} KB`;
    } catch (error) {
      return '—';
    }
  }

  function renderSettingsPage() {
    const stats = getStats();
    const maxCount = Math.max(1, ...stats.days.map(d => d.count));
    const review = getReview();
    const ai = state.settings.ai;
    const schedule = state.settings.schedule;
    const permission = notificationPermission();
    const pendingHourLabel = stats.pendingMinutes >= 60
      ? `${(stats.pendingMinutes / 60).toFixed(1)}<small>小时</small>`
      : `${stats.pendingMinutes}<small>分钟</small>`;
    const completedToday = stats.todayDone;

    return `
      <div class="page settings-page">
        ${pageHead(
          'REVIEW · 统计与设置',
          '回望一周，<em>调整节奏</em>',
          '看见自己的完成轨迹，也把提醒、数据和 AI 放在顺手的位置。',
          `<button class="btn btn-ghost" data-action="export-json">${icon('download')}备份数据</button>`
        )}

        <div class="stats-grid">
          <div class="stat-card" style="--stat-tint:rgba(60,135,106,.09);">
            <div class="stat-label">${icon('target')}整体完成率</div>
            <div class="stat-value">${stats.completionRate}<small>%</small></div>
            <div class="stat-foot">已完成 ${stats.completed} / ${stats.total} 个任务</div>
          </div>
          <div class="stat-card" style="--stat-tint:rgba(74,131,189,.08);">
            <div class="stat-label">${icon('check')}本周完成</div>
            <div class="stat-value">${stats.thisWeekDone}<small>项</small></div>
            <div class="stat-foot">${completedToday ? `今天已完成 ${completedToday} 项` : '今天还没有完成任务'}</div>
          </div>
          <div class="stat-card" style="--stat-tint:rgba(225,138,56,.09);">
            <div class="stat-label">${icon('target')}待办预计投入</div>
            <div class="stat-value">${pendingHourLabel}</div>
            <div class="stat-foot">${stats.overdue ? `${stats.overdue} 项已逾期，先处理最要紧的` : '没有逾期任务，保持节奏'}</div>
          </div>
          <div class="stat-card" style="--stat-tint:rgba(217,83,83,.07);">
            <div class="stat-label">${icon('inbox')}未处理消息</div>
            <div class="stat-value">${stats.unread}<small>条</small></div>
            <div class="stat-foot">${state.messages.length} 条消息保存在本地</div>
          </div>
        </div>

        <div class="settings-layout">
          <div class="settings-grid">
            <section class="panel">
              <div class="settings-section-title">
                <span class="panel-icon">${icon('chart')}</span>
                <h3>最近 7 天完成节奏</h3>
                <span class="badge">按完成时间统计</span>
              </div>
              <div class="chart-wrap">
                ${stats.days.map(day => `
                  <div class="chart-col ${day.isToday ? 'is-today' : ''}">
                    <div class="chart-bar-area">
                      ${day.count ? `<span class="bar-value">${day.count}</span>` : ''}
                      <div class="chart-bar" style="height:${day.count ? Math.max(8, Math.round(day.count / maxCount * 100)) : 4}%;"></div>
                    </div>
                    <span class="chart-label">${day.label}</span>
                  </div>`).join('')}
              </div>
            </section>

            <section class="panel">
              <div class="settings-section-title">
                <span class="panel-icon">${icon('flame')}</span>
                <h3>未完成任务重要度分布</h3>
                <span class="badge">共 ${stats.distribution.reduce((sum, p) => sum + p.count, 0)} 项</span>
              </div>
              <div class="priority-bars">
                ${stats.distribution.map(p => {
                  const total = stats.distribution.reduce((sum, item) => sum + item.count, 0);
                  return `
                    <div class="priority-bar-row" style="${levelStyle(p)}">
                      <span>${p.label}</span>
                      <div class="priority-track"><div class="priority-fill" style="width:${total ? Math.round(p.count / total * 100) : 0}%;"></div></div>
                      <span class="priority-num">${p.count}</span>
                    </div>`;
                }).join('')}
              </div>
            </section>

            <section class="panel">
              <div class="settings-section-title">
                <span class="panel-icon">${icon('edit')}</span>
                <h3>本周复盘</h3>
                <span class="badge">${weekRangeLabel()} · 第 ${getWeekNumber()} 周</span>
              </div>
              <form class="review-area" data-form="review">
                <label class="sr-only" for="weekly-review">本周复盘</label>
                <textarea class="textarea" id="weekly-review" name="review" maxlength="1200" placeholder="这一周，什么事情让你觉得值得？哪里可以更从容一点？下周想保留什么、放下什么？">${esc(review)}</textarea>
                <div class="review-meta">
                  <span>只写给自己看，不会上传到任何服务器。</span>
                  <span data-review-status>${review ? '已保存本周复盘' : '还没有写复盘'}</span>
                </div>
                <button class="btn btn-soft" type="submit" style="align-self:flex-start;">保存本周复盘</button>
              </form>
            </section>
          </div>

          <div class="settings-grid">
            <section class="panel">
              <div class="settings-section-title">
                <span class="panel-icon">${icon('sparkles')}</span>
                <h3>AI 解析增强</h3>
                <span class="badge">可选</span>
              </div>
              <div class="setting-row">
                <div class="setting-row-main">
                  <strong>启用 AI 解析</strong>
                  <p>调用兼容 Chat Completions 的接口，补足自然语言里的时间与标签。</p>
                </div>
                <button class="toggle ${ai.enabled ? 'on' : ''}" type="button" data-action="toggle-ai-setting" role="switch" aria-checked="${ai.enabled}" aria-label="启用 AI 解析"></button>
              </div>
              <div class="ai-key-list">
                ${ai.keys.length ? ai.keys.map(entry => {
                  const meta = AI_PROVIDERS[entry.provider] || AI_PROVIDERS.custom;
                  const active = entry.id === ai.activeKeyId;
                  return `
                    <div class="ai-key-card ${active ? 'active' : ''}">
                      <button class="ai-key-pick" type="button" data-action="ai-key-active" data-key-id="${esc(entry.id)}" aria-pressed="${active}">
                        <span class="key-radio">${active ? icon('check') : ''}</span>
                        <span class="ai-key-info">
                          <strong>${esc(entry.label || meta.label)}</strong>
                          <code>${esc(maskApiKey(entry.key))}</code>
                          <small>${esc(meta.label)} · ${esc(entry.model || '未填模型')}</small>
                        </span>
                      </button>
                      <button class="icon-btn danger" type="button" data-action="ai-key-delete" data-key-id="${esc(entry.id)}" aria-label="删除这个 API Key">${icon('trash')}</button>
                    </div>`;
                }).join('') : `
                  <div class="ai-key-empty">
                    ${icon('shield')}
                    <span>还没有保存通道。添加后可随时切换，Key 只留在本机。</span>
                  </div>`}
              </div>
              <div class="ai-key-actions">
                <button class="btn btn-soft btn-sm" type="button" data-action="open-api-key">${icon('plus')}添加 API Key</button>
                ${ai.keys.length && ai.activeKeyId ? `<span class="ai-key-active-note">当前使用：${esc((getActiveAIKey() || {}).label || '')}</span>` : ''}
              </div>
              <div class="ai-note" style="margin-top:11px;">
                ${icon('shield')}
                <span>保存前会请求一次 <code>/models</code> 验证 Key；验证失败不会写入本地。Key 只存在当前浏览器，请求直接从浏览器发出。</span>
              </div>
            </section>

            <section class="panel">
              <div class="settings-section-title">
                <span class="panel-icon">${icon('sun')}</span>
                <h3>作息与空闲</h3>
                <span class="badge">用于识别空闲</span>
              </div>
              <form data-form="schedule-settings">
                <div class="form-grid">
                  <label class="field">
                    <span>通常几点起床</span>
                    <input class="input" type="time" name="wake" value="${esc(schedule.wake)}" required>
                  </label>
                  <label class="field">
                    <span>通常几点睡觉</span>
                    <input class="input" type="time" name="sleep" value="${esc(schedule.sleep)}" required>
                  </label>
                </div>
                <p class="field-hint">日历里的“一键识别空闲”会避开这段睡眠时间，并扣除事件和日程。</p>
                <div style="display:flex;justify-content:flex-end;margin-top:11px;">
                  <button class="btn btn-primary btn-sm" type="submit">${icon('check')}保存作息</button>
                </div>
              </form>
            </section>

            <section class="panel">
              <div class="settings-section-title">
                <span class="panel-icon">${icon('bell')}</span>
                <h3>提醒与回顾</h3>
                <span class="badge">页面打开时生效</span>
              </div>
              <div class="setting-list">
                <div class="setting-row">
                  <div class="setting-row-main">
                    <strong>浏览器桌面通知</strong>
                    <p>今日清单与即将到期的任务会弹出一条通知。</p>
                  </div>
                  <div style="display:flex;align-items:center;gap:8px;flex:0 0 auto;">
                    <span class="perm-status ${permissionClass(permission)}">${permissionText(permission)}</span>
                    <button class="toggle ${state.settings.browserNotify ? 'on' : ''}" type="button" data-action="toggle-setting" data-setting="browserNotify" role="switch" aria-checked="${state.settings.browserNotify}" aria-label="浏览器桌面通知" ${permission === 'unsupported' ? 'disabled' : ''}></button>
                  </div>
                </div>
                <div class="setting-row">
                  <div class="setting-row-main">
                    <strong>临近截止提醒</strong>
                    <p>任务进入最后 2 小时时，在页面顶部和通知里提醒你。</p>
                  </div>
                  <button class="toggle ${state.settings.notifyDueSoon ? 'on' : ''}" type="button" data-action="toggle-setting" data-setting="notifyDueSoon" role="switch" aria-checked="${state.settings.notifyDueSoon}" aria-label="临近截止提醒"></button>
                </div>
                <div class="setting-row">
                  <div class="setting-row-main">
                    <strong>每日晨间清单</strong>
                    <p>在今日页显示 4 个帮助进入状态的小步骤。</p>
                  </div>
                  <button class="toggle ${state.settings.morningChecklist ? 'on' : ''}" type="button" data-action="toggle-setting" data-setting="morningChecklist" role="switch" aria-checked="${state.settings.morningChecklist}" aria-label="每日晨间清单"></button>
                </div>
              </div>
              <div class="data-actions" style="margin-top:13px;">
                <button class="btn btn-soft btn-sm" data-action="export-ics">${icon('calendar')}导出 .ics 日历</button>
                <button class="btn btn-ghost btn-sm" data-action="request-notification">${icon('bell')}请求通知权限</button>
              </div>
            </section>

            <section class="panel">
              <div class="settings-section-title">
                <span class="panel-icon">${icon('database')}</span>
                <h3>数据与备份</h3>
                <span class="badge">${dataSizeLabel()}</span>
              </div>
              <div class="setting-row">
                <div class="setting-row-main">
                  <strong>本地存储 ${storageBroken ? '不可用' : '正常'}</strong>
                  <p>数据只保存在这台设备。清理浏览器数据会一并删除，请定期备份。</p>
                </div>
              </div>
              <div class="data-actions">
                <button class="btn btn-soft btn-sm" data-action="export-json">${icon('download')}导出 JSON</button>
                <button class="btn btn-soft btn-sm" data-action="export-csv">${icon('file')}导出 CSV</button>
                <button class="btn btn-ghost btn-sm" data-action="import-json">${icon('upload')}导入备份</button>
                <button class="btn btn-ghost btn-sm" data-action="export-ics">${icon('calendar')}导出 .ics</button>
              </div>
              <div class="data-note">
                ${icon('shield')}
                <span>JSON 备份不会包含 API Key。导入备份会覆盖当前任务与消息，请先导出一份当前数据。</span>
              </div>
              <div class="danger-zone">
                <div class="setting-row">
                  <div class="setting-row-main">
                    <strong>重置与清理</strong>
                    <p>清空本机保存的全部任务、消息、作息和复盘内容。</p>
                  </div>
                </div>
                <div class="data-actions" style="margin-top:7px;">
                  <button class="btn btn-danger btn-sm" data-action="clear-data">${icon('trash')}清空所有数据</button>
                </div>
              </div>
            </section>

            <div class="settings-foot">
              <strong>拾光 · Study Flow</strong> &nbsp;${APP_VERSION} &nbsp;·&nbsp; 原生 HTML / CSS / JS &nbsp;·&nbsp; 数据留在本地
            </div>
          </div>
        </div>
      </div>`;
  }

  function getWeekNumber() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now - start) / MS_DAY);
    return Math.max(1, Math.ceil((days + start.getDay() + 1) / 7));
  }

  /* ============================================================
     11. 弹窗
     ============================================================ */
  function openModal(html) {
    const root = $('#modal-root');
    if (!root) return;
    if (!root.innerHTML.trim()) ui.lastFocus = document.activeElement;
    root.innerHTML = html;
    document.body.classList.add('modal-open');
    setTimeout(() => {
      const target = root.querySelector('[autofocus]') || root.querySelector('input, textarea, select');
      if (target) {
        target.focus();
        if (target.setSelectionRange && target.type !== 'email' && target.type !== 'password') {
          try { target.setSelectionRange(target.value.length, target.value.length); } catch (error) { /* noop */ }
        }
      }
    }, 20);
  }

  function closeModal() {
    const root = $('#modal-root');
    if (!root || !root.innerHTML.trim()) return;
    if (ui.visionController) {
      ui.visionController.abort();
      ui.visionController = null;
    }
    ui.visionLoading = false;
    root.innerHTML = '';
    document.body.classList.remove('modal-open');
    ui.confirmHandler = null;
    ui.taskModalContext = null;
    const last = ui.lastFocus;
    ui.lastFocus = null;
    if (last && document.contains(last) && typeof last.focus === 'function') {
      setTimeout(() => last.focus(), 20);
    }
  }

  function subtaskRowHTML(subtask) {
    const item = subtask || {};
    return `
      <div class="subtask-row" data-sub-id="${esc(item.id || uid('s'))}">
        <input type="checkbox" ${item.done ? 'checked' : ''} aria-label="子任务完成状态">
        <input type="text" value="${esc(item.title || '')}" placeholder="写一个更小的下一步…" maxlength="120" aria-label="子任务标题">
        <button class="icon-btn" type="button" data-action="remove-subtask" title="删除子任务" aria-label="删除子任务">${icon('x')}</button>
      </div>`;
  }

  function ensureSubtaskEmpty() {
    const list = $('#subtask-list');
    if (!list) return;
    const rows = list.querySelectorAll('.subtask-row');
    const empty = $('#subtask-empty');
    if (!rows.length && !empty) {
      list.insertAdjacentHTML('beforeend', '<div class="subtask-empty" id="subtask-empty">还没有子任务，把大任务拆成小步骤会更容易开始。</div>');
    }
    if (rows.length && empty) empty.remove();
  }

  function openTaskModal(task = null, options = {}) {
    const isNew = !task;
    const base = task ? { ...task } : {
      id: '',
      type: options.type || 'task',
      title: options.title || '',
      description: options.description || '',
      due: options.due || '',
      end: options.end || '',
      dueTimeKnown: options.dueTimeKnown !== false,
      location: options.location || '',
      priority: options.priority || 'p3',
      importance: options.importance || 'normal',
      urgency: options.urgency || 'normal',
      urgencySource: options.urgencySource || 'auto',
      status: options.status || 'todo',
      tags: options.tags || [],
      estimate: options.estimate || 0,
      routine: options.routine || null,
      routineDone: options.routineDone || {},
      subtasks: options.subtasks || [],
      sourceMessageId: options.sourceMessageId || null
    };
    const type = TASK_TYPES[base.type] ? base.type : 'task';
    const wakeTime = state.settings.schedule.wake || '07:30';
    const routine = base.routine || {
      start: wakeTime,
      end: minutesToTime(Math.min(1439, timeToMinutes(wakeTime) + 60)),
      days: [1, 2, 3, 4, 5],
      from: dateKey(new Date()),
      until: ''
    };
    const context = {
      isNew,
      fromQuick: Boolean(options.fromQuick),
      convertMessageId: options.convertMessageId || null
    };
    ui.taskModalContext = context;
    ui.taskModalType = type;
    const sourceMessage = base.sourceMessageId
      ? state.messages.find(m => m.id === base.sourceMessageId)
      : null;
    const dueInput = base.due ? toDatetimeLocal(base.due) : '';
    const endInput = base.end ? toDatetimeLocal(base.end) : '';
    const allDay = Boolean(base.due) && base.dueTimeKnown === false;
    const subtaskRows = (base.subtasks || []).map(subtaskRowHTML).join('');
    const baseImportance = effectiveImportance(base);
    const baseUrgency = effectiveUrgency(base);
    const urgencySource = base.urgencySource === 'manual' ? 'manual' : 'auto';
    const importanceOptions = Object.keys(IMPORTANCE_LEVELS).map(key =>
      `<option value="${key}" ${baseImportance === key ? 'selected' : ''}>${IMPORTANCE_LEVELS[key].label}</option>`
    ).join('');
    const urgencyOptions = [
      `<option value="auto" ${urgencySource === 'auto' ? 'selected' : ''}>自动判断</option>`,
      ...Object.keys(URGENCY_LEVELS).map(key =>
        `<option value="${key}" ${urgencySource === 'manual' && baseUrgency === key ? 'selected' : ''}>${URGENCY_LEVELS[key].label}</option>`)
    ].join('');
    const statusOptions = Object.keys(STATUSES).map(key =>
      `<option value="${key}" ${base.status === key ? 'selected' : ''}>${STATUSES[key].label}</option>`
    ).join('');
    const typeOptions = Object.keys(TASK_TYPES).map(key => {
      const meta = TASK_TYPES[key];
      return `
        <button class="task-type-option ${type === key ? 'active' : ''}" type="button" data-action="task-type" data-type="${key}" aria-pressed="${type === key}" style="--type-color:${meta.color};--type-soft:${meta.soft};">
          <span class="task-type-icon">${icon(meta.icon)}</span>
          <span class="task-type-copy"><strong>${meta.label}</strong><small>${meta.hint}</small></span>
        </button>`;
    }).join('');
    const dayChecks = WEEKDAYS.map(day => `
      <label class="day-check">
        <input type="checkbox" name="routineDays" value="${day.value}" ${routine.days.includes(day.value) ? 'checked' : ''}>
        <span>${day.label}</span>
      </label>`).join('');

    openModal(`
      <div class="modal-overlay">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="task-modal-title">
          <div class="modal-head">
            <div>
              <h2 id="task-modal-title">${isNew ? '捕获一件新任务' : '编辑任务'}</h2>
              <p>${isNew ? '先选一种类型，再填入这件事真正需要的细节。' : '调整类型与细节，让它更接近可以开始的状态。'}</p>
            </div>
            <button class="modal-close" type="button" data-action="close-modal" aria-label="关闭">${icon('x')}</button>
          </div>
          <form id="task-form" data-form="task-modal">
            <div class="modal-body">
              <div class="form-grid">
                <input type="hidden" name="taskId" value="${esc(base.id || '')}">
                <input type="hidden" name="sourceMessageId" value="${esc(base.sourceMessageId || '')}">
                <input type="hidden" name="convertMessageId" value="${esc(context.convertMessageId || '')}">
                <label class="field full">
                  <span>标题 <em>必填</em></span>
                  <input class="input" name="title" value="${esc(base.title || '')}" placeholder="例如：完成高数第三章作业" maxlength="120" required autofocus>
                </label>
                ${sourceMessage ? `
                  <div class="message-linked" style="grid-column:1/-1;margin:0;">
                    ${icon('inbox')}
                    <span>来源消息 · ${esc(sourceMessage.source)}：</span>
                    <span style="color:var(--brand-deep);">${esc(sourceMessage.content.slice(0, 72))}${sourceMessage.content.length > 72 ? '…' : ''}</span>
                  </div>` : ''}
                <div class="task-type-block full">
                  <span class="field-label">任务类型</span>
                  <div class="task-type-picker">${typeOptions}</div>
                </div>

                <div class="type-fields full" data-type-panel="task">
                  <div class="type-fields-inner">
                    <label class="field">
                      <span>截止时间</span>
                      <input class="input" type="datetime-local" name="due" id="task-due" value="${esc(dueInput)}">
                    </label>
                    <div class="field">
                      <span>时间设置</span>
                      <div class="all-day-row">
                        <label class="inline-check">
                          <input type="checkbox" name="allDay" ${allDay ? 'checked' : ''}> 仅日期（全天）
                        </label>
                        <button class="link-btn" type="button" data-action="clear-task-due">清除</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="type-fields full" data-type-panel="event">
                  <div class="type-fields-inner">
                    <label class="field">
                      <span>开始时间 <em>需要到场</em></span>
                      <input class="input" type="datetime-local" name="eventStart" value="${esc(dueInput)}">
                    </label>
                    <label class="field">
                      <span>结束时间</span>
                      <input class="input" type="datetime-local" name="eventEnd" value="${esc(endInput)}">
                    </label>
                    <label class="field full">
                      <span>地点</span>
                      <input class="input" name="location" value="${esc(base.location || '')}" placeholder="例如：图书馆报告厅 / 创新中心 302" maxlength="160">
                    </label>
                  </div>
                </div>

                <div class="type-fields full" data-type-panel="routine">
                  <div class="type-fields-inner">
                    <label class="field">
                      <span>每天开始</span>
                      <input class="input" type="time" name="routineStart" value="${esc(routine.start)}">
                    </label>
                    <label class="field">
                      <span>每天结束</span>
                      <input class="input" type="time" name="routineEnd" value="${esc(routine.end)}">
                    </label>
                    <div class="field full">
                      <span>重复星期</span>
                      <div class="day-checks">${dayChecks}</div>
                    </div>
                    <label class="field">
                      <span>从哪天开始 <em>可留空</em></span>
                      <input class="input" type="date" name="routineFrom" value="${esc(routine.from || '')}">
                    </label>
                    <label class="field">
                      <span>到哪天结束 <em>可留空</em></span>
                      <input class="input" type="date" name="routineUntil" value="${esc(routine.until || '')}">
                    </label>
                  </div>
                </div>

                <label class="field">
                  <span>重要度 <em>由你判断</em></span>
                  <select class="select" name="importance">${importanceOptions}</select>
                </label>
                <label class="field">
                  <span>紧急度 <em>可自动，也可改</em></span>
                  <select class="select" name="urgency">${urgencyOptions}</select>
                  <small class="field-note" id="urgency-note">自动判断：24 小时内紧急，3 天内普通，其余较低。</small>
                </label>
                <label class="field">
                  <span>状态</span>
                  <select class="select" name="status">${statusOptions}</select>
                </label>
                <label class="field" id="task-estimate-field">
                  <span>预计时长 <em>分钟</em></span>
                  <input class="input" type="number" name="estimate" min="0" max="1440" step="5" value="${Number(base.estimate) || 0}">
                </label>
                <label class="field">
                  <span>标签 <em>逗号分隔</em></span>
                  <input class="input" name="tags" value="${esc((base.tags || []).join(', '))}" placeholder="课程, 高数" maxlength="160">
                </label>
                <div class="form-section-label">任务细节</div>
                <label class="field full">
                  <span>描述</span>
                  <textarea class="textarea" name="description" placeholder="补充资料、链接、验收标准，或者写给未来自己的提示…" maxlength="1200">${esc(base.description || '')}</textarea>
                </label>
                <div class="subtasks-block">
                  <div class="subtasks-head">
                    <span>子任务</span>
                    <button class="add-subtask" type="button" data-action="add-subtask">${icon('plus')}添加子任务</button>
                  </div>
                  <div id="subtask-list">${subtaskRows || '<div class="subtask-empty" id="subtask-empty">还没有子任务，把大任务拆成小步骤会更容易开始。</div>'}</div>
                </div>
              </div>
              <div class="modal-error" id="task-modal-error" role="alert"></div>
            </div>
            <div class="modal-foot">
              <span style="font-size:9px;color:var(--faint);">${isNew ? '保存后会按类型出现在今日、任务与日历视图' : '修改会立即保存在本机'}</span>
              <div class="modal-foot-right">
                <button class="btn btn-ghost" type="button" data-action="close-modal">取消</button>
                <button class="btn btn-primary" type="submit">${icon('check')}${isNew ? '保存任务' : '保存修改'}</button>
              </div>
            </div>
          </form>
        </div>
      </div>`);
    const form = $('#task-form');
    if (form) updateTaskTypeUI(form, type);
  }

  function updateTaskTypeUI(form, type) {
    ui.taskModalType = TASK_TYPES[type] ? type : 'task';
    form.querySelectorAll('[data-type-panel]').forEach(panel => {
      const active = panel.dataset.typePanel === ui.taskModalType;
      panel.classList.toggle('is-hidden', !active);
      panel.querySelectorAll('input, select, textarea, button').forEach(el => {
        el.disabled = !active;
      });
    });
    form.querySelectorAll('.task-type-option').forEach(button => {
      const active = button.dataset.type === ui.taskModalType;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const estimateField = $('#task-estimate-field');
    if (estimateField) estimateField.classList.toggle('is-hidden', ui.taskModalType !== 'task');
    const urgencyNote = form.querySelector('#urgency-note');
    if (urgencyNote) {
      urgencyNote.textContent = ui.taskModalType === 'routine'
        ? '自动判断：日程开始前 2 小时内紧急，24 小时内普通，其余较低。'
        : '自动判断：24 小时内紧急，3 天内普通，其余较低。';
    }
    const start = form.querySelector('[name="eventStart"]');
    const end = form.querySelector('[name="eventEnd"]');
    if (ui.taskModalType === 'event' && start && start.value && end && !end.value) {
      end.value = toDatetimeLocal(addMinutes(fromDatetimeLocal(start.value), 90));
    }
  }

  function openConfirm(options = {}) {
    ui.confirmHandler = typeof options.onConfirm === 'function' ? options.onConfirm : null;
    openModal(`
      <div class="modal-overlay">
        <div class="modal small" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div class="modal-head">
            <div>
              <h2 id="confirm-title">${esc(options.title || '确认操作')}</h2>
              ${options.subtitle ? `<p>${esc(options.subtitle)}</p>` : ''}
            </div>
            <button class="modal-close" type="button" data-action="close-modal" aria-label="关闭">${icon('x')}</button>
          </div>
          <div class="modal-body">
            <p style="font-size:11.5px;line-height:1.8;color:var(--muted);">${esc(options.message || '这个操作无法撤销。')}</p>
          </div>
          <div class="modal-foot">
            <span></span>
            <div class="modal-foot-right">
              <button class="btn btn-ghost" type="button" data-action="close-modal">取消</button>
              <button class="btn ${options.danger ? 'btn-danger' : 'btn-primary'}" type="button" data-action="confirm-modal">${esc(options.confirmLabel || '确认')}</button>
            </div>
          </div>
        </div>
      </div>`);
  }

  function openLinkModal(messageId) {
    const message = state.messages.find(m => m.id === messageId);
    if (!message) return;
    const tasks = state.tasks.slice().sort(taskSortByDue);
    openModal(`
      <div class="modal-overlay">
        <div class="modal medium" role="dialog" aria-modal="true" aria-labelledby="link-modal-title">
          <div class="modal-head">
            <div>
              <h2 id="link-modal-title">关联一条任务</h2>
              <p>把这条消息挂到对应任务上，之后回看时不会失去上下文。</p>
            </div>
            <button class="modal-close" type="button" data-action="close-modal" aria-label="关闭">${icon('x')}</button>
          </div>
          <form data-form="link-task">
            <input type="hidden" name="messageId" value="${esc(message.id)}">
            <div class="modal-body">
              <div class="message-linked" style="margin:0 0 12px;">
                ${icon('inbox')}
                <span>${esc(message.source)}：</span>
                <span>${esc(message.content.slice(0, 90))}${message.content.length > 90 ? '…' : ''}</span>
              </div>
              <div class="link-task-list">
                <label class="link-task-option">
                  <input type="radio" name="taskId" value="" ${!message.taskId ? 'checked' : ''}>
                  <span>不关联任务<small>只保留消息本身</small></span>
                </label>
                ${tasks.map(task => `
                  <label class="link-task-option">
                    <input type="radio" name="taskId" value="${esc(task.id)}" ${message.taskId === task.id ? 'checked' : ''}>
                    <span>${esc(task.title)}<small>${esc(dueLabel(task))} · ${STATUSES[task.status].label}</small></span>
                  </label>`).join('')}
              </div>
              ${!tasks.length ? `<div class="subtask-empty" style="margin-top:10px;">还没有任务，先在任务页新建一个，再回来关联。</div>` : ''}
            </div>
            <div class="modal-foot">
              <span style="font-size:9px;color:var(--faint);">${tasks.length} 个可选任务</span>
              <div class="modal-foot-right">
                <button class="btn btn-ghost" type="button" data-action="close-modal">取消</button>
                <button class="btn btn-primary" type="submit">${icon('link')}保存关联</button>
              </div>
            </div>
          </form>
        </div>
      </div>`);
  }

  function markMessageConverted(messageId, taskId) {
    const message = state.messages.find(m => m.id === messageId);
    if (message) {
      message.taskId = taskId;
      message.processed = true;
    }
  }

  function saveTaskFromModal(form) {
    const errorBox = $('#task-modal-error');
    const showError = message => {
      if (errorBox) errorBox.textContent = message;
      toast(message, 'error');
    };
    if (errorBox) errorBox.textContent = '';
    const title = String(form.elements.title.value || '').trim();
    if (!title) {
      showError('先给任务起一个名字吧。');
      form.elements.title.focus();
      return;
    }
    const type = TASK_TYPES[ui.taskModalType] ? ui.taskModalType : 'task';
    const taskId = String(form.elements.taskId.value || '');
    const existing = taskId ? state.tasks.find(t => t.id === taskId) : null;
    let due = '';
    let dueTimeKnown = false;
    let end = '';
    let location = '';
    let routine = null;
    let routineDone = existing && existing.type === 'routine' ? { ...(existing.routineDone || {}) } : {};
    let estimate = Math.max(0, Math.min(1440, Number(form.elements.estimate.value) || 0));

    if (type === 'task') {
      const dueInput = String(form.elements.due.value || '');
      const allDay = Boolean(form.elements.allDay && form.elements.allDay.checked);
      if (dueInput) {
        if (allDay) {
          const day = fromDateKey(dueInput.slice(0, 10));
          due = atTime(day, 23, 59).toISOString();
          dueTimeKnown = false;
        } else {
          due = fromDatetimeLocal(dueInput);
          dueTimeKnown = true;
        }
      }
    } else if (type === 'event') {
      const startInput = String(form.elements.eventStart.value || '');
      const endInput = String(form.elements.eventEnd.value || '');
      if (!startInput || !endInput) {
        showError('事件需要开始与结束时间，才能看出一段时间是否被占用。');
        form.elements.eventStart.focus();
        return;
      }
      const startDate = new Date(fromDatetimeLocal(startInput));
      const endDate = new Date(fromDatetimeLocal(endInput));
      if (endDate <= startDate) {
        showError('结束时间需要晚于开始时间。');
        form.elements.eventEnd.focus();
        return;
      }
      due = startDate.toISOString();
      end = endDate.toISOString();
      dueTimeKnown = true;
      location = String(form.elements.location.value || '').trim().slice(0, 160);
      estimate = Math.round((endDate - startDate) / 60000);
    } else {
      const start = String(form.elements.routineStart.value || '');
      const finish = String(form.elements.routineEnd.value || '');
      const days = $$('input[name="routineDays"]:checked', form).map(el => Number(el.value));
      if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(finish)) {
        showError('日程需要填写固定的开始与结束时间。');
        return;
      }
      if (timeToMinutes(finish) <= timeToMinutes(start)) {
        showError('日程的结束时间需要晚于开始时间。');
        form.elements.routineEnd.focus();
        return;
      }
      if (!days.length) {
        showError('至少选择一个重复的星期。');
        return;
      }
      const from = String(form.elements.routineFrom.value || '');
      const until = String(form.elements.routineUntil.value || '');
      if (from && until && until < from) {
        showError('结束日期不能早于开始日期。');
        form.elements.routineUntil.focus();
        return;
      }
      routine = { start, end: finish, days: [...new Set(days)].sort(), from, until };
      estimate = timeToMinutes(finish) - timeToMinutes(start);
      due = '';
      dueTimeKnown = false;
      routineDone = existing && existing.type === 'routine' ? { ...(existing.routineDone || {}) } : {};
    }

    const status = STATUSES[form.elements.status.value] ? form.elements.status.value : 'todo';
    const completedAt = status === 'done'
      ? ((existing && existing.completedAt) || new Date().toISOString())
      : null;
    const tags = [...new Set(String(form.elements.tags.value || '')
      .split(/[,，、;；\n]+/)
      .map(tag => tag.trim())
      .filter(Boolean))].slice(0, 12);
    const subtasks = $$('#subtask-list .subtask-row').map(row => ({
      id: row.dataset.subId || uid('s'),
      title: row.querySelector('input[type="text"]').value.trim(),
      done: row.querySelector('input[type="checkbox"]').checked
    })).filter(subtask => subtask.title);
    const importance = IMPORTANCE_LEVELS[form.elements.importance.value]
      ? form.elements.importance.value
      : 'normal';
    const urgencyChoice = form.elements.urgency.value;
    const urgencySource = urgencyChoice === 'auto' ? 'auto' : 'manual';
    const urgency = urgencyChoice === 'auto'
      ? ((existing && existing.urgency) || 'normal')
      : (URGENCY_LEVELS[urgencyChoice] ? urgencyChoice : 'normal');
    const legacyPriority = urgencySource === 'manual' && urgency === 'high'
      ? 'p1'
      : (importance === 'high' ? 'p2' : (importance === 'low' ? 'p4' : 'p3'));
    const now = new Date().toISOString();
    const nextTask = normalizeTask({
      id: existing ? existing.id : uid('t'),
      type,
      title: title.slice(0, 240),
      description: String(form.elements.description.value || '').slice(0, 4000),
      due,
      end,
      dueTimeKnown,
      location,
      priority: legacyPriority,
      importance,
      urgency,
      urgencySource,
      status,
      tags,
      estimate,
      routine,
      routineDone,
      subtasks,
      sourceMessageId: form.elements.sourceMessageId.value || null,
      createdAt: existing ? existing.createdAt : now,
      completedAt
    });
    if (existing) {
      state.tasks = state.tasks.map(t => t.id === existing.id ? nextTask : t);
    } else {
      state.tasks.unshift(nextTask);
    }
    if (nextTask.sourceMessageId) {
      markMessageConverted(nextTask.sourceMessageId, nextTask.id);
    }
    const convertId = String(form.elements.convertMessageId.value || '');
    if (convertId) markMessageConverted(convertId, nextTask.id);

    const context = { ...(ui.taskModalContext || {}) };
    saveState();
    closeModal();
    if (context.fromQuick) {
      ui.quickDraft = '';
      ui.aiParsed = null;
    }
    renderCurrentPage(true);
    toast(context.isNew ? '任务已捕获，慢慢来就好' : '任务已更新', 'success');
  }

  /* ============================================================
     12. 页面渲染与路由
     ============================================================ */
  function renderCurrentPage(keepScroll = false) {
    const container = $('#page');
    if (!container) return;
    const scrollY = window.scrollY;
    let html = '';
    if (ui.page === 'tasks') html = renderTasksPage();
    else if (ui.page === 'calendar') html = renderCalendarPage();
    else if (ui.page === 'messages') html = renderMessagesPage();
    else if (ui.page === 'settings') html = renderSettingsPage();
    else html = renderToday();
    container.innerHTML = html;
    updateChrome();
    if (ui.page === 'today') updateCapturePreview();
    if (keepScroll) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollY, behavior: 'auto' });
      });
    }
  }

  function pageFromHash() {
    return location.hash.replace(/^#/, '');
  }

  function navigateTo(page) {
    if (!PAGES[page]) return;
    if (location.hash === `#${page}`) {
      ui.page = page;
      if (page !== 'tasks') {
        ui.multiSelect = false;
        ui.selectedTaskIds = [];
      }
      renderCurrentPage();
      window.scrollTo({ top: 0, behavior: 'auto' });
    } else {
      location.hash = page;
    }
  }

  function handleHashChange() {
    const page = pageFromHash();
    if (!PAGES[page]) {
      history.replaceState(null, '', '#today');
      ui.page = 'today';
    } else {
      ui.page = page;
    }
    if (page !== 'tasks') {
      ui.multiSelect = false;
      ui.selectedTaskIds = [];
    }
    if ($('#modal-root').innerHTML.trim()) closeModal();
    renderCurrentPage();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function focusCompose() {
    const focusIt = () => {
      const textarea = $('.compose-textarea');
      if (textarea) {
        textarea.focus();
        textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };
    if (ui.page === 'messages') {
      focusIt();
    } else {
      navigateTo('messages');
      setTimeout(focusIt, 90);
    }
  }

  /* ============================================================
     13. 浏览器通知
     ============================================================ */
  function loadNotified() {
    return new Set(AppStorage.loadNotified());
  }

  function persistNotified() {
    try {
      const list = [...ui.notified].slice(-240);
      ui.notified = new Set(list);
      AppStorage.saveNotified(list);
    } catch (error) {
      console.warn('保存通知记录失败：', error);
    }
  }

  function sendNotification(title, body, tag) {
    if (!notificationSupported() || Notification.permission !== 'granted') return false;
    try {
      const notification = new Notification(title, {
        body,
        tag,
        silent: false
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
      return true;
    } catch (error) {
      console.warn('发送通知失败：', error);
      return false;
    }
  }

  function checkNotifications() {
    if (!state || !state.settings.browserNotify) return;
    if (!notificationSupported() || Notification.permission !== 'granted') return;
    const now = new Date();
    const addKey = key => {
      if (!ui.notified.has(key)) {
        ui.notified.add(key);
        return true;
      }
      return false;
    };
    let changed = false;

    if (now.getHours() >= 6) {
      const dailyKey = `day-${todayKey()}`;
      const todayTasks = getTodayTasks().filter(task => !isDone(task));
      if (todayTasks.length && addKey(dailyKey)) {
        changed = true;
        const first = todayTasks[0];
        sendNotification(
          '拾光 · 今日清单',
          `今天还有 ${todayTasks.length} 项任务。最近一项：${first.title}（${dueLabel(first)}）。`,
          `shiguang-day-${todayKey()}`
        );
      }
    }

    if (state.settings.notifyDueSoon) {
      getDueSoon().forEach(task => {
        const key = `due-${task.id}-${task.due}`;
        if (addKey(key)) {
          changed = true;
          sendNotification(
            '拾光 · 即将截止',
            `${task.title} 将在 ${dueLabel(task)} 截止，预计需要 ${estimateLabel(task.estimate) || '一点时间'}。`,
            `shiguang-due-${task.id}`
          );
        }
      });
    }

    if (changed) persistNotified();
  }

  async function enableBrowserNotifications(fromBell = false) {
    if (!notificationSupported()) {
      toast('当前浏览器不支持桌面通知', 'error');
      return false;
    }
    if (Notification.permission === 'denied') {
      toast('通知权限已被浏览器拒绝，请在浏览器站点设置中重新允许', 'error');
      return false;
    }
    let permission = Notification.permission;
    if (permission === 'default') {
      try {
        permission = await Notification.requestPermission();
      } catch (error) {
        console.warn('请求通知权限失败：', error);
        toast('无法请求通知权限，请检查浏览器设置', 'error');
        return false;
      }
    }
    if (permission !== 'granted') {
      toast('没有获得通知权限，可以在浏览器设置里再打开', 'info');
      if (state.settings.browserNotify) {
        state.settings.browserNotify = false;
        saveState();
        if (ui.page === 'settings' || ui.page === 'today') renderCurrentPage(true);
      }
      return false;
    }
    state.settings.browserNotify = true;
    saveState();
    if (ui.page === 'settings' || ui.page === 'today') renderCurrentPage(true);
    checkNotifications();
    toast(fromBell ? '桌面通知已开启，今日清单会提醒你' : '桌面通知已开启', 'success');
    return true;
  }

  /* ============================================================
     14. 导入 / 导出
     ============================================================ */
  function localDateTimeLabel(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return `${dateKey(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function exportJSON() {
    const copy = JSON.parse(JSON.stringify(state));
    copy.settings.ai = {
      ...copy.settings.ai,
      enabled: false,
      activeKeyId: '',
      keys: []
    };
    const payload = {
      app: '拾光 Study Flow',
      version: 2,
      exportedAt: new Date().toISOString(),
      data: copy
    };
    downloadFile(
      `shiguang-backup-${dateKey(new Date())}.json`,
      JSON.stringify(payload, null, 2),
      'application/json;charset=utf-8'
    );
    toast('JSON 备份已导出，不包含 API Key', 'success');
  }

  function exportCSV() {
    const head = ['标题', '类型', '描述', '时间安排', '紧急度', '重要度', '状态', '标签', '预计时长（分钟）', '子任务', '来源消息', '创建时间', '完成时间'];
    const rows = state.tasks
      .slice()
      .sort(taskSmartSort)
      .map(task => {
        const source = task.sourceMessageId
          ? state.messages.find(m => m.id === task.sourceMessageId)
          : null;
        return [
          task.title,
          taskTypeMeta(task.type).label,
          String(task.description || '').replace(/\r?\n/g, ' '),
          taskScheduleText(task),
          urgencyMeta(effectiveUrgency(task)).label,
          importanceMeta(effectiveImportance(task)).label,
          STATUSES[task.status].label,
          task.tags.join(' / '),
          task.estimate || '',
          (task.subtasks || []).map(s => `${s.done ? '[x]' : '[ ]'} ${s.title}`).join('；'),
          source ? `${source.source}（${SOURCE_TYPES[source.sourceType].label}）` : '',
          localDateTimeLabel(task.createdAt),
          task.completedAt ? localDateTimeLabel(task.completedAt) : ''
        ];
      });
    const csvEscape = value => `"${String(value == null ? '' : value).replace(/"/g, '""')}"`;
    const csv = [head, ...rows].map(row => row.map(csvEscape).join(',')).join('\r\n');
    downloadFile(
      `shiguang-tasks-${dateKey(new Date())}.csv`,
      `\uFEFF${csv}`,
      'text/csv;charset=utf-8'
    );
    toast('CSV 已导出，可以用 Excel 打开', 'success');
  }

  function icsEscape(value) {
    return String(value == null ? '' : value)
      .replace(/\\/g, '\\\\')
      .replace(/\r?\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');
  }

  function icsUTC(value) {
    return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  }

  function icsDateOnly(value) {
    const d = new Date(value);
    return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
  }

  function exportICS() {
    const tasks = state.tasks.filter(task => task.type === 'routine' || task.due).sort(taskSortByDue);
    if (!tasks.length) {
      toast('还没有可以导出的任务或日程', 'info');
      return;
    }
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Shiguang Study Flow//CN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:拾光 · 任务 DDL',
      'X-WR-TIMEZONE:Asia/Shanghai'
    ];
    tasks.forEach(task => {
      const isRoutine = task.type === 'routine';
      let start;
      let end;
      if (isRoutine) {
        const fromKey = task.routine.from || todayKey();
        start = new Date(`${fromKey}T${task.routine.start}:00`);
        end = new Date(`${fromKey}T${task.routine.end}:00`);
      } else {
        start = new Date(task.due);
        end = task.type === 'event' && task.end
          ? new Date(task.end)
          : new Date(start.getTime() + Math.max(30, Number(task.estimate) || 30) * 60000);
      }
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${task.id}@shiguang.local`);
      lines.push(`DTSTAMP:${icsUTC(new Date())}`);
      if (isRoutine) {
        const dayCodes = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
        lines.push(`DTSTART:${icsUTC(start)}`);
        lines.push(`DTEND:${icsUTC(end)}`);
        let rule = `RRULE:FREQ=WEEKLY;BYDAY=${(task.routine.days || []).map(d => dayCodes[d]).join(',')}`;
        if (task.routine.until) rule += `;UNTIL=${icsUTC(new Date(`${task.routine.until}T23:59:59`))}`;
        lines.push(rule);
      } else if (task.dueTimeKnown === false) {
        lines.push(`DTSTART;VALUE=DATE:${icsDateOnly(start)}`);
        lines.push(`DTEND;VALUE=DATE:${icsDateOnly(addDays(start, 1))}`);
      } else {
        lines.push(`DTSTART:${icsUTC(start)}`);
        lines.push(`DTEND:${icsUTC(end)}`);
      }
      const typeLabel = taskTypeMeta(task.type).short;
      const urgency = urgencyMeta(effectiveUrgency(task));
      const importance = importanceMeta(effectiveImportance(task));
      lines.push(`SUMMARY:${icsEscape(`【急 ${urgency.label} · 重 ${importance.label} · ${typeLabel}】${task.title}`)}`);
      const descriptionParts = [];
      if (isRoutine) descriptionParts.push(`固定日程：${routineLabel(task)} ${task.routine.start}–${task.routine.end}`);
      if (task.description) descriptionParts.push(task.description);
      if (task.tags.length) descriptionParts.push(`标签：${task.tags.join('、')}`);
      if ((task.subtasks || []).length) {
        descriptionParts.push('子任务：' + task.subtasks.map(s => `${s.done ? '✓' : '○'} ${s.title}`).join('；'));
      }
      if (!isRoutine) descriptionParts.push(`状态：${STATUSES[task.status].label}`);
      lines.push(`DESCRIPTION:${icsEscape(descriptionParts.join('\n'))}`);
      if (task.tags.length) lines.push(`CATEGORIES:${icsEscape(task.tags.join(','))}`);
      if (task.type === 'event' && task.location) lines.push(`LOCATION:${icsEscape(task.location)}`);
      lines.push('STATUS:CONFIRMED');
      lines.push('TRANSP:OPAQUE');
      if (!isRoutine && !isDone(task)) {
        lines.push('BEGIN:VALARM');
        lines.push('TRIGGER:-PT2H');
        lines.push('ACTION:DISPLAY');
        lines.push(`DESCRIPTION:${icsEscape(`任务即将截止：${task.title}`)}`);
        lines.push('END:VALARM');
      }
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    downloadFile(
      `shiguang-ddl-${dateKey(new Date())}.ics`,
      lines.join('\r\n'),
      'text/calendar;charset=utf-8'
    );
    toast(`已导出 ${tasks.length} 个 DDL 到 .ics 文件`, 'success');
  }

  function importJSONFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ''));
        const raw = parsed && parsed.data && Array.isArray(parsed.data.tasks) ? parsed.data : parsed;
        if (!raw || !Array.isArray(raw.tasks)) throw new Error('没有 tasks 数组');
        const imported = normalizeState(raw);
        if (!imported.settings.ai.keys.length && state.settings.ai.keys.length) {
          imported.settings.ai.keys = state.settings.ai.keys;
          imported.settings.ai.activeKeyId = state.settings.ai.activeKeyId;
          imported.settings.ai.enabled = state.settings.ai.enabled;
        }
        openConfirm({
          title: '导入这份备份？',
          subtitle: '当前数据会被覆盖',
          message: `备份中有 ${imported.tasks.length} 个任务和 ${imported.messages.length} 条消息。导入后会替换当前全部任务、消息与设置，建议先导出一份当前数据。`,
          confirmLabel: '导入并覆盖',
          danger: true,
          onConfirm: () => {
            state = imported;
            saveState();
            renderCurrentPage();
            toast('备份已导入', 'success');
          }
        });
      } catch (error) {
        console.warn('导入 JSON 失败：', error);
        toast('文件格式不正确，无法导入', 'error');
      }
    };
    reader.onerror = () => toast('读取文件失败，请重试', 'error');
    reader.readAsText(file, 'utf-8');
  }

  /* ============================================================
     15. 任务与消息操作
     ============================================================ */
  function toggleTaskDone(taskId, dateStr) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;
    if (task.type === 'routine') {
      const key = dateStr || taskNextRoutineKey(task);
      if (!key) {
        toast('这段日程还没有可执行的日期', 'info');
        return;
      }
      task.routineDone = task.routineDone && typeof task.routineDone === 'object' ? task.routineDone : {};
      if (task.routineDone[key]) {
        delete task.routineDone[key];
        toast('这次日程已恢复为待完成', 'info');
      } else {
        task.routineDone[key] = true;
        toast('这次日程完成，继续保持', 'success');
      }
      saveState();
      renderCurrentPage(true);
      return;
    }
    if (isDone(task)) {
      task.status = 'todo';
      task.completedAt = null;
    } else {
      task.status = 'done';
      task.completedAt = new Date().toISOString();
      toast('完成一件，辛苦了', 'success');
    }
    saveState();
    renderCurrentPage(true);
  }

  function requestDeleteTask(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;
    openConfirm({
      title: '删除这个任务？',
      subtitle: '任务会被永久移除',
      message: `“${task.title}”将从本地删除。如果有关联的消息，关联会解除，但消息本身会保留。`,
      confirmLabel: '删除任务',
      danger: true,
      onConfirm: () => {
        state.tasks = state.tasks.filter(t => t.id !== taskId);
        state.messages.forEach(message => {
          if (message.taskId === taskId) message.taskId = null;
        });
        ui.selectedTaskIds = ui.selectedTaskIds.filter(id => id !== taskId);
        saveState();
        renderCurrentPage(true);
        toast('任务已删除', 'success');
      }
    });
  }

  function syncTaskSelectionUI() {
    if (!ui.multiSelect) return;
    const visibleIds = getFilteredTasks().map(task => task.id);
    const visibleSet = new Set(visibleIds);
    ui.selectedTaskIds = ui.selectedTaskIds.filter(id => visibleSet.has(id));

    const count = ui.selectedTaskIds.length;
    const countEl = $('#bulk-selected-count');
    if (countEl) countEl.textContent = String(count);

    const all = $('#task-select-all');
    if (all) {
      all.checked = visibleIds.length > 0 && count === visibleIds.length;
      all.indeterminate = count > 0 && count < visibleIds.length;
      all.disabled = visibleIds.length === 0;
    }

    const del = $('#bulk-delete');
    if (del) del.disabled = count === 0;
  }

  function setTaskSelected(taskId, selected) {
    const ids = new Set(ui.selectedTaskIds);
    if (selected) ids.add(taskId);
    else ids.delete(taskId);
    ui.selectedTaskIds = [...ids];
    const row = document.querySelector(`[data-task-row="${taskId}"]`);
    if (row) {
      row.classList.toggle('is-selected', selected);
      const box = row.querySelector('.task-select');
      if (box) box.checked = selected;
    }
    syncTaskSelectionUI();
  }

  function toggleMultiSelectMode() {
    ui.multiSelect = !ui.multiSelect;
    ui.selectedTaskIds = [];
    if (ui.multiSelect) ui.taskView = 'list';
    renderCurrentPage(true);
  }

  function requestDeleteSelectedTasks() {
    const ids = new Set(ui.selectedTaskIds);
    const tasks = state.tasks.filter(task => ids.has(task.id));
    if (!tasks.length) {
      toast('还没有选中任务', 'info');
      return;
    }
    openConfirm({
      title: `删除选中的 ${tasks.length} 个任务？`,
      subtitle: '批量删除无法撤销',
      message: '选中的任务会从本地永久删除。关联的消息会保留，只解除关联关系。',
      confirmLabel: `删除 ${tasks.length} 个任务`,
      danger: true,
      onConfirm: () => {
        state.tasks = state.tasks.filter(task => !ids.has(task.id));
        state.messages.forEach(message => {
          if (ids.has(message.taskId)) message.taskId = null;
        });
        ui.selectedTaskIds = [];
        ui.multiSelect = false;
        saveState();
        renderCurrentPage(true);
        toast(`已删除 ${tasks.length} 个任务`, 'success');
      }
    });
  }

  function convertMessageToTask(messageId) {
    const message = state.messages.find(m => m.id === messageId);
    if (!message) return;
    if (message.taskId) {
      const existing = state.tasks.find(t => t.id === message.taskId);
      if (existing) {
        openTaskModal(existing);
        return;
      }
    }
    const parsed = parseNaturalLanguage(message.content);
    const title = messageTaskTitle(message.content);
    const hasExplicitEstimate = /预计|大概(?:需要|要)|大约(?:需要|要)|耗时/.test(message.content);
    openTaskModal(null, {
      title,
      description: message.content,
      due: parsed.due,
      dueTimeKnown: parsed.dueTimeKnown,
      priority: parsed.priority,
      importance: parsed.importance,
      urgency: parsed.urgency,
      urgencySource: parsed.urgencySource,
      tags: parsed.tags,
      estimate: hasExplicitEstimate ? parsed.estimate : 0,
      sourceMessageId: message.id,
      convertMessageId: message.id
    });
  }

  function requestDeleteMessage(messageId) {
    const message = state.messages.find(m => m.id === messageId);
    if (!message) return;
    openConfirm({
      title: '删除这条消息？',
      subtitle: '消息会从收件箱移除',
      message: `${message.source} 的这条消息将从本地删除，已关联的任务会保留。`,
      confirmLabel: '删除消息',
      danger: true,
      onConfirm: () => {
        state.messages = state.messages.filter(m => m.id !== messageId);
        state.tasks.forEach(task => {
          if (task.sourceMessageId === messageId) task.sourceMessageId = null;
        });
        saveState();
        renderCurrentPage(true);
        toast('消息已删除', 'success');
      }
    });
  }

  function toggleMessageProcessed(messageId) {
    const message = state.messages.find(m => m.id === messageId);
    if (!message) return;
    message.processed = !message.processed;
    saveState();
    renderCurrentPage(true);
    toast(message.processed ? '消息已处理' : '消息回到未处理', 'success');
  }

  /* ============================================================
     16. 表单提交
     ============================================================ */
  function handleQuickCapture(form) {
    const input = form.elements.quick;
    const raw = String(input.value || '').trim();
    if (!raw) {
      toast('先写下一件想记住的事', 'info');
      input.focus();
      return;
    }
    const aiMatch = ui.aiParsed && ui.aiParsed.text === raw;
    const parsed = aiMatch ? ui.aiParsed.data : parseNaturalLanguage(raw);
    openTaskModal(null, {
      title: parsed.title,
      description: parsed.description || '',
      due: parsed.due,
      dueTimeKnown: parsed.dueTimeKnown,
      priority: parsed.priority,
      importance: parsed.importance,
      urgency: parsed.urgency,
      urgencySource: parsed.urgencySource,
      tags: parsed.tags,
      estimate: parsed.estimate,
      fromQuick: true
    });
  }

  function handleMessageSubmit(form) {
    const content = String(form.elements.content.value || '').trim();
    const source = String(form.elements.source.value || '').trim();
    if (!content) {
      toast('消息内容不能为空', 'error');
      return;
    }
    if (!source) {
      toast('给这条消息加一个来源吧', 'error');
      form.elements.source.focus();
      return;
    }
    const type = SOURCE_TYPES[form.elements.sourceType.value] ? form.elements.sourceType.value : 'other';
    state.messages.unshift({
      id: uid('m'),
      source: source.slice(0, 100),
      sourceType: type,
      content: content.slice(0, 8000),
      createdAt: new Date().toISOString(),
      processed: false,
      taskId: null
    });
    saveState();
    form.reset();
    renderCurrentPage(true);
    toast('消息已收进收件箱', 'success');
    const textarea = $('.compose-textarea');
    if (textarea) textarea.focus();
  }

  function handleLinkTaskSubmit(form) {
    const messageId = String(form.elements.messageId.value || '');
    const message = state.messages.find(m => m.id === messageId);
    if (!message) return;
    const selected = form.querySelector('input[name="taskId"]:checked');
    message.taskId = selected && selected.value ? selected.value : null;
    saveState();
    closeModal();
    renderCurrentPage(true);
    toast('关联已保存', 'success');
  }

  async function validateApiKeyEntry(entry) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(modelsEndpointFor(entry), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${entry.key}`,
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
      clearTimeout(timer);
      if (response.ok) return { ok: true };
      if (response.status === 401 || response.status === 403) {
        return { ok: false, message: 'Key 无效，或这个通道没有访问权限（401 / 403）。' };
      }
      if (response.status === 404) {
        return { ok: false, message: '接口没有找到 /models，请检查 Base URL 是否填对。' };
      }
      let detail = '';
      try {
        const data = await response.json();
        detail = (data && data.error && (data.error.message || data.error.code)) || '';
      } catch (error) { /* response is not JSON */ }
      return { ok: false, message: `验证失败（HTTP ${response.status}）${detail ? `：${detail}` : ''}` };
    } catch (error) {
      clearTimeout(timer);
      if (error && error.name === 'AbortError') {
        return { ok: false, message: '验证超时，请检查网络或稍后再试。' };
      }
      return { ok: false, message: '无法连接验证接口，请检查地址、网络或浏览器的跨域限制。' };
    }
  }

  async function handleApiKeySubmit(form) {
    if (ui.aiValidating) return;
    const provider = AI_PROVIDERS[form.elements.provider.value] ? form.elements.provider.value : 'custom';
    const meta = AI_PROVIDERS[provider];
    const label = String(form.elements.label.value || '').trim() || meta.label;
    const key = String(form.elements.key.value || '').trim();
    const model = String(form.elements.model.value || '').trim() || meta.model;
    const endpoint = String(form.elements.endpoint.value || '').trim().replace(/\/+$/, '');
    const errorEl = $('#api-key-error');
    const submitBtn = form.querySelector('[type="submit"]');
    const showError = message => {
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
      }
      toast(message, 'error');
    };
    if (errorEl) errorEl.classList.add('hidden');
    if (!/^https?:\/\//i.test(endpoint)) {
      showError('API 地址需要以 http:// 或 https:// 开头。');
      form.elements.endpoint.focus();
      return;
    }
    try { new URL(endpoint); } catch (error) {
      showError('API 地址格式不正确。');
      form.elements.endpoint.focus();
      return;
    }
    if (key.length < 6) {
      showError('API Key 太短，请检查是否完整粘贴。');
      form.elements.key.focus();
      return;
    }
    ui.aiValidating = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `${icon('sparkles')}正在验证…`;
    }
    const entry = normalizeApiKey({
      id: uid('key'),
      provider,
      label,
      endpoint,
      model,
      key,
      lastValidatedAt: new Date().toISOString()
    });
    const result = await validateApiKeyEntry(entry);
    ui.aiValidating = false;
    if (!result.ok) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `${icon('shield')}验证并保存`;
      }
      showError(result.message);
      return;
    }
    state.settings.ai.keys.push(entry);
    state.settings.ai.activeKeyId = entry.id;
    state.settings.ai.enabled = true;
    saveState();
    closeModal();
    renderCurrentPage(true);
    toast('Key 已验证并保存在本机', 'success');
  }

  function openApiKeyModal() {
    const provider = state.settings.ai.keys[0]
      ? state.settings.ai.keys[0].provider
      : 'deepseek';
    const meta = AI_PROVIDERS[provider] || AI_PROVIDERS.deepseek;
    openModal(`
      <div class="modal-overlay">
        <div class="modal medium" role="dialog" aria-modal="true" aria-labelledby="api-key-title">
          <div class="modal-head">
            <div>
              <h2 id="api-key-title">添加 API 通道</h2>
              <p>先验证 Key 是否可用，再保存到当前浏览器。</p>
            </div>
            <button class="modal-close" type="button" data-action="close-modal" aria-label="关闭">${icon('x')}</button>
          </div>
          <form data-form="api-key">
            <div class="modal-body">
              <div class="form-grid">
                <label class="field">
                  <span>通道</span>
                  <select class="select" name="provider" id="api-provider">
                    ${Object.keys(AI_PROVIDERS).map(key => `<option value="${key}" ${key === provider ? 'selected' : ''}>${AI_PROVIDERS[key].label}</option>`).join('')}
                  </select>
                </label>
                <label class="field">
                  <span>显示名称</span>
                  <input class="input" name="label" value="${esc(meta.label)}" maxlength="60" placeholder="例如：我的 DeepSeek">
                </label>
                <label class="field full">
                  <span>Base URL <em>不含 /chat/completions</em></span>
                  <input class="input" name="endpoint" value="${esc(meta.base)}" placeholder="https://api.deepseek.com" spellcheck="false" required>
                </label>
                <label class="field">
                  <span>模型</span>
                  <input class="input" name="model" value="${esc(meta.model)}" placeholder="deepseek-chat" spellcheck="false" required>
                </label>
                <label class="field">
                  <span>API Key <em>只存本机</em></span>
                  <div class="ai-key-row">
                    <input class="input" name="key" type="password" placeholder="sk-…" autocomplete="off" spellcheck="false" required autofocus>
                    <button class="key-eye" type="button" data-action="toggle-key" aria-label="显示或隐藏 API Key" aria-pressed="false">${icon('eye')}</button>
                  </div>
                </label>
              </div>
              <div class="form-error hidden" id="api-key-error" role="alert"></div>
              <div class="ai-note" style="margin-top:11px;">
                ${icon('shield')}
                <span>保存前会请求 <code>/models</code> 验证。验证不通过不会写入本地；验证请求只发往你填写的地址。</span>
              </div>
            </div>
            <div class="modal-foot">
              <span class="modal-foot-note">${esc(meta.note)}</span>
              <div class="modal-foot-right">
                <button class="btn btn-ghost" type="button" data-action="close-modal">取消</button>
                <button class="btn btn-primary" type="submit">${icon('shield')}验证并保存</button>
              </div>
            </div>
          </form>
        </div>
      </div>`);
  }

  /* ---------- 智能识图 ---------- */
  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('图片读取失败，请重试'));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('图片格式暂不支持'));
      image.src = dataUrl;
    });
  }

  async function prepareVisionImage(dataUrl, fileSize = 0) {
    try {
      const image = await loadImage(dataUrl);
      const maxEdge = Math.max(image.naturalWidth, image.naturalHeight);
      if (maxEdge <= 1800 && fileSize < 1400000) return dataUrl;
      const scale = Math.min(1, 1800 / maxEdge);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.88);
    } catch (error) {
      return dataUrl;
    }
  }

  function normalizeVisionDate(value) {
    const source = String(value || '').trim();
    if (!source) return '';
    const full = source.match(/(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})/);
    if (full) {
      const key = `${full[1]}-${pad2(Number(full[2]))}-${pad2(Number(full[3]))}`;
      return dateKey(fromDateKey(key)) === key ? key : '';
    }
    const short = source.match(/(\d{1,2})\s*[-/.月]\s*(\d{1,2})/);
    if (short) {
      const key = `${new Date().getFullYear()}-${pad2(Number(short[1]))}-${pad2(Number(short[2]))}`;
      return dateKey(fromDateKey(key)) === key ? key : '';
    }
    return '';
  }

  function normalizeVisionTime(value) {
    let source = String(value || '').trim();
    if (!source) return '';
    const period = /下午|晚上|傍晚/.test(source) ? 'pm' : (/上午|早上|凌晨/.test(source) ? 'am' : '');
    source = source.replace(/：/g, ':').replace(/\s+/g, '');
    let match = source.match(/(\d{1,2}):(\d{1,2})/);
    let hours;
    let minutes;
    if (match) {
      hours = Number(match[1]);
      minutes = Number(match[2]);
    } else {
      match = source.match(/(\d{1,2})(?:点|时)(半|\d{1,2})?/);
      if (!match) return '';
      hours = Number(match[1]);
      minutes = match[2] === '半' ? 30 : (match[2] ? Number(match[2]) : 0);
    }
    if (period === 'pm' && hours < 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return '';
    return `${pad2(hours)}:${pad2(minutes)}`;
  }

  function extractVisionJSON(text) {
    const source = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    const objectStart = source.indexOf('{');
    const arrayStart = source.indexOf('[');
    let start = -1;
    let end = -1;
    if (arrayStart >= 0 && (objectStart < 0 || arrayStart < objectStart)) {
      start = arrayStart;
      end = source.lastIndexOf(']');
    } else if (objectStart >= 0) {
      start = objectStart;
      end = source.lastIndexOf('}');
    }
    if (start < 0 || end <= start) return source;
    return source.slice(start, end + 1);
  }

  function normalizeVisionType(value, raw) {
    const text = String(value || '').trim().toLowerCase();
    if (/routine|recurring|repeat|fixed|周课|固定|重复|每周|作息|日程/.test(text)) return 'routine';
    if (/event|activity|meeting|exam|class|活动|会议|考试|课程|事件/.test(text)) return 'event';
    if (/task|todo|deadline|assignment|任务|作业|截止|报名/.test(text)) return 'task';
    if (raw && (raw.days || raw.weekdays || raw.repeat || raw.recurrence)) return 'routine';
    if (raw && raw.start && raw.end) return 'event';
    return 'task';
  }

  function normalizeVisionDays(value, date) {
    const parts = Array.isArray(value) ? value : String(value || '').split(/[,\s、/，]+/).filter(Boolean);
    const cn = { 日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };
    const en = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    const days = [];
    parts.forEach(part => {
      const text = String(part).trim().toLowerCase();
      if (/^[0-6]$/.test(text)) days.push(Number(text));
      else if (en[text.slice(0, 3)] !== undefined) days.push(en[text.slice(0, 3)]);
      else {
        const match = text.match(/^(?:周|星期|礼拜)?([日天一二三四五六])$/);
        if (match) days.push(cn[match[1]]);
      }
    });
    if (!days.length && date) {
      const day = fromDateKey(date);
      if (!Number.isNaN(day.getTime())) days.push(day.getDay());
    }
    return [...new Set(days)].sort((a, b) => a - b);
  }

  function visionEventFromRaw(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const pick = (...values) => values.find(value => value !== undefined && value !== null && String(value).trim() !== '') || '';
    let title = String(pick(raw.title, raw.name, raw.summary, raw['标题'], raw['事项'])).trim();
    title = title.replace(/^[\s\-•·*]+/, '').replace(/^\d{1,2}[、.．)）]\s*/, '').slice(0, 120);
    if (!title) return null;
    const date = normalizeVisionDate(pick(raw.date, raw.day, raw.startDate, raw['日期']));
    const rangeSource = String(pick(raw.time, raw['时间'], raw.start, raw.startTime, raw['开始']) || '');
    const pieces = rangeSource.match(/\d{1,2}\s*[:：]\s*\d{1,2}|\d{1,2}\s*点(?:半|\d{1,2}分?)?/g) || [];
    let start = normalizeVisionTime(pick(raw.start, raw.startTime, raw['开始']));
    let end = normalizeVisionTime(pick(raw.end, raw.endTime, raw['结束']));
    if (!start && pieces[0]) start = normalizeVisionTime(pieces[0]);
    if (!end && pieces[1]) end = normalizeVisionTime(pieces[1]);
    if (start && end && timeToMinutes(end) <= timeToMinutes(start)) end = '';
    const type = normalizeVisionType(pick(raw.type, raw.kind, raw.category, raw['类型']), raw);
    let days = normalizeVisionDays(pick(raw.days, raw.weekdays, raw.repeat, raw.recurrence, raw['星期']), date);
    if (type === 'routine' && !days.length) days = [new Date().getDay()];
    return {
      id: uid('v'),
      title,
      type,
      date,
      start,
      end,
      days: type === 'routine' ? days : [],
      location: String(pick(raw.location, raw.place, raw.venue, raw['地点'])).trim().slice(0, 100),
      notes: String(pick(raw.notes, raw.note, raw.description, raw['备注'])).trim().slice(0, 500),
      selected: true
    };
  }

  function normalizeVisionEvents(payload) {
    const list = Array.isArray(payload)
      ? payload
      : (payload && (payload.events || payload.items || payload.schedule)) || [];
    if (!Array.isArray(list)) throw new Error('AI 返回的数据格式不正确');
    return list
      .slice(0, 80)
      .map(visionEventFromRaw)
      .filter(Boolean)
      .sort((a, b) => (a.date || '9999-99-99').localeCompare(b.date || '9999-99-99') || (a.start || '99:99').localeCompare(b.start || '99:99'));
  }

  function setVisionStatus(message, kind = 'loading') {
    const status = $('#vision-status');
    if (!status) return;
    status.className = `vision-status show ${kind}`;
    status.textContent = message;
  }

  function syncVisionEventsFromDOM() {
    $$('#vision-list .vision-row').forEach(row => {
      const item = ui.visionEvents.find(event => event.id === row.dataset.id);
      if (!item) return;
      item.selected = Boolean(row.querySelector('.vision-select')?.checked);
      item.title = row.querySelector('.vision-title-input')?.value.trim() || '';
      item.type = row.querySelector('.vision-type-select')?.value || 'task';
      item.days = item.type === 'routine'
        ? $$('.vision-day-input', row).filter(box => box.checked).map(box => Number(box.value))
        : [];
      item.date = row.querySelector('.vision-date-input')?.value || '';
      item.start = row.querySelector('.vision-start-input')?.value || '';
      item.end = row.querySelector('.vision-end-input')?.value || '';
      item.location = row.querySelector('.vision-location-input')?.value.trim() || '';
      item.notes = row.querySelector('.vision-notes-input')?.value.trim() || '';
    });
  }

  function updateVisionSelection() {
    const boxes = $$('#vision-list .vision-select');
    const checked = boxes.filter(box => box.checked).length;
    const count = $('#vision-selected-count');
    if (count) count.textContent = String(checked);
    const all = $('#vision-all');
    if (all) {
      all.checked = boxes.length > 0 && checked === boxes.length;
      all.indeterminate = checked > 0 && checked < boxes.length;
    }
    const importBtn = $('#vision-import-btn');
    if (importBtn) importBtn.disabled = checked === 0 || ui.visionLoading;
  }

  function renderVisionEvents() {
    const list = $('#vision-list');
    const resultHead = $('#vision-result-head');
    const empty = $('#vision-empty');
    const retry = $('#vision-retry');
    if (!list) return;
    const events = ui.visionEvents;
    list.innerHTML = events.map(item => {
      const itemType = item.type || 'task';
      const typeSelect = Object.entries(TASK_TYPES)
        .map(([value, meta]) => `<option value="${value}" ${itemType === value ? 'selected' : ''}>${meta.label}</option>`).join('');
      return `
      <div class="vision-row" data-id="${esc(item.id)}">
        <input class="vision-check vision-select" type="checkbox" ${item.selected ? 'checked' : ''} aria-label="选择这条安排">
        <div class="vision-fields">
          <div class="vision-title-row">
            <input class="vision-title-input" value="${esc(item.title)}" aria-label="事件标题" placeholder="事件标题">
            <select class="vision-type-select" aria-label="导入类型">${typeSelect}</select>
          </div>
          <div class="vision-meta-grid">
            <label><span>日期</span><input class="vision-mini-input vision-date-input" type="date" value="${esc(item.date)}"></label>
            <label><span>开始</span><input class="vision-mini-input vision-start-input" type="time" value="${esc(item.start)}"></label>
            <label><span>结束</span><input class="vision-mini-input vision-end-input" type="time" value="${esc(item.end)}"></label>
            <label><span>地点</span><input class="vision-mini-input vision-location-input" value="${esc(item.location)}" placeholder="可留空"></label>
          </div>
          <div class="vision-routine-row ${itemType === 'routine' ? '' : 'hidden'}">
            <span>每周</span>
            ${WEEKDAYS.map(day => `<label class="vision-day"><input class="vision-day-input" type="checkbox" value="${day.value}" ${(item.days || []).includes(day.value) ? 'checked' : ''}><span>${day.label}</span></label>`).join('')}
          </div>
          <input class="vision-notes-input" value="${esc(item.notes)}" aria-label="备注" placeholder="备注（可留空）">
        </div>
        <button class="icon-btn" type="button" data-action="vision-remove" data-id="${esc(item.id)}" aria-label="移除这条安排">${icon('x')}</button>
      </div>`;
    }).join('');
    list.classList.toggle('show', events.length > 0);
    const drop = $('#vision-drop');
    if (drop) drop.classList.toggle('has-result', events.length > 0);
    if (resultHead) resultHead.classList.toggle('show', events.length > 0);
    if (empty) empty.classList.toggle('hidden', events.length > 0 || ui.visionLoading);
    if (retry) retry.classList.toggle('hidden', !ui.visionError || !ui.visionImage);
    updateVisionSelection();
  }

  async function recognizeVisionImage() {
    if (!ui.visionImage || ui.visionLoading) return;
    const key = getActiveAIKey();
    if (!key) {
      setVisionStatus('还没有可用的 API Key，请先去设置添加。', 'error');
      return;
    }
    if (ui.visionController) ui.visionController.abort();
    ui.visionController = new AbortController();
    ui.visionLoading = true;
    ui.visionError = '';
    setVisionStatus('正在读取图片、识别日程…这可能需要十几秒。', 'loading');
    updateVisionSelection();
    const controller = ui.visionController;
    const timeout = setTimeout(() => controller.abort(), 70000);
    const today = new Date();
    const current = `${dateKey(today)} ${pad2(today.getHours())}:${pad2(today.getMinutes())}`;
    const prompt = [
      '你是大学生日程整理助手。请从这张图片中提取所有明确的时间安排（课程表、考试安排、活动通知、群通知等）。',
      `当前日期时间：${current}，时区：Asia/Shanghai。`,
      '只输出严格 JSON，不要 Markdown，不要解释。格式：',
      '{"events":[{"title":"标题","type":"task|event|routine","date":"YYYY-MM-DD","start":"HH:MM","end":"HH:MM","days":[1,3],"location":"地点","notes":"备注"}]}',
      '任务类型判断规则：',
      '- task：一次性完成的事项、作业、报名、截止提醒，通常不需要本人在固定时段到场。',
      '- event：一次性发生、需要在某天某个时段本人到场的活动、会议、考试或单次课程。',
      '- routine：每周固定重复的安排，例如课程表里的固定周课、每周例会、固定训练。',
      '- 课程表如果是“每周重复”的周课表，优先输出 routine；如果明确是某一天的单次课程或考试，输出 event。',
      '- routine 必须给出 days（0=周日，1=周一，…，6=周六）和固定 start/end；date 填首次发生日期或空字符串。',
      '- task/event 的 date 必须换算成 YYYY-MM-DD；时间使用 24 小时制 HH:MM；没有的信息用空字符串；不要编造图片中没有的日期、时间或地点；同一张图中的每一项安排分别输出；忽略无关的标题和广告。'
    ].join('\n');
    try {
      const response = await fetch(chatEndpointFor(key), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key.key}`
        },
        body: JSON.stringify({
          model: key.model || 'gpt-4o-mini',
          temperature: 0.1,
          max_tokens: 3500,
          messages: [
            { role: 'system', content: '你只输出可解析的 JSON，不要输出 Markdown 代码块。' },
            { role: 'user', content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: ui.visionImage } }
            ] }
          ]
        }),
        signal: controller.signal
      });
      let data = null;
      try { data = await response.json(); } catch (error) { data = null; }
      if (!response.ok) {
        const detail = String((data && data.error && (data.error.message || data.error)) || '').slice(0, 160);
        if (response.status === 401 || response.status === 403) throw new Error('Key 无效，或这个通道没有图片识别权限。');
        if (response.status === 404) throw new Error('接口地址或模型不存在，请检查 API 设置。');
        if (response.status === 400) throw new Error(`模型可能不支持图片输入${detail ? `：${detail}` : '，请换用支持视觉的模型'}。`);
        if (response.status === 429) throw new Error('请求太频繁或额度不足，请稍后再试。');
        throw new Error(`识别失败（${response.status}）${detail ? `：${detail}` : ''}`);
      }
      const content = data && data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : '';
      const text = Array.isArray(content) ? content.map(part => part.text || part.content || '').join('\n') : String(content || '');
      if (!text.trim()) throw new Error('AI 返回了空内容，请换一张图片或换用支持视觉的模型。');
      let payload;
      try {
        payload = JSON.parse(extractVisionJSON(text));
      } catch (error) {
        throw new Error('AI 返回的内容不是有效 JSON，请重试。');
      }
      const events = normalizeVisionEvents(payload);
      if (!events.length) throw new Error('没有识别到明确的日程，请换一张更清晰的图片。');
      ui.visionEvents = events;
      setVisionStatus(`识别到 ${events.length} 条安排，请核对后导入。`, 'ok');
      renderVisionEvents();
    } catch (error) {
      const message = error && error.name === 'AbortError'
        ? '识别超时了，请重试或换用支持视觉的模型。'
        : (error && error.message ? error.message : '识别失败，请重试。');
      ui.visionError = message;
      setVisionStatus(message, 'error');
      renderVisionEvents();
    } finally {
      clearTimeout(timeout);
      ui.visionLoading = false;
      ui.visionController = null;
      updateVisionSelection();
    }
  }

  async function handleVisionFile(file) {
    if (!file) return;
    if (!/^image\//i.test(file.type || '') && !/\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name || '')) {
      toast('请选择图片文件', 'error');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      toast('图片太大了，请压缩到 12MB 以内', 'error');
      return;
    }
    if (!getActiveAIKey()) {
      toast('请先在设置中添加支持图片输入的 API Key', 'error');
      return;
    }
    ui.visionImage = '';
    ui.visionImageName = file.name || '日程表图片';
    ui.visionEvents = [];
    ui.visionError = '';
    renderVisionEvents();
    const drop = $('#vision-drop');
    if (drop) drop.classList.remove('drag-over');
    try {
      const original = await readFileAsDataURL(file);
      const image = $('#vision-thumb');
      if (image) image.src = original;
      const wrap = $('#vision-image-wrap');
      if (wrap) wrap.classList.remove('hidden');
      const empty = $('#vision-drop-empty');
      if (empty) empty.classList.add('hidden');
      if (drop) drop.classList.add('has-image');
      const name = $('#vision-image-name');
      if (name) name.textContent = ui.visionImageName;
      setVisionStatus('正在压缩图片…', 'loading');
      ui.visionImage = await prepareVisionImage(original, file.size);
      await recognizeVisionImage();
    } catch (error) {
      ui.visionError = error.message || '图片处理失败';
      setVisionStatus(ui.visionError, 'error');
      renderVisionEvents();
    }
  }

  function openVisionModal() {
    if (ui.visionController) {
      ui.visionController.abort();
      ui.visionController = null;
    }
    ui.visionImage = '';
    ui.visionImageName = '';
    ui.visionEvents = [];
    ui.visionLoading = false;
    ui.visionError = '';
    const key = getActiveAIKey();
    const provider = key ? (AI_PROVIDERS[key.provider]?.label || key.provider) : '';
    openModal(`
      <div class="modal-overlay">
        <div class="modal vision-modal" role="dialog" aria-modal="true" aria-labelledby="vision-title">
          <div class="modal-head">
            <div>
              <h2 id="vision-title">智能识图导入</h2>
              <p>上传课程表、考试安排或群通知截图，让 AI 先帮你读成日程。</p>
            </div>
            <button class="modal-close" type="button" data-action="close-modal" aria-label="关闭">${icon('x')}</button>
          </div>
          <div class="modal-body">
            ${key ? `
              <div class="vision-note">
                ${icon('shield')}
                <span>当前通道：<strong>${esc(key.label || provider)}</strong> · ${esc(key.model)}。图片只会发送到你配置的 AI 接口，不保存到本应用。</span>
              </div>
              <input type="file" id="vision-file" accept="image/*" hidden>
              <div class="vision-drop" id="vision-drop" role="button" tabindex="0" aria-label="选择或拖入日程表图片">
                <div class="vision-drop-empty" id="vision-drop-empty">
                  <span class="vision-drop-icon">${icon('image')}</span>
                  <strong>选择图片，或拖到这里</strong>
                  <span>支持课程表、考试安排、群通知截图</span>
                  <small>PNG / JPG / WebP · 建议文字清晰、不要倾斜</small>
                </div>
                <div class="vision-image-wrap hidden" id="vision-image-wrap">
                  <img id="vision-thumb" alt="待识别的日程表预览">
                  <div class="vision-image-bar">
                    <strong id="vision-image-name"></strong>
                    <div class="vision-image-actions">
                      <button class="vision-mini-btn" type="button" data-action="vision-replace">更换图片</button>
                    </div>
                  </div>
                </div>
              </div>
              <div class="vision-status" id="vision-status"></div>
              <div class="vision-result-head" id="vision-result-head">
                <strong>识别结果 · <span id="vision-selected-count">0</span> 条已选</strong>
                <label class="vision-select-all"><input type="checkbox" id="vision-all">全选</label>
              </div>
              <div class="vision-list" id="vision-list"></div>
              <button class="btn btn-ghost btn-sm hidden" id="vision-retry" type="button" data-action="vision-retry" style="margin-top:9px;">${icon('refresh')}重新识别这张图</button>
              <p class="vision-privacy">AI 只负责提议；导入前请核对日期、时间、地点。取消勾选的项目不会被写入。需要模型支持图片输入；如果当前模型不支持，请到设置更换。</p>
            ` : `
              <div class="vision-key-state">
                <span class="vision-drop-icon">${icon('image')}</span>
                <strong>先添加一个支持图片输入的 API Key</strong>
                <p>智能识图会把图片发送给你配置的 AI 视觉模型。请先在设置中添加 Key，并选择支持图片输入的模型（如 gpt-4o、qwen-vl 等）。</p>
                <p class="vision-privacy">图片只用于本次识别，不会上传到拾光的本地服务器，也不会写入 localStorage。</p>
              </div>
            `}
          </div>
          <div class="modal-foot">
            <span class="modal-foot-note">${key ? 'AI 只提议，最终写入由你确认。' : '还没有可用的 API 通道。'}</span>
            <div class="modal-foot-right">
              <button class="btn btn-ghost" type="button" data-action="close-modal">取消</button>
              ${key
                ? `<button class="btn btn-primary" id="vision-import-btn" type="button" data-action="vision-import" disabled>${icon('upload')}导入选中</button>`
                : `<button class="btn btn-primary" type="button" data-action="go-settings">去设置</button>`}
            </div>
          </div>
        </div>
      </div>`);
    if (key) {
      setTimeout(() => {
        const drop = $('#vision-drop');
        if (!drop) return;
        const choose = () => {
          if (ui.visionLoading) return;
          const input = $('#vision-file');
          if (input) input.click();
        };
        drop.addEventListener('click', event => {
          if (event.target.closest('[data-action="vision-replace"]')) return;
          choose();
        });
        drop.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            choose();
          }
        });
        ['dragenter', 'dragover'].forEach(name => {
          drop.addEventListener(name, event => {
            event.preventDefault();
            drop.classList.add('drag-over');
          });
        });
        drop.addEventListener('dragleave', event => {
          if (!drop.contains(event.relatedTarget)) drop.classList.remove('drag-over');
        });
        drop.addEventListener('drop', event => {
          event.preventDefault();
          drop.classList.remove('drag-over');
          const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
          if (file) handleVisionFile(file);
        });
      }, 0);
    }
  }

  function handleVisionImport() {
    syncVisionEventsFromDOM();
    const selected = ui.visionEvents.filter(event => event.selected);
    if (!selected.length) {
      toast('先勾选至少一条要导入的安排', 'error');
      return;
    }
    const added = [];
    let skipped = 0;
    const sameDays = (a, b) => a.length === b.length && [...a].sort((x, y) => x - y).every((day, index) => day === [...b].sort((x, y) => x - y)[index]);
    selected.forEach(item => {
      const title = String(item.title || '').trim();
      const type = ['task', 'event', 'routine'].includes(item.type) ? item.type : 'task';
      const rawDate = String(item.date || '').trim();
      const hasDate = rawDate && dateKey(fromDateKey(rawDate)) === rawDate;
      if (!title || (type !== 'routine' && !hasDate)) {
        skipped += 1;
        return;
      }
      let start = normalizeVisionTime(item.start);
      let end = normalizeVisionTime(item.end);
      if (start && end && timeToMinutes(end) <= timeToMinutes(start)) end = '';
      const date = hasDate ? rawDate : todayKey();
      const day = fromDateKey(date);
      const startDate = start ? atTime(day, Math.floor(timeToMinutes(start) / 60), timeToMinutes(start) % 60) : null;
      let endDate = end ? atTime(day, Math.floor(timeToMinutes(end) / 60), timeToMinutes(end) % 60) : null;
      if (type === 'event' && startDate && !endDate) {
        endDate = new Date(startDate.getTime() + 60 * 60000);
        end = minutesToTime(timeToMinutes(start) + 60);
      }
      const days = type === 'routine' ? normalizeVisionDays(item.days, date) : [];
      if (type === 'event' && !startDate) {
        skipped += 1;
        return;
      }
      if (type === 'routine' && (!start || !days.length)) {
        skipped += 1;
        return;
      }
      const duplicate = type === 'routine'
        ? (state.tasks.some(task => task.title.trim() === title && task.type === 'routine' && task.routine && task.routine.start === start && sameDays(task.routine.days, days))
          || added.some(task => task.title.trim() === title && task.type === 'routine' && task.routine && task.routine.start === start && sameDays(task.routine.days, days)))
        : (state.tasks.some(task => task.title.trim() === title && task.type !== 'routine' && task.due && dateKey(new Date(task.due)) === date)
          || added.some(task => task.title.trim() === title && task.type !== 'routine' && task.due && dateKey(new Date(task.due)) === date));
      if (duplicate) {
        skipped += 1;
        return;
      }
      const duration = startDate && endDate ? Math.max(15, Math.round((endDate.getTime() - startDate.getTime()) / 60000)) : 60;
      const task = normalizeTask({
        id: uid('t'),
        title: title.slice(0, 160),
        description: item.notes || '',
        type,
        due: type === 'routine' ? '' : (startDate ? startDate.toISOString() : atTime(day, 23, 59).toISOString()),
        dueTimeKnown: type !== 'routine' && Boolean(startDate),
        end: type === 'event' && endDate ? endDate.toISOString() : '',
        location: item.location || '',
        priority: 'p3',
        importance: 'normal',
        urgency: 'normal',
        urgencySource: 'auto',
        status: 'todo',
        tags: ['识图导入'],
        estimate: type === 'task' && !startDate ? 0 : duration,
        subtasks: [],
        sourceMessageId: null,
        routine: type === 'routine' ? { start, end: end || minutesToTime(timeToMinutes(start) + duration), days, from: date, until: '' } : null,
        routineDone: {},
        createdAt: new Date().toISOString(),
        completedAt: null
      });
      added.push(task);
    });
    if (!added.length) {
      toast(skipped ? '没有可导入的新安排（可能已存在或缺少日期）' : '没有可导入的安排', 'error');
      return;
    }
    state.tasks.push(...added);
    saveState();
    closeModal();
    navigateTo('tasks');
    toast(`已导入 ${added.length} 条安排${skipped ? `，跳过 ${skipped} 条` : ''}`, 'success');
  }

  function handleScheduleSubmit(form) {
    const wake = String(form.elements.wake.value || '');
    const sleep = String(form.elements.sleep.value || '');
    if (!/^\d{2}:\d{2}$/.test(wake) || !/^\d{2}:\d{2}$/.test(sleep)) {
      toast('请填写有效的起床和睡觉时间', 'error');
      return;
    }
    if (timeToMinutes(wake) >= timeToMinutes(sleep)) {
      toast('起床时间需要早于睡觉时间', 'error');
      form.elements.wake.focus();
      return;
    }
    state.settings.schedule = { wake, sleep };
    saveState();
    renderCurrentPage(true);
    toast('作息已保存，识别空闲时会使用它', 'success');
  }

  function handleReviewSubmit(form) {
    const value = String(form.elements.review.value || '').slice(0, 1200);
    state.reviews[weekKey()] = value;
    saveState();
    const status = $('[data-review-status]');
    if (status) status.textContent = value.trim() ? '已保存本周复盘' : '还没有写复盘';
    toast(value.trim() ? '本周复盘已保存' : '复盘内容已清空', 'success');
  }

  /* ============================================================
     17. 事件委托
     ============================================================ */
  function handleAction(actionEl, event) {
    const action = actionEl.dataset.action;
    const id = actionEl.dataset.id;

    switch (action) {
      case 'new-task': {
        const options = {};
        if (actionEl.dataset.status && STATUSES[actionEl.dataset.status]) {
          options.status = actionEl.dataset.status;
        }
        if (actionEl.dataset.date) {
          const day = fromDateKey(actionEl.dataset.date);
          if (actionEl.dataset.time) {
            const parts = String(actionEl.dataset.time).split(':').map(Number);
            options.due = atTime(day, parts[0] || 9, parts[1] || 0).toISOString();
            options.dueTimeKnown = true;
          } else {
            options.due = atTime(day, 23, 59).toISOString();
            options.dueTimeKnown = false;
          }
        }
        openTaskModal(null, options);
        break;
      }
      case 'edit-task': {
        const task = state.tasks.find(t => t.id === id);
        if (task) openTaskModal(task);
        break;
      }
      case 'task-type': {
        const form = $('#task-form');
        if (form) updateTaskTypeUI(form, actionEl.dataset.type);
        break;
      }
      case 'delete-task':
        requestDeleteTask(id);
        break;
      case 'toggle-task':
        toggleTaskDone(id, actionEl.dataset.date || '');
        break;
      case 'toggle-multi-select':
        toggleMultiSelectMode();
        break;
      case 'delete-selected':
        requestDeleteSelectedTasks();
        break;
      case 'task-view':
        ui.multiSelect = false;
        ui.selectedTaskIds = [];
        ui.taskView = ['list', 'board', 'matrix'].includes(actionEl.dataset.view) ? actionEl.dataset.view : 'list';
        renderCurrentPage(true);
        break;
      case 'clear-task-filters':
        ui.taskFilters = { q: '', importance: 'all', status: 'all', tag: 'all', sort: 'smart' };
        renderCurrentPage(true);
        toast('筛选已清除', 'info');
        break;
      case 'calendar-prev': {
        const cursor = new Date(ui.calCursor || new Date());
        ui.calCursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
        renderCurrentPage(true);
        break;
      }
      case 'calendar-next': {
        const cursor = new Date(ui.calCursor || new Date());
        ui.calCursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
        renderCurrentPage(true);
        break;
      }
      case 'calendar-today':
        ui.calCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        renderCurrentPage(true);
        break;
      case 'calendar-mode':
        ui.calMode = actionEl.dataset.mode === 'timeline' ? 'timeline' : 'month';
        renderCurrentPage(true);
        break;
      case 'open-day':
        if (actionEl.dataset.date) openDayModal(actionEl.dataset.date);
        break;
      case 'day-shift':
        if (actionEl.dataset.date) openDayModal(actionEl.dataset.date);
        break;
      case 'open-free-time':
        openFreeTimeModal();
        break;
      case 'free-time-mode': {
        const dayValue = $('#free-time-date')?.value || $('#free-time-start')?.value;
        if (dayValue) ui.freeTimeDate = dayValue;
        const rangeValue = Number($('#free-time-range')?.value);
        if (rangeValue) ui.freeTimeRange = rangeValue;
        ui.freeTimeMode = actionEl.dataset.mode === 'range' ? 'range' : 'day';
        const body = $('#free-time-body');
        if (body) body.innerHTML = freeTimeQuestionHTML();
        break;
      }
      case 'free-time-run':
        runFreeTimeSearch();
        break;
      case 'open-messages':
        navigateTo('messages');
        break;
      case 'focus-compose':
        focusCompose();
        break;
      case 'msg-filter':
        ui.msgFilter = ['all', 'unprocessed', 'processed'].includes(actionEl.dataset.filter)
          ? actionEl.dataset.filter
          : 'all';
        renderCurrentPage(true);
        break;
      case 'convert-message':
        convertMessageToTask(id);
        break;
      case 'link-message':
        openLinkModal(id);
        break;
      case 'toggle-message':
        toggleMessageProcessed(id);
        break;
      case 'delete-message':
        requestDeleteMessage(id);
        break;
      case 'toggle-checklist': {
        const checks = getMorningChecks();
        const index = Number(actionEl.dataset.index);
        if (Number.isInteger(index) && index >= 0 && index < checks.length) {
          checks[index] = !checks[index];
          saveState();
          renderCurrentPage(true);
        }
        break;
      }
      case 'use-example': {
        const input = $('#quick-input');
        if (input) {
          input.value = actionEl.dataset.example || '';
          ui.quickDraft = input.value;
          updateCapturePreview();
          input.focus();
        }
        break;
      }
      case 'ai-parse':
        runAIParse();
        break;
      case 'request-notification':
        enableBrowserNotifications(true);
        break;
      case 'toggle-setting': {
        const setting = actionEl.dataset.setting;
        if (setting === 'browserNotify') {
          if (state.settings.browserNotify) {
            state.settings.browserNotify = false;
            saveState();
            renderCurrentPage(true);
            toast('桌面通知已关闭', 'info');
          } else {
            enableBrowserNotifications();
          }
        } else if (setting === 'notifyDueSoon' || setting === 'morningChecklist') {
          state.settings[setting] = !state.settings[setting];
          saveState();
          renderCurrentPage(true);
          toast('设置已保存', 'success');
        }
        break;
      }
      case 'toggle-ai-quick':
      case 'toggle-ai-setting': {
        if (!state.settings.ai.keys.length) {
          toast('先添加一个可用的 API Key，才能打开 AI 增强', 'info', {
            label: '去设置',
            onClick: () => { location.hash = 'settings'; }
          });
          break;
        }
        if (!state.settings.ai.activeKeyId) {
          state.settings.ai.activeKeyId = state.settings.ai.keys[0].id;
        }
        state.settings.ai.enabled = !state.settings.ai.enabled;
        saveState();
        renderCurrentPage(true);
        if (action === 'toggle-ai-quick') {
          const input = $('#quick-input');
          if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
        }
        toast(state.settings.ai.enabled ? 'AI 增强已打开' : 'AI 增强已关闭', 'info');
        break;
      }
      case 'open-api-key':
        openApiKeyModal();
        break;
      case 'open-vision':
        openVisionModal();
        break;
      case 'vision-choose':
      case 'vision-replace': {
        const input = $('#vision-file');
        if (input && !ui.visionLoading) input.click();
        break;
      }
      case 'vision-retry':
        recognizeVisionImage();
        break;
      case 'vision-remove': {
        syncVisionEventsFromDOM();
        ui.visionEvents = ui.visionEvents.filter(item => item.id !== id);
        renderVisionEvents();
        break;
      }
      case 'vision-import':
        handleVisionImport();
        break;
      case 'go-settings':
        closeModal();
        navigateTo('settings');
        break;
      case 'ai-key-active': {
        const entry = state.settings.ai.keys.find(k => k.id === actionEl.dataset.keyId);
        if (!entry) break;
        state.settings.ai.activeKeyId = entry.id;
        state.settings.ai.enabled = true;
        saveState();
        renderCurrentPage(true);
        toast(`已切换到 ${entry.label}`, 'success');
        break;
      }
      case 'ai-key-delete': {
        const entry = state.settings.ai.keys.find(k => k.id === actionEl.dataset.keyId);
        if (!entry) break;
        openConfirm({
          title: '删除这个 API Key？',
          subtitle: entry.label,
          message: '删除后需要重新输入并验证 Key，才能再次使用这个通道。',
          confirmLabel: '删除 Key',
          danger: true,
          onConfirm: () => {
            state.settings.ai.keys = state.settings.ai.keys.filter(k => k.id !== entry.id);
            if (state.settings.ai.activeKeyId === entry.id) {
              state.settings.ai.activeKeyId = state.settings.ai.keys[0]?.id || '';
            }
            if (!state.settings.ai.keys.length) state.settings.ai.enabled = false;
            saveState();
            renderCurrentPage(true);
            toast('API Key 已从本机删除', 'info');
          }
        });
        break;
      }
      case 'toggle-key': {
        const keyInput = actionEl.closest('.ai-key-row')?.querySelector('input') || $('#ai-key');
        if (!keyInput) break;
        const showing = keyInput.type === 'text';
        keyInput.type = showing ? 'password' : 'text';
        actionEl.setAttribute('aria-pressed', String(!showing));
        actionEl.innerHTML = icon(showing ? 'eye' : 'shield');
        break;
      }
      case 'export-json':
        exportJSON();
        break;
      case 'export-csv':
        exportCSV();
        break;
      case 'export-ics':
        exportICS();
        break;
      case 'import-json':
        $('#import-file').click();
        break;
      case 'clear-data':
        openConfirm({
          title: '清空所有数据？',
          subtitle: '这个操作无法撤销',
          message: '所有任务、消息、晨间清单和复盘都会从这台设备移除。建议先导出一份 JSON 备份。',
          confirmLabel: '清空所有数据',
          danger: true,
          onConfirm: () => {
            state = createEmptyState();
            saveState();
            renderCurrentPage();
            toast('所有本地数据已清空', 'success');
          }
        });
        break;
      case 'close-modal':
        closeModal();
        break;
      case 'confirm-modal': {
        const handler = ui.confirmHandler;
        closeModal();
        if (handler) handler();
        break;
      }
      case 'add-subtask': {
        const list = $('#subtask-list');
        if (!list) break;
        const empty = $('#subtask-empty');
        if (empty) empty.remove();
        list.insertAdjacentHTML('beforeend', subtaskRowHTML({ title: '' }));
        const rows = list.querySelectorAll('.subtask-row');
        const last = rows[rows.length - 1];
        if (last) last.querySelector('input[type="text"]').focus();
        break;
      }
      case 'remove-subtask': {
        const row = actionEl.closest('.subtask-row');
        if (row) row.remove();
        ensureSubtaskEmpty();
        break;
      }
      case 'clear-task-due': {
        const due = $('#task-due');
        if (due) due.value = '';
        const allDay = $('#task-form input[name="allDay"]');
        if (allDay) allDay.checked = false;
        if (due) due.focus();
        break;
      }
      default:
        break;
    }
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      if (event.target.classList && event.target.classList.contains('modal-overlay')) {
        closeModal();
        return;
      }
      if (ui.multiSelect && ui.page === 'tasks') {
        const row = event.target.closest('.task-row[data-task-row]');
        if (row && !event.target.closest('.task-select-wrap')) {
          event.preventDefault();
          setTaskSelected(row.dataset.taskRow, !row.classList.contains('is-selected'));
          return;
        }
      }
      const actionEl = event.target.closest('[data-action]');
      if (!actionEl) return;
      if (actionEl.tagName === 'BUTTON') event.preventDefault();
      handleAction(actionEl, event);
    });

    document.addEventListener('submit', event => {
      const form = event.target.closest('form[data-form]');
      if (!form) return;
      event.preventDefault();
      const kind = form.dataset.form;
      if (kind === 'quick-capture') handleQuickCapture(form);
      else if (kind === 'message') handleMessageSubmit(form);
      else if (kind === 'task-modal') saveTaskFromModal(form);
      else if (kind === 'link-task') handleLinkTaskSubmit(form);
      else if (kind === 'api-key') handleApiKeySubmit(form);
      else if (kind === 'schedule-settings') handleScheduleSubmit(form);
      else if (kind === 'review') handleReviewSubmit(form);
    });

    document.addEventListener('input', event => {
      if (event.target.matches('#quick-input')) {
        ui.quickDraft = event.target.value;
        if (ui.aiParsed && ui.aiParsed.text !== ui.quickDraft.trim()) ui.aiParsed = null;
        updateCapturePreview();
        queueAIQuickParse();
      } else if (event.target.matches('[data-task-search]')) {
        ui.taskFilters.q = event.target.value;
        updateTaskResults();
      } else if (event.target.matches('[data-message-search]')) {
        ui.msgQuery = event.target.value;
        updateMessageList();
      }
    });

    document.addEventListener('change', event => {
      if (event.target.matches('[data-task-select]')) {
        setTaskSelected(event.target.dataset.taskSelect, event.target.checked);
        return;
      }
      if (event.target.id === 'task-select-all') {
        const ids = getFilteredTasks().map(task => task.id);
        ui.selectedTaskIds = event.target.checked ? ids : [];
        $$('.task-select').forEach(box => { box.checked = event.target.checked; });
        $$('.task-row[data-task-row]').forEach(row => {
          row.classList.toggle('is-selected', event.target.checked && ids.includes(row.dataset.taskRow));
        });
        syncTaskSelectionUI();
        return;
      }
      if (event.target.matches('[data-task-filter]')) {
        const key = event.target.dataset.taskFilter;
        if (Object.prototype.hasOwnProperty.call(ui.taskFilters, key)) {
          ui.taskFilters[key] = event.target.value;
          updateTaskResults();
        }
      } else if (event.target.id === 'import-file') {
        const file = event.target.files && event.target.files[0];
        event.target.value = '';
        importJSONFile(file);
      } else if (event.target.id === 'vision-file') {
        const file = event.target.files && event.target.files[0];
        event.target.value = '';
        handleVisionFile(file);
      } else if (event.target.id === 'vision-all') {
        $$('#vision-list .vision-select').forEach(box => { box.checked = event.target.checked; });
        updateVisionSelection();
      } else if (event.target.matches('.vision-select')) {
        updateVisionSelection();
      } else if (event.target.matches('.vision-type-select')) {
        const row = event.target.closest('.vision-row');
        const routineRow = row && row.querySelector('.vision-routine-row');
        if (routineRow) routineRow.classList.toggle('hidden', event.target.value !== 'routine');
        if (routineRow && event.target.value === 'routine' && !$$('.vision-day-input:checked', row).length) {
          const dateInput = row.querySelector('.vision-date-input');
          const day = dateInput && dateInput.value ? fromDateKey(dateInput.value).getDay() : new Date().getDay();
          const box = row.querySelector(`.vision-day-input[value="${day}"]`);
          if (box) box.checked = true;
        }
      } else if (event.target.id === 'api-provider') {
        const form = event.target.closest('form[data-form="api-key"]');
        const meta = AI_PROVIDERS[event.target.value];
        if (!form || !meta) return;
        const oldLabel = form.elements.label.value.trim();
        const oldWasDefault = Object.keys(AI_PROVIDERS).some(key => AI_PROVIDERS[key].label === oldLabel);
        form.elements.endpoint.value = meta.base;
        form.elements.model.value = meta.model;
        if (!oldLabel || oldWasDefault) form.elements.label.value = meta.label;
        const note = form.querySelector('.modal-foot-note');
        if (note) note.textContent = meta.note;
      }
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        if ($('#modal-root').innerHTML.trim()) {
          event.preventDefault();
          closeModal();
        }
        return;
      }
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        const focusSearch = () => {
          const input = $('[data-task-search]');
          if (input) input.focus();
        };
        if (ui.page !== 'tasks') {
          navigateTo('tasks');
          setTimeout(focusSearch, 60);
        } else {
          focusSearch();
        }
        return;
      }
      if (mod && event.key === 'Enter') {
        const form = $('#task-form');
        if (form) {
          event.preventDefault();
          form.requestSubmit();
        }
        return;
      }
      const target = event.target;
      const typing = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      );
      if (!typing && !mod && !event.altKey && !$('#modal-root').innerHTML.trim() && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        openTaskModal();
      }
    });

    window.addEventListener('hashchange', handleHashChange);

    document.addEventListener('dragstart', event => {
      const card = event.target.closest('.kanban-card');
      if (!card) return;
      const task = state.tasks.find(t => t.id === card.dataset.taskId);
      if (task && task.type === 'routine') {
        event.preventDefault();
        toast('固定日程按天勾选完成，不需要拖入状态列', 'info');
        return;
      }
      ui.dragTaskId = card.dataset.taskId;
      card.classList.add('dragging');
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', ui.dragTaskId);
      }
    });

    document.addEventListener('dragend', event => {
      const card = event.target.closest('.kanban-card');
      if (card) card.classList.remove('dragging');
      $$('.drag-over').forEach(el => el.classList.remove('drag-over'));
      ui.dragTaskId = null;
    });

    document.addEventListener('dragover', event => {
      const zone = event.target.closest('[data-drop-status]');
      if (!zone || !ui.dragTaskId) return;
      event.preventDefault();
      zone.classList.add('drag-over');
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    });

    document.addEventListener('dragleave', event => {
      const zone = event.target.closest('[data-drop-status]');
      if (zone && !zone.contains(event.relatedTarget)) zone.classList.remove('drag-over');
    });

    document.addEventListener('drop', event => {
      const zone = event.target.closest('[data-drop-status]');
      if (!zone) return;
      event.preventDefault();
      zone.classList.remove('drag-over');
      const taskId = ui.dragTaskId || (event.dataTransfer ? event.dataTransfer.getData('text/plain') : '');
      const task = state.tasks.find(t => t.id === taskId);
      if (!task) return;
      const status = zone.dataset.dropStatus;
      if (!STATUSES[status]) return;
      task.status = status;
      task.completedAt = status === 'done' ? new Date().toISOString() : null;
      ui.dragTaskId = null;
      saveState();
      renderCurrentPage(true);
      toast(`已移动到「${STATUSES[status].label}」`, 'success');
    });

    window.addEventListener('storage', event => {
      if (event.key !== AppStorage.KEY || !event.newValue) return;
      try {
        state = normalizeState(JSON.parse(event.newValue));
        ui.notified = loadNotified();
        renderCurrentPage(true);
      } catch (error) {
        console.warn('同步其他标签页数据失败：', error);
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkNotifications();
    });
  }

  /* ============================================================
     18. 初始化
     ============================================================ */
  function init() {
    state = loadState();
    ui.notified = loadNotified();
    pruneOldChecks();
    if (isFirstRun) saveState();

    if (notificationSupported() && Notification.permission === 'denied' && state.settings.browserNotify) {
      state.settings.browserNotify = false;
      saveState();
    }

    const page = pageFromHash();
    if (!PAGES[page]) {
      history.replaceState(null, '', '#today');
      ui.page = 'today';
    } else {
      ui.page = page;
    }

    bindEvents();
    renderCurrentPage();
    if (state.settings.browserNotify) checkNotifications();
    setInterval(checkNotifications, 60 * 1000);

    if (isFirstRun) isFirstRun = false;
    if (storageBroken) {
      setTimeout(() => toast('浏览器本地存储不可用，刷新后数据可能丢失', 'error'), 900);
    }
  }

  init();


})();
