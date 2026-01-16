import { createClient } from '@supabase/supabase-js';

// ใช้ Service Role Key เพื่อให้มีสิทธิ์บันทึกข้อมูลได้โดยตรง
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ตัวอย่าง Webhook ที่ถูกต้อง
export async function POST(req) {
    const body = await req.json();
    const event = body.events[0];

    if (event && event.type === 'message') {
        let content = ''; // ✅ ประกาศตัวแปรรับค่าตรงนี้
        const messageType = event.message.type;

        if (messageType === 'text') {
            content = event.message.text;
        }
        else if (messageType === 'sticker') {
            content = `https://stickershop.line-scdn.net/stickershop/v1/sticker/${event.message.stickerId}/android/sticker.png`;
        }

        // ✅ ตรวจสอบว่ามีค่าแล้วค่อย Insert
        if (content) {
            const { error } = await supabase.from('chat_messages').insert([{
                line_user_id: event.source.userId,
                message_text: content,
                message_type: messageType, // ต้องมีคอลัมน์นี้ใน DB นะครับ
                sender_type: 'user',
                is_read: true
            }]);

            if (error) console.error('Supabase Error:', error);
        }
    }
    return new Response('OK');
}