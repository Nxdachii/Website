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
        lerp: 0.09,
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

            history.replaceState(
        history.state,
        "",
        location.pathname + location.search
      );

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
                lenis.resize();
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

    // Hafif atmosfer mevcut CSS gradyanıyla sağlanır.
  function setupShader() {
    document.querySelector("#calm-shader")?.remove();
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
// Cached artwork; only small image layers move.
(async () => {
  "use strict";

  const media = matchMedia("(prefers-reduced-motion: reduce)");
  const moving = () =>
    !media.matches &&
    document.documentElement.dataset.motion !== "reduced";

  const random = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const TAU = Math.PI * 2;

  const files = [
    "dandelion",
    "dandelion-light",
    "dandelion-seed",
    "dandelion-seed-light",
  ];

  const sources = files.map(name =>
    new URL(`assets/${name}.webp`, document.baseURI).href
  );

  try {
    await Promise.all(
      sources.map(src => new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = resolve;
        image.onerror = reject;
        image.src = src;
      }))
    );
  } catch (_) {
    return;
  }

  if (document.getElementById("eg-breeze")) return;

  const field = document.createElement("div");
  field.id = "eg-breeze";
  field.setAttribute("aria-hidden", "true");
  document.body.append(field);

  const section = document.querySelector(".process");
  const stem = { x: .26239699, y: .92155240 };

  const matrix = {
    a: .0025160997,
    b: .0000584534,
    c: -.0000584534,
    d: .0025160997,
    e: .13048322,
    f: .31576062,
  };

  const seeds = [];
  let width = 0, height = 0, size = 390;
  let time = 0, frame = 0, last = 0, lastStep = 0;
  let nextSeed = 1.5, breeze = 0;
  let previousScroll = scrollY, dirty = true;
  let top = Infinity, bottom = Infinity, fade = 1;
  let resizePending = true, bag = [], warmIndex = 0;

  const warmOffset = random(0, TAU);

  function piece(first) {
    const el = document.createElement("div");
    el.className = "eg-piece";

    const layers = [0, 1].map(i => {
      const layer = document.createElement("div");
      layer.className = "eg-pigment";

      const image = document.createElement("img");
      image.src = sources[first + i];
      image.alt = "";
      image.draggable = false;

      layer.append(image);
      el.append(layer);

      return { layer, image };
    });

    field.append(el);

    return {
      el,
      layers,
      mask: "",
      x: 0,
      y: 0,
      box: 0,
    };
  }

  const flower = piece(0);

  function geometry(p, box, w, h, x, y, origin) {
    p.box = box;
    p.el.style.width = p.el.style.height = `${box}px`;

    for (const { image } of p.layers) {
      Object.assign(image.style, {
        width: `${w}px`,
        height: `${h}px`,
        left: `${x}px`,
        top: `${y}px`,
        transformOrigin: origin,
      });
    }
  }

  function tint(p, y = p.y) {
    const end = y + p.box;
    let key;

    if (end <= top || y >= bottom) {
      key = "ink";
    } else if (y >= top + fade && end <= bottom - fade) {
      key = "light";
    } else {
      key = `${top - y},${bottom - y}`;
    }

    if (key === p.mask) return;
    p.mask = key;

    p.layers.forEach(({ layer }, i) => {
      const single = key === "ink" || key === "light";

      layer.style.display =
        single && i !== (key === "light" ? 1 : 0)
          ? "none"
          : "block";

      let mask = "none";

      if (!single) {
        const weight = value => {
          const t = clamp(
            Math.min(value - top, bottom - value) / fade,
            0,
            1
          );

          return t * t * (3 - 2 * t);
        };

        const stops = [
          ...new Set(
            [y, end, top, top + fade, bottom - fade, bottom]
              .filter(v => v >= y && v <= end)
          ),
        ].sort((a, b) => a - b);

        mask = `linear-gradient(to bottom,${stops.map(v => {
          const alpha = weight(v);
          return (
            `rgba(0,0,0,${i ? alpha : 1 - alpha}) ` +
            `${v - y}px`
          );
        }).join(",")})`;
      }

      layer.style.maskImage = mask;
      layer.style.webkitMaskImage = mask;
    });
  }

    let sectionBounds = null;

  function measure() {
    if (resizePending || !sectionBounds) {
      const rect = section?.getBoundingClientRect();

      sectionBounds = rect
        ? {
            top: rect.top + scrollY,
            bottom: rect.bottom + scrollY
          }
        : {
            top: Infinity,
            bottom: Infinity
          };
    }

    top = sectionBounds.top - scrollY;
    bottom = sectionBounds.bottom - scrollY;

    if (resizePending) {
      const w = field.clientWidth;
      const h = field.clientHeight;
      fade = Math.max(
        .5,
        parseFloat(
          getComputedStyle(document.documentElement)
            .getPropertyValue("--process-fade")
        ) || 1
      );

      if (width && height) {
        for (const s of seeds) {
          s.x *= w / width;
          s.y *= h / height;
        }
      }

      width = w;
      height = h;
      size = width <= 600 ? 280 : 390;

      const pad = size * .15;

      geometry(
        flower,
        size + pad * 2,
        size,
        size,
        pad,
        pad,
        `${stem.x * size}px ${stem.y * size}px`
      );

      flower.x = (width <= 600 ? -60 : -80) - pad;
      flower.y = height + 1 - stem.y * size - pad;

      flower.el.style.transform =
        `translate3d(${flower.x}px,${flower.y}px,0)`;

      flower.el.style.opacity =
        width <= 600 ? ".7" : ".82";

      while (seeds.length > (width < 600 ? 8 : 12)) {
        seeds.pop().el.remove();
      }

      resizePending = false;
    }

    dirty = false;
  }

  function artworkPoint(x, y) {
    const px =
      (matrix.a * x + matrix.c * y + matrix.e - stem.x) * size;

    const py =
      (matrix.b * x + matrix.d * y + matrix.f - stem.y) * size;

    const angle =
      (Math.cos(time * TAU / 9.52) * 2 - 1.3308414) *
      Math.PI / 180;

    return {
      x:
        flower.x + size * .15 + stem.x * size +
        px * Math.cos(angle) - py * Math.sin(angle),
      y:
        height + 1 +
        px * Math.sin(angle) + py * Math.cos(angle),
    };
  }

  function release(warm = false) {
    if (seeds.length >= (width < 600 ? 8 : 12)) return;

    const center = artworkPoint(80, 100);
    let source, heading;

    for (let attempt = 0; attempt < 12; attempt++) {
      if (!bag.length) {
        bag = [-2.65, -1.85, -1.1, -.35, .45, 1.15];

        for (let i = bag.length - 1; i > 0; i--) {
          const j = Math.floor(random(0, i + 1));
          [bag[i], bag[j]] = [bag[j], bag[i]];
        }
      }

      const angle = bag.pop() + random(-.18, .18);
      const radius = random(58, 76);

      source = artworkPoint(
        80 + Math.cos(angle) * radius,
        100 + Math.sin(angle) * radius
      );

      heading = Math.atan2(
        source.y - center.y,
        source.x - center.x
      );

      if (
        source.x > 6 &&
        source.x < width - 6 &&
        source.y > 20 &&
        source.y < height - 12
      ) break;
    }

    if (warm) {
      heading =
        warmOffset + warmIndex++ * TAU / 3 +
        random(-.25, .25);
    }

    const depth = random(.75, 1.12);
    const speed = random(22, 30) * depth;

    const w = random(
      width < 600 ? 35 : 42,
      width < 600 ? 49 : 61
    ) * depth;

    const h = w * .54910714;
    const box = Math.ceil(Math.hypot(w, h) * 2);

    const s = Object.assign(piece(2), {
      x: warm ? random(.12, .9) * width : source.x,
      y: warm ? random(.12, .85) * height : source.y,
      vx: Math.cos(heading) * speed,
      vy: Math.sin(heading) * speed,
      heading: heading + random(-1.3, 1.3),
      speed,
      depth,
      angle: heading,
      spin: random(-.025, .025),
      phase: random(0, TAU),
      alpha: random(.5, .76),
      age: warm ? 8 : 0,
      life: random(85, 125),
      turnAt: time + random(3.5, 7),
      recovering: false,
    });

    geometry(
      s,
      box,
      w,
      h,
      box / 2 - w * .76,
      box / 2 - h * .42,
      "76% 42%"
    );

    seeds.push(s);
  }

  function update(dt) {
    time += dt;
    breeze *= Math.exp(-dt * 2);

    if (time >= nextSeed) {
      release();
      nextSeed = time + random(2.8, 4.8);
    }

    for (let i = seeds.length - 1; i >= 0; i--) {
      const s = seeds[i];
      s.age += dt;

      const outside =
        s.x < -45 || s.x > width + 45 ||
        s.y < -45 || s.y > height + 45;

      if (outside && !s.recovering) {
        s.heading =
          Math.atan2(height * .5 - s.y, width * .5 - s.x) +
          random(-.6, .6);

        s.recovering = true;
      } else if (
        s.recovering &&
        s.x > 25 && s.x < width - 25 &&
        s.y > 25 && s.y < height - 25
      ) {
        s.recovering = false;
        s.turnAt = time + random(2, 4);
      }

      if (!s.recovering && time >= s.turnAt) {
        s.heading +=
          (Math.random() < .5 ? -1 : 1) * random(.8, 2.1);

        s.turnAt = time + random(3.5, 7);
      }

      if (s.age > .65) {
        const heading =
          s.heading + Math.sin(time * .22 + s.phase) * .32;

        const blend = 1 - Math.exp(-dt * .35);

        s.vx +=
          (Math.cos(heading) * s.speed - s.vx) * blend;

        s.vy +=
          (Math.sin(heading) * s.speed - s.vy) * blend;
      }

      s.x += (
        s.vx + Math.sin(time * .29 + s.phase) * 3 * s.depth
      ) * dt;

      s.y += (
        s.vy + Math.cos(time * .24 + s.phase) * 3 * s.depth -
        breeze
      ) * dt;

      s.angle += s.spin * dt;

      if (s.age >= s.life) {
        s.el.remove();
        seeds.splice(i, 1);
      }
    }
  }

  function paint() {
    if (dirty || resizePending) measure();

    const rotation =
      `rotate(${Math.cos(time * TAU / 9.52) * 2 - 1.3308414}deg)`;

    for (const { image } of flower.layers) {
      image.style.transform = rotation;
    }

    tint(flower);

    for (const s of seeds) {
      const x = s.x - s.box / 2;
      const y = s.y - s.box / 2;

      s.el.style.transform = `translate3d(${x}px,${y}px,0)`;

      s.el.style.opacity = String(
        Math.max(
          0,
          Math.min(1, s.age / .75, (s.life - s.age) / 8)
        ) * s.alpha
      );

      const angle =
        `rotate(${s.angle + Math.sin(time * .25 + s.phase) * .16}rad)`;

      for (const { image } of s.layers) {
        image.style.transform = angle;
      }

      tint(s, y);
    }
  }

  function tick(now) {
    frame = 0;
    if (document.hidden || !moving()) return;

    const elapsed = now - last;

    if (elapsed >= 1000 / 60) {
      last = now - elapsed % (1000 / 60);

      const dt = Math.min((now - lastStep) / 1000, .05);
      lastStep = now;

      update(dt);
      paint();
    }

    frame = requestAnimationFrame(tick);
  }

  function sync() {
    if (document.hidden || !moving()) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else if (!frame) {
      last = lastStep = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }

  let refreshFrame = 0;

  function refresh() {
    dirty = true;

    if (!refreshFrame) {
      refreshFrame = requestAnimationFrame(() => {
        refreshFrame = 0;

        if (!document.hidden && (!moving() || !frame)) {
          paint();
        }
      });
    }
  }

  function resize() {
    resizePending = true;
    refresh();
  }

  addEventListener("resize", resize, { passive: true });

  window.visualViewport?.addEventListener(
    "resize",
    resize,
    { passive: true }
  );

  addEventListener("scroll", () => {
    breeze = clamp(
      breeze + (scrollY - previousScroll) * .035,
      -8,
      8
    );

    previousScroll = scrollY;
    refresh();
  }, { passive: true });

  document.addEventListener("visibilitychange", () => {
    refresh();
    sync();
  });

  document.addEventListener("emel:motionchange", sync);
  media.addEventListener("change", sync);

  if ("ResizeObserver" in window) {
        new ResizeObserver(() => {
      sectionBounds = null;
      refresh();
    }).observe(document.querySelector("main"));
  }

  measure();

  for (let i = 0; i < 3; i++) release(true);

  paint();
  sync();
})();
// Bölüm bağlantılarını adres çubuğundan temizle.
(() => {
  "use strict";

  function clearSectionHash() {
    if (!location.href.includes("#")) return;

    history.replaceState(
      history.state,
      "",
      location.pathname + location.search
    );
  }

  const cleanAfterNavigation = () =>
    requestAnimationFrame(clearSectionHash);

  window.addEventListener("hashchange", cleanAfterNavigation);
  window.addEventListener("pageshow", cleanAfterNavigation);

  if (document.readyState === "complete") {
    cleanAfterNavigation();
  } else {
    window.addEventListener("load", cleanAfterNavigation, {
      once: true
    });
  }
})();
