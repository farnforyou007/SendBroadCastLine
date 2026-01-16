'use client';
import { useEffect, useState } from 'react';
import liff from '@line/liff';
import Swal from 'sweetalert2';

export default function StudentRegister() {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        studentId: '',
        firstName: '',
        lastName: '',
        phone: '',
    });

    useEffect(() => {
        // ตั้งชื่อ Title สำหรับ SEO (กรณีใช้ use client)
        document.title = "ลงทะเบียนรับข่าวสารนักศึกษา | คณะการแพทย์แผนไทย";
        document.querySelector('meta[name="description"]').setAttribute('content', 'ลงทะเบียนรับข่าวสารผ่าน LINE ของคณะการแพทย์แผนไทย มหาวิทยาลัยสงขลานครินทร์');
    }, []);

    useEffect(() => {
        const initLiff = async () => {
            try {
                await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID });
                if (!liff.isLoggedIn()) {
                    liff.login();
                } else {
                    const userProfile = await liff.getProfile();
                    setProfile(userProfile);
                }
            } catch (err) {
                console.error('LIFF Error', err);
            }
        };
        initLiff();
    }, []);

    // ฟังก์ชันสำหรับกรองให้กรอกได้เฉพาะตัวเลขและจำกัด 10 หลัก
    const handlePhoneChange = (e) => {
        const value = e.target.value.replace(/\D/g, ''); // ลบทุกอย่างที่ไม่ใช่ตัวเลข
        if (value.length <= 10) {
            setFormData({ ...formData, phone: value });
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();

        // ตรวจสอบเบอร์โทรศัพท์อีกครั้งก่อนส่ง
        if (formData.phone.length !== 10) {
            Swal.fire({
                icon: 'error',
                title: 'เบอร์โทรศัพท์ไม่ถูกต้อง',
                text: 'กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 หลัก',
                confirmButtonColor: '#3B82F6'
            });
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                // headers ต้องมีแค่ข้อมูลทางเทคนิค (ASCII เท่านั้น)
                headers: {
                    'Content-Type': 'application/json'
                },
                // ข้อมูลภาษาไทย (ชื่อ-นามสกุล) ต้องอยู่ใน body เท่านั้น
                body: JSON.stringify({
                    studentId: formData.studentId,
                    firstName: formData.firstName,
                    lastName: formData.lastName,
                    phone: formData.phone,
                    lineUserId: profile?.userId
                }),
            });

            const result = await response.json();

            if (result.success) {
                // แสดง UI แจ้งเตือนสำเร็จด้วย SweetAlert2
                Swal.fire({
                    title: 'ลงทะเบียนสำเร็จ!',
                    text: 'ข้อมูลของคุณถูกบันทึกเรียบร้อยแล้ว',
                    icon: 'success',
                    confirmButtonText: 'ตกลง',
                    confirmButtonColor: '#3B82F6',
                    backdrop: `rgba(59, 130, 246, 0.1)`
                }).then(() => {
                    liff.closeWindow(); // ปิดหน้าต่างเมื่อกดตกลง
                });
            } else {
                throw new Error(result.error);
            }
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: err.message || 'ไม่สามารถบันทึกข้อมูลได้',
                confirmButtonColor: '#EF4444'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-5 font-sans relative overflow-hidden">
            {/* Background Decor - Mesh Gradient Style */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/20 blur-[100px] rounded-full"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/20 blur-[100px] rounded-full"></div>

            <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl shadow-blue-200/50 z-10 overflow-hidden border border-white/50 backdrop-blur-sm">

                {/* Header Section */}
                <div className="pt-10 pb-6 flex flex-col items-center border-b border-slate-50">

                    <div className="relative mb-4">

                        <div className="w-24 h-24 rounded-full border-4 border-white shadow-md overflow-hidden bg-slate-100 ring-2 ring-blue-100">

                            {profile?.pictureUrl ? (
                                <img src={profile.pictureUrl} alt="profile" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-blue-200 text-3xl font-bold italic">U</div>
                            )}
                        </div>
                        <div className="absolute bottom-1 right-1 w-6 h-6 bg-green-500 border-4 border-white rounded-full"></div>
                    </div>
                    <h2 className="text-xl font-black text-slate-800">ลงทะเบียนรับข่าวสาร</h2>
                    <p className="text-slate-400 text-sm mt-1 font-medium">สวัสดีคุณ {profile?.displayName || 'Student'}</p>
                </div>

                {/* Form Section */}
                <form onSubmit={handleRegister} className="p-8 space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">รหัสนักศึกษา</label>
                        <input
                            type="text" // เปลี่ยนจาก number เป็น text เพื่อให้ maxLength ทำงานได้แม่นยำ
                            inputMode="numeric" // ช่วยให้มือถือเปิดแป้นตัวเลขขึ้นมา
                            pattern="[0-9]*" // ดักเฉพาะตัวเลข
                            maxLength={10} // จำกัด 10 ตัวอักษร
                            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700 placeholder:text-slate-300 focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-blue-200 outline-none transition-all font-semibold"
                            placeholder="XXXXXXXXXX"
                            value={formData.studentId}
                            onChange={e => {
                                const value = e.target.value.replace(/\D/g, ''); 
                                if (value.length <= 10) {
                                    setFormData({ ...formData, studentId: value });
                                }
                            }}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">ชื่อ</label>
                            <input
                                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700 placeholder:text-slate-300 focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-blue-200 outline-none transition-all font-semibold"
                                placeholder="ชื่อ"
                                value={formData.firstName}
                                onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">นามสกุล</label>
                            <input
                                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700 placeholder:text-slate-300 focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-blue-200 outline-none transition-all font-semibold"
                                placeholder="นามสกุล"
                                value={formData.lastName}
                                onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">เบอร์โทรศัพท์ (10 หลัก)</label>
                        <input
                            type="tel"
                            inputMode="numeric"
                            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700 placeholder:text-slate-300 focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-blue-200 outline-none transition-all font-semibold"
                            placeholder="0XXXXXXXXX"
                            value={formData.phone}
                            onChange={handlePhoneChange}
                            required
                        />
                    </div>

                    <button
                        disabled={loading}
                        className={`w-full py-5 rounded-2xl font-bold text-lg transition-all duration-300 active:scale-[0.98] ${loading
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-[#6366f1]/10 text-[#6366f1] hover:bg-[#6366f1] hover:text-white border border-[#6366f1]/20'
                            }`}
                    >
                        {loading ? (
                            <div className="flex items-center justify-center gap-2">
                                <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                                <span>กำลังบันทึก...</span>
                            </div>
                        ) : 'ยืนยันลงทะเบียน'}
                    </button>

                    <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-tighter opacity-70">
                        * ข้อมูลนี้ใช้เพื่อประกาศข่าวสารผ่าน LINE เท่านั้น
                    </p>
                </form>
            </div>

            <div className="mt-8 text-slate-400 text-[10px] font-black uppercase tracking-widest z-10">
                © 2026 Faculty of ... | Powered by TTM System
            </div>
        </div>
    );
}