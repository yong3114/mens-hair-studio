# Men's Hair Studio V2.3 — Hair System Core Workflow

这版的重点不是“再加几个页面”，而是把系统改成真正符合 Hair System 生意的流程。

## 核心流程

Lead → Consultation → Decision → Deal → Installation → Active Client → Maintenance

## 新增

- Lead 不需要真实姓名 / 电话
- Lead 可直接 Book Consultation
- Consultation 与 Service 完全分开
- Signed / Follow Up / Not Signed outcome
- Signed 后才自动建立 Client
- Deal / Hair System Selection
- Deposit / Balance
- Stock / Custom order
- Installation 完成后才变 Active Client
- Ah Bi / Yong My Jobs
- In-app Notification Bell
- Assignment / Reschedule notifications

## 更新顺序

先看：`V2.3_UPDATE_STEP_BY_STEP_CN.md`

先 Run：`supabase/04_V2_3_HAIR_SYSTEM_CORE.sql`

> `02_FINAL_RLS_LOCKDOWN.sql` 仍然不要现在跑，等 Customer Portal 和 automation 权限一起完成后再做最终锁定。
