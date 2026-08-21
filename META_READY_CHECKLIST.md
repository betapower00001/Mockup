# META READY CHECKLIST — ใส่ค่าแล้วใช้งานต่อได้เลย

โปรเจกต์เวอร์ชันนี้เตรียมไว้ให้ **รอใส่ Meta 3 ค่า** โดยไม่ต้องแก้โค้ดส่วน Mockup อีก

## 1) เปิดไฟล์ `.env.local`

ไฟล์อยู่ระดับเดียวกับ `package.json`

```env
META_PAGE_ACCESS_TOKEN=
META_APP_SECRET=
META_WEBHOOK_VERIFY_TOKEN=

META_GRAPH_API_VERSION=v26.0
META_REFERRAL_MAX_AGE_SECONDS=7200
```

ใส่ค่าจริงเฉพาะ 3 บรรทัดแรก

- `META_PAGE_ACCESS_TOKEN` = Page Access Token ของเพจ Adsawin Thailand
- `META_APP_SECRET` = App Secret ของ Meta App
- `META_WEBHOOK_VERIFY_TOKEN` = ค่าที่คุณตั้งเอง และต้องใช้ค่าเดียวกันตอน Verify Webhook ใน Meta

สองบรรทัดล่างพร้อมใช้งานแล้ว ปกติไม่ต้องแก้

## 2) Restart Next.js ทุกครั้งหลังแก้ `.env.local`

หยุด server เดิม:

```bash
Ctrl+C
```

แล้วเปิดใหม่:

```bash
npm run dev
```

## 3) เช็ก Environment ก่อนทดสอบ Messenger

เปิดใน browser:

```text
http://localhost:3000/api/messenger/status
```

ถ้ายังไม่ใส่ค่า จะเห็นประมาณ:

```json
{
  "ok": true,
  "configured": false,
  "missing": [
    "META_PAGE_ACCESS_TOKEN",
    "META_APP_SECRET",
    "META_WEBHOOK_VERIFY_TOKEN"
  ]
}
```

เมื่อใส่ครบและ Restart แล้ว ต้องเห็น:

```json
{
  "ok": true,
  "configured": true,
  "missing": []
}
```

> Endpoint นี้ไม่แสดง Token หรือ Secret ออกมา จะแสดงเพียงว่าตั้งค่าครบหรือยัง

## 4) ตั้ง Meta Webhook หลังเว็บมี HTTPS URL จริง

Callback URL:

```text
https://YOUR-DOMAIN.com/api/messenger/webhook
```

Verify Token ให้ใช้ค่าเดียวกับ:

```env
META_WEBHOOK_VERIFY_TOKEN=...
```

## 5) Flow ที่พร้อมแล้ว

เมื่อ Meta ตั้งค่าครบ:

1. ลูกค้าทำ Mockup
2. เลือกจำนวน
3. ระบบคำนวณราคา
4. กด `ส่งรายละเอียดไป Messenger`
5. ระบบตรวจ Meta config ก่อนทันที
6. สร้าง Production PNG 3000×3000
7. สร้างภาพมุมบนเอียงขวา 2400×2400
8. สร้าง PDF สรุป
9. Upload ทั้ง 3 ไฟล์เข้า Meta
10. เปิด Messenger เพจ `adsawinthailand`
11. Webhook ส่งรายละเอียด + 2 รูป + PDF เข้าแชต
12. คุยงานต่อใน Messenger — ไม่มีฐานข้อมูล Order ของเว็บ

## ปรับแก้เรื่องหน้าค้างแล้ว

เวอร์ชันนี้ตรวจ Environment **ก่อน** สร้าง/Upload ไฟล์ขนาดใหญ่

ถ้ายังไม่ใส่ Meta จะไม่ค้างที่ข้อความ “กำลังสร้าง PDF และรูปสำหรับ Messenger...” อีก แต่จะแสดงว่าขาด Environment ตัวไหน

ระหว่างทำงาน popup จะแสดงสถานะเป็นขั้น ๆ และถ้า Meta/API error จะขึ้นข้อความ error ใน popup พร้อมปุ่มปิด
