วางไฟล์ GLB สำหรับส่งผลิตไว้ในโฟลเดอร์นี้ โดยใช้ชื่อ:

Un1-production.glb
Un2-production.glb
Un3-production.glb
Un4-production.glb
Un5-production.glb

จอใหญ่ยังใช้ไฟล์เดิมใน /public/models/plug/
จอเล็ก "ไฟล์ผลิต" และปุ่ม "โหลดไฟล์ผลิต" จะใช้ไฟล์ในโฟลเดอร์นี้

สำคัญ:
- ชื่อ Mesh/Material ในไฟล์ผลิตควรตรงกับไฟล์ Mockup หลัก
- อย่างน้อยควรมี Top_Front, Top_Side, Bottom และ Swit ตามแต่ละ TYPE
- หากต้องการเปลี่ยนชื่อไฟล์หรือ path แก้ได้ที่ src/data/plugTypes.ts
