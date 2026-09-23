(() => {
  'use strict';
  const slides = [...document.querySelectorAll('.slide')];
  const page = document.querySelector('#page');
  const chapter = document.querySelector('#chapter');
  const previous = document.querySelector('#previous');
  const next = document.querySelector('#next');
  const notes = document.querySelector('#notes');
  const speakerNotes = JSON.parse(document.querySelector('#speaker-notes').textContent);
  const fullscreen = document.querySelector('#fullscreen');
  let current = 0;
  function load(index) {
    const img = slides[index]?.querySelector('img');
    if (img?.dataset.src) { img.src = img.dataset.src; delete img.dataset.src; }
  }
  function render(index) {
    current = Math.max(0, Math.min(slides.length - 1, index));
    slides.forEach((slide, i) => { slide.hidden = i !== current; });
    load(current); load(current + 1); load(current - 1);
    page.value = String(current + 1);
    chapter.value = '';
    previous.disabled = current === 0;
    next.disabled = current === slides.length - 1;
    const title = slides[current].querySelector('img').alt;
    document.title = `${current + 1} / ${slides.length} · ${title} · Flow2Spec`;
    document.querySelector('#status').textContent = `第 ${current + 1} 页，共 ${slides.length} 页：${title}`;
    document.querySelector('#notes-title').textContent = title;
    document.querySelector('#notes-body').textContent = speakerNotes[current];
  }
  function fromHash() {
    const match = location.hash.match(/^#\/?(\d+)$/);
    render(match ? Number(match[1]) - 1 : 0);
  }
  function go(index) {
    render(index);
    location.hash = `/${current + 1}`;
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { document.querySelector('#status').textContent = '当前浏览器不支持全屏，请使用浏览器全屏功能。'; }
  }
  previous.addEventListener('click', () => go(current - 1));
  next.addEventListener('click', () => go(current + 1));
  page.addEventListener('change', () => go(Number(page.value) - 1));
  chapter.addEventListener('change', () => { if (chapter.value) go(Number(chapter.value) - 1); });
  document.querySelector('#notes-button').addEventListener('click', () => notes.showModal());
  fullscreen.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', () => { fullscreen.textContent = document.fullscreenElement ? '退出全屏' : '全屏'; });
  window.addEventListener('hashchange', fromHash);
  document.addEventListener('keydown', event => {
    if (notes.open || event.altKey || event.ctrlKey || event.metaKey || /^(SELECT|INPUT|TEXTAREA|BUTTON)$/.test(event.target.tagName)) return;
    const actions = {
      ArrowRight: () => go(current + 1), ArrowDown: () => go(current + 1), PageDown: () => go(current + 1),
      ArrowLeft: () => go(current - 1), ArrowUp: () => go(current - 1), PageUp: () => go(current - 1),
      ' ': () => go(current + (event.shiftKey ? -1 : 1)), Home: () => go(0), End: () => go(slides.length - 1),
      f: toggleFullscreen, F: toggleFullscreen, n: () => notes.showModal(), N: () => notes.showModal()
    };
    if (actions[event.key]) { event.preventDefault(); actions[event.key](); }
  });
  let touch = null;
  const stage = document.querySelector('#stage');
  stage.addEventListener('touchstart', event => {
    touch = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
  }, { passive: true });
  stage.addEventListener('touchend', event => {
    if (!touch) return;
    const end = event.changedTouches[0];
    const dx = end.clientX - touch.x, dy = end.clientY - touch.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(current + (dx < 0 ? 1 : -1));
    touch = null;
  }, { passive: true });
  stage.addEventListener('touchcancel', () => { touch = null; }, { passive: true });
  window.addEventListener('beforeprint', () => slides.forEach((_, i) => load(i)));
  fromHash();
})();
