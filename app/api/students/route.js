import { createClient } from '@supabase/supabase-js';

export async function GET() {
    console.log("--- API CALL: FETCHING STUDENTS ---"); // ล็อกนี้จะขึ้นที่ VS Code
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY // ใช้ Key นี้ชัวร์กว่า
    );

    const { data, error } = await supabase
        .from('mst_personal')
        .select('*');

    if (error) {
        console.error("Supabase API Error:", error.message);
        return Response.json({ error: error.message }, { status: 500 });
    }

    console.log("Data found:", data.length, "rows");
    return Response.json(data);
}