# Men's Hair Studio V2 — GitHub 免费部署完整步骤

这份是 **GitHub Development / Testing 版本**。

正式生产环境以后可以搬去你自己的 hosting + domain；GitHub repo 可以保留做 source code / version history / backup，GitHub Pages 再关闭即可。

---

## 0. 现在这套架构

```text
GitHub Repository
       ↓
GitHub Actions 自动 Build
       ↓
GitHub Pages 免费 HTTPS 网站
       ↓
Men's Hair Studio Web App
       ↓
Supabase Auth / Database / Storage
       +
Google Maps / Places
```

---

## 1. 本机先解压

建议：

```text
C:\Users\YONG\Desktop\mens-hair-studio-v2-github-edition
```

旧版不要删除。

---

## 2. GitHub 建新的 Repository

Repository 建议名称：

```text
mens-hair-studio
```

开发阶段如果使用 GitHub Free + GitHub Pages，最简单是先使用 **Public** repository。

不要勾选自动生成 README / .gitignore / license，避免第一次上传发生冲突。

---

## 3. 把这个完整项目上传到 Repository

第一次可以直接用 GitHub 网页：

```text
Add file -> Upload files
```

把本项目里面的内容全部上传到 repository root。

必须确认 GitHub repo 顶层直接看到：

```text
package.json
vite.config.js
index.html
src/
supabase/
.github/
```

不要多包一层 folder。

---

## 4. 加 3 个 GitHub Actions Secrets

GitHub Repository：

```text
Settings
-> Secrets and variables
-> Actions
-> New repository secret
```

照 `GITHUB_SECRETS_TEMPLATE.txt` 建：

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_GOOGLE_MAPS_API_KEY
```

Google Maps key 暂时还没有的话，也可以先建立成空值以后再改；不过 Google Address Autocomplete 不会工作，直到真正设置 key。

---

## 5. 开 GitHub Pages

Repository：

```text
Settings
-> Pages
-> Build and deployment
-> Source
-> GitHub Actions
```

项目内已经包含：

```text
.github/workflows/deploy.yml
```

所以之后每次 push `main`，GitHub 都会自动：

```text
npm install
-> npm run build
-> upload dist
-> deploy GitHub Pages
```

---

## 6. 看自动部署

打开：

```text
Actions
```

找到：

```text
Deploy Hair Studio to GitHub Pages
```

绿色勾 = Build / Deploy 成功。

然后 Settings -> Pages 会显示正式 GitHub Pages URL，例如：

```text
https://YOURUSERNAME.github.io/mens-hair-studio/
```

---

## 7. Google Maps API Key Restriction

等 GitHub Pages URL 出来以后，Google Cloud Console 把 Browser API key 的 Website / HTTP referrer restriction 加：

```text
https://YOURUSERNAME.github.io/mens-hair-studio/*
```

并限制只可调用项目实际需要的 Google Maps / Places API。

以后搬去自己的 domain，再加新的 domain，然后确认正式网址正常后才移除 GitHub Pages referrer。

---

## 8. Supabase

V2 使用真正分表 database。

新 Supabase Project 第一次只运行：

```text
supabase/01_PREP_SCHEMA.sql
```

网站、Login、Cloud CRUD 全部确认稳定后，才运行：

```text
supabase/02_FINAL_RLS_LOCKDOWN.sql
```

不要一开始就先 Run FINAL LOCKDOWN。

---

## 9. 本机开发

本机双击：

```text
01_RUN_LOCAL.bat
```

本机 `.env` 需要参考 `.env.example` 创建。

`.env` 已被 `.gitignore` 排除，不应该上传到 GitHub。

---

## 10. 以后正式搬自己的 Hosting

最终完成后：

```text
GitHub Development Site
        ↓
购买 Domain + Hosting
        ↓
Build Production
        ↓
部署正式网站
        ↓
测试 Auth / DB / Storage / Google Maps
        ↓
确认一切正常
        ↓
关闭 GitHub Pages
```

GitHub repository 建议保留，并改为 Private（如果你的 GitHub plan / hosting workflow 允许），用来保存 source code 和版本记录，不建议直接删除整个 repo。
