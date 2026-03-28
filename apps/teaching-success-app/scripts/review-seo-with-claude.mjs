import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(appRoot, "..", "..");

const SEO_FOCUS_THEMES = [
  "tutors in smethwick",
  "tuition in smethwick",
  "english teacher in smethwick",
  "11 plus tuition smethwick",
  "SAT prep Birmingham",
  "Year 6 English tutor",
  "Year 7 tutor",
  "local private tutor pages around Smethwick, Bearwood, Oldbury and nearby areas"
];

const KEY_PAGES = [
  "index.html",
  "blog.html",
  "blog/all-local-guides.html",
  "blog/year-6-english-tutor-smethwick.html",
  "blog/year-7-tutor-smethwick.html",
  "blog/11-plus-primary-smethwick.html",
  "blog/private-tutor-bearwood.html",
  "blog/gcse-english-tutor-smethwick.html",
  "blog/year-11-gcse-revision-smethwick.html",
  "blog/homework-help-smethwick.html"
];

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const env = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    value = value.replace(/^['"]|['"]$/g, "");
    env[key] = value;
  }

  return env;
}

function getEnv(name) {
  const direct = process.env[name]?.trim();
  if (direct) {
    return direct;
  }

  const localEnv = loadDotEnv(path.join(appRoot, ".env.local"));
  return localEnv[name]?.trim() || "";
}

function isPlaceholderSecret(value) {
  if (!value) {
    return true;
  }

  const normalized = value.toLowerCase();
  return (
    normalized.includes("your_") ||
    normalized.includes("placeholder") ||
    normalized.includes("changeme") ||
    normalized.includes("replace") ||
    normalized.includes("...") ||
    normalized === "test"
  );
}

function read(filePath) {
  return fs.readFileSync(path.join(repoRoot, filePath), "utf8");
}

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extract(html, regex) {
  const match = html.match(regex);
  return match?.[1]?.replace(/\s+/g, " ").trim() || "";
}

function extractLinks(html) {
  const matches = [...html.matchAll(/<a[^>]+href="([^"]+)"/gi)];
  return matches
    .map((match) => match[1].trim())
    .filter((href) => href.startsWith("/") && !href.startsWith("//"));
}

function pageSnapshot(filePath, options = {}) {
  const html = read(filePath);
  const text = visibleText(html);
  const links = extractLinks(html);
  const sampleLength = options.sampleLength || 850;
  return {
    path: filePath,
    title: extract(html, /<title>([\s\S]*?)<\/title>/i),
    description: extract(html, /<meta\s+name="description"\s+content="([^"]*)"/i),
    canonical: extract(html, /<link\s+rel="canonical"\s+href="([^"]*)"/i),
    h1: extract(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i),
    words: text ? text.split(/\s+/).length : 0,
    sample: text.slice(0, sampleLength),
    localLinks: Array.from(new Set(links)).slice(0, 16)
  };
}

function runGit(args) {
  return execFileSync("git", ["-C", repoRoot, ...args], { encoding: "utf8" }).trim();
}

function getChangedFiles() {
  const output = runGit(["diff", "--name-only", "--", "index.html", "assets/css/index.css", "blog.html", "blog"]);
  return output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function getChangedHtmlSummary() {
  return getChangedFiles()
    .filter((filePath) => filePath.endsWith(".html"))
    .map((filePath) => {
      const snapshot = pageSnapshot(filePath, { sampleLength: 240 });
      return {
        path: snapshot.path,
        title: snapshot.title,
        h1: snapshot.h1,
        description: snapshot.description,
        words: snapshot.words
      };
    });
}

function getSitemapAudit() {
  const sitemap = read("sitemap.xml");
  const robots = read("robots.txt");
  const sitemapUrls = new Set(
    [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => match[1].trim())
  );

  const blogDir = path.join(repoRoot, "blog");
  const htmlFiles = fs
    .readdirSync(blogDir)
    .filter((name) => name.endsWith(".html"))
    .map((name) => `https://www.teachingsuccess.co.uk/blog/${name}`);

  const missingFromSitemap = htmlFiles.filter((url) => !sitemapUrls.has(url));

  return {
    robotsSample: robots.trim(),
    sitemapUrlCount: sitemapUrls.size,
    htmlFileCount: htmlFiles.length,
    missingFromSitemap
  };
}

function thinPageAudit() {
  const blogDir = path.join(repoRoot, "blog");
  const threshold = 260;
  const rows = fs
    .readdirSync(blogDir)
    .filter((name) => name.endsWith(".html"))
    .map((name) => {
      const filePath = path.join("blog", name);
      const snapshot = pageSnapshot(filePath, { sampleLength: 180 });
      return {
        path: filePath,
        title: snapshot.title,
        words: snapshot.words
      };
    })
    .filter((row) => row.words < threshold)
    .sort((a, b) => a.words - b.words);

  return {
    threshold,
    total: rows.length,
    rows: rows.slice(0, 30)
  };
}

function formatList(items, emptyText = "- none") {
  if (!items.length) {
    return emptyText;
  }

  return items.map((item) => `- ${item}`).join("\n");
}

function buildPrompt() {
  const changedHtml = getChangedHtmlSummary();
  const keyPageSnapshots = KEY_PAGES.map((filePath) => pageSnapshot(filePath));
  const sitemapAudit = getSitemapAudit();
  const thinAudit = thinPageAudit();
  const cssDiffSummary = runGit(["diff", "--stat", "--", "assets/css/index.css"]);

  return [
    "You are an expert SEO strategist reviewing a local UK tutoring website after a recent SEO/content cleanup.",
    "Be critical and specific. Focus on local SEO, internal linking, topical coverage, duplicate/thin content risk, crawl budget, on-page optimisation, and conversion-oriented content quality.",
    "Assume the site serves families in Smethwick, Birmingham and nearby areas.",
    "",
    "Output format:",
    "1. What has improved",
    "2. Main risks or weaknesses still present",
    "3. Priority next actions (ordered, highest impact first)",
    "4. Specific pages or clusters to update next",
    "5. Technical SEO checks still worth doing",
    "",
    "Recent SEO focus themes:",
    formatList(SEO_FOCUS_THEMES),
    "",
    "Changed HTML page summary:",
    JSON.stringify(changedHtml, null, 2),
    "",
    "Core page snapshots:",
    JSON.stringify(keyPageSnapshots, null, 2),
    "",
    "Sitemap and robots audit:",
    JSON.stringify(sitemapAudit, null, 2),
    "",
    `Thin-page audit (threshold: < ${thinAudit.threshold} visible words):`,
    JSON.stringify(thinAudit, null, 2),
    "",
    "CSS change summary:",
    cssDiffSummary || "(no CSS diff summary found)",
    "",
    "Be explicit about whether the current work looks like genuine quality improvement versus keyword-driven templating. If some page clusters still risk looking templated or cannibalised, say exactly which ones and why. End with a short 'next 7 days' action list."
  ].join("\n");
}

async function main() {
  if (process.argv.includes("--prompt-only")) {
    console.log(buildPrompt());
    return;
  }

  const apiKey = getEnv("ANTHROPIC_API_KEY");
  if (isPlaceholderSecret(apiKey)) {
    console.error(
      "Missing a real ANTHROPIC_API_KEY. Add it to apps/teaching-success-app/.env.local or export it in the shell, then rerun `npm run review:seo:claude`."
    );
    process.exit(1);
  }

  const model = getEnv("ANTHROPIC_MODEL") || "claude-3-5-sonnet-latest";
  const anthropic = new Anthropic({ apiKey });
  const prompt = buildPrompt();

  const response = await anthropic.messages.create({
    model,
    max_tokens: 2200,
    temperature: 0.2,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: prompt }]
      }
    ]
  });

  const text = response.content
    .filter((item) => item.type === "text")
    .map((item) => item.text)
    .join("\n\n")
    .trim();

  if (!text) {
    throw new Error("Claude returned an empty review.");
  }

  const outputPath = path.join(repoRoot, "claude-seo-review.md");
  fs.writeFileSync(outputPath, `${text}\n`, "utf8");
  console.log(text);
  console.log(`\nSaved review to ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
