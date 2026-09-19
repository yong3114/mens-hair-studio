# Men's Hair Studio Official V2 — GitHub Edition

这是重新按照 **SVR Inventory 那种正式项目结构**制作的版本，不是单一 HTML demo。

## 技术结构

- React 18
- Vite
- Supabase Auth / PostgreSQL / Storage
- Google Places Address Autocomplete
- GitHub Actions
- GitHub Pages（开发 / 测试阶段免费部署）

## 现在先看哪一份？

第一次设置：

**`GITHUB_SETUP_STEP_BY_STEP_CN.md`**

GitHub Secrets：

**`GITHUB_SECRETS_TEMPLATE.txt`**

Supabase：

```text
supabase/01_PREP_SCHEMA.sql
supabase/02_FINAL_RLS_LOCKDOWN.sql
```

> FINAL RLS LOCKDOWN 一定等网站实际测试正常才运行。

## 本机运行

先复制：

```text
.env.example -> .env
```

填入 Supabase / Google Maps 配置，再双击：

```text
01_RUN_LOCAL.bat
```

## GitHub 部署

项目已包含：

```text
.github/workflows/deploy.yml
```

GitHub Actions 会自动安装、build，并发布 `dist` 到 GitHub Pages。

详细步骤看 `GITHUB_SETUP_STEP_BY_STEP_CN.md`。
