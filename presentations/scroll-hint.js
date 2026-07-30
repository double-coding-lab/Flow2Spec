/* flow-spec-intro：滚动页 UI — 视口 fixed 提示 + 暗角/扫描线铺满 scrollHeight */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    if (/[?&]preview=\d+/.test(location.search || '')) return;

    const deck = document.querySelector('.deck');
    if (!deck) return;

    let hint = document.getElementById('fx-scroll-hint');
    if (!hint) {
      hint = document.createElement('div');
      hint.id = 'fx-scroll-hint';
      hint.className = 'fx-scroll-hint';
      hint.setAttribute('aria-hidden', 'true');
      hint.textContent = '↕ scroll';
      document.body.appendChild(hint);
    }

    const scrollSlides = Array.from(deck.querySelectorAll('.slide.is-scroll'));

    function syncScrollOverlays() {
      scrollSlides.forEach(function (slide) {
        slide.style.setProperty('--fx-scroll-overlay-h', slide.scrollHeight + 'px');
      });
    }

    function update() {
      const active = deck.querySelector('.slide.is-active');
      const show = !!(active && active.classList.contains('is-scroll'));
      hint.classList.toggle('is-visible', show);
      hint.setAttribute('aria-hidden', show ? 'false' : 'true');
      syncScrollOverlays();
    }

    const obs = new MutationObserver(function () {
      update();
      requestAnimationFrame(syncScrollOverlays);
    });
    obs.observe(deck, {
      attributes: true,
      subtree: true,
      attributeFilter: ['class'],
    });

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(function () {
        syncScrollOverlays();
      });
      scrollSlides.forEach(function (slide) {
        ro.observe(slide);
      });
    }

    window.addEventListener('resize', syncScrollOverlays);
    window.addEventListener('load', syncScrollOverlays);
    update();
    requestAnimationFrame(syncScrollOverlays);
    setTimeout(syncScrollOverlays, 600);
  });
})();
