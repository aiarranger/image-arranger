/* image-arranger LP — zero-dependency, offline-safe (one optional guarded GitHub API call) */
(() => {
  "use strict";
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- copy buttons (Clipboard API + execCommand fallback) ---------- */
  function legacyCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0;pointer-events:none";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    ta.remove();
    return ok;
  }
  $$(".copy").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const text = btn.dataset.copy || "";
      let ok = false;
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch {
        ok = legacyCopy(text);
      }
      btn.textContent = ok ? "copied!" : "select & copy";
      btn.classList.toggle("copied", ok);
      setTimeout(() => {
        btn.textContent = "copy";
        btn.classList.remove("copied");
      }, 1500);
    });
  });

  /* ---------- smooth anchors ---------- */
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const el = document.querySelector(a.getAttribute("href"));
      if (el) {
        e.preventDefault();
        el.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth" });
      }
    });
  });

  /* ---------- GitHub star count (silent fallback: render nothing) ---------- */
  (async () => {
    try {
      const res = await fetch("https://api.github.com/repos/aiarranger/image-arranger");
      if (!res.ok) return;
      const data = await res.json();
      if (data && typeof data.stargazers_count === "number" && data.stargazers_count > 0) {
        const el = $("#starCount");
        el.textContent = data.stargazers_count.toLocaleString("en-US");
        el.hidden = false;
      }
    } catch { /* offline / rate-limited: render nothing */ }
  })();

  /* ---------- works-with marquee: duplicate the row for a seamless loop ---------- */
  const stripRow = $("#stripRow");
  if (stripRow) {
    $$("span", stripRow).forEach((chip) => {
      const dup = chip.cloneNode(true);
      dup.setAttribute("data-dup", "");
      dup.setAttribute("aria-hidden", "true");
      stripRow.appendChild(dup);
    });
  }

  /* ---------- shared scroll-reveal observer ---------- */
  const revealIO = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (en.isIntersecting) {
        en.target.classList.add("in-view");
        revealIO.unobserve(en.target);
      }
    }
  }, { threshold: 0.25 });
  $$("[data-reveal], .cell, .ba-panel.after").forEach((el) => revealIO.observe(el));

  /* ---------- workflow scrollytelling ---------- */
  const wfSteps = $$(".wf-step");
  const wfLabels = $$(".wf-label");
  const wfProgress = $("#wfProgress");
  if (wfSteps.length && wfLabels.length) {
    const setActive = (i) => {
      wfLabels.forEach((l, j) => l.classList.toggle("on", j === i));
      if (wfProgress) wfProgress.style.transform = `scaleY(${(i + 1) / wfSteps.length})`;
    };
    const wfIO = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (en.isIntersecting) setActive(wfSteps.indexOf(en.target));
      }
    }, { threshold: 0.5 });
    wfSteps.forEach((s) => wfIO.observe(s));
    wfLabels.forEach((l) => {
      l.addEventListener("click", () => {
        const step = wfSteps[Number(l.dataset.wf)];
        if (step) step.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "center" });
      });
    });
    setActive(0);
  }

  /* ---------- self-playing hero demo loop (~12s, exactly loopable) ---------- */
  const mock = $("#demoMock");
  if (!mock) return;
  // Reduced motion keeps the static data-step="1" frame, but the loop wiring
  // below still attaches so an RM-on → off flip mid-session starts the demo.

  const body = $("#demoBody");
  const pill = $("#demoPill");
  const cursor = $("#demoCursor");
  const typed = $("#demoTyped");
  const tabBase = $("#demoTabBase");
  const tabImage = $("#demoTabImage");
  const tabQueue = $("#demoTabQueue");
  const PROMPT = "full body, red dress, soft studio light";
  const STEP_MS = [1500, 1900, 1500, 2900, 2200, 2000]; // ≈ 12s total
  let stepTimer = 0;
  let typeTimer = 0;
  let running = false;

  function placePill(tab) {
    pill.style.width = tab.offsetWidth + "px";
    pill.style.transform = `translateX(${tab.offsetLeft}px)`;
  }
  function moveCursorTo(el, dx, dy) {
    const r = el.getBoundingClientRect();
    const b = body.getBoundingClientRect();
    const x = r.left - b.left + r.width / 2 + (dx || 0) - 7;
    const y = r.top - b.top + r.height / 2 + (dy || 0) - 7;
    cursor.style.transform = `translate(${x}px, ${y}px)`;
  }
  function typewriter() {
    clearInterval(typeTimer);
    let i = 0;
    typed.textContent = "";
    typeTimer = setInterval(() => {
      i += 1;
      typed.textContent = PROMPT.slice(0, i);
      if (i >= PROMPT.length) clearInterval(typeTimer);
    }, Math.floor(2100 / PROMPT.length));
  }
  function flyCardToQueue() {
    const src = $(".card.c3 .ph", mock);
    if (!src || typeof src.animate !== "function") return;
    const from = src.getBoundingClientRect();
    const to = tabQueue.getBoundingClientRect();
    const clone = src.cloneNode(false);
    clone.innerHTML = "";
    clone.className = "fly-card";
    clone.style.cssText += `;left:${from.left}px;top:${from.top}px;width:${from.width}px;height:${from.height}px;` +
      `background:linear-gradient(140deg,#b8e8f7,#b8f7d8);box-shadow:0 10px 28px rgba(155,125,255,.3)`;
    document.body.appendChild(clone);
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    clone.animate(
      [
        { transform: "translate(0,0) scale(1)", opacity: 0.95 },
        { transform: `translate(${dx}px, ${dy}px) scale(.15)`, opacity: 0.2 }
      ],
      { duration: 450, easing: "cubic-bezier(.3,.8,.4,1)", fill: "forwards" }
    ).finished.then(() => clone.remove()).catch(() => clone.remove());
  }
  function applyStep(n) {
    mock.dataset.step = String(n);
    const onImage = n >= 2;
    tabBase.classList.toggle("on", !onImage);
    tabImage.classList.toggle("on", onImage);
    placePill(onImage ? tabImage : tabBase);
    if (n === 0) { typed.textContent = ""; moveCursorTo(body, -200, 80); }
    if (n === 1) moveCursorTo($(".card.c1 .badge.adopted", mock), 0, 0);
    if (n === 2) moveCursorTo(tabImage, 0, 0);
    if (n === 3) { moveCursorTo($(".json", mock), -80, 0); typewriter(); }
    if (n === 4) { moveCursorTo($(".card.c3 .ph", mock), 0, 0); flyCardToQueue(); }
  }
  function runStep(n) {
    if (n === 0 && mock.dataset.step === "5") {
      // soft crossfade back to the start state (loop ends where it began)
      if (typeof body.animate === "function") {
        body.animate([{ opacity: 1 }, { opacity: 0.25, offset: 0.5 }, { opacity: 1 }], { duration: 500, easing: "ease-in-out" });
      }
      setTimeout(() => applyStep(0), 240);
    } else {
      applyStep(n);
    }
    stepTimer = setTimeout(() => { if (running) runStep((n + 1) % STEP_MS.length); }, STEP_MS[n]);
  }
  function start() {
    if (running) return;
    running = true;
    mock.classList.add("live");
    runStep(0);
  }
  function stop() {
    running = false;
    clearTimeout(stepTimer);
    clearInterval(typeTimer);
  }
  // pause off-screen, restart (from a clean step 0) when visible again
  let mockInView = false;
  new IntersectionObserver((entries) => {
    for (const en of entries) {
      mockInView = en.isIntersecting;
      if (mockInView && !reduceMotion.matches) start();
      else stop();
    }
  }, { threshold: 0.2 }).observe(mock);
  addEventListener("resize", () => {
    if (running) placePill(mock.dataset.step >= "2" ? tabImage : tabBase);
  });
  // RM flipped on mid-session: stop and show the static frame.
  // RM flipped off: start the loop if the mock is on screen.
  reduceMotion.addEventListener?.("change", (e) => {
    if (e.matches) {
      stop();
      mock.classList.remove("live");
      mock.dataset.step = "1";
      typed.textContent = PROMPT;
      tabBase.classList.add("on");
      tabImage.classList.remove("on");
    } else if (mockInView) {
      start();
    }
  });
})();
