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
// Lottie dandelion and matching seeds across the whole page.
(async () => {
  "use strict";

  if (document.getElementById("eg-flower")) return;

  document
    .querySelectorAll(
      ".hero-art, .seed-field, .process-decoration, #eg-breeze"
    )
    .forEach(el => el.remove());

  function loadPlayer() {
    if (window.lottie) {
      return Promise.resolve(window.lottie);
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");

      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.13.0/lottie.min.js";

      script.onload = () => resolve(window.lottie);

      script.onerror = () =>
        reject(new Error("Lottie player could not load."));

      document.head.append(script);
    });
  }

  const ready = animation =>
    new Promise((resolve, reject) => {
      animation.addEventListener("DOMLoaded", resolve);

      animation.addEventListener("data_failed", () => {
        reject(new Error("Invalid animation data."));
      });
    });

  const copy = value =>
    JSON.parse(JSON.stringify(value));

  const random = (min, max) =>
    min + Math.random() * (max - min);

  const clamp = (value, min, max) =>
    Math.max(min, Math.min(max, value));

  try {
    const [data, player] = await Promise.all([
      fetch("dandelion.json?v=20261102-3").then(response => {
        if (!response.ok) {
          throw new Error(
            "dandelion.json: " + response.status
          );
        }

        return response.json();
      }),

      loadPlayer(),
    ]);

    // Keep the original paths and movement; recolor the ink.
    function recolor(node) {
      if (!node || typeof node !== "object") return;

      if (
        (node.ty === "fl" || node.ty === "st") &&
        Array.isArray(node.c?.k) &&
        typeof node.c.k[0] === "number"
      ) {
        const light = node.c.k[0] > 0.4;

        node.c.k = light
          ? [0.53, 0.61, 0.45, 1]
          : [0.24, 0.36, 0.27, 1];
      }

      Object.values(node).forEach(value => {
        if (value && typeof value === "object") {
          recolor(value);
        }
      });
    }

    recolor(data);

    // Remove the small square sparkle layers.
    data.layers = data.layers.filter(
      layer => !/^espora/i.test(layer.nm || "")
    );

    const canvas = document.createElement("canvas");
    canvas.id = "eg-breeze";
    canvas.setAttribute("aria-hidden", "true");

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const flower = document.createElement("div");
    flower.id = "eg-flower";
    flower.setAttribute("aria-hidden", "true");

    document.body.append(canvas, flower);

    // Use an actual seed from the supplied animation.
    async function makeSeed() {
      const source = data.layers.find(layer =>
        /^semilla1 Outlines$/.test(layer.nm || "")
      );

      if (!source) {
        throw new Error(
          "Seed layer not found in dandelion.json."
        );
      }

      const layer = copy(source);

      layer.ks = {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [0, 0, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] },
      };

      layer.ip = 0;
      layer.op = 2;
      layer.st = 0;

      delete layer.parent;

      const holder = document.createElement("div");

      holder.style.cssText =
        "position:fixed;left:-10000px;top:0;" +
        "width:596px;height:596px;visibility:hidden";

      document.body.append(holder);

      const seedAnimation = player.loadAnimation({
        container: holder,
        renderer: "svg",
        loop: false,
        autoplay: false,
        animationData: {
          ...copy(data),
          layers: [layer],
          ip: 0,
          op: 2,
          fr: 1,
        },
      });

      try {
        await ready(seedAnimation);
        seedAnimation.goToAndStop(0, true);

        const svg = holder.querySelector("svg");
        const box = svg.getBBox();
        const w = box.width + 8;
        const h = box.height + 8;

        svg.setAttribute(
          "viewBox",
          `${box.x - 4} ${box.y - 4} ${w} ${h}`
        );

        svg.setAttribute("width", String(w));
        svg.setAttribute("height", String(h));
        svg.removeAttribute("style");

        svg
          .querySelectorAll("[clip-path]")
          .forEach(el => el.removeAttribute("clip-path"));

        const image = new Image();

        const imageLoaded = new Promise(
          (resolve, reject) => {
            image.onload = resolve;
            image.onerror = reject;
          }
        );

        image.src =
          "data:image/svg+xml;charset=utf-8," +
          encodeURIComponent(
            new XMLSerializer().serializeToString(svg)
          );

        await imageLoaded;

        const normal = document.createElement("canvas");

        normal.width = 224;
        normal.height = Math.ceil((224 * h) / w);

        normal.getContext("2d").drawImage(
          image,
          0,
          0,
          normal.width,
          normal.height
        );

        const light = document.createElement("canvas");

        light.width = normal.width;
        light.height = normal.height;

        const c = light.getContext("2d");

        c.drawImage(normal, 0, 0);
        c.globalCompositeOperation = "source-in";
        c.fillStyle = "#e0dfc9";
        c.fillRect(0, 0, light.width, light.height);

        return {
          normal,
          light,
          ratio: h / w,
        };
      } finally {
        seedAnimation.destroy();
        holder.remove();
      }
    }

    const sprite = await makeSeed();

    const animation = player.loadAnimation({
      name: "emel-flower",
      container: flower,
      renderer: "svg",
      loop: true,
      autoplay: false,
      animationData: copy(data),
      rendererSettings: {
        preserveAspectRatio: "xMidYMid meet",
      },
    });

    await ready(animation);

    animation.setSpeed(0.42);
    animation.setSubframe(false);
    animation.goToAndStop(60, true);

    flower.classList.add("is-ready");

    const media = matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    const canMove = () =>
      !media.matches &&
      document.documentElement.dataset.motion !== "reduced";

    const darkSection = document.querySelector(".process");
    const seeds = [];

    let width = 0;
    let height = 0;
    let ratio = 1;
    let time = 0;
    let raf = 0;
    let last = 0;
    let nextSeed = 5;
    let dirty = true;
    let breeze = 0;
    let previousScroll = scrollY;
    let flowerBox;
    let darkBand = { top: -1, bottom: -1 };

    const isDark = y =>
      y >= darkBand.top && y <= darkBand.bottom;

    function release(warm = false) {
      if (seeds.length >= (width < 600 ? 6 : 12)) return;

      seeds.push({
        x: warm
          ? random(0.2, 0.9) * width
          : flowerBox.left + flowerBox.width * 0.84,

        y: warm
          ? random(0.12, 0.8) * height
          : flowerBox.top + flowerBox.height * 0.16,

        vx: random(12, 23),
        vy: random(-10, -4),

        size: random(
          width < 600 ? 28 : 36,
          width < 600 ? 44 : 58
        ),

        angle: random(-0.55, 0.05),
        phase: random(0, Math.PI * 2),
        alpha: random(0.5, 0.8),
        age: warm ? 4 : 0,
        life: random(90, 125),
      });
    }

    function paint() {
      if (dirty) {
        const box = darkSection?.getBoundingClientRect();

        darkBand = box
          ? { top: box.top, bottom: box.bottom }
          : { top: -1, bottom: -1 };

        flower.classList.toggle(
          "is-dark",
          isDark(flowerBox.top + flowerBox.height * 0.56)
        );

        dirty = false;
      }

      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);

      for (const seed of seeds) {
        const fade = Math.min(
          1,
          seed.age / 3,
          (seed.life - seed.age) / 8
        );

        ctx.save();
        ctx.translate(seed.x, seed.y);

        ctx.rotate(
          seed.angle +
          Math.sin(time * 0.25 + seed.phase) * 0.14
        );

        ctx.globalAlpha = Math.max(0, fade) * seed.alpha;

        const h = seed.size * sprite.ratio;

        ctx.drawImage(
          isDark(seed.y) ? sprite.light : sprite.normal,
          -seed.size / 2,
          -h / 2,
          seed.size,
          h
        );

        ctx.restore();
      }
    }

    function tick(now) {
      raf = 0;

      if (document.hidden || !canMove()) return;

      const elapsed = now - last;

      if (elapsed >= 33) {
        const delta = Math.min(elapsed / 1000, 0.08);

        last = now;
        time += delta;
        breeze *= Math.exp(-delta * 2);

        if (time >= nextSeed) {
          release();
          nextSeed = time + random(7, 11);
        }

        for (let i = seeds.length - 1; i >= 0; i--) {
          const seed = seeds[i];

          seed.age += delta;

          seed.x +=
            (
              seed.vx +
              Math.sin(time * 0.3 + seed.phase) * 3
            ) * delta;

          seed.y +=
            (
              seed.vy +
              Math.sin(time * 0.35 + seed.phase) * 4 -
              breeze
            ) * delta;

          if (
            seed.x > width + 80 ||
            seed.y < -80 ||
            seed.age >= seed.life
          ) {
            seeds.splice(i, 1);
          }
        }

        paint();
      }

      raf = requestAnimationFrame(tick);
    }

    function sync() {
      if (document.hidden || !canMove()) {
        animation.pause();
        cancelAnimationFrame(raf);
        raf = 0;
      } else {
        animation.play();

        if (!raf) {
          last = performance.now();
          raf = requestAnimationFrame(tick);
        }
      }
    }

    function resize() {
      const oldW = width;
      const oldH = height;

      width = document.documentElement.clientWidth;
      height = innerHeight;
      ratio = Math.min(devicePixelRatio || 1, 1.75);

      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);

      if (oldW && oldH) {
        seeds.forEach(seed => {
          seed.x *= width / oldW;
          seed.y *= height / oldH;
        });
      }

      flowerBox = flower.getBoundingClientRect();

      animation.resize();
      dirty = true;
      paint();
    }

    window.addEventListener("resize", resize, {
      passive: true,
    });

    window.addEventListener(
      "scroll",
      () => {
        breeze = clamp(
          breeze + (scrollY - previousScroll) * 0.035,
          -8,
          8
        );

        previousScroll = scrollY;
        dirty = true;

        if (!canMove()) paint();
      },
      { passive: true }
    );

    document.addEventListener("visibilitychange", sync);
    document.addEventListener("emel:motionchange", sync);
    media.addEventListener("change", sync);

    resize();

    for (let i = 0; i < 3; i++) {
      release(true);
    }

    paint();
    sync();
  } catch (error) {
    console.error("Emel Gönül animation:", error);
  }
})();
