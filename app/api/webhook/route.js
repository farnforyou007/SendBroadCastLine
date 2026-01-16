import { createClient } from '@supabase/supabase-js';

// ใช้ Service Role Key เพื่อให้มีสิทธิ์บันทึกข้อมูลได้โดยตรง
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
    try {
        const body = await req.json();
        const event = body.events[0];

        // ตรวจสอบว่าเป็นข้อความประเภท Text
        if (event && event.type === 'message' && event.message.type === 'text') {
            const lineUserId = event.source.userId;
            const text = event.message.text;

            // บันทึกลงตาราง chat_messages (รันเลข ID อัตโนมัติ)
            const { error } = await supabase.from('chat_messages').insert([{
                line_user_id: lineUserId,
                message_text: text,
                sender_type: 'user' // ระบุว่าเป็นข้อความจากนักศึกษา
            }]);

            if (error) console.error('Error saving message:', error);
        }

        return new Response('OK', { status: 200 });
    } catch (err) {
        console.error('Webhook Error:', err);
        return new Response('Error', { status: 500 });
    }
}