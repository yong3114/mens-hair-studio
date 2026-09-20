# Men's Hair Studio V2.1 — Workflow Rebuild

这版不是继续堆功能，而是把 V2.0.x 的核心流程重新整理成更接近日常营业逻辑的版本。

## V2.1 重点

- Lead 不再要求真实姓名/电话号码；只有 WhatsApp display name 也能先建立。
- Lead → Customer 时真实姓名可以留空，WhatsApp identity 会继续保留。
- Customer 页面明确区分：
  - **Book appointment** = 预留未来时间，进入 Calendar。
  - **Start service** = 实际开始做服务，进入 Service History。
- Calendar 重做：**Month / Week / Day / Agenda / Map**。
- Calendar 可点击空白时间建立 booking、点击 booking 编辑、Desktop 可拖拉改日期/时间。
- Booking 编辑改成右侧 details pane（手机为 bottom sheet），改 Date / Start time 更直接。
- Service 改成真正的 Service Queue：Booking → Start → Complete。
- Walk-in Service 会先自动建立 Calendar booking，所以不会再出现“有 Service 但 Calendar 没东西”。
- Complete Service 后会自动：
  - Calendar booking → Completed
  - 写入 Service History
  - 扣 Consumables
  - 建立 Payment（amount > 0）
  - 保存 Next Maintenance
  - 提供 Before/After / Book next visit 快捷动作
- Service 新增 **Follow-up** tab：到期 maintenance 会出现，可直接 Book next visit。
- Before / After 变成真正媒体库：Upload / Gallery / Compare / Consent / Delete / Mobile Camera。
- Payments 增加 Outstanding / Paid / Refund filters 及 Mark Paid。
- Desktop / Tablet / Mobile UI 全面重排，手机只保留 5 个主要 bottom-nav 项目。

## 技术结构

- React 18 + Vite
- Supabase Auth / PostgreSQL / Storage
- Google Places Address Autocomplete
- GitHub Actions + GitHub Pages

## 已经在 V2.0.x 正式运行的用户怎么升级？

请直接看：

**`V2.1_UPDATE_STEP_BY_STEP_CN.md`**

重点：先在现有 Supabase 跑：

```text
supabase/03_V2_1_WORKFLOW_MIGRATION.sql
```

看到：

```text
V2_1_WORKFLOW_MIGRATION_OK
```

才把 V2.1 files 覆盖到现有 GitHub project folder，再 commit / push。

## 全新 Supabase Project

全新安装才跑：

```text
supabase/01_PREP_SCHEMA.sql
```

现有 V2.0.x Project **不要重跑 PREP**，只跑 `03_V2_1_WORKFLOW_MIGRATION.sql`。

## Final RLS

`02_FINAL_RLS_LOCKDOWN.sql` 继续先不要跑，直到你确认 V2.1 的完整营业流程没有问题。
