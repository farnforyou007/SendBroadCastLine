import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// export async function POST(req) {
//     try {
//         const { mode, target, message } = await req.json();
//         let userIds = [];

//         if (mode === 'year') {
//             // ดึง ID จากฐานข้อมูลตามรหัสปี (2 ตัวแรกของรหัส นศ.)
//             const { data, error } = await supabase
//                 .from('mst_personal')
//                 .select('line_user_id')
//                 .like('user_type', `%Student${target}%`)
//                 .not('line_user_id', 'is', null);

//             if (error) throw error;
//             userIds = data.map(u => u.line_user_id);
//         }
//         else if (mode === 'single') {
//             userIds = [target];
//         }
//         else if (mode === 'multi') {
//             // target ถูกส่งมาเป็น Array จากหน้าบ้านแล้ว (tags)
//             userIds = Array.isArray(target) ? target : [target];
//         }

//         if (userIds.length === 0) {
//             return Response.json({ success: false, error: 'ไม่พบรายชื่อผู้รับในระบบ' }, { status: 404 });
//         }

//         // เรียกใช้ LINE Messaging API (Multicast)
//         const lineRes = await fetch('https://api.line.me/v2/bot/message/multicast', {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json',
//                 'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
//             },
//             body: JSON.stringify({
//                 to: userIds,
//                 messages: [{ type: 'text', text: message }],
//             }),
//         });

//         const lineData = await lineRes.json();
//         if (!lineRes.ok) throw new Error(lineData.message || 'LINE API Error');

//         return Response.json({ success: true, count: userIds.length });

//     } catch (err) {
//         console.error('Broadcast Error:', err);
//         return Response.json({ success: false, error: err.message }, { status: 500 });
//     }
// }

// แก้ไขไฟล์ app/api/broadcast/route.js
export async function POST(req) {
    try {
        const { mode, target, message } = await req.json();
        let userIds = [];

        // 1. ค้นหาผู้รับตามโหมดที่เลือก
        if (mode === 'year') {
            const { data, error } = await supabase
                .from('mst_personal')
                .select('line_user_id')
                // ปรับให้ตรงกับ TTM/Student67
                .ilike('user_type', `%Student${target}%`)
                .not('line_user_id', 'is', null);

            if (error) throw error;
            userIds = data.map(u => u.line_user_id);
        } else if (mode === 'multi') {
            userIds = target;
        } else if (mode === 'single') {
            userIds = Array.isArray(target) ? target : [target];
        }

        if (userIds.length === 0) {
            return new Response(JSON.stringify({ error: 'ไม่พบรายชื่อผู้รับในระบบ' }), { status: 404 });
        }

        // 2. ส่ง LINE API (Multicast สำหรับหลายคน / Push สำหรับคนเดียว)
        const linePayload = {
            to: userIds,
            messages: [{ type: 'text', text: message }]
        };

        const lineEndpoint = userIds.length > 1
            ? 'https://api.line.me/v2/bot/message/multicast'
            : 'https://api.line.me/v2/bot/message/push';

        const lineRes = await fetch(lineEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
            },
            body: JSON.stringify(userIds.length > 1 ? linePayload : { to: userIds[0], messages: linePayload.messages }),
        });

        // 3. บันทึกลง chat_messages แยกรายคน
        const chatInserts = userIds.map(id => ({
            line_user_id: id,
            message_text: message,
            sender_type: 'admin',
            message_type: 'text'
        }));
        await supabase.from('chat_messages').insert(chatInserts);

        // ✅ ส่ง sentIds กลับไปเพื่อให้หน้าบ้านนำไปบันทึกลง broadcast_logs
        return new Response(JSON.stringify({ success: true, count: userIds.length, sentIds: userIds }), { status: 200 });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}