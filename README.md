# AI & People at Work – website

Public website for the **AI & People at Work** study (University of Zurich, Chair of Work and Organizational Psychology). It presents the report's findings in a more accessible, interactive way: theme pages, a self-check ("How do you compare?") and an interactive language-region map.

**Status:** structure and placeholders. Pages contain titles, short descriptions and dashed **"To build"** boxes that describe what still needs to be implemented. No results or numbers from the report have been added yet. The self-check works end to end, but with **invented demo values** (see below).

Built with [Eleventy](https://www.11ty.dev/), a simple static site generator. The output is plain HTML/CSS, so the site is fast and secure and doesn't need a server or a database. There are no cookies, no analytics and no third-party requests. Fonts are self-hosted.

---

## Quick start

You need [Node.js](https://nodejs.org/) (version 20 or newer).

```bash
npm install      # once, installs Eleventy and the fonts
npm start        # local preview at http://localhost:8080 (reloads on save)
npm run build    # builds the finished site into _site/
```

---

## Where things are

```
src/
├── _data/                  ← SETTINGS & CONTENT LISTS (edit these most)
│   ├── site.yaml           site name, contact emails, social links, report PDF, active design
│   ├── navigation.yaml     header menu + footer links
│   ├── home.yaml           all homepage texts
│   ├── team.yaml           research team (About page)
│   └── selfcheck.yaml      self-check questions, answer scales, result-card texts, comparison values (demo)
│
├── findings/
│   ├── index.njk           /findings/ overview page
│   └── themes/             ONE FILE PER THEME (Markdown) → /findings/<file-name>/
│       ├── ai-use.md         1  AI use at work
│       ├── differences.md    2  Gender, age and language region (+ map)
│       ├── personal.md       3  Personal level
│       ├── colleagues.md     4  Interpersonal level
│       ├── organisation.md   5  Organisational level
│       ├── society.md        6  Societal level
│       ├── trends.md         upcoming (wave 2) – card only, no page yet
│       └── deep-dive.md      upcoming – card only, no page yet
│
├── self-check/             /self-check/
├── report/                 /report/   (download, method, citation)
├── about/                  /about/    (mission, story, team, partners)
├── contact/                /contact/  (media, form, social, feedback)
├── newsletter/             /newsletter/
├── privacy/ imprint/ accessibility/   legal pages
├── 404.njk                 "page not found"
├── index.njk               homepage (shows the design set in site.yaml)
│
├── design-options/         TEMPORARY: the three homepage designs for comparison
│
├── _includes/              TEMPLATES (change the look/structure of many pages at once)
│   ├── layouts/            base.njk (HTML shell), page.njk (normal page), theme.njk (theme page)
│   ├── partials/           header, footer, design-switcher (temporary)
│   ├── components/         theme card, map placeholder, self-check banner, logo
│   └── home/               the three homepage layouts: editorial / swiss / warm
│
└── assets/
    ├── css/
    │   ├── base.css        reset, typography, header, footer, buttons, accessibility
    │   ├── components.css  cards, forms, placeholders, team grid, …
    │   ├── fonts.css       self-hosted fonts
    │   └── themes/         editorial.css / swiss.css / warm.css (colours, fonts, homepage)
    ├── js/                 main.js (mobile menu), self-check.js (self-check + shareable result card)
    ├── img/                favicon, team photos
    └── downloads/          the report PDF goes here
```

---

## Common edits

| I want to… | Edit |
|---|---|
| Change a homepage text | `src/_data/home.yaml` |
| Change the menu or footer links | `src/_data/navigation.yaml` |
| Add contact emails or social links | `src/_data/site.yaml` |
| Write content for a theme | `src/findings/themes/<theme>.md` (Markdown) |
| Add a new theme | Copy a file in `src/findings/themes/`, change `title`, `order`, `summary` |
| Publish an upcoming theme | Remove `status: upcoming` and `permalink: false` from its file |
| Add the report PDF | Put it in `src/assets/downloads/`, set `report.available: true` in `site.yaml` |
| Add team members or photos | `src/_data/team.yaml` + photos in `src/assets/img/team/` |
| Choose self-check questions | `src/_data/selfcheck.yaml` → `enabled: true/false` |
| Change the result-card texts or "AI-at-work types" | `src/_data/selfcheck.yaml` → `card:` per question, `personas:` |
| Put in the real comparison values | `src/_data/selfcheck.yaml` → `benchmark:` per question, then `demo: false` |
| Change colours or fonts | `src/assets/css/themes/<active theme>.css` (top of file) |

**Find everything that still needs work:** search the project for `{% todo` (placeholder boxes) and `TODO` (missing values).

---

## Design

**Chosen: C · Warm.** Friendly and self-check-first: rounded shapes, coral red on cream, Atkinson Hyperlegible Next (a very legible typeface). All pages use it (`theme: "warm"` in `src/_data/site.yaml`). Colours, fonts and the warm look of the inner pages are in `src/assets/css/themes/warm.css`.

The other two options (A · Editorial, B · Swiss grid) can still be previewed at `/design-options/`. Optional clean-up once nobody needs them: delete `src/design-options/`, `editorial` and `swiss` in `src/_includes/home/` and `src/assets/css/themes/`, `src/_includes/partials/design-switcher.njk`, and the "Design preview tools" block at the end of `components.css`.

---

## Self-check

`/self-check/` asks 4 questions, one at a time (AI users get all 4, non-users skip the AI-users-only question), then shows a personal **result card** in the style of a year-in-review "wrapped" story:

- an "AI-at-work type" (e.g. *The Explorer*), based on how often people use AI and whether they see more benefits or risks;
- one line per question ("More open than XX % of AI users") with a small track: ● me vs. ○ the average;
- **Save image** creates a 1080 × 1920 PNG (Instagram story size) on the visitor's device; **Share card** opens the phone's share menu; LinkedIn and WhatsApp links.

Everything runs in the browser: answers are never sent or stored.

**Demo data:** the comparison values in `selfcheck.yaml` are invented round numbers, clearly marked there. While `demo: true`, the card and the result page say "Demo data". Replace them with the weighted survey results before launch, then set `demo: false`.

---

## Publishing (GitHub Pages)

The workflow in `.github/workflows/deploy.yml` builds and publishes the site on every push to `main`.

One-time setup on GitHub:

1. **Settings → Pages → Build and deployment → Source:** choose **GitHub Actions**.
2. Optional custom domain (e.g. `aiatwork.ch`): enter it under **Settings → Pages → Custom domain** and set up the DNS records at the domain registrar. A `CNAME` file is not needed with this workflow.
3. Tick **Enforce HTTPS** (free certificate from GitHub).

---

## Principles

- **Privacy:** no cookies, no analytics, no external scripts, fonts or embeds. A Content Security Policy in `src/_includes/layouts/base.njk` blocks anything that isn't loaded from this website. If you add a service later (form, newsletter), add its domain there and describe it on the privacy page.
- **Accessibility (WCAG 2.2 AA):** semantic HTML, skip link, keyboard navigation, visible focus, AA colour contrast in all three designs, reduced motion respected. Every chart needs a text summary and a data table, and must never rely on colour alone.
- **Works without JavaScript:** JavaScript only adds extras (mobile menu, self-check, map).
