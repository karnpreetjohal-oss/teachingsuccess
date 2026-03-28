## SEO Review: Teaching Success — Post-Cleanup Audit

---

### 1. What Has Improved

- **Homepage targeting is clean.** Title, H1, description and on-page copy all align around "tutors in Smethwick" without stuffing. The service list, tutor credentials and free trial CTA are all present.
- **Topic cluster structure exists.** There is a logical hub (blog.html → all-local-guides.html → individual pages) rather than a flat, unorganised blog dump.
- **Core pages have meaningful word counts.** Year 6 English (433w), 11-plus primary (307w), Year 7 (288w), Bearwood (326w) and the GCSE cluster are all above thin-page thresholds and contain real substance rather than filler lists.
- **Internal linking on core pages is coherent.** Year 6 links to SATs, KS2 English, KS2 Maths and 11-plus. GCSE English links to exam technique, Year 10/11 pages. These are genuine topical clusters, not random links.
- **robots.txt is correct** — permissive with sitemap declared.
- **Local area pages exist** for Bearwood, Cape Hill, Edgbaston, Harborne, Oldbury, Quinton and West Bromwich — correct geographic intent signal.

---

### 2. Main Risks and Weaknesses

#### A. The "Page Moved" stubs are a crawl and trust liability

`tutor-near-me-smethwick.html`, `tutoring-bearwood-guide.html`, and `tutoring-oldbury-guide.html` are live HTML pages with 16–19 words of content, no H1, no canonical pointing to the replacement URL, and they are **absent from the sitemap**. They are not 301 redirects — they are thin, ambiguous stub pages. Googlebot will crawl them, find near-zero content and a non-standard "page moved" pattern, and treat them as low-quality pages. Any backlinks or internal equity pointing to old URLs is being wasted.

#### B. Keyword cannibalism across the 11-plus cluster

You have three 11-plus pages targeting essentially the same geography:

- `11-plus-primary-smethwick.html` — "KS2 Reading, Maths & Reasoning"
- `11-plus-non-verbal-reasoning-smethwick.html` — "Non-Verbal Reasoning Tutor"
- `11-plus-verbal-reasoning-smethwick.html` — "Verbal Reasoning Tutor"

The parent page (primary) covers "verbal reasoning and non-verbal reasoning" in its body copy. The two child pages are 307–338 words and contain overlapping content about 11+ preparation in Smethwick. Google will struggle to decide which page to rank for "11 plus tuition smethwick" and may split signals across all three or suppress the weaker two. There is no explicit canonical or internal hierarchy making the primary page the definitive landing page.

#### C. Local area pages look heavily templated — this is the most serious duplicate content risk

The seven neighbourhood pages (Bearwood, Cape Hill, Edgbaston, Harborne, Oldbury, Quinton, West Bromwich) have word counts of 326, 333, 326, 326, 327, 326, 333 words respectively. That near-identical pattern, combined with near-identical titles ("Private Tutor in [X] | Local English, Maths & 11+ Support") and near-identical descriptions (same sentence structure, just location-swapped), strongly suggests these are templated pages with only the place name changed. The Bearwood sample confirms this — the content is generic ("what families usually want", "primary, secondary, GCSE") with no locality-specific detail whatsoever. Google's helpful content system is specifically designed to identify and discount this pattern. These pages currently offer no differentiation signal.

#### D. Year-group tutor pages are thin and formulaic at scale

Year 2, 3, 4, 5, 6 tutor pages: all exactly **219 words**.
Year 12, 13 tutor pages: both exactly **224 words**.
Year 7, 8, 9 subject pages (English and Maths): all exactly **234–235 words**.

Uniform word counts across a cluster are a reliable signal of template generation. These pages will either not rank at all or rank transiently before being demoted. Year 8 and Year 9 tutor pages (210 and 212 words) are already below the thin threshold.

#### E. A-Level subject pages are critically thin

All four A-level pages (Biology, Chemistry, Maths, Physics) sit at 179–181 words. These are the highest commercial-value pages on the site — families searching "A-level maths tutor Birmingham" are ready to buy — and they have the thinnest content. The competing pages from MyTutor, Tutorful and local tutoring centres will all be substantially longer and more detailed.

#### F. Homepage internal linking is incomplete

The homepage links to only seven blog/guide pages. Key commercial pages — GCSE English, Year 10/11 tutor, A-Level subjects, catch-up tuition, one-to-one tuition — receive no homepage link equity. The most commercially valuable pages are buried behind two clicks (homepage → blog.html → page).

#### G. "SAT prep Birmingham" targeting is absent as a page

The focus theme list includes "SAT prep Birmingham" but there is no dedicated page. `sats-preparation-smethwick.html` exists (286 words, targets Smethwick) but nothing is aimed at the broader Birmingham SATs search. This is a meaningful search volume gap.

#### H. Miscellaneous thin pages with keyword-targeted titles but no real content

`affordable-tuition-smethwick-birmingham.html` (191w), `best-maths-tutor-near-b676rs.html` (191w), `summer-tuition-birmingham.html` (191w), `predicted-grade-improvement-gcse.html` (225w) — these pages have clear keyword-targeting intent but insufficient content to rank or convert. The postcode-targeted page (`best-maths-tutor-near-b676rs.html`) looks like a local SEO micro-targeting experiment; at 191 words it will not pass quality assessment.

---

### 3. Priority Next Actions (Highest Impact First)

**1. Replace the three "Page Moved" stubs with proper 301 server redirects.**
Delete the HTML stub pages and configure server-level 301 redirects from the old URLs to the canonical destinations. This is the fastest fix — it takes 10 minutes and stops wasting crawl budget on confirmed thin content. Add the destination pages to the sitemap if not already present.

**2. Rewrite the A-Level pages to 400–600 words each.**
These are your highest commercial-value pages and your weakest content. Each page needs: exam board specifics (AQA/OCR/Edexcel), topic breakdown, what the tutor does differently from school teaching, and a conversion CTA. Target length: 450–550 words minimum.

**3. Differentiate the local area pages or consolidate the weakest ones.**
For each neighbourhood page, add at least one genuinely local signal: distance from Smethwick, nearby school names, transport links, or which age groups are most common in that area. Without differentiation, Cape Hill, Edgbaston, Harborne and Quinton pages are identical content under different URLs. If you cannot add genuine local detail, redirect the weakest three to the Smethwick main page and consolidate equity.

**4. Resolve the 11-plus cannibalism.**
Establish `11-plus-primary-smethwick.html` as the definitive landing page for "11 plus tuition smethwick." Expand it to 500+ words covering KS2, verbal and non-verbal reasoning. Reframe the two sub-pages as supporting content on specific subtopics only (not competing for the same head term) and add explicit internal links from them to the parent page, not just to blog.html.

**5. Expand Year 8 and Year 9 tutor pages above the thin threshold.**
At 210 and 212 words they are below audit threshold. These pages cover a genuine transition period (KS3 to GCSE) with real search intent. Bring them to 300+ words with content specific to that year's challenges — they should not be clones of the Year 7 page.

**6. Expand the Year 2–6 generic tutor pages or consolidate them.**
If Year 6 already has its own dedicated page (`year-6-english-tutor-smethwick.html`, 433 words), then `year-6-tutor-smethwick.html` at 219 words is competing with it and diluting equity. Either merge the generic year-group pages into the subject-specific pages or make each one distinctly different in focus (e.g. Year 5 focuses on pre-SATs readiness, Year 4 on building fluency habits).

**7. Add homepage links to the GCSE and A-Level pages.**
GCSE English, Year 11 revision, and the A-Level subject pages should receive direct homepage links. They currently have no homepage equity.

---

### 4. Specific Pages or Clusters to Update Next

| Priority | Cluster | Action |
|---|---|---|
| Immediate | `tutor-near-me-smethwick.html`, `tutoring-bearwood-guide.html`, `tutoring-oldbury-guide.html` | Server-side 301 redirect; remove from crawl |
| Week 1 | A-Level Biology, Chemistry, Maths, Physics | Full rewrites to 450+ words |
| Week 1–2 | `year-8-tutor-smethwick.html`, `year-9-tutor-smethwick.html` | Expand to 300w+, make content distinct from Year 7 |
| Week 2 | Local area pages (Cape Hill, Edgbaston, Harborne, Quinton) | Add local signals or redirect to Smethwick hub |
| Week 2–3 | `11-plus-primary-smethwick.html` | Expand to 500w+; restructure as definitive 11+ page |
| Week 3 | `year-2` through `year-6` generic tutor pages | Differentiate or merge into subject-specific equivalents |
| Week 3–4 | `affordable-tuition-smethwick-birmingham.html`, `summer-tuition-birmingham.html` | Expand to 350w+ or redirect |

---

### 5. Technical SEO Checks Still Worth Doing

- **Confirm the three "moved" pages return HTTP 200**, not 301. If they return 200 with thin content and no canonical, they are indexable and will be treated as low-quality pages. Check via `curl -I [URL]`.
- **Verify canonicals are self-referencing and correct** on every page. The sample data shows canonicals on reviewed pages but the full set of 72 pages has not been verified. Any page with a missing or wrong canonical will dilute equity.
- **Check Core Web Vitals in Search Console** — the CSS change (79 lines added) should be followed by a Lighthouse check to confirm no render-blocking or layout shift was introduced.
- **Verify Google is indexing the correct pages** for head terms. Use `site:teachingsuccess.co.uk 11 plus tuition smethwick` style queries to confirm the 11-plus primary page is the indexed result, not a thinner variant.
- **Structured data (LocalBusiness schema)** — check whether the homepage carries LocalBusiness or TutorAction schema with address, area served and telephone. This is missing from the data provided and is a local SEO gap that affects map pack eligibility.
- **Check for duplicate title tags** across the year-group subject pages — Year 7 English and Year 7 Maths tutor pages may share similar title patterns; confirm they are sufficiently distinct.
- **Sitemap freshness** — sitemap shows 71 URLs against 72 HTML files (the 3 moved pages account for the discrepancy). Confirm the sitemap lastmod dates are accurate, as stale dates cause crawl deprioritisation.
- **Google Business Profile** — not a site-level check but local SEO for "tutors in Smethwick" is heavily influenced by GBP. Verify the profile is verified, the address matches the site's schema, and reviews are being actively collected.

---

### Next 7 Days — Action List

1. **Day 1:** Set up server-level 301 redirects for the three stub pages; confirm with curl that they no longer return 200.
2. **Day 1–2:** Rewrite all four A-Level pages to 450+ words with exam board specifics and a booking CTA in each.
3. **Day 3:** Expand Year 8 and Year 9 tutor pages to 300+ words with content distinct from Year 7.
4. **Day 4:** Add LocalBusiness schema to homepage if absent; verify canonical tags site-wide.
5. **Day 5:** Update homepage internal links to include GCSE English, Year 11 revision, and A-Level hub.
6. **Day 6:** Begin differentiating local area pages — start with Bearwood and Oldbury (highest search volume neighbourhoods near Smethwick); add school names, distances, local context.
7. **Day 7:** Run Lighthouse on homepage and top 5 pages post-CSS change; check Search Console for crawl errors on the redirected URLs.
