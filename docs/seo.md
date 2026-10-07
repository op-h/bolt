# BoltBlocks: discoverability spec (BEACON)

Owner: BEACON. Files: this doc, `robots.txt`, `sitemap.xml`, and the `<!-- seo:start -->` to
`<!-- seo:end -->` region in `index.html`'s head. ADR 0002 makes this an app shell, so crawlers
effectively see one page: metadata plus the server-rendered shell carry all discoverability.

## 1. Information architecture

| URL | Purpose | Indexable |
|---|---|---|
| `/` (`index.html`) | The editor (block workspace, stage, lessons). The only page. | yes |
| `README.md` | Linked from `<noscript>` only. Not a site page. | not listed in sitemap |

- One URL, one purpose. Language (EN/AR), theme, lessons, dialogs are all client state on `/`
  (ADR 0004: language switches by reload, same URL). No hash/query routes are crawlable content.
- Heading structure today: visible-to-AT `h1` ("BoltBlocks — block coding workspace", `.sr-only`),
  `h2` per panel (workspace, stage, lesson), `h3` for sprite settings and lesson sub-sections.
  One `h1`, no skipped levels in the shell. (GRANITE's file; reported here, not edited.)
- Internal links: the logo link is `./`; there are no other internal navigation links to optimise.

### Lesson deep links: NOT supported (verified)
`js/app.js` has no `location.hash`, `hashchange`, `history` or `URLSearchParams` handling (grep
found only `location.reload()` and a `file:` protocol check). Lessons are opened from a dialog by
id (`startLesson(id)`). So `#lesson=<id>` is **not** a feature and must not appear in the sitemap,
metadata, or structured data.

Suggestion for CIRCUIT (optional, not required for launch): on boot and on `hashchange`, parse
`#lesson=<id>`, validate against ids in `lessons/lessons.json`, call `startLesson(id, { skipConfirm: true })`,
ignore unknown ids silently. Value: teachers can link a class straight to a lesson. It would NOT
create crawlable pages (fragment URLs are not indexed), so it changes nothing in the sitemap.

### Content gap
Because the shell has little static text, search snippets depend on the `<meta name="description">`.
TODO(content): ATLAS/GRANITE may add a short visible, server-rendered "About BoltBlocks" paragraph
(inside `#app-boot` or the `<noscript>` block) so JS-less crawlers and parents see real copy. The
current `<noscript>` text only says JavaScript is needed.

## 2. Metadata spec (what is in `index.html`)

| Tag | Value | Notes |
|---|---|---|
| `<title>` | `BoltBlocks — block coding for kids` | GRANITE's, outside the seo region. OG/Twitter titles repeat it exactly. |
| `meta description` | EN, ~155 chars, "free block-coding playground for kids aged 7 to 14 ... English and Arabic" | Every claim is true of the shipped app (EN+AR, blocks, stage, characters). No ratings, user counts or awards. |
| `meta color-scheme` | `light dark` | Matches CSS (`color-scheme` per theme in `css/style.css`). |
| `meta theme-color` (x2) | light `#FFFFFF`, dark `#1C1C3F` via `media=` | Both = `--bb-surface`, the top-bar fill (`docs/design.md`). |
| `link rel=icon` | `assets/bolt.svg`, `image/svg+xml` | Chosen over `logo.svg`: `bolt.svg` is square (viewBox 200x200) and reads at tab size; `logo.svg` is a 250x56 wordmark that would be squashed. |
| `link rel=canonical` | `https://op-h.github.io/bolt/` | GitHub `op-h`, repo `bolt`, project site, trailing slash. |
| Open Graph | `og:type=website`, `og:site_name`, `og:title`, `og:description`, `og:locale=en_US`, `og:url=https://op-h.github.io/bolt/` | `og:image*` are TODO(content), commented out (no share image exists). |
| Twitter | `twitter:card=summary`, `title`, `description` | Switch to `summary_large_image` when a share image exists. |
| `hreflang` / `alternate` | none, on purpose | EN/AR share one URL. Emitting alternates would point at URLs that do not exist. |
| `lang`/`dir` | stamped on `<html>` by GRANITE's boot script | Crawlers without JS see `lang="en"`. |

Resolved: origin is `https://op-h.github.io/bolt/` (canonical, `og:url`, sitemap `<loc>`, robots
`Sitemap:` line, JSON-LD `url` all use it). If the repo is renamed or a custom domain is added, update
those five places together.

Unknowns to resolve (all marked `TODO(content):` in the files):
1. (done, see above)
2. A share image, 1200x630 PNG/JPG (SVG is rejected by most scrapers), with alt text. Needs MUSE.
   Not created here; no tag references it until it exists.
3. A `<noscript>`/visible description paragraph (see 1).

## 3. Structured data decision

Emit **one** JSON-LD block: `WebApplication` (a `SoftwareApplication` subtype, so also a `CreativeWork`).
Placed in the seo region as `<script type="application/ld+json">`.

Fields and why:
- `name`, `description` (matches the meta description in substance), `applicationCategory: EducationalApplication`.
- `operatingSystem`, `browserRequirements`: JS plus HTML5 canvas, true per ADR 0002 and `stage` canvas.
- `inLanguage: ["en","ar"]`, `isAccessibleForFree: true`.
- `typicalAgeRange: "7-14"` (valid on `CreativeWork`) and `audience: PeopleAudience` with
  `suggestedMinAge 7` / `suggestedMaxAge 14`.
- `featureList`: only things that exist in the shell (workspace, lessons with hints, stage, EN/AR+RTL).

`url` is `https://op-h.github.io/bolt/`. Deliberately omitted (no source of truth): `image`, `author`/`creator`/`publisher`,
`aggregateRating`, `review`, `offers` (price/currency would be invented; `isAccessibleForFree` says it),
`datePublished`, `softwareVersion`. `Organization`, `Article`, `BreadcrumbList`, `FAQPage` are not
used: one page, no org facts, no articles, no breadcrumb trail, no FAQ content on screen.

Add `image` when a share image exists. Google has no rich result for this type without
rating/offers data, so this is for machine-readable clarity, not a snippet promise.

CSP note for SENTRY: `application/ld+json` is a data block, not executed script, so it is not
governed by `script-src`; no hash or nonce is needed.

## 4. Crawlability

- `robots.txt`: `User-agent: *` / `Allow: /` plus `Sitemap: https://op-h.github.io/bolt/sitemap.xml`.
  On a GitHub Pages **project** site, `robots.txt` is not at the host root, so crawlers
  ignore it there; harmless, since everything is allowed. It becomes effective on a user/custom domain.
- `sitemap.xml`: one `<url><loc>https://op-h.github.io/bolt/</loc></url>`. No `lastmod`/`priority`
  (no source of truth for dates). Because the project site is under `/bolt/`, search consoles only
  accept it for the `https://op-h.github.io/bolt/` URL-prefix property.
- Status/redirects: GitHub Pages serves `/` as 200. No redirects are needed; there is a single URL.
  Choose one of `https://host/repo/` vs `.../index.html` and use the former everywhere (canonical, OG, sitemap).

## 5. Analytics and privacy stance

**Recommendation: no third-party tracking, and no analytics at all in v1.** The audience is children
7-14 (COPPA in the US, GDPR-K / Article 8 in the EU, plus school policies). Cookieless analytics from
a third party still sends IP address and user agent off-site and is typically blocked by schools. The
site already loads fonts from Google and Blockly from jsDelivr (ADR 0001); adding a tracker would
widen that surface for little benefit. No analytics code is written, and none is to be added without
an ATLAS ADR plus a human privacy sign-off.

Search-side signals (no code needed): Google Search Console / Bing Webmaster verify via DNS or a
file, collect nothing from visitors.

### Event dictionary (OPTIONAL, off by default, not implemented)
Documented only so that, if a human ever opts in, the vocabulary is already privacy-safe.
Constraints for any future implementation: first-party only (no third-party host), no cookies,
no identifiers (no user id, no fingerprint, no IP storage), no project content, block text, project
names, sprite names or free text, counts aggregated locally and only exported by an explicit teacher
action (for example a "Download class stats" file), disabled unless a flag is turned on by an adult.

| Event | Properties (enumerated values only) | Purpose |
|---|---|---|
| `lesson_started` | `lesson_id` (from `lessons.json`) | Which lessons get used |
| `lesson_completed` | `lesson_id` | Completion rate per lesson |
| `run_clicked` | none | Is the green flag being used |
| `project_saved` | `target`: `browser` or `file` | Save path popularity |
| `language_changed` | `to`: `en` or `ar` | EN/AR demand |
| `theme_changed` | `to`: `light` or `dark` | Theme usage |
| `error_shown` | `kind`: `loop`, `recursion`, `math`, `unknown` (runtime's own enum) | Where kids get stuck |

Never collect: names, answers typed into `ask`, project XML, device identifiers, precise timestamps
per user, referrer paths. Ownership: CIRCUIT (implementation, if ever), SENTRY (privacy/CSP review).

## 6. Verification log (2026-10-06)
- Shell access was unavailable this session, so `node -e 'JSON.parse(...)'` was NOT run. The JSON-LD was
  checked by eye only (balanced braces, no trailing commas, schema.org property/type names reviewed).
  TODO: SENTRY to run a real `JSON.parse` and the Schema.org validator.
- Head by inspection: one `<title>` (GRANITE), one `viewport`, one `description`, one `color-scheme`, two
  `theme-color` (distinct `media`), one `rel=icon`. No duplicates against GRANITE's tags; perf and sec
  regions were still empty. HTML comments in the region are balanced and contain no `--` runs.
- Re-run when QUARTZ/SENTRY fill their regions: they must not add a second `theme-color`, `description`,
  `icon` or `canonical`.
