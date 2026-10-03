/*
 * Emel Gönül — interactions and gentle motion.
 * Existing local Lenis assets remain in use.
 * Add your appointment URL to bookingUrl when ready.
 */

(() => {
  "use strict";

  const SITE_CONFIG = { bookingUrl: "" };
  const root = document.documentElement;

  root.classList.add("js-enabled");

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  );
  const header = document.querySelector(".header");
  const menuButton = document.querySelector(".menu-toggle");
  const navigation = document.querySelector(".nav");
  const dialog = document.querySelector("#booking-dialog");
  const motionButton = document.querySelector(".motion-toggle");
  const activeAnimations = new Set();

  let lenis = null;
  let userReduced = false;

  try {
    userReduced =
      localStorage.getItem("emel-reduce-motion") === "true";
  } catch (_) {
    // Use the system preference when storage is unavailable.
  }

  const motionAllowed = () =>
    !reducedMotion.matches && !userReduced;

  const scrollLocked = () =>
    document.body.classList.contains("menu-open") || dialog.open;

  function animateElement(element, frames, options) {
    if (!motionAllowed() || !element.animate) return null;

    const animation = element.animate(frames, options);
    activeAnimations.add(animation);

    animation.finished
      .then(() => {
        activeAnimations.delete(animation);
        animation.cancel();
      })
      .catch(() => activeAnimations.delete(animation));

    return animation;
  }

  function syncSmoothScroll() {
    if (lenis) {
      lenis.destroy();
      lenis = null;
    }

    if (motionAllowed() && typeof window.Lenis === "function") {
      lenis = new window.Lenis({
        autoRaf: true,
        lerp: 0.13,
        smoothWheel: true,
        syncTouch: false,
        wheelMultiplier: 1,
        anchors: false,
        prevent: (element) =>
          Boolean(element.closest("dialog, .nav.open")),
      });

      if (scrollLocked()) lenis.stop();
    }
  }

  function syncMotion() {
    root.dataset.motion = motionAllowed() ? "full" : "reduced";

    if (!motionAllowed()) {
      for (const animation of activeAnimations) {
        animation.cancel();
      }

      activeAnimations.clear();
      document
        .querySelectorAll(".reveal-pending")
        .forEach(showImmediately);
    }

    motionButton.setAttribute(
      "aria-pressed",
      String(!motionAllowed())
    );
    motionButton.disabled = reducedMotion.matches;

    motionButton.querySelector("span").textContent =
      reducedMotion.matches
        ? "Hareket azaltıldı"
        : userReduced
          ? "Animasyonları aç"
          : "Hareketi azalt";

    motionButton.title = reducedMotion.matches
      ? "Cihazınızın hareket azaltma tercihi uygulanıyor."
      : "";

    syncSmoothScroll();
    document.dispatchEvent(new CustomEvent("emel:motionchange"));
  }

  motionButton.addEventListener("click", () => {
    userReduced = !userReduced;

    try {
      localStorage.setItem(
        "emel-reduce-motion",
        String(userReduced)
      );
    } catch (_) {}

    syncMotion();
  });

  reducedMotion.addEventListener("change", syncMotion);

  // Navigation and appointment dialog.

  function syncScrollLock() {
    if (!lenis) return;

    if (scrollLocked()) lenis.stop();
    else lenis.start();
  }

  function closeMenu() {
    navigation.classList.remove("open");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Menüyü aç");
    document.body.classList.remove("menu-open");
    syncScrollLock();
  }

  menuButton.addEventListener("click", () => {
    const open = !navigation.classList.contains("open");

    navigation.classList.toggle("open", open);
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute(
      "aria-label",
      open ? "Menüyü kapat" : "Menüyü aç"
    );
    document.body.classList.toggle("menu-open", open);

    syncScrollLock();
  });

  navigation.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      navigation.classList.contains("open")
    ) {
      closeMenu();
      menuButton.focus();
    }
  });

  window
    .matchMedia("(min-width: 881px)")
    .addEventListener("change", (event) => {
      if (event.matches) closeMenu();
    });

  document.querySelectorAll("[data-booking]").forEach((button) => {
    button.addEventListener("click", () => {
      if (SITE_CONFIG.bookingUrl) {
        window.location.assign(SITE_CONFIG.bookingUrl);
        return;
      }

      dialog.showModal();
      dialog.classList.add("is-opening");
      syncScrollLock();
    });
  });

  dialog.addEventListener("animationend", () => {
    dialog.classList.remove("is-opening");
  });

  dialog.addEventListener("close", () => {
    dialog.classList.remove("is-opening");
    syncScrollLock();
  });

  document
    .querySelectorAll("[data-close-dialog], .dialog-close")
    .forEach((button) => {
      button.addEventListener("click", () => dialog.close());
    });

  dialog.addEventListener("click", (event) => {
    const rect = dialog.getBoundingClientRect();

    if (
      event.target === dialog &&
      (event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom)
    ) {
      dialog.close();
    }
  });

  document.querySelector("[data-year]").textContent =
    new Date().getFullYear();

  // Gentle, single-pass content reveals.

  function showImmediately(element) {
    element.classList.remove("reveal-pending");
    element.classList.add("is-revealed");
  }

  function reveal(element) {
    if (!element.classList.contains("reveal-pending")) return;

    showImmediately(element);

    animateElement(
      element,
      [
        { opacity: 0, transform: "translateY(18px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      {
        duration: 820,
        delay: Number(element.dataset.revealDelay || 0),
        easing: "cubic-bezier(.22,1,.36,1)",
        fill: "backwards",
      }
    );
  }

  function prepareReveals() {
    if (
      !motionAllowed() ||
      !("IntersectionObserver" in window)
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            reveal(entry.target);
            observer.unobserve(entry.target);
          }
        }
      },
      {
        threshold: 0.08,
        rootMargin: "0px 0px -30px 0px",
      }
    );

    const selectors =
      ".portrait, .about-copy > *, .services .section-heading, " +
      ".service, .services-note, .process .section-heading > *, " +
      ".step, .process-bottom, .faq-intro, .faq-list > details, " +
      ".appointment-inner > *, .footer-top > *";

    document.querySelectorAll(selectors).forEach((element) => {
      if (element.matches(".service, .step, details")) {
        element.dataset.revealDelay = String(
          Math.min(
            [...element.parentElement.children].indexOf(element) * 70,
            210
          )
        );
      }

      if (element.getBoundingClientRect().top < innerHeight - 20) {
        showImmediately(element);
      } else {
        element.classList.add("reveal-pending");
        observer.observe(element);
      }
    });

    document.addEventListener("focusin", (event) => {
      const pending = event.target.closest(".reveal-pending");

      if (pending) {
        showImmediately(pending);
        observer.unobserve(pending);
      }
    });

    window.addEventListener("hashchange", () => {
      const target = document.getElementById(
        decodeURIComponent(location.hash.slice(1))
      );

      if (target) {
        showImmediately(target);
        target
          .querySelectorAll(".reveal-pending")
          .forEach(showImmediately);
      }
    });

    window.addEventListener("beforeprint", () => {
      document
        .querySelectorAll(".reveal-pending")
        .forEach(showImmediately);
    });
  }

  // Anchor scrolling, history and keyboard focus.

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      ) {
        return;
      }

      const hash = link.getAttribute("href");
      const target = document.getElementById(hash.slice(1));

      if (!target) return;

      event.preventDefault();
      closeMenu();
      showImmediately(target);

      target
        .querySelectorAll(".reveal-pending")
        .forEach(showImmediately);

      const top = Math.max(
        0,
        target.getBoundingClientRect().top +
          window.scrollY -
          header.offsetHeight -
          23
      );

      if (location.hash !== hash) {
        history.pushState(null, "", hash);
      }

      const focusTarget = target.querySelector("h1, h2") || target;

      if (!focusTarget.hasAttribute("tabindex")) {
        focusTarget.setAttribute("tabindex", "-1");
        focusTarget.addEventListener(
          "blur",
          () => focusTarget.removeAttribute("tabindex"),
          { once: true }
        );
      }

      focusTarget.focus({ preventScroll: true });

      if (lenis) {
        lenis.scrollTo(top, { duration: 0.95 });
      } else {
        window.scrollTo({
          top,
          behavior: motionAllowed() ? "smooth" : "instant",
        });
      }
    });
  });

  // Native FAQ elements with smooth height transitions.

  document.querySelectorAll(".faq-list details").forEach((details) => {
    const summary = details.querySelector("summary");
    let animation = null;
    let requestedOpen = details.open;

    summary.addEventListener("click", (event) => {
      if (!motionAllowed() || !details.animate) return;

      event.preventDefault();

      const start = details.getBoundingClientRect().height;
      requestedOpen = !requestedOpen;

      if (animation) animation.cancel();

      details.open = true;
      details.style.height = "";

      const end = requestedOpen
        ? details.getBoundingClientRect().height
        : summary.getBoundingClientRect().height + 1;

      details.style.overflow = "hidden";

      animation = details.animate(
        [{ height: `${start}px` }, { height: `${end}px` }],
        {
          duration: 330,
          easing: "cubic-bezier(.22,1,.36,1)",
        }
      );

      const current = animation;

      const finish = () => {
        if (animation !== current) return;

        details.open = requestedOpen;
        details.style.height = "";
        details.style.overflow = "";
        animation = null;

        if (lenis) lenis.resize();
      };

      current.finished.then(finish).catch(finish);
    });

    details.addEventListener("toggle", () => {
      if (!animation) requestedOpen = details.open;
    });

    document.addEventListener("emel:motionchange", () => {
      if (!motionAllowed() && animation) animation.finish();
    });
  });

  // Header state and active navigation.

  let headerFrame = 0;

  const updateHeader = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 14);
    headerFrame = 0;
  };

  window.addEventListener(
    "scroll",
    () => {
      if (!headerFrame) {
        headerFrame = requestAnimationFrame(updateHeader);
      }
    },
    { passive: true }
  );

  updateHeader();

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            navigation.querySelectorAll("a").forEach((link) => {
              if (
                link.getAttribute("href") === "#" + entry.target.id
              ) {
                link.setAttribute("aria-current", "location");
              } else {
                link.removeAttribute("aria-current");
              }
            });
          }
        }
      },
      { rootMargin: "-15% 0px -60% 0px" }
    );

    document
      .querySelectorAll(
        "#hakkimda, #calisma-alanlari, #surec, #iletisim"
      )
      .forEach((section) => observer.observe(section));

    const ambientObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          entry.target.classList.toggle(
            "animation-paused",
            !entry.isIntersecting
          );
        }
      },
      { rootMargin: "60px" }
    );

    document
      .querySelectorAll(".hero, .about, .services, .appointment")
      .forEach((section) => ambientObserver.observe(section));
  }

  const syncVisibility = () => {
    document.body.classList.toggle(
      "animation-paused",
      document.hidden
    );

    for (const animation of activeAnimations) {
      document.hidden ? animation.pause() : animation.play();
    }
  };

  document.addEventListener("visibilitychange", syncVisibility);

  // Subtle WebGL background atmosphere, capped at 15 fps.

  function setupShader() {
    if (!motionAllowed()) {
      const startWhenAllowed = () => {
        if (!motionAllowed()) return;

        document.removeEventListener(
          "emel:motionchange",
          startWhenAllowed
        );
        setupShader();
      };

      document.addEventListener(
        "emel:motionchange",
        startWhenAllowed
      );
      return;
    }

    const canvas = document.querySelector("#calm-shader");
    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      powerPreference: "low-power",
    });

    if (!gl) return;

    const vertex =
      "attribute vec2 position; void main(){gl_Position=vec4(position,0.0,1.0);}";

    const fragment =
      "precision mediump float; uniform vec2 resolution; uniform float time; void main(){vec2 uv=gl_FragCoord.xy/resolution;uv.x*=resolution.x/resolution.y;float t=time*0.075;float wave=sin(uv.x*2.4+t+sin(uv.y*3.0-t))*0.5+0.5;float bloom=exp(-length((uv-vec2(1.2+sin(t)*0.15,0.55))*vec2(0.7,1.2))*1.7);vec3 cream=vec3(0.965,0.953,0.922);vec3 sage=vec3(0.824,0.867,0.761);vec3 color=mix(cream,sage,bloom*(0.28+wave*0.28));gl_FragColor=vec4(color,1.0);}";

    function compile(type, source) {
      const shader = gl.createShader(type);

      gl.shaderSource(shader, source);
      gl.compileShader(shader);

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }

      return shader;
    }

    const vs = compile(gl.VERTEX_SHADER, vertex);
    const fs = compile(gl.FRAGMENT_SHADER, fragment);

    if (!vs || !fs) return;

    const program = gl.createProgram();

    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

    gl.useProgram(program);

    const buffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1, 1, -1, -1, 1,
        -1, 1, 1, -1, 1, 1,
      ]),
      gl.STATIC_DRAW
    );

    const position = gl.getAttribLocation(program, "position");

    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const size = gl.getUniformLocation(program, "resolution");
    const clock = gl.getUniformLocation(program, "time");

    let visible = true;
    let last = 0;
    let frame = 0;
    let contextLost = false;
    let sceneTime = 0;

    function resize() {
      const rect = canvas.getBoundingClientRect();

      if (!rect.width || !rect.height) return;

      canvas.width = Math.max(1, Math.round(rect.width * 0.65));
      canvas.height = Math.max(1, Math.round(rect.height * 0.65));

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(size, canvas.width, canvas.height);
    }

    function animate(now) {
      frame = 0;

      if (
        document.hidden ||
        !visible ||
        !motionAllowed() ||
        contextLost
      ) {
        return;
      }

      if (now - last > 66) {
        sceneTime += Math.min(now - last, 100) / 1000;
        gl.uniform1f(clock, sceneTime);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        last = now;
      }

      frame = requestAnimationFrame(animate);
    }

    function resume() {
      if (
        !frame &&
        !document.hidden &&
        visible &&
        motionAllowed() &&
        !contextLost
      ) {
        resize();
        last = performance.now();
        frame = requestAnimationFrame(animate);
      }
    }

    function stop() {
      cancelAnimationFrame(frame);
      frame = 0;
    }

    resize();

    if ("ResizeObserver" in window) {
      new ResizeObserver(resize).observe(canvas);
    } else {
      window.addEventListener("resize", resize, { passive: true });
    }

    document.addEventListener("visibilitychange", () => {
      document.hidden ? stop() : resume();
    });

    document.addEventListener("emel:motionchange", () => {
      motionAllowed() ? resume() : stop();
    });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
        if (visible) resume();
        else stop();
      }).observe(document.querySelector(".hero"));
    }

    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      contextLost = true;
      canvas.style.display = "none";
      stop();
    });

    resume();
  }

  syncMotion();
  prepareReveals();

  if (motionAllowed()) {
    document
      .querySelectorAll(".hero-copy > *, .hero-art, .hero-bottom")
      .forEach((element, index) => {
        animateElement(
          element,
          [
            { opacity: 0, transform: "translateY(10px)" },
            { opacity: 1, transform: "none" },
          ],
          {
            duration: 1000,
            delay: Math.min(index * 85, 340),
            easing: "cubic-bezier(.22,1,.36,1)",
            fill: "backwards",
          }
        );
      });
  }

  setupShader();
})();

// Detailed individual dandelion seeds.

(() => {
  "use strict";

  const canvas = document.querySelector("#dandelion-canvas");
  const ctx = canvas?.getContext("2d");

  if (!ctx) return;

  const frame = canvas.closest(".dandelion-composition");
  const art = canvas.closest(".hero-art");
  const media = matchMedia("(prefers-reduced-motion: reduce)");

  const canMove = () =>
    !media.matches &&
    document.documentElement.dataset.motion !== "reduced";

  const ratio = Math.min(devicePixelRatio || 1, 2);
  const TAU = Math.PI * 2;

  let randomState = 8251;

  const random = () => {
    randomState =
      (Math.imul(randomState, 1664525) + 1013904223) | 0;

    return (randomState >>> 0) / 4294967296;
  };

  // Cache the delicate filaments once, then animate each seed.

  function makeSeed(variant) {
    const sprite = document.createElement("canvas");

    sprite.width = 128 * ratio;
    sprite.height = 168 * ratio;

    const c = sprite.getContext("2d");

    c.scale(ratio, ratio);
    c.translate(64, 56);
    c.lineCap = "round";

    const spread = 25 + variant * 1.6;

    for (let j = 0; j < 29; j++) {
      const angle = -Math.PI + (j / 28) * Math.PI;
      const length = 0.83 + random() * 0.22;
      const x = Math.cos(angle) * spread * length;
      const y =
        Math.sin(angle) * (18 + variant) * length - 3;

      c.beginPath();
      c.moveTo(0, 0);
      c.quadraticCurveTo(x * 0.46, y * 0.64, x, y);
      c.strokeStyle =
        `rgba(70,96,55,${0.52 + random() * 0.25})`;
      c.lineWidth = 0.56 + random() * 0.22;
      c.stroke();

      // Fine branches at each filament tip.
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(
        x + Math.cos(angle - 0.55) * 2.5,
        y + Math.sin(angle - 0.55) * 2.5
      );
      c.moveTo(x, y);
      c.lineTo(
        x + Math.cos(angle + 0.55) * 2.5,
        y + Math.sin(angle + 0.55) * 2.5
      );
      c.lineWidth = 0.35;
      c.strokeStyle = "rgba(113,132,90,.48)";
      c.stroke();
    }

    // Slender connection between the tuft and seed.
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(4 + variant, 22, -7, 44);
    c.strokeStyle = "#768260";
    c.lineWidth = 0.86;
    c.stroke();

    // Warm, natural brown seed body.
    c.save();
    c.translate(-7, 47);
    c.rotate(0.15);

    const brown = c.createLinearGradient(-2, 0, 2, 0);

    brown.addColorStop(0, "#7b7154");
    brown.addColorStop(0.55, "#a09673");
    brown.addColorStop(1, "#6e674e");

    c.fillStyle = brown;
    c.beginPath();
    c.ellipse(0, 0, 1.7, 5.5, 0, 0, TAU);
    c.fill();
    c.restore();

    return sprite;
  }

  const sprites = Array.from(
    { length: 4 },
    (_, i) => makeSeed(i)
  );

  const seeds = Array.from({ length: 18 }, (_, i) => {
    const direction = i % 5 === 0 ? -1 : 1;
    const initialX =
      ((i % 5) + 0.3 + random() * 0.4) / 5;

    return {
      phase: direction > 0 ? initialX : 1 - initialX,
      y: 55 + Math.floor(i / 5) * 112 + random() * 48,
      duration: 67 + random() * 42,
      direction,
      scale: 0.42 + random() * 0.65,
      opacity: 0.6 + random() * 0.3,
      lean: (random() - 0.5) * 0.85,
      wave: random() * TAU,
      lift: (random() - 0.5) * 48,
      sprite: sprites[i % sprites.length],
    };
  });

  let width = 480;
  let height = 520;
  let time = 0;
  let raf = 0;
  let last = 0;
  let lastPaint = 0;
  let visible = true;
  let wind = 0;
  let windTarget = 0;

  function paint() {
    ctx.setTransform(width / 480, 0, 0, height / 520, 0, 0);
    ctx.clearRect(0, 0, 480, 520);

    for (const seed of seeds) {
      const progress =
        (time / seed.duration + seed.phase) % 1;

      const travel =
        seed.direction > 0 ? progress : 1 - progress;

      const x =
        -65 +
        travel * 610 +
        Math.sin(time * 0.15 + seed.wave) * 9 +
        wind;

      const y =
        seed.y +
        Math.sin(progress * TAU + seed.wave) * 26 +
        Math.sin(time * 0.18 + seed.wave) * 7 +
        (progress - 0.5) * seed.lift;

      // Fade at the edges so loops never visibly jump.
      const fade = Math.min(
        1,
        progress / 0.07,
        (1 - progress) / 0.07
      );

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(
        seed.lean + Math.sin(time * 0.21 + seed.wave) * 0.14
      );
      ctx.scale(seed.scale, seed.scale);
      ctx.globalAlpha = Math.max(0, fade) * seed.opacity;
      ctx.drawImage(seed.sprite, -64, -56, 128, 168);
      ctx.restore();
    }
  }

  function resize() {
    const box = frame.getBoundingClientRect();

    if (!box.width || !box.height) return;

    width = Math.round(box.width * ratio);
    height = Math.round(box.height * ratio);

    canvas.width = width;
    canvas.height = height;

    paint();
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  function animate(now) {
    raf = 0;

    if (!visible || document.hidden || !canMove()) {
      stop();
      return;
    }

    // Approximately 30 fps; keep the animation light.
    if (now - lastPaint >= 33) {
      const delta = Math.min((now - last) / 1000, 0.08);

      time += delta;
      last = now;
      lastPaint = now;

      wind +=
        (windTarget - wind) * Math.min(delta * 1.5, 1);

      paint();
    }

    raf = requestAnimationFrame(animate);
  }

  function sync() {
    if (!visible || document.hidden || !canMove()) {
      stop();
      return;
    }

    if (!raf) {
      last = performance.now();
      lastPaint = last;
      raf = requestAnimationFrame(animate);
    }
  }

  art.addEventListener("pointermove", (event) => {
    if (!canMove() || event.pointerType !== "mouse") return;

    const box = art.getBoundingClientRect();

    windTarget =
      ((event.clientX - box.left) / box.width - 0.5) * 8;
  });

  art.addEventListener("pointerleave", () => {
    windTarget = 0;
  });

  document.addEventListener("visibilitychange", sync);
  document.addEventListener("emel:motionchange", sync);
  media.addEventListener("change", sync);

  // Pause while the decorative area is offscreen.
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting;
        sync();
      },
      { rootMargin: "20px" }
    ).observe(art);
  }

  if ("ResizeObserver" in window) {
    new ResizeObserver(resize).observe(frame);
  } else {
    window.addEventListener("resize", resize, { passive: true });
  }

  resize();
  frame.classList.add("dandelion-ready");
  sync();
})();
