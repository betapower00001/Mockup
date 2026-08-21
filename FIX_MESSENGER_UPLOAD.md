# Messenger upload fix (2026-08-21)

แก้ปัญหาหน้าค้างที่ “กำลังอัปโหลดเข้า Meta” โดยเปลี่ยน flow จากการส่ง PDF + PNG 3 ไฟล์รวมใน request เดียว เป็นการอัปโหลดทีละไฟล์

Flow ใหม่:
1. ใช้ Production PNG จาก Step 6 Preview โดยตรง (ไม่ render Production ซ้ำ)
2. ใช้ภาพมุมบนเอียงขวาจาก Preview; ถ้ายังไม่มีจึง render fallback 1400x1400
3. ลดขนาด PNG ให้อยู่ในขอบเขตที่เหมาะกับ serverless request โดยยังคงไฟล์เป็น PNG
4. POST ทีละไฟล์ไป `/api/messenger/attachment`
5. เมื่อได้ Meta attachment IDs ครบ 3 ไฟล์ ค่อย POST JSON ขนาดเล็กไป `/api/messenger/package`
6. สร้าง signed referral token แล้วเปิด `m.me` เพื่อให้ webhook รู้ PSID และส่งไฟล์เข้าแชทอัตโนมัติ

ไฟล์ที่แก้:
- `src/components/PlugCustomizer.tsx`
- `src/app/api/messenger/attachment/route.ts` (เพิ่มใหม่)
- `src/app/api/messenger/package/route.ts`

หมายเหตุ:
- Desktop fallback ใช้ Page ID `110219891504385` สำหรับเปิด Facebook Messages ด้วย session ที่ล็อกอินอยู่แล้ว
- การส่งไฟล์อัตโนมัติยังต้องใช้ `m.me?...ref=...` เพื่อให้ Meta ส่ง referral event/PSID เข้า webhook
- `.env.local` ไม่ได้รวมอยู่ใน ZIP ที่ส่งกลับ เพื่อไม่ให้ secret หลุดไปกับไฟล์ artifact; ให้ใช้ค่าเดิมในเครื่อง/Vercel
