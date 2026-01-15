import { createClient } from '@supabase/supabase-js';

export async function GET() {
    // ใช้ Service Role Key (ตัวล่าง) ในฝั่ง Server เท่านั้น
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data, error } = await supabaseAdmin
        .from('mst_personal') // << เช็คชื่อตารางใน Supabase อีกครั้งว่าตรงมั้ย
        .select('*');

    if (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data);
}