import { createClient } from '@supabase/supabase-js';

// ใช้ Service Role Key เพื่อให้มีสิทธิ์เขียนข้อมูลลงตาราง
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
    try {
        const body = await req.json();
        const { studentId, firstName, lastName, phone, lineUserId } = body;

        // 1. ตรวจสอบข้อมูลเบื้องต้น
        if (!studentId || !lineUserId) {
            return Response.json({ success: false, error: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 });
        }

        // 2. Logic ตัดรหัส นศ. 2 ตัวแรกเพื่อหาชั้นปี (เช่น 661141... -> 66)
        const yearPrefix = studentId.substring(0, 2);

        // 3. บันทึกลง Supabase
        const { data, error } = await supabase
            .from('mst_personal')
            .insert([
                {
                    user_type: `TTM/Student${yearPrefix}`, // แยกประเภทตามปีอัตโนมัติ
                    first_name: firstName,
                    last_name: lastName,
                    phone: phone,
                    line_user_id: lineUserId,
                    display_name_th: `${firstName} ${lastName}`,
                    note: studentId,
                    status: 'yes'
                }
            ])
            .select();

        if (error) {
            // ตรวจสอบกรณีรหัสซ้ำ (ถ้าตั้งค่ารหัส นศ. เป็น Unique)
            if (error.code === '23505') {
                throw new Error('รหัสนักศึกษานี้เคยลงทะเบียนไว้แล้ว');
            }
            throw error;
        }

        return Response.json({ success: true, data: data[0] });

    } catch (err) {
        console.error('Registration Error:', err.message);
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}