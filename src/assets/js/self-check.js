// self-check.js – the interactive "How do you compare?" self-check.
//
// How it works
//   1. The questions are a normal form on the page (built from
//      src/_data/selfcheck.yaml). This script shows them one at a time.
//   2. Visitors who don't use AI skip the questions only AI users were asked.
//   3. The result card compares each answer with the benchmark values from the
//      YAML file and picks an "AI-at-work type" (personas in the YAML file).
//   4. "Save image" draws the same card on a canvas (1080 × 1920 px, the size of
//      an Instagram story). "Share card" opens the phone's share menu.
//
// Privacy: everything stays in the browser. Answers are never sent anywhere
// and nothing is stored (no cookies, no localStorage).

(() => {
  const app = document.getElementById("self-check-app");
  const dataEl = document.getElementById("selfcheck-data");
  if (!app || !dataEl) return;

  const data = JSON.parse(dataEl.textContent);
  const itemsByCode = new Map([...data.profile, ...data.items].map((q) => [q.code, q]));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const shareUrl = app.dataset.shareUrl;
  const fileName = "my-ai-at-work-card.png";

  // Thresholds for the AI-at-work type (answer positions, counted from 0)
  const LOTS_FROM = 4;   // frequency scale: "Several times a week" or more often = uses AI a lot
  const UPBEAT_FROM = 3; // agree scale: "Rather agree" or more = upbeat

  // ---------------------------------------------------------------------------
  // Elements
  // ---------------------------------------------------------------------------
  const start = app.querySelector('[data-screen="start"]');
  const form = app.querySelector('[data-screen="quiz"]');
  const result = app.querySelector('[data-screen="result"]');
  const questions = [...form.querySelectorAll(".sc-question")];
  const hint = form.querySelector("[data-hint]");
  const nextButton = form.querySelector("[data-next]");
  const progressLabel = form.querySelector("[data-progress-label]");
  const progressFill = form.querySelector("[data-progress-fill]");
  const startButton = start.querySelector('[data-action="start"]');
  const shareButton = result.querySelector('[data-action="share"]');
  const downloadButton = result.querySelector('[data-action="download"]');
  const whatsappLink = result.querySelector('[data-share="whatsapp"]');
  const shareStatus = result.querySelector("[data-share-status]");
  const statList = result.querySelector("[data-stats]");

  let step = 0;          // position in the list of questions this visitor is asked
  let current = null;    // { persona, stats } of the last result
  let image = null;      // Promise of the PNG of the last result

  // JavaScript works: swap the "needs JavaScript" note for the start button
  start.querySelector("[data-nojs]").hidden = true;
  startButton.hidden = false;

  // ---------------------------------------------------------------------------
  // Answers
  // ---------------------------------------------------------------------------
  const answerOf = (code) => {
    const value = code ? form.elements.namedItem(code)?.value : "";
    return value ? Number(value) : null;
  };
  const isNonUser = () => answerOf(data.result?.usageItem) === 0;

  // The questions this visitor is asked (AI users get a few more)
  const activeQuestions = () =>
    questions.filter((fs) => !("usersOnly" in fs.dataset) || !isNonUser());

  // ---------------------------------------------------------------------------
  // Screens and steps
  // ---------------------------------------------------------------------------
  const showScreen = (screen) => {
    for (const s of [start, form, result]) s.hidden = s !== screen;
  };

  const renderStep = ({ focus = true } = {}) => {
    const active = activeQuestions();
    const question = active[step];
    for (const fs of questions) fs.hidden = fs !== question;
    progressLabel.textContent = `Question ${step + 1} of ${active.length}`;
    progressFill.style.width = `${((step + 1) / active.length) * 100}%`;
    nextButton.textContent = step === active.length - 1 ? "See my card" : "Next";
    hint.textContent = "";
    if (focus) question.querySelector(".sc-question__text").focus();
  };

  startButton.addEventListener("click", () => {
    step = 0;
    showScreen(form);
    renderStep();
  });

  // "Next" (also Enter on a selected answer)
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const active = activeQuestions();
    const question = active[step];
    if (answerOf(question.dataset.code) === null) {
      hint.textContent = "Please choose an answer to continue.";
      question.querySelector("input").focus();
      return;
    }
    if (step < active.length - 1) {
      step += 1;
      renderStep();
    } else {
      showResult();
    }
  });

  form.querySelector('[data-action="back"]').addEventListener("click", () => {
    if (step === 0) {
      showScreen(start);
      startButton.focus();
      return;
    }
    step -= 1;
    renderStep();
  });

  // Changing the first answer can change how many questions follow
  form.addEventListener("change", () => renderStep({ focus: false }));

  result.querySelector('[data-action="restart"]').addEventListener("click", () => {
    form.reset();
    result.classList.remove("is-revealed");
    step = 0;
    showScreen(form);
    renderStep();
  });

  // ---------------------------------------------------------------------------
  // Result: comparison and AI-at-work type
  // ---------------------------------------------------------------------------
  const percent = (n) => `${Math.round(n)}%`;

  // Where the answer sits among everyone's answers (benchmark = % per answer)
  const compare = (item, answer) => {
    const dist = item.benchmark.distribution;
    const total = dist.reduce((a, b) => a + b, 0) || 1;
    const share = (from, to) => (dist.slice(from, to).reduce((a, b) => a + b, 0) / total) * 100;
    const below = share(0, answer);      // chose a lower answer
    const above = share(answer + 1);     // chose a higher answer
    const mean = dist.reduce((sum, v, i) => sum + v * i, 0) / total;
    const higher = below >= above;
    const steps = dist.length - 1;
    return {
      p: Math.round(higher ? below : above),
      template:
        (higher ? item.card?.more : item.card?.less) ||
        (higher ? "Higher than {p} of employees" : "Lower than {p} of employees"),
      you: answer / steps,
      avg: mean / steps,
      avgIndex: Math.round(mean),
    };
  };

  const buildStats = () =>
    activeQuestions()
      .map((fs) => itemsByCode.get(fs.dataset.code))
      .filter((item) => item?.benchmark?.distribution)
      .map((item) => {
        const answer = answerOf(item.code);
        const scale = data.scales[item.scale];
        const c = compare(item, answer);
        return {
          ...c,
          code: item.code,
          label: item.construct,
          ends: data.scaleEnds?.[item.scale] || [scale[0], scale[scale.length - 1]],
          answerText: scale[answer],
          avgText: scale[c.avgIndex],
        };
      });

  const personaFor = () => {
    const use = answerOf(data.result?.usageItem);
    const outlook = answerOf(data.result?.outlookItem);
    const useKey = use === null ? "some" : use === 0 ? "none" : use >= LOTS_FROM ? "lots" : "some";
    const outlookKey = outlook === null || outlook >= UPBEAT_FROM ? "upbeat" : "wary";
    return data.personas?.[`${useKey}-${outlookKey}`] || { name: "My AI at work", text: "" };
  };

  // ---------------------------------------------------------------------------
  // Result: the card on the page
  // ---------------------------------------------------------------------------
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  const statItem = (s) => {
    const li = el("li", "sc-stat");
    const [before, after = ""] = s.template.split("{p}");
    const num = el("strong", "sc-stat__num", percent(s.p));
    num.dataset.value = s.p;
    const phrase = el("p", "sc-stat__phrase");
    phrase.append(before, num, after);

    const track = el("div", "sc-track");
    track.setAttribute("role", "img");
    track.setAttribute("aria-label", `My answer: ${s.answerText}. Average answer: about “${s.avgText}”.`);
    const line = el("span", "sc-track__line");
    const avg = el("span", "sc-track__dot sc-track__dot--avg");
    const you = el("span", "sc-track__dot sc-track__dot--you");
    avg.dataset.pos = s.avg;
    you.dataset.pos = s.you;
    line.append(avg, you);
    track.append(el("span", "sc-track__end", s.ends[0]), line, el("span", "sc-track__end", s.ends[1]));

    li.append(el("p", "sc-stat__label", s.label), phrase, track);
    return li;
  };

  const placeDots = () => {
    for (const dot of statList.querySelectorAll(".sc-track__dot")) {
      dot.style.left = `${Number(dot.dataset.pos) * 100}%`;
    }
  };

  // Numbers count up from 0 while the rows fade in
  const countUp = () => {
    if (reduceMotion) return;
    const nums = [...statList.querySelectorAll(".sc-stat__num")];
    const t0 = performance.now() + 350;
    const duration = 900;
    const tick = (t) => {
      const k = Math.min(1, Math.max(0, (t - t0) / duration));
      const eased = 1 - (1 - k) ** 3;
      for (const n of nums) n.textContent = percent(Number(n.dataset.value) * eased);
      if (k < 1) requestAnimationFrame(tick);
    };
    for (const n of nums) n.textContent = percent(0);
    requestAnimationFrame(tick);
  };

  const showResult = () => {
    const persona = personaFor();
    const stats = buildStats();
    current = { persona, stats };

    for (const node of result.querySelectorAll("[data-persona-name]")) node.textContent = persona.name;
    for (const node of result.querySelectorAll("[data-persona-text]")) node.textContent = persona.text;
    statList.replaceChildren(...stats.map(statItem));

    // Only show "Dig deeper" links for the questions this visitor answered
    const asked = new Set(activeQuestions().map((fs) => fs.dataset.code));
    for (const li of result.querySelectorAll(".sc-links [data-code]")) li.hidden = !asked.has(li.dataset.code);

    whatsappLink.href =
      "https://wa.me/?text=" +
      encodeURIComponent(`My AI-at-work type: ${persona.name}. How do you compare? ${shareUrl}`);
    shareStatus.textContent = "";

    result.classList.remove("is-revealed");
    showScreen(result);
    result.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
    result.querySelector("#sc-result-title").focus({ preventScroll: true });

    // Two frames later the card is on screen at its start position → animate in
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        result.classList.add("is-revealed");
        placeDots();
        countUp();
      }),
    );

    // Prepare the image now, so "Share" can open the share menu right away
    image = renderImage(current);
  };

  // ---------------------------------------------------------------------------
  // Result: the same card as an image (canvas)
  // Sizes are in U = 1 % of the card width, matching the cqi units in the CSS.
  // ---------------------------------------------------------------------------
  const W = 1080;
  const H = 1920;
  const U = W / 100;

  const roundRect = (ctx, x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  const wrap = (ctx, text, maxWidth) => {
    const lines = [];
    let line = "";
    for (const word of text.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(test).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  const renderImage = async ({ persona, stats }) => {
    const card = result.querySelector("[data-card]");
    const css = getComputedStyle(card);
    const font = css.fontFamily;
    const token = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
    const accent = token("--c-accent", "#b8322a");
    const accentStrong = token("--c-accent-strong", "#962520");
    const cream = token("--c-bg", "#fff7f0");
    const white = "#ffffff";

    if (document.fonts) {
      await Promise.all([400, 700, 800].map((w) => document.fonts.load(`${w} ${4 * U}px ${font}`)));
    }

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    const pad = 9 * U;
    const inner = W - 2 * pad;
    const canSpace = "letterSpacing" in ctx;

    const setFont = (weight, size, spaced = false) => {
      ctx.font = `${weight} ${size * U}px ${font}`;
      if (canSpace) ctx.letterSpacing = spaced ? "0.06em" : "0px";
    };
    const dot = (x, y, r, fill) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
    };

    // Background + rings (same geometry as the SVG on the card)
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, W, H);
    const ringsW = 78 * U;
    const s = ringsW / 400;
    const rx = W + 22 * U - ringsW;
    const ry = -24 * U;
    [
      [200, 195, "rgba(255,255,255,0.08)"],
      [230, 150, "rgba(255,255,255,0.12)"],
      [260, 105, "rgba(255,255,255,0.18)"],
      [290, 60, cream],
    ].forEach(([cy, r, fill]) => dot(rx + 200 * s, ry + cy * s, r * s, fill));
    ctx.fillStyle = accent;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.font = `800 ${22 * s}px ${font}`;
    ctx.fillText("You", rx + 200 * s, ry + 297 * s);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    // Kicker
    ctx.fillStyle = white;
    setFont(700, 3, true);
    ctx.fillText(card.querySelector(".sc-card__kicker").textContent.toUpperCase(), pad, pad);

    // AI-at-work type
    let y = pad + 3 * 1.4 * U + 30 * U;
    ctx.globalAlpha = 0.85;
    setFont(700, 2.8, true);
    ctx.fillText(card.querySelector(".sc-card__label").textContent.toUpperCase(), pad, y);
    ctx.globalAlpha = 1;
    y += 2.8 * 1.4 * U + 1.5 * U;
    setFont(800, 9);
    for (const line of wrap(ctx, persona.name, inner)) {
      ctx.fillText(line, pad, y);
      y += 9 * 1.02 * U;
    }
    y += 2 * U;
    setFont(400, 3.6);
    for (const line of wrap(ctx, persona.text, inner)) {
      ctx.fillText(line, pad, y);
      y += 3.6 * 1.35 * U;
    }

    // Footer (from the bottom up)
    const footH = 2.4 * 1.4 * U;
    const footY = H - pad - footH / 2; // vertical middle of the footer line
    ctx.textBaseline = "middle";
    const ls = (5 * U) / 40; // logo: 40 × 32 units → 5 U wide
    const logoAccent = getComputedStyle(card.querySelector(".brand__mark-accent")).fill;
    [[0, 18, 14], [8.5, 12, 20], [17, 15, 17], [25.5, 6, 26], [34, 10, 22]].forEach(([x, top, h], i) => {
      ctx.fillStyle = i === 3 ? logoAccent : white;
      roundRect(ctx, pad + x * ls, footY - 16 * ls + top * ls, 6 * ls, h * ls, 3 * ls);
      ctx.fill();
    });
    ctx.fillStyle = white;
    setFont(700, 2.4);
    ctx.fillText(card.querySelector(".sc-card__brand").textContent.trim(), pad + 6.6 * U, footY);
    const demo = card.querySelector(".sc-card__demo");
    if (demo) {
      setFont(800, 2.2, true);
      const label = demo.textContent.toUpperCase();
      const w = ctx.measureText(label).width + 4 * U;
      const h = 2.2 * U + 1.6 * U + 0.8 * U;
      roundRect(ctx, W - pad - w, footY - h / 2, w, h, h / 2);
      ctx.fillStyle = cream;
      ctx.fill();
      ctx.fillStyle = accentStrong;
      ctx.fillText(label, W - pad - w + 2 * U, footY);
    }

    // Stats (anchored above the footer, like margin-top: auto in the CSS)
    const rowH = 2.5 * 1.4 * U + 0.6 * U + 3.7 * 1.25 * 1.2 * U + 1.6 * U + 3.4 * U;
    const gap = 3.4 * U;
    const legendH = 2.4 * 1.4 * U + 3 * U;
    y = H - pad - footH - 6 * U - stats.length * rowH - (stats.length - 1) * gap - legendH;

    // Legend
    ctx.fillStyle = white;
    setFont(700, 2.4);
    const legendY = y + 1.2 * U;
    dot(pad + 1.2 * U, legendY, 1.2 * U, cream);
    let x = pad + 2.4 * U + 1.5 * U;
    ctx.fillStyle = white;
    ctx.fillText("Me", x, legendY);
    x += ctx.measureText("Me").width + 1.5 * U + 2 * U;
    ctx.strokeStyle = white;
    ctx.lineWidth = 0.5 * U;
    ctx.beginPath();
    ctx.arc(x + 1.2 * U, legendY, 0.95 * U, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillText("Average in Switzerland", x + 2.4 * U + 1.5 * U, legendY);
    y += legendH;

    for (const st of stats) {
      // Label
      ctx.globalAlpha = 0.85;
      ctx.textBaseline = "top";
      setFont(700, 2.5, true);
      ctx.fillText(st.label.toUpperCase(), pad, y);
      ctx.globalAlpha = 1;
      y += 2.5 * 1.4 * U + 0.6 * U;

      // Sentence with a bigger number (shrinks to fit if needed)
      const [before, after = ""] = st.template.split("{p}");
      const num = percent(st.p);
      let size = 3.7;
      const measure = () => {
        setFont(700, size);
        const a = ctx.measureText(before).width + ctx.measureText(after).width;
        setFont(800, size * 1.25);
        return a + ctx.measureText(num).width;
      };
      while (measure() > inner && size > 2.6) size -= 0.1;
      const base = y + size * 1.25 * 1.2 * U * 0.8;
      ctx.textBaseline = "alphabetic";
      let px = pad;
      setFont(700, size);
      ctx.fillText(before, px, base);
      px += ctx.measureText(before).width;
      setFont(800, size * 1.25);
      ctx.fillText(num, px, base);
      px += ctx.measureText(num).width;
      setFont(700, size);
      ctx.fillText(after, px, base);
      y += 3.7 * 1.25 * 1.2 * U + 1.6 * U;

      // Track with "me" and "average" markers
      const ty = y + 1.7 * U;
      ctx.textBaseline = "middle";
      ctx.globalAlpha = 0.85;
      setFont(400, 2.2);
      ctx.fillText(st.ends[0], pad, ty);
      const leftW = ctx.measureText(st.ends[0]).width;
      const rightW = ctx.measureText(st.ends[1]).width;
      ctx.textAlign = "right";
      ctx.fillText(st.ends[1], W - pad, ty);
      ctx.textAlign = "left";
      ctx.globalAlpha = 1;
      const x0 = pad + leftW + 3.2 * U;
      const x1 = W - pad - rightW - 3.2 * U;
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      roundRect(ctx, x0, ty - 0.3 * U, x1 - x0, 0.6 * U, 0.3 * U);
      ctx.fill();
      const avgX = x0 + st.avg * (x1 - x0);
      dot(avgX, ty, 1.3 * U, white);
      dot(avgX, ty, 0.75 * U, accent);
      const youX = x0 + st.you * (x1 - x0);
      dot(youX, ty, 1.7 * U + 0.55 * U, accent);
      dot(youX, ty, 1.7 * U, cream);

      y += 3.4 * U + gap;
    }

    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  };

  // ---------------------------------------------------------------------------
  // Share & download
  // ---------------------------------------------------------------------------
  const canShareFiles = (() => {
    try {
      return !!navigator.canShare?.({ files: [new File([""], fileName, { type: "image/png" })] });
    } catch {
      return false;
    }
  })();
  if (canShareFiles) {
    shareButton.hidden = false;
    downloadButton.classList.replace("button--primary", "button--ghost");
  }

  shareButton.addEventListener("click", async () => {
    try {
      const blob = await image;
      await navigator.share({
        files: [new File([blob], fileName, { type: "image/png" })],
        title: "My AI at work",
        text: `My AI-at-work type: ${current.persona.name}. How do you compare? ${shareUrl}`,
      });
    } catch (error) {
      if (error.name !== "AbortError") shareStatus.textContent = "Sharing didn't work. Try “Save image” instead.";
    }
  });

  downloadButton.addEventListener("click", async () => {
    try {
      const blob = await image;
      const url = URL.createObjectURL(blob);
      const link = Object.assign(document.createElement("a"), { href: url, download: fileName });
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      shareStatus.textContent = "Image saved. Look for it in your downloads.";
    } catch {
      shareStatus.textContent = "Sorry, the image couldn't be created in this browser.";
    }
  });
})();
