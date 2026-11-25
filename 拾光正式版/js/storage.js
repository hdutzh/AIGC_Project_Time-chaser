/* ============================================================
   拾光 · 本地存储层
   这里只负责浏览器 localStorage 的读写，不包含界面和业务逻辑。
   数据不会上传服务器；换电脑时请使用应用内的 JSON 导入/导出。
   ============================================================ */
(() => {
  'use strict';

  const STORAGE_KEY = 'shiguang_study_flow_v1';
  const NOTIFIED_KEY = 'shiguang_notified_v1';

  let available = true;
  try {
    const probe = '__shiguang_storage_test__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
  } catch (error) {
    available = false;
  }

  function readJSON(key) {
    if (!available) return null;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      console.warn('读取本地数据失败：', error);
      return null;
    }
  }

  function writeJSON(key, value) {
    if (!available) throw new Error('当前浏览器不允许使用本地存储');
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  function loadState() {
    return readJSON(STORAGE_KEY);
  }

  function saveState(state) {
    writeJSON(STORAGE_KEY, state);
  }

  function clearState() {
    if (!available) return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn('清空本地数据失败：', error);
    }
  }

  function loadNotified() {
    const value = readJSON(NOTIFIED_KEY);
    return Array.isArray(value) ? value : [];
  }

  function saveNotified(list) {
    if (!available) return;
    writeJSON(NOTIFIED_KEY, Array.isArray(list) ? list : []);
  }

  window.ShiGuangStorage = {
    KEY: STORAGE_KEY,
    NOTIFIED_KEY,
    isAvailable: () => available,
    loadState,
    saveState,
    clearState,
    loadNotified,
    saveNotified
  };
})();
