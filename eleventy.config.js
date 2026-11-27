// Eleventy configuration – see https://www.11ty.dev/docs/config/
// You rarely need to touch this file. Content lives in src/, settings in src/_data/.

import { HtmlBasePlugin } from "@11ty/eleventy";
import { load as loadYaml } from "js-yaml";
import markdownIt from "markdown-it";
import markdownItAnchor from "markdown-it-anchor";

export default function (eleventyConfig) {
  // ---------------------------------------------------------------------------
  // Data: allow .yaml files in src/_data (they support comments, unlike JSON)
  // ---------------------------------------------------------------------------
  eleventyConfig.addDataExtension("yaml,yml", (contents) => loadYaml(contents));

  // ---------------------------------------------------------------------------
  // Static files copied as-is into the built site
  // ---------------------------------------------------------------------------
  eleventyConfig.addPassthroughCopy("src/assets");
  // Self-hosted fonts (no Google Fonts → no third-party requests, no tracking)
  eleventyConfig.addPassthroughCopy({
    "node_modules/@fontsource-variable/*/files/*-latin{,-ext}-wght-{normal,italic}.woff2":
      "assets/fonts",
  });

  // Rewrites absolute links (/about/) when the site is served from a sub-folder
  // (e.g. username.github.io/AIatwork/). Set via --pathprefix in the deploy workflow.
  eleventyConfig.addPlugin(HtmlBasePlugin);

  // ---------------------------------------------------------------------------
  // Markdown: give every heading an id so sections can be linked and shared
  // ---------------------------------------------------------------------------
  eleventyConfig.amendLibrary("md", (md) =>
    md.use(markdownItAnchor, {
      level: [2, 3],
      slugify: eleventyConfig.getFilter("slugify"),
    }),
  );

  // ---------------------------------------------------------------------------
  // Collections
  // ---------------------------------------------------------------------------
  // All report themes (src/findings/themes/*.md), sorted by their `order` field.
  eleventyConfig.addCollection("themes", (api) =>
    api
      .getFilteredByTag("theme")
      .sort((a, b) => (a.data.order ?? 99) - (b.data.order ?? 99)),
  );

  // ---------------------------------------------------------------------------
  // Shortcodes
  // ---------------------------------------------------------------------------
  // {% todo "Chart" %} What should be built here … {% endtodo %}
  // Renders a clearly marked placeholder box. Search the project for "{% todo"
  // to get a list of everything that still needs to be implemented.
  const md = markdownIt({ html: true });
  eleventyConfig.addPairedShortcode("todo", (content, label = "To implement") => {
    return `<aside class="todo" role="note"><p class="todo__label">${label}</p>${md.render(content.trim())}</aside>`;
  });

  eleventyConfig.addShortcode("year", () => String(new Date().getFullYear()));

  // ---------------------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------------------
  // Builds an "On this page" list from the <h2 id="…"> headings of rendered content.
  eleventyConfig.addFilter("toc", (html = "") => {
    const items = [];
    const re = /<h2 id="([^"]+)"[^>]*>(.*?)<\/h2>/g;
    let m;
    while ((m = re.exec(html))) items.push({ id: m[1], title: m[2].replace(/<[^>]+>/g, "") });
    return items;
  });

  // Data for <script type="application/json"> blocks. Escapes "<" so a text
  // containing "</script>" can never end the block early.
  eleventyConfig.addFilter("jsonScript", (value) =>
    JSON.stringify(value).replace(/</g, "\\u003c"),
  );

  // Two-digit number for theme cards: 1 → "01"
  eleventyConfig.addFilter("pad", (n) => String(n).padStart(2, "0"));

  // Previous / next item in a collection (used for theme-to-theme navigation)
  eleventyConfig.addFilter("neighbours", (collection, url) => {
    const published = collection.filter((p) => p.url);
    const i = published.findIndex((p) => p.url === url);
    return { prev: published[i - 1], next: published[i + 1] };
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "_site",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
