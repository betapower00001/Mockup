# Messenger Platform — Stateless Flow (ไม่ใช้ฐานข้อมูล)

เวอร์ชันนี้ออกแบบตาม Flow:

`สร้าง Mockup → เลือกจำนวน → คำนวณราคา → ส่ง Messenger → จบและคุยต่อในแชต`

เว็บ **ไม่บันทึก Order ลงฐานข้อมูล และไม่เขียน PDF/PNG ลง storage ของเว็บ**

## ทำงานอย่างไร

1. Browser สร้างไฟล์ 3 รายการ ณ ตอนกดส่ง
   - PDF สรุปแบบ
   - Production PNG
   - ภาพมุมบนเอียงขวา
2. Browser POST ไฟล์ทั้ง 3 ไป `POST /api/messenger/package`
3. Server อัปโหลดไฟล์ทั้ง 3 เข้า Meta Attachment Upload API โดยตรง
4. Meta คืน `attachment_id` ของ PDF และรูปทั้ง 2
5. Server สร้าง `ref` แบบ signed + short-lived ซึ่งมีเฉพาะข้อมูล Order ที่จำเป็นและ attachment IDs
6. Browser เปิด `https://m.me/adsawinthailand?ref=...`
7. Meta ส่ง referral event เข้า `POST /api/messenger/webhook`
8. Webhook ตรวจ signature ของ Meta และตรวจ signature/อายุของ ref
9. Page ส่งเข้าแชตอัตโนมัติ:
   - ข้อความรายละเอียดรุ่น / จำนวน / ราคา
   - ภาพมุมบนเอียงขวา
   - Production image
   - PDF เป็น file attachment
10. จบ Flow — ไม่มี Order record ค้างอยู่ในระบบของเว็บ

## API ที่ใช้ในโปรเจกต์

- `GET /api/messenger/status`
  - ตรวจว่า Meta Environment 3 ค่าหลักตั้งครบหรือยัง
  - ไม่คืน Token/Secret ออกมาฝั่ง client
- `POST /api/messenger/package`
  - รับ metadata + PDF + 2 PNG
  - upload เข้า Meta โดยตรง
  - คืน signed referral ref
- `GET /api/messenger/webhook`
  - ใช้ verify webhook ตอนตั้งค่า Meta
- `POST /api/messenger/webhook`
  - รับ referral event แล้วส่งชุดข้อมูลเข้า Messenger

## Environment Variables

สร้าง `.env.local`:

```env
META_PAGE_ACCESS_TOKEN=...
META_APP_SECRET=...
META_WEBHOOK_VERIFY_TOKEN=...
META_GRAPH_API_VERSION=v26.0
META_REFERRAL_MAX_AGE_SECONDS=7200
```

### ค่าแต่ละตัว
- `META_PAGE_ACCESS_TOKEN` — Page Access Token ของ Adsawin Thailand
- `META_APP_SECRET` — App Secret จาก Meta App Settings; ใช้ตรวจ webhook และเซ็น referral token
- `META_WEBHOOK_VERIFY_TOKEN` — ตั้งเอง แล้วใส่ค่าเดียวกันในหน้า Webhook ของ Meta
- `META_GRAPH_API_VERSION` — ค่า default ของโปรเจกต์คือ v26.0
- `META_REFERRAL_MAX_AGE_SECONDS` — อายุ ref; default 2 ชั่วโมง

> ห้ามใส่ Page Access Token หรือ App Secret ใน `PlugCustomizer.tsx` หรือ client-side code

## ตั้ง Webhook ใน Meta

หลัง deploy เว็บขึ้น HTTPS แล้ว ใช้ Callback URL:

```text
https://YOUR-DOMAIN.com/api/messenger/webhook
```

Verify Token ต้องตรงกับ `META_WEBHOOK_VERIFY_TOKEN`

Subscribe event ที่รองรับ referral / messaging ของเพจตามการตั้งค่า Messenger Platform ของ Meta

## จุดสำคัญของ Stateless Flow

- ไม่มี Supabase / Firebase / SQL
- ไม่มี `.data/messenger-orders`
- ไม่มี public URL สำหรับ PDF/PNG ของเว็บ
- asset ถูกส่งเข้า Meta Attachment API ณ ตอนนั้น
- signed ref มีอายุจำกัด ลดความเสี่ยงจากการ reuse ลิงก์เก่า
- เนื่องจากไม่เก็บ state ฝั่ง server จึงไม่มีระบบ History / Track Order / deduplicate แบบถาวร
- Order ID ยังคงสร้างเพื่อให้คนอ่านและคุยอ้างอิงใน Messenger ได้ แต่ไม่ได้หมายถึงมี record ในฐานข้อมูล

## Facebook Page

- Page: Adsawin Thailand
- Username: `adsawinthailand`
- Referral link base: `https://m.me/adsawinthailand`


## การป้องกันหน้าค้างเมื่อยังไม่ได้ตั้ง Meta

เวอร์ชันนี้มี preflight check ก่อนสร้างไฟล์ โดยปุ่ม Messenger จะเรียก `/api/messenger/status` ก่อน ถ้ายังขาด Environment จะหยุดทันทีและแจ้งชื่อค่าที่ขาด ไม่ Upload PDF/PNG ขนาดใหญ่โดยไม่จำเป็น

`POST /api/messenger/package` ตรวจ Environment ซ้ำฝั่ง Server **ก่อน** เรียก `request.formData()` เพื่อให้ fail fast เมื่อ Meta ยังไม่พร้อม

ดูขั้นตอนสั้น ๆ ใน `META_READY_CHECKLIST.md`
