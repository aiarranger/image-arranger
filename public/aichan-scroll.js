(() => {
  "use strict";

  const scriptUrl = document.currentScript?.src || new URL("aichan-scroll.js", location.href).href;
  const imageBase = new URL("./aichan/", scriptUrl);
  const images = {
    normal: new URL("normal.png", imageBase).href,
    surprised: new URL("surprised.png", imageBase).href,
    yay: new URL("yay.png", imageBase).href,
    back: new URL("back.png", imageBase).href,
  };

  const SURPRISE_SPEED = 10;
  const SURPRISE_DELTA = 60;
  const SURPRISE_DURATION = 720;
  const BACK_DURATION = 760;
  const BOTTOM_THRESHOLD = 0.985;
  const UP_SCROLL_DELTA = -2;
  const TOP_THRESHOLD = 0.02;

  function appendEl(tag, className, parent) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    parent.appendChild(el);
    return el;
  }

  function init() {
    if (document.querySelector(".ia-aichan-scroll")) return;

    const ui = appendEl("div", "ia-aichan-scroll", document.body);
    ui.setAttribute("aria-hidden", "true");
    const track = appendEl("div", "ia-aichan-track", ui);
    const fill = appendEl("div", "ia-aichan-fill", track);
    const character = appendEl("div", "ia-aichan-character", ui);
    const img = appendEl("img", "", character);
    img.alt = "";
    img.decoding = "async";

    Object.values(images).forEach((src) => {
      const preload = new Image();
      preload.src = src;
    });

    let currentState = "";
    let lastY = window.scrollY;
    let lastTime = performance.now();
    let surpriseUntil = 0;
    let backUntil = 0;
    let ticking = false;

    function setState(state) {
      if (state === currentState) return;
      currentState = state;
      img.src = images[state];
      character.classList.remove("is-normal", "is-surprised", "is-yay", "is-back");
      void character.offsetWidth;
      character.classList.add(`is-${state}`);
    }

    function scrollInfo() {
      const doc = document.scrollingElement || document.documentElement;
      const maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
      const y = Math.min(maxScroll, Math.max(0, window.scrollY || doc.scrollTop || 0));
      return { y, progress: Math.min(1, Math.max(0, y / maxScroll)) };
    }

    function update() {
      const now = performance.now();
      const { y, progress } = scrollInfo();
      const delta = y - lastY;
      const dt = Math.max(16, now - lastTime);
      const normalizedSpeed = Math.abs(delta) / (dt / 16.67);

      fill.style.height = `${(progress * 100).toFixed(2)}%`;

      const uiHeight = ui.clientHeight;
      const charHeight = character.offsetHeight || Number.parseFloat(getComputedStyle(character).width) || 120;
      const maxTop = Math.max(0, uiHeight - charHeight);
      const top = maxTop * progress;
      character.style.setProperty("--ia-aichan-y", `${top.toFixed(2)}px`);

      if (delta <= UP_SCROLL_DELTA && progress > TOP_THRESHOLD) {
        backUntil = now + BACK_DURATION;
        surpriseUntil = 0;
      } else if (delta > 0 && (normalizedSpeed > SURPRISE_SPEED || delta >= SURPRISE_DELTA) && progress > TOP_THRESHOLD && progress < 0.96) {
        surpriseUntil = now + SURPRISE_DURATION;
      }

      if (progress >= BOTTOM_THRESHOLD) {
        setState("yay");
      } else if (now < backUntil) {
        setState("back");
      } else if (now < surpriseUntil) {
        setState("surprised");
      } else {
        setState("normal");
      }

      lastY = y;
      lastTime = now;
      ui.classList.add("is-ready");
    }

    function requestUpdate() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        update();
      });
    }

    img.addEventListener("load", requestUpdate);
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    window.setInterval(() => {
      const { y } = scrollInfo();
      if (Math.abs(y - lastY) > 0.5) requestUpdate();
    }, 150);
    setState("normal");
    update();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
