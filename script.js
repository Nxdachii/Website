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
// Corner dandelion: gentle movement and a continuous page-wide breeze.
(() => {
  "use strict";

  // Remove the previous decorative plants and seed fields.
  document
    .querySelectorAll(".hero-art, .seed-field, .process-decoration")
    .forEach(el => el.remove());

  if (document.querySelector("#eg-breeze")) return;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) return;

  canvas.id = "eg-breeze";
  canvas.setAttribute("aria-hidden", "true");
  document.body.append(canvas);

  const media = matchMedia("(prefers-reduced-motion: reduce)");

  const canMove = () =>
    !media.matches &&
    document.documentElement.dataset.motion !== "reduced";

  const TAU = Math.PI * 2;
  const random = (min, max) => min + Math.random() * (max - min);
  const ease = x => x * x * (3 - 2 * x);
  const clamp = (x, min, max) => Math.max(min, Math.min(max, x));

  let width = 0;
  let height = 0;
  let ratio = 1;
  let time = 0;
  let raf = 0;
  let last = 0;
  let nextRelease = 2.6;
  let scrollBreeze = 0;
  let lastScroll = scrollY;
  let bandDirty = true;
  let darkBand = { top: -1, bottom: -1 };

  const darkSection = document.querySelector(".process");
  const particles = [];

  // Draw the fine filaments once and reuse them during animation.
  function makeTuft(light, variant) {
    const image = document.createElement("canvas");
    image.width = 144;
    image.height = 176;

    const c = image.getContext("2d");

    c.scale(2, 2);
    c.translate(36, 30);
    c.lineCap = "round";

    for (let i = 0; i < 27; i++) {
      const angle = -Math.PI + (i / 26) * Math.PI;
      const length = 0.86 + Math.sin(i * 13.7 + variant) * 0.12;
      const x = Math.cos(angle) * (23 + variant) * length;
      const y = Math.sin(angle) * (17 + variant) * length - 2;

      c.strokeStyle = light
        ? "rgba(238,235,212,.88)"
        : "rgba(84,105,66,.7)";

      c.lineWidth = 0.48 + (i % 3) * 0.09;
      c.beginPath();
      c.moveTo(0, 0);
      c.quadraticCurveTo(x * 0.45, y * 0.7, x, y);
      c.stroke();

      c.lineWidth = 0.34;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(
        x + Math.cos(angle - 0.6) * 2.8,
        y + Math.sin(angle - 0.6) * 2.8
      );
      c.moveTo(x, y);
      c.lineTo(
        x + Math.cos(angle + 0.6) * 2.8,
        y + Math.sin(angle + 0.6) * 2.8
      );
      c.stroke();
    }

    c.strokeStyle = light ? "#c5d1ac" : "#7a8863";
    c.lineWidth = 0.85;
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(3, 15, -3, 32);
    c.stroke();

    c.fillStyle = light ? "#d9cbaa" : "#8b7956";
    c.beginPath();
    c.ellipse(-3, 35, 1.25, 4, 0.15, 0, TAU);
    c.fill();

    return image;
  }

  const sprites = [false, true].map(light =>
    Array.from({ length: 3 }, (_, i) => makeTuft(light, i))
  );

  // A spherical arrangement gives the seed head depth.
  const attached = Array.from({ length: 125 }, (_, i) => {
    const z = 1 - (2 * (i + 0.5)) / 125;
    const angle = i * 2.399963;
    const radius = Math.sqrt(1 - z * z) * 47;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    return {
      x,
      y,
      z,
      rotation: Math.atan2(y, x) + Math.PI / 2,
      scale: 0.23 + (z + 1) * 0.105,
      variant: i % 3,
      returnAt: -100,
    };
  }).sort((a, b) => a.z - b.z);

  function pose() {
    const mobile = width < 600;

    const scale = mobile
      ? clamp(height / 900, 0.64, 0.82)
      : clamp(height / 850, 0.82, 1.1);

    return {
      x:
        (mobile ? 28 : 62) * scale +
        Math.sin(time * 0.35) * 7 * scale,

      y:
        height -
        (mobile ? 222 : 253) * scale +
        Math.cos(time * 0.29) * 3,

      scale,
      rotation: -0.2 + Math.sin(time * 0.33) * 0.045,
    };
  }

  function isDark(y) {
    return y >= darkBand.top && y <= darkBand.bottom;
  }

  function drawTuft(x, y, scale, rotation, alpha, variant) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;

    ctx.drawImage(
      sprites[isDark(y) ? 1 : 0][variant],
      -36,
      -30,
      72,
      88
    );

    ctx.restore();
  }

  function release(warmStart = false) {
    if (particles.length >= (width < 600 ? 10 : 18)) return;

    const choices = attached.filter(
      seed =>
        time > seed.returnAt + 5 &&
        seed.x > -15 &&
        seed.y < 24 &&
        Math.hypot(seed.x, seed.y) > 27
    );

    if (!choices.length) return;

    const source = choices[Math.floor(random(0, choices.length))];
    const plant = pose();
    const cos = Math.cos(plant.rotation);
    const sin = Math.sin(plant.rotation);

    const seed = {
      x:
        plant.x +
        (source.x * cos - source.y * sin) * plant.scale,

      y:
        plant.y +
        (source.x * sin + source.y * cos) * plant.scale,

      age: 0,
      life: random(95, 135),
      vx: random(15, 27),
      vy: random(-12, -6),
      scale: source.scale * plant.scale,
      targetScale: random(0.38, 0.7),
      rotation: source.rotation + plant.rotation,
      phase: random(0, TAU),
      opacity: random(0.48, 0.76),
      variant: source.variant,
    };

    source.returnAt = time + random(14, 21);

    // Begin with a few seeds already carried by the breeze.
    if (warmStart) {
      seed.x += random(0.15, 0.85) * width;
      seed.y -= random(0.15, 0.6) * height;
      seed.age = 12;
    }

    particles.push(seed);
  }

  function paint() {
    if (bandDirty) {
      const rect = darkSection?.getBoundingClientRect();

      darkBand = rect
        ? { top: rect.top, bottom: rect.bottom }
        : { top: -1, bottom: -1 };

      bandDirty = false;
    }

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const plant = pose();
    const dark = isDark(plant.y);
    const baseX = -18;
    const baseY = height + 15;

    ctx.lineCap = "round";

    const stem = ctx.createLinearGradient(
      0,
      plant.y,
      0,
      height
    );

    stem.addColorStop(
      0,
      dark ? "#c1cda2" : "#72835b"
    );

    stem.addColorStop(
      1,
      isDark(height - 2) ? "#a9ba8c" : "#9ba382"
    );

    ctx.strokeStyle = stem;
    ctx.lineWidth = 2.1 * plant.scale;

    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.bezierCurveTo(
      55 * plant.scale,
      height - 60 * plant.scale,
      plant.x - 45 * plant.scale,
      plant.y + 100 * plant.scale,
      plant.x,
      plant.y + 8 * plant.scale
    );
    ctx.stroke();

    // The head follows the same gentle sway as the stem.
    ctx.save();
    ctx.translate(plant.x, plant.y);
    ctx.rotate(plant.rotation);
    ctx.scale(plant.scale, plant.scale);

    for (const seed of attached) {
      const opacity = ease(
        clamp((time - seed.returnAt) / 5, 0, 1)
      );

      if (!opacity) continue;

      ctx.strokeStyle = dark
        ? "rgba(201,212,174,.22)"
        : "rgba(112,129,90,.24)";

      ctx.lineWidth = 0.45;
      ctx.beginPath();
      ctx.moveTo(seed.x * 0.12, seed.y * 0.12);
      ctx.lineTo(seed.x, seed.y);
      ctx.globalAlpha = opacity;
      ctx.stroke();

      ctx.save();
      ctx.translate(seed.x, seed.y);
      ctx.rotate(seed.rotation);
      ctx.scale(seed.scale, seed.scale);

      ctx.globalAlpha =
        opacity * (0.42 + (seed.z + 1) * 0.22);

      ctx.drawImage(
        sprites[dark ? 1 : 0][seed.variant],
        -36,
        -30,
        72,
        88
      );

      ctx.restore();
    }

    ctx.restore();

    for (const seed of particles) {
      const grow = ease(clamp(seed.age / 8, 0, 1));

      const fade = clamp(
        (seed.life - seed.age) / 8,
        0,
        1
      );

      drawTuft(
        seed.x,
        seed.y,
        seed.scale +
          (seed.targetScale - seed.scale) * grow,
        seed.rotation +
          Math.sin(seed.age * 0.28 + seed.phase) * 0.22,
        seed.opacity * fade,
        seed.variant
      );
    }
  }

  function update(delta) {
    time += delta;
    scrollBreeze *= Math.exp(-delta * 2);

    // Release one seed at a time, with irregular pauses.
    if (time >= nextRelease) {
      release();
      nextRelease = time + random(4, 7);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const seed = particles[i];

      seed.age += delta;

      seed.x +=
        (
          seed.vx +
          Math.sin(time * 0.3 + seed.phase) * 4
        ) * delta;

      seed.y +=
        (
          seed.vy +
          Math.sin(time * 0.4 + seed.phase) * 5 -
          scrollBreeze
        ) * delta;

      if (
        seed.x > width + 70 ||
        seed.y < -80 ||
        seed.age >= seed.life
      ) {
        particles.splice(i, 1);
      }
    }
  }

  function tick(now) {
    raf = 0;

    if (document.hidden || !canMove()) return;

    const elapsed = now - last;

    if (elapsed >= 33) {
      update(Math.min(elapsed / 1000, 0.08));
      paint();
      last = now;
    }

    raf = requestAnimationFrame(tick);
  }

  function sync() {
    if (document.hidden || !canMove()) {
      cancelAnimationFrame(raf);
      raf = 0;
      return;
    }

    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  }

  function resize() {
    const oldWidth = width;
    const oldHeight = height;

    width = document.documentElement.clientWidth;
    height = window.innerHeight;
    ratio = Math.min(devicePixelRatio || 1, 1.75);

    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);

    if (oldWidth && oldHeight) {
      particles.forEach(seed => {
        seed.x *= width / oldWidth;
        seed.y *= height / oldHeight;
      });
    }

    bandDirty = true;
    paint();
  }

  window.addEventListener("resize", resize, {
    passive: true,
  });

  window.addEventListener(
    "scroll",
    () => {
      scrollBreeze = clamp(
        scrollBreeze + (scrollY - lastScroll) * 0.035,
        -8,
        8
      );

      lastScroll = scrollY;
      bandDirty = true;

      if (!canMove()) paint();
    },
    { passive: true }
  );

  document.addEventListener("visibilitychange", sync);
  document.addEventListener("emel:motionchange", sync);
  media.addEventListener("change", sync);

  resize();

  for (let i = 0; i < 4; i++) {
    release(true);
  }

  paint();
  sync();
})();
