# Google Maps / Places Setup

V2.0 使用 Google 官方 Places Autocomplete，体验就是：输入一点点地址 → Google suggestion dropdown → 点一下自动保存完整地址 / Place / 经纬度。

需要启用：
- Maps JavaScript API
- Places API (New)

API Key 建议设置：
1. Application restrictions → Websites (HTTP referrers)
2. Local test: http://localhost:5173/*
3. Production: https://你的正式domain/*
4. API restrictions → Restrict key
5. 只选 Maps JavaScript API + Places API (New)

系统会把建议限制在 Malaysia，并以 Johor Bahru 附近作 location bias。

.env：
VITE_GOOGLE_MAPS_API_KEY=xxxxxxxx

如果 Google autocomplete 没出现：
- F12 → Console 看 error
- 确认 Billing enabled
- 确认两个 API 都 enabled
- 确认 localhost / 正式 domain 在 HTTP referrer allowlist
- 修改 Google Cloud restriction 后可能需要几分钟生效
