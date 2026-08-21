# Step 6 — Stateless Messenger Flow

ขั้นตอนสุดท้ายเปลี่ยนเป็นการสร้างและส่งข้อมูลเข้า Facebook Messenger ณ ตอนนั้น โดยไม่เก็บ Order ในฐานข้อมูลของเว็บ

## Flow

1. Mockup เสร็จ
2. เลือกจำนวน 12–1,000 ชิ้น
3. ระบบคิดราคาตาม Tier ของ TYPE-1 ถึง TYPE-5
4. เลือก `คุย Messenger`
5. กด `ส่งรายละเอียดไป Messenger`
6. สร้างไฟล์ ณ ตอนนั้น
   - PDF
   - Production PNG 3000×3000
   - Top-right PNG 2400×2400
7. Upload ทั้ง 3 ไฟล์เข้า Meta Attachment API โดยตรง
8. สร้าง signed referral ref ที่มีข้อมูลราคา + attachment IDs
9. เปิด Messenger ของ `adsawinthailand`
10. Webhook ส่งรายละเอียด + รูป 2 รูป + PDF เข้าแชต
11. จบ — คุยงานต่อใน Messenger

## สิ่งที่ตัดออก

- `src/lib/messengerOrderStore.ts`
- `/api/messenger/orders`
- การเขียนไฟล์ลง `.data`
- `PUBLIC_APP_URL`
- `MESSENGER_ORDER_DATA_DIR`
- การพึ่ง database/storage ของเว็บเพื่อส่งไฟล์ Messenger

## สิ่งที่เพิ่ม

- `src/lib/messengerReferralToken.ts`
- `/api/messenger/package`
- Signed + expiring referral token
- Upload PDF เป็น Messenger attachment type `file`
- Upload Production/Top-right เป็น Messenger attachment type `image`

## Environment ที่ต้องมี

```env
META_PAGE_ACCESS_TOKEN=
META_APP_SECRET=
META_WEBHOOK_VERIFY_TOKEN=
META_GRAPH_API_VERSION=v26.0
META_REFERRAL_MAX_AGE_SECONDS=7200
```

## หมายเหตุ

Stateless หมายถึงเว็บไม่เก็บ Order/ไฟล์เอง แต่ Meta จำเป็นต้องรับ asset เพื่อให้ Messenger ส่งไฟล์เข้าแชตได้


## Meta readiness / แก้หน้าค้าง

- เพิ่ม `GET /api/messenger/status` เพื่อตรวจ Environment ก่อนสร้างไฟล์
- ปุ่ม Messenger จะไม่เริ่มสร้าง PDF/PNG ถ้า Meta 3 ค่าหลักยังไม่ครบ
- Popup แสดงสถานะทีละขั้น และแสดง Error ชัดเจนแทนการค้าง
- `POST /api/messenger/package` ตรวจ Environment ก่อนอ่าน `formData()` ขนาดใหญ่
- เพิ่ม `.env.local` พร้อมช่องว่างรอกรอก 3 ค่า และตั้ง `v26.0` / `7200` ให้แล้ว
- ดู `META_READY_CHECKLIST.md`
