# OCR 模型对比可视化

把同一份 PDF 经多个 OCR 模型转写为 markdown 后的结果**并排对比**，按语义块（标题/段落/表格/代码/列表）对齐，区分四类差异：仅 A 有、仅 B 有、格式不同、文本不同。顶部热力图给出全文档 × 全模型的差异概览，一眼定位「哪个模型在哪页出错」。

**两种使用方式：**

1. **远程示例数据**（默认）—— 直接打开网页，自动从 Cloudflare R2 加载示例 PDF + OCR 结果，零配置开箱即用
2. **拖拽 zip**（看「打包数据」+「部署」小节）—— 把自己的数据打成 zip 拖进网页就能看，可以部署到 Cloudflare 给任何人用

所有 PDF 渲染、markdown 解析、diff 计算都在浏览器里跑，**zip 不会上传到任何服务器**。R2 上的数据通过公开 URL 拉取，不经过任何后端。

---

## 第一次运行（小白手把手版）

### 1. 安装 Node.js（一次性）

这是一个**前端网页项目**，需要 Node.js 来跑本地开发服务器。Node 可以理解为「能在你电脑上运行 JavaScript 代码的工具」，类似你装 Python 才能跑 `.py` 文件。

- 打开 https://nodejs.org/ ，点首页那个「LTS」绿色按钮下载安装包（不要选 Current）
- 装好后，**重启 PowerShell 或 VS Code**（重要，否则命令找不到）
- 验证安装成功：在 PowerShell 里运行下面两行，应该各打出一个版本号

```powershell
node --version
npm --version
```

> 如果你看到 `v20.x.x` 或更高、`10.x.x` 或更高，就 OK 了。

### 2. 安装项目依赖（一次性）

在 VS Code 里打开本项目文件夹，按 `` Ctrl+` `` 调出集成终端（PowerShell），然后运行：

```powershell
npm install
```

这会读取 `package.json`，把项目用到的库（react、vite、pdf 渲染、markdown 解析等等）下载到 `node_modules/` 文件夹。第一次会下载几百 MB，需要 1-5 分钟，看网速。**期间出现的黄色 `npm warn deprecated ...` 全部可以忽略**，只要最后看到类似 `added 295 packages` 就成功了。

> 如果觉得太慢，可以临时切到国内镜像：
> ```powershell
> npm config set registry https://registry.npmmirror.com
> npm install
> ```

### 3. 启动项目（每次想看效果时）

```powershell
npm run dev
```

终端里会出现：

```
  VITE v5.4.21  ready in 1213 ms
  ➜  Local:   http://localhost:5173/
```

**用浏览器打开 http://localhost:5173/** 就看到界面了。这个终端要保持开着——它是你的本地服务器。

要停止：在终端里按 `Ctrl+C`。

要重新启动：再次 `npm run dev` 即可。**不需要每次都 `npm install`**，那是一次性的。

### 4. 修改代码后会发生什么

这个开发服务器自带「热更新」——你改了 `src/` 下的任何代码并保存，浏览器会自动刷新，不用手动重启。

---

## 项目能做什么

打开页面后你会看到三层：

1. **顶栏**：选文档、翻页、选 A/B 两个模型对比、四类差异图例
2. **概览热力图**：横轴是页码，纵轴是除 baseline 外的所有模型；颜色越深 = 该模型在该页与 baseline 分歧越大；**点格子 = 跳到该页 + 自动切到 baseline vs 该模型**
3. **主视图**：左侧 PDF 原文，右侧两个模型的 markdown 渲染结果，差异被着色

差异分四类：

| 类别 | 含义 | 颜色 |
|---|---|---|
| 仅 A 有 | A 的某个块在 B 中找不到对应（B 漏识别） | 🟥 红 |
| 仅 B 有 | B 的某个块在 A 中找不到对应（A 漏识别） | 🟩 绿 |
| 格式不同 | 两边都识别出该内容，但块类型/层级不同（如 A 是 `## 标题`，B 是普通段落） | 🟨 黄 |
| 文本不同 | 同类型、同层级的块，但内部文字有差异（OCR 字符错误） | 🟦 蓝 |

「文本不同」的块内部还会进一步做词级 diff——A 视图里红色高亮的是 A 多出的词，B 视图里绿色高亮的是 B 多出的词。

---

## 怎么放新数据进来

本项目的「数据」部署在 **Cloudflare R2** 对象存储上。前端启动后，会从 `R2_BASE`（在 `src/config.ts` 里定义）拉取 `doc_exports/manifest.json` 和 `doc_exports/json/<fid>__<name>.json`，PDF 也直接从 R2 拉。

**新增一份数据的流程**：

1. 把 PDF 上传到 R2 的 `pdfs/<lang>/<doc_name>.pdf`（`<lang>` 目前是 `chinese` 或 `english`，可在 `src/config.ts` 的 `PDF_LANG_DIRS` 里扩展）
2. 把模型输出 JSON 上传到 R2 的 `doc_exports/json/<fid>__<name>.json`
3. 更新 R2 的 `doc_exports/manifest.json`，加一条新记录（字段格式见文末「数据约定」）
4. 刷新页面即可——**前端代码无需改动、无需重新部署**

> 💡 **关于 PDF 的语言子目录**：manifest 里的 `doc_name` 不带 `chinese/` `english/` 前缀。前端按 `PDF_LANG_DIRS` 顺序对每条记录做一次 HEAD 探测来定位，结果会按 `doc_fid` 缓存。如果你想跳过探测，可以在 manifest 条目里直接加一个 `pdf_path` 字段（如 `"pdf_path": "pdfs/chinese/9787115353009.pdf"`），前端会优先使用它。

**线上拖拽 zip**：完全独立的离线路径，给同事看私密数据用。详见下文「打包数据为 zip」。

---

## 常见问题

**`npm install` 卡住或报网络错误。** 切镜像（见上文步骤 2 的提示）。

**`npm: 无法将"npm"项识别为 cmdlet 的名称`。** Node 没装好或没重启 PowerShell。重新打开 VS Code 试试。

**端口 5173 被占用。** 在终端里 `Ctrl+C` 停掉之前那次 dev，或在 `vite.config.ts` 里改端口。

**页面打开是空白的。** 按 `F12` 打开浏览器开发者工具，看 Console 标签的红色报错信息——通常是数据文件路径不对。

**改了代码但浏览器没反应。** 看终端有没有报错；如果终端正常，浏览器按 `Ctrl+Shift+R` 强制刷新。

---

## 算法细节（可选阅读）

块对齐流程：

1. `unified + remark-parse + remark-gfm` 把两份 markdown 解析为 mdast（markdown 抽象语法树），取顶层 `children` 作为「块序列」
2. 两个块序列做 LCS（最长公共子序列）。匹配函数：类型签名相同 + 文本归一化后字符 bigram Jaccard 相似度 ≥ 0.4；或类型不同但文本几乎相同（≥ 0.7）也算匹配，标为「格式不同」
3. 匹配上的：完全相同 → equal；类型差异 → type-diff；其他 → text-diff
4. 未匹配上的：仅 A 有 / 仅 B 有
5. text-diff 与 type-diff 的块在 paragraph/heading 里再做词级 diff

每页输出一个 `divergenceScore = onlyA + onlyB + 0.7·typeDiff + 0.3·textDiff`，作为热力图颜色深浅。

加载文档时所有页的分数会**异步分批计算**，不会阻塞 UI——已算出的格子立即显示，未算的显示灰色。

---

## 技术栈

React 18 + TypeScript + Vite + Tailwind CSS + react-pdf + react-markdown + remark/unified 生态。Zustand 管全局状态。JSZip 在浏览器内解压数据包。

---

## 打包数据为 zip

写好的 `scripts/make-bundle.ps1` 会把 `public/doc_exports/` + `public/pdfs/` 打成可拖入网页的 zip：

```powershell
# 打包所有文档
.\scripts\make-bundle.ps1

# 只打某一篇（用 manifest 里的 doc_fid）
.\scripts\make-bundle.ps1 -DocFid 65d8ecd9-ab77-402a-8013-9645a4401732 -Output sample-small.zip
```

zip 内部结构（也就是任何想自己造数据的人需要遵守的格式）：

```
bundle.zip
├── manifest.json                    （文档清单，结构见下文）
├── json/
│   └── <fid>__<name>.json           （单文档所有模型输出）
└── pdfs/
    └── <doc_name>.pdf
```

⚠️ 大 zip 注意：解压在浏览器内进行，**单个 zip 建议控制在 200MB 以内**，否则部分浏览器会卡或 OOM。如果你的 PDF 很大，可以只打文字数据（json/manifest），不带 PDF 也能用 —— 此时左侧 PDF 栏会提示「找不到 PDF」，但 markdown 对比依然正常。

---

## 部署到 Cloudflare Pages（GitHub 自动部署）

> ⚠️ 名词澄清：本项目是**纯静态站点**，部署到 Cloudflare 的 **Pages** 服务（不是 Workers）。两者在 CF 后台被合并到「Workers & Pages」入口，所以容易混；你只需要点 Pages 路径，全程零代码、零运维、免费。
>
> 整体流程：`本地代码 → GitHub 仓库 → Cloudflare Pages 自动构建 → 永久 URL`，每次 `git push` 自动重新发布。

### 步骤 1：把项目推到 GitHub

#### 1.1 在 GitHub 创建仓库

打开 https://github.com/new

- Repository name：随便起，如 `ocr-diff-visualization`
- Public 或 Private 都行（CF Pages 都支持）
- **不要**勾选 "Add a README" / "Add .gitignore"，本地已有
- 点 Create repository

#### 1.2 本地初始化 git 并推送

在 PowerShell 里（项目根目录）：

```powershell
# 先确认 sample-bundle 不会被推上去
Get-Content .gitignore
# 应该看到 sample-bundle*.zip 这行；没有就加上

git init
git add .
git commit -m "initial: OCR diff visualization"
git branch -M main

# 把下面的 URL 换成你刚创建的仓库的 URL（GitHub 创建完会给提示）
git remote add origin https://github.com/<你的用户名>/ocr-diff-visualization.git
git push -u origin main
```

> 如果 `git push` 提示要密码——GitHub 不再支持密码，需要 [Personal Access Token](https://github.com/settings/tokens)（密码位置粘 token），或者装 [GitHub CLI](https://cli.github.com/) 跑 `gh auth login`。

#### 1.3 检查仓库里**没有** `node_modules/` 和 `sample-bundle*.zip`

刷新仓库页面扫一眼。如果误提交了，本地跑：

```powershell
git rm -r --cached node_modules sample-bundle*.zip
git commit -m "fix gitignore"
git push
```

### 步骤 2：在 Cloudflare 连接 GitHub

#### 2.1 注册并进入 Pages

1. 注册 https://dash.cloudflare.com/sign-up（免费，邮箱即可）
2. 登录后左侧菜单 → **Workers & Pages**
3. 点 **Create** → 选 **Pages** 标签 → 选 **Connect to Git**

#### 2.2 授权 GitHub

第一次会弹 GitHub 授权页：

- 选 **Only select repositories** → 勾刚创建的 `ocr-diff-visualization`（最小权限）
- 点 Install & Authorize

回到 CF 页面，从仓库列表选你的仓库 → 点 **Begin setup**。

#### 2.3 填构建配置（关键）

| 字段 | 填什么 |
|---|---|
| Project name | `ocr-diff`（会成为 `<这个名字>.pages.dev` 的子域名） |
| Production branch | `main` |
| Framework preset | **None**（不要选 Vite，预设设置反而不全） |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Deploy command | `npx wrangler pages deploy dist --project-name=ocr-diff` |
| Root directory (advanced) | 留空 |

> ⚠️ **不要使用** `npx wrangler deploy`（那是 Workers 命令）。Workers 的 deploy 会触发 Vite 集成检查，要求 Vite ≥ 6，本项目 Vite 5 会直接构建失败。本项目是纯静态站点，必须用 `wrangler pages deploy`。

**展开 Environment variables，必须加一个：**

| 变量名 | 值 |
|---|---|
| `NODE_VERSION` | `20` |

> 不加这个，CF 默认用 Node 12，项目跑不起来。

填完点 **Save and Deploy**。

#### 2.4 等首次构建（2-5 分钟）

CF 会拉代码、跑 `npm install` 和 `npm run build`，页面上能看到实时日志。最后一行出现 `Success: Your site was deployed!` 就成功了。

成功后页面顶部显示一个链接，类似 `https://ocr-diff.pages.dev` —— 打开即用。

### 步骤 3：以后的更新

```powershell
git add .
git commit -m "改了 xxx"
git push
```

完事。CF 自动检测到 push、重新构建并发布，通常 1-2 分钟内生效，每次 push 还会收到邮件通知构建结果。

### 给同事使用的姿势

1. 你跑 `.\scripts\make-bundle.ps1` 生成 zip（这个 zip **不要提交到 GitHub**，已在 .gitignore）
2. 把 `https://ocr-diff.pages.dev` 链接 + zip 发给同事（微信、邮件、网盘任意方式）
3. 同事打开链接 → 拖 zip 进网页 → 直接看
4. zip 完全在他浏览器内解压，**不上传任何服务器**

### 自定义域名（可选）

有自己的域名（如 `ocr.yourname.com`），CF 项目页 → **Custom domains** → Set up a custom domain，按提示加一条 CNAME 到你的 DNS 服务商，几分钟生效。**完全免费，自动免费 HTTPS**。

### 常见踩坑

**构建日志报 `Cannot find module ...`**
99% 是漏了 `NODE_VERSION=20`。Settings → Environment variables 加上 → Deployments → Retry deployment。

**部署成功但页面空白**
F12 → Console 看红字。多半是路径问题；本项目用了 Vite 标准的 worker import 写法，正常情况不会有事。

**改了代码 push 后页面没更新**
CF 给每次部署生成预览链接 `<commit>.<project>.pages.dev`，但主链接 `<project>.pages.dev` 只跟 production 分支（`main`）。确认 push 到的是 `main`。还不行就 `Ctrl+Shift+R` 强刷浏览器缓存。

**构建超时**
CF 免费版限 20 分钟，本项目 `vite build` 通常 3 秒完成，绝不会超时。如果真超了，多半是 npm 拉包慢——CF 的服务器在海外，**不要**配国内镜像（反而更慢）。

---

### 替代方案：手动用 wrangler 命令行部署

如果不想用 GitHub 自动部署（比如代码不想公开、又不想开 GitHub Private），可以用命令行单次手动推：

```powershell
npm install -g wrangler
wrangler login                      # 浏览器授权一次
npm run build
npx wrangler pages deploy dist --project-name=ocr-diff
```

第一次运行会问「是否新建 project」，回答 yes。之后每次执行同一行命令即更新。**比 GitHub 自动部署需要更多手动操作**，一般不推荐。

---

## 数据约定

**`public/pdfs/`**
原始 PDF。可放在根目录或一级子目录（如 `public/pdfs/chinese/`、`public/pdfs/english/`），dev / 构建模式下 Vite 会原样发布到站点 `/pdfs/...`；zip 模式下要平铺在 zip 内的 `pdfs/` 下。

**`public/doc_exports/manifest.json` / 或 zip 里的 `manifest.json`**
文档清单：

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

前端只用 `doc_name` / `doc_fid` / `json_file`（取文件名拼到 `/doc_exports/json/` 或从 zip 的 `json/` 取）。

**`<fid>__<name>.json`**
单文档所有模型的输出：

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

`page_num` 从 0 起。不同模型的 `pages.length` 可以不同（PDF 总页数取最大值）。文件必须是 UTF-8 编码（中文才不会乱码）。
