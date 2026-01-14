import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
    try {
        const { mode, target, message } = await req.json();
        let userIds = [];

        if (mode === 'year') {
            // ดึง ID จากฐานข้อมูลตามรหัสปี (2 ตัวแรกของรหัส นศ.)
            const { data, error } = await supabase
                .from('mst_personal')
                .select('line_user_id')
                .like('user_type', `%Student${target}%`)
                .not('line_user_id', 'is', null);

            if (error) throw error;
            userIds = data.map(u => u.line_user_id);
        }
        else if (mode === 'single') {
            userIds = [target];
        }
        else if (mode === 'multi') {
            // target ถูกส่งมาเป็น Array จากหน้าบ้านแล้ว (tags)
            userIds = Array.isArray(target) ? target : [target];
        }

        if (userIds.length === 0) {
            return Response.json({ success: false, error: 'ไม่พบรายชื่อผู้รับในระบบ' }, { status: 404 });
        }

        // เรียกใช้ LINE Messaging API (Multicast)
        const lineRes = await fetch('https://api.line.me/v2/bot/message/multicast', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
            },
            body: JSON.stringify({
                to: userIds,
                messages: [{ type: 'text', text: message }],
            }),
        });

        const lineData = await lineRes.json();
        if (!lineRes.ok) throw new Error(lineData.message || 'LINE API Error');

        return Response.json({ success: true, count: userIds.length });

    } catch (err) {
        console.error('Broadcast Error:', err);
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}