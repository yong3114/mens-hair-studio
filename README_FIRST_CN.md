# Men's Hair Studio V2.3.4 — Leads CRM + Workflow Status

当前主流程：

Lead → Follow-up → Consultation → Signed / Follow Up / Lost → Client → Installation → Active Client → Maintenance

## 本版重点

- Leads 页面重新设计：整行点进去、清楚 Edit / Save、Next Follow-up、Last Contacted、Follow-up History。
- Consultation / Service Start 后不再“锁死”：误按 Start 可以安全 Return to booked 或 Cancel。
- Completed 仍然保护，避免 Payment / Stock / Deal 记录被随意破坏。

## 升级必须先 Run

`supabase/05_V2_3_4_LEADS_STATUS_FIX.sql`

成功看到：

`V2_3_4_LEADS_STATUS_OK`

然后覆盖项目、git add / commit / push。

完整步骤看：`V2.3.4_UPDATE_CN.md`

> `02_FINAL_RLS_LOCKDOWN.sql` 暂时仍不要 Run，等 Customer Portal + Automation 权限完成后再做最终锁定。
