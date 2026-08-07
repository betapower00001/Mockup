# Production Model Preview / Export

ระบบแบ่งโมเดลออกเป็น 2 ไฟล์ต่อ TYPE:

1. `modelPath` — ใช้กับจอ Mockup ขนาดใหญ่และภาพตัวอย่างทั่วไป
2. `productionModelPath` — ใช้กับจอเล็ก “ไฟล์ผลิต” และปุ่ม “โหลดไฟล์ผลิต”

กำหนด path ได้ที่:

`src/data/plugTypes.ts`

ค่าเริ่มต้นของไฟล์ผลิต:

- `/models/plug/production/Un1-production.glb`
- `/models/plug/production/Un2-production.glb`
- `/models/plug/production/Un3-production.glb`
- `/models/plug/production/Un4-production.glb`
- `/models/plug/production/Un5-production.glb`

ให้นำไฟล์จริงไปวางใน:

`public/models/plug/production/`

## เงื่อนไขสำคัญของไฟล์ GLB ผลิต

เพื่อให้สี ลาย และโลโก้ซิงก์กับจอใหญ่โดยไม่ต้องเขียน mapping ใหม่ ชื่อ Mesh/Material ควรตรงกับโมเดลหลัก เช่น:

- `Top_Front`
- `Top_Side`
- `Bottom`
- `Swit`

หากชื่อ Mesh ของไฟล์ผลิตต่างจากไฟล์หลัก ให้แยก Production Config เพิ่มใน `src/data/plugConfig.ts` ก่อนใช้งานจริง

## พฤติกรรม Export

- ปุ่มโหลดมุมทั่วไปและ A4 ยังใช้โมเดลจอใหญ่
- ปุ่ม `🏭 โหลดไฟล์ผลิต` ใช้โมเดลจอเล็ก
- หากจอเล็กยังโหลดไม่พร้อม ระบบ fallback ไปใช้จอใหญ่เพื่อไม่ให้ปุ่มเงียบ
