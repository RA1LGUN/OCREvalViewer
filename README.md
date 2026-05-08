# OCR Model Comparison Visualization

Side-by-side comparison of multiple OCR models' markdown output for the same PDF, aligned by semantic blocks (headings / paragraphs / tables / code / lists), with four difference categories: Only A, Only B, Type Diff, Text Diff. A heatmap at the top provides a full-document × full-model divergence overview, letting you spot "which model errs on which page" at a glance.

**Two ways to use:**

1. **Remote sample data** (default) — open the page and it automatically loads sample PDFs + OCR results from Cloudflare R2, zero config
2. **Drag-and-drop zip** (see "Packaging data" + "Deployment" sections) — package your own data as a zip, drag it into the page, optionally deploy to Cloudflare for anyone to use

All PDF rendering, markdown parsing, and diff computation runs in the browser. **Zips are never uploaded to any server.** Data on R2 is fetched via public URLs with no backend involved.

---

## First-time setup (step by step)

### 1. Install Node.js (one-time)

This is a **frontend web project** that needs Node.js to run a local dev server.

- Open https://nodejs.org/ and download the **LTS** installer (not Current)
- After installation, **restart your terminal** (important, or the command won't be found)
- Verify installation:

```powershell
node --version
npm --version
```

> `v20.x.x` or higher and `10.x.x` or higher means you're good.

### 2. Install project dependencies (one-time)

Open the project folder in VS Code, press `` Ctrl+` `` to open the integrated terminal, then run:

```powershell
npm install
```

This reads `package.json` and downloads all libraries (React, Vite, PDF rendering, markdown parsing, etc.) into `node_modules/`. The first download is a few hundred MB and takes 1–5 minutes depending on your connection. **Yellow `npm warn deprecated ...` messages can all be ignored** — as long as you see something like `added 295 packages` at the end, it succeeded.

### 3. Start the project (every time you want to see it)

```powershell
npm run dev
```

You'll see:

```
  VITE v5.4.21  ready in 1213 ms
  ➜  Local:   http://localhost:5173/
```

**Open http://localhost:5173/** in your browser. Keep the terminal open — it's your local server.

To stop: press `Ctrl+C` in the terminal.

To restart: run `npm run dev` again. **You don't need to `npm install` every time** — that's one-time only.

### 4. What happens when you edit code

The dev server has hot reload — when you save any file under `src/`, the browser refreshes automatically. No manual restarts needed.

---

## What the project does

When you open the page you'll see three layers:

1. **Top bar**: select document, flip pages, pick two models (A vs B) to compare, four-category diff legend
2. **Overview heatmap**: horizontal axis = page number, vertical axis = all models except the baseline; darker color = greater divergence from baseline on that page; **click a cell = jump to that page + auto-switch to baseline vs that model**
3. **Main view**: left side shows the original PDF, right side shows two models' rendered markdown with differences highlighted

Four diff categories:

| Category | Meaning | Color |
|---|---|---|
| Only A | A block with no counterpart in B (B missed it) | Red |
| Only B | B block with no counterpart in A (A missed it) | Green |
| Type Diff | Both recognized the content, but block type/level differs (e.g. A is `## heading`, B is plain paragraph) | Yellow |
| Text Diff | Same type, same level, but internal text differs (OCR character errors) | Blue |

"Text Diff" blocks also get word-level diff internally — in A's view, red highlights are words unique to A; in B's view, green highlights are words unique to B.

---

## Adding new data

This project's "data" lives on **Cloudflare R2** object storage. On startup, the frontend fetches `doc_exports/manifest.json` and `doc_exports/json/<fid>__<name>.json` from `R2_BASE` (defined in `src/config.ts`). PDFs are also fetched directly from R2.

**Workflow for adding a new document:**

1. Upload the PDF to R2 at `pdfs/<lang>/<doc_name>.pdf` (`<lang>` is currently `chinese` or `english`; extend `PDF_LANG_DIRS` in `src/config.ts` as needed)
2. Upload the model output JSON to R2 at `doc_exports/json/<fid>__<name>.json`
3. Update `doc_exports/manifest.json` on R2 with a new entry (field format in "Data format" section below)
4. Refresh the page — **no frontend code changes, no redeploy needed**

> **About PDF language subdirectories**: `doc_name` in the manifest does NOT include `chinese/` / `english/` prefixes. The frontend probes each entry in `PDF_LANG_DIRS` order via HEAD requests to locate the PDF; results are cached by `doc_fid`. To skip probing, add a `pdf_path` field directly in the manifest entry (e.g. `"pdf_path": "pdfs/chinese/9787115353009.pdf"`) — the frontend will use it first.

**Online drag-and-drop zip**: a fully independent offline path for sharing private data with colleagues. See "Packaging data as zip" below.

---

## FAQ

**`npm install` hangs or shows network errors.** Try a mirror registry:
```powershell
npm config set registry https://registry.npmmirror.com
npm install
```

**`npm: The term 'npm' is not recognized...`.** Node isn't installed or you haven't restarted your terminal. Reopen VS Code and try again.

**Port 5173 is already in use.** Press `Ctrl+C` in the terminal to stop the previous dev server, or change the port in `vite.config.ts`.

**The page is blank.** Press `F12` to open browser dev tools and check the Console tab for red error messages — usually a data file path issue.

**Code changes aren't showing in the browser.** Check the terminal for errors; if it looks fine, press `Ctrl+Shift+R` in the browser to force refresh.

---

## Algorithm details (optional)

Block alignment pipeline:

1. `unified + remark-parse + remark-gfm` parses both markdown strings into mdast (markdown abstract syntax trees), taking top-level `children` as the "block sequence"
2. LCS (longest common subsequence) on the two block sequences. Match function: same type signature + normalized text character-bigram Jaccard similarity ≥ 0.4; or different types but nearly identical text (≥ 0.7) also counts as a match, labeled "type-diff"
3. Matched pairs: fully identical → equal; type mismatch → type-diff; otherwise → text-diff
4. Unmatched: only-A / only-B
5. text-diff and type-diff blocks get word-level diff inside paragraphs/headings

Each page outputs a `divergenceScore = onlyA + onlyB + 0.7·typeDiff + 0.3·textDiff`, used as the heatmap color intensity.

Scores for all pages are computed **asynchronously in batches** when a document loads, without blocking the UI — computed cells appear immediately, uncomputed ones show as gray.

---

## Tech stack

React 18 + TypeScript + Vite + Tailwind CSS + react-pdf + react-markdown + remark/unified ecosystem. Zustand for global state. JSZip for in-browser zip extraction.

---

## Packaging data as zip

The `scripts/make-bundle.ps1` script packages `public/doc_exports/` + `public/pdfs/` into a drag-and-drop zip:

```powershell
# Package all documents
.\scripts\make-bundle.ps1

# Package a single document (use doc_fid from manifest)
.\scripts\make-bundle.ps1 -DocFid 65d8ecd9-ab77-402a-8013-9645a4401732 -Output sample-small.zip
```

Zip internal structure (the format anyone producing their own data should follow):

```
bundle.zip
├── manifest.json                    (document manifest, structure below)
├── json/
│   └── <fid>__<name>.json           (all model outputs for one document)
└── pdfs/
    └── <doc_name>.pdf
```

⚠️ Large zip note: extraction happens in the browser. **Keep individual zips under 200MB** or some browsers may lag or OOM. If your PDF is large, you can include only text data (json/manifest) without the PDF — the left PDF pane will show "PDF not found", but markdown comparison still works fine.

---

## Deploying to Cloudflare Pages (automatic GitHub deploy)

> ⚠️ This is a **pure static site**, deployed to Cloudflare **Pages** (not Workers). Both are grouped under "Workers & Pages" in the CF dashboard, so they're easy to mix up; just follow the Pages path. Zero code, zero ops, free.
>
> Overall flow: `local code → GitHub repo → Cloudflare Pages auto-build → permanent URL`. Every `git push` triggers automatic redeployment.

### Step 1: Push the project to GitHub

#### 1.1 Create a GitHub repository

Open https://github.com/new

- Repository name: anything, e.g. `ocr-diff-visualization`
- Public or Private both work (CF Pages supports both)
- Do **NOT** check "Add a README" / "Add .gitignore" — already present locally
- Click Create repository

#### 1.2 Initialize git locally and push

In PowerShell (project root):

```powershell
# First confirm sample-bundle won't be pushed
Get-Content .gitignore
# Should see sample-bundle*.zip listed; add it if not

git init
git add .
git commit -m "initial: OCR diff visualization"
git branch -M main

# Replace the URL below with your new repo's URL (GitHub shows it after creation)
git remote add origin https://github.com/<your-username>/ocr-diff-visualization.git
git push -u origin main
```

> If `git push` asks for a password — GitHub no longer supports passwords. Use a [Personal Access Token](https://github.com/settings/tokens) (paste the token in the password field), or install [GitHub CLI](https://cli.github.com/) and run `gh auth login`.

#### 1.3 Verify `node_modules/` and `sample-bundle*.zip` are NOT in the repo

Refresh the repo page and scan. If accidentally committed, run locally:

```powershell
git rm -r --cached node_modules sample-bundle*.zip
git commit -m "fix gitignore"
git push
```

### Step 2: Connect GitHub to Cloudflare

#### 2.1 Sign up and go to Pages

1. Sign up at https://dash.cloudflare.com/sign-up (free, email only)
2. After login, left sidebar → **Workers & Pages**
3. Click **Create** → **Pages** tab → **Connect to Git**

#### 2.2 Authorize GitHub

First time will show a GitHub authorization page:

- Select **Only select repositories** → check your `ocr-diff-visualization` repo (least privilege)
- Click Install & Authorize

Back on the CF page, pick your repo from the list → click **Begin setup**.

#### 2.3 Fill in build configuration (critical)

| Field | Value |
|---|---|
| Project name | `ocr-diff` (becomes `<name>.pages.dev` subdomain) |
| Production branch | `main` |
| Framework preset | **None** (don't pick Vite — the preset is incomplete) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Deploy command | `npx wrangler pages deploy dist --project-name=ocr-diff` |
| Root directory (advanced) | leave empty |

> ⚠️ **Do NOT use** `npx wrangler deploy` (that's the Workers command). Workers deploy triggers a Vite integration check requiring Vite ≥ 6; this project uses Vite 5 and will fail. This is a pure static site — must use `wrangler pages deploy`.

**Expand Environment variables and add:**

| Variable | Value |
|---|---|
| `NODE_VERSION` | `20` |

> Without this, CF defaults to Node 12 and the project won't build.

Click **Save and Deploy**.

#### 2.4 Wait for the first build (2–5 minutes)

CF pulls the code, runs `npm install` and `npm run build`. You can watch the live logs on the page. When the last line shows `Success: Your site was deployed!`, it's done.

A link like `https://ocr-diff.pages.dev` appears at the top — open it and you're live.

### Step 3: Future updates

```powershell
git add .
git commit -m "changed something"
git push
```

That's it. CF auto-detects the push, rebuilds, and redeploys — usually live within 1–2 minutes. You'll also get an email notification for each build result.

### Sharing with colleagues

1. Run `.\scripts\make-bundle.ps1` to generate a zip (this zip should **NOT be committed to GitHub** — already in .gitignore)
2. Send the `https://ocr-diff.pages.dev` link + zip to colleagues (WeChat, email, file sharing — any method)
3. They open the link → drag the zip into the page → view immediately
4. The zip is fully extracted in their browser — **nothing is uploaded to any server**

### Custom domain (optional)

If you have your own domain (e.g. `ocr.yourname.com`), go to the CF project page → **Custom domains** → Set up a custom domain, follow the prompts to add a CNAME record at your DNS provider. Takes effect in minutes. **Completely free, automatic free HTTPS**.

### Common pitfalls

**Build log shows `Cannot find module ...`**
99% of the time you forgot `NODE_VERSION=20`. Settings → Environment variables → add it → Deployments → Retry deployment.

**Deploy succeeded but page is blank**
F12 → Console, look for red text. Usually a path issue; this project uses Vite's standard worker import syntax and should be fine normally.

**Pushed code but page didn't update**
CF generates preview URLs `<commit>.<project>.pages.dev` for each deployment, but the main URL `<project>.pages.dev` only tracks the production branch (`main`). Make sure you pushed to `main`. If still not working, `Ctrl+Shift+R` to bypass browser cache.

**Build timeout**
CF free tier has a 20-minute limit. This project's `vite build` typically finishes in 3 seconds — it will never time out. If it does, npm package fetching is slow — CF servers are overseas, so do **NOT** configure a domestic mirror (it'll be slower).

---

### Alternative: manual wrangler CLI deploy

If you don't want GitHub auto-deploy (e.g. code shouldn't be public and you don't want GitHub Private), you can manually push via CLI:

```powershell
npm install -g wrangler
wrangler login                      # authorize in browser once
npm run build
npx wrangler pages deploy dist --project-name=ocr-diff
```

The first run will ask "create new project?" — answer yes. After that, run the same command to update. **More manual work than GitHub auto-deploy**, generally not recommended.

---

## Data format

**`public/pdfs/`**
Original PDFs. Can be placed at the root or in a first-level subdirectory (e.g. `public/pdfs/chinese/`, `public/pdfs/english/`). In dev/build mode Vite publishes them as-is to `/pdfs/...`; in zip mode they should be flat under `pdfs/` inside the zip.

**`public/doc_exports/manifest.json` (or `manifest.json` inside a zip)**
Document manifest:

```json
[
  {
    "doc_name": "9787115353009.pdf",
    "doc_fid": "65d8ecd9-ab77-...",
    "json_file": "results/doc_exports/json/<fid>__<name>.json",
    "markdown_dir": "...",
    "markdown_files": ["..."]
  }
]
```

The frontend only uses `doc_name` / `doc_fid` / `json_file` (takes the filename and appends to `/doc_exports/json/` or reads from `json/` in the zip).

**`<fid>__<name>.json`**
All model outputs for a single document:

```json
{
  "doc_name": "...",
  "doc_fid": "...",
  "ocr_results": [
    {
      "model_id": "gemini-3-flash-preview",
      "pages": [
        { "page_num": 0, "result": "...markdown..." },
        ...
      ]
    },
    ...
  ]
}
```

`page_num` is 0-indexed. Different models can have different `pages.length` (total PDF pages = max across models). Files must be UTF-8 encoded.
