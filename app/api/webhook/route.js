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
        if (event.message.type === 'text') {
            content = event.message.text;
        }
        else if (event.message.type === 'sticker') {
            // ดึง URL รูปภาพสติกเกอร์จาก LINE CDN โดยใช้ stickerId
            // รูปนี้จะเป็นไฟล์ .png ที่แสดงผลบนเว็บได้ทันที
            content = `https://stickershop.line-scdn.net/stickershop/v1/sticker/${event.message.stickerId}/android/sticker.png`;
        }

        if (content) {
            await supabase.from('chat_messages').insert([{
                line_user_id: lineUserId,
                message_text: content,
                // เพิ่มคอลัมน์นี้เพื่อแยกประเภท (ถ้ามี) หรือใช้เช็คจากข้อความเอาภายหลังได้ครับ
                message_type: event.message.type,
                sender_type: 'user'
            }]);
        }

        return new Response('OK', { status: 200 });
    } catch (err) {
        console.error('Webhook Error:', err);
        return new Response('Error', { status: 500 });
    }
}