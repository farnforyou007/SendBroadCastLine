'use client';
import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import Swal from 'sweetalert2';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function AdminDashboard() {
    const [mode, setMode] = useState('year');
    const [targetYear, setTargetYear] = useState('');
    const [tags, setTags] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const [students, setStudents] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterYear, setFilterYear] = useState('all');
    const [filterRole, setFilterRole] = useState('all');

    const Toast = Swal.mixin({
        toast: true, position: 'top-end', showConfirmButton: false, timer: 2000
    });

    const fetchStudents = async () => {
        try {
            const res = await fetch('/api/students'); // เรียกผ่าน API แทน
            if (!res.ok) throw new Error('Network response was not ok');
            const data = await res.json();

            console.log("Client received data:", data); // ล็อกนี้จะขึ้นที่ Browser
            setStudents(data || []);
        } catch (err) {
            console.error("Fetch error:", err.message);
        }
    };

    // --- ✨ ส่วนใหม่: ดึงตัวเลือก Filter จากข้อมูลจริงใน DB ---
    const dynamicOptions = useMemo(() => {
        const years = new Set();
        const roles = new Set();

        students.forEach(s => {
            // ดึงปีจาก Note (2 ตัวแรก)
            if (s.note && s.note.length >= 2) years.add(s.note.substring(0, 2));
            // ดึง Role จาก user_type (ถ้ามี Staff/Student หรือค่าอื่นๆ)
            if (s.user_type) roles.add(s.user_type.includes('/') ? s.user_type.split('/')[1] : s.user_type);
        });

        return {
            years: Array.from(years).sort((a, b) => b - a), // เรียงปีจากใหม่ไปเก่า
            roles: Array.from(roles).sort()
        };
    }, [students]);

    const filteredStudents = useMemo(() => {
        return students.filter(s => {
            const name = (s.display_name_th || s.first_name || "").toLowerCase();
            const studentId = (s.note || "").toLowerCase();
            const role = (s.user_type || "").toLowerCase();

            const matchesSearch = name.includes(searchTerm.toLowerCase()) || studentId.includes(searchTerm.toLowerCase());
            const matchesYear = filterYear === 'all' || s.note?.startsWith(filterYear);
            const matchesRole = filterRole === 'all' || role.includes(filterRole.toLowerCase());

            return matchesSearch && matchesYear && matchesRole;
        });
    }, [students, searchTerm, filterYear, filterRole]);

    // ... (handleKeyDown, removeTag, copyToClipboard, handleSend เหมือนเดิม) ...
    const handleKeyDown = (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && inputValue.trim() !== '') {
            e.preventDefault();
            if (!tags.includes(inputValue.trim())) setTags(prev => [...prev, inputValue.trim()]);
            setInputValue('');
        } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
            setTags(prev => prev.slice(0, -1));
        }
    };

    const copyToClipboard = (text) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        Toast.fire({ icon: 'success', title: 'คัดลอก Line ID แล้ว' });
    };

    const handleSend = async () => {
        let finalTarget = mode === 'year' ? targetYear : mode === 'single' ? inputValue : tags;
        if (!finalTarget || (Array.isArray(finalTarget) && finalTarget.length === 0) || !message) {
            return Toast.fire({ icon: 'warning', title: 'กรุณากรอกข้อมูลให้ครบ' });
        }
        const confirm = await Swal.fire({
            title: 'ยืนยันการประกาศ?',
            text: "ข้อความจะถูกส่งไปยังกลุ่มเป้าหมายที่เลือก",
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#3b82f6'
        });
        if (!confirm.isConfirmed) return;
        setLoading(true);
        try {
            const res = await fetch('/api/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode, target: finalTarget, message }),
            });
            const result = await res.json();
            if (result.success) {
                Toast.fire({ icon: 'success', title: `ส่งสำเร็จ ${result.count} รายการ` });
                setMessage('');
                if (mode === 'multi') setTags([]);
            } else { Swal.fire('Error', result.error, 'error'); }
        } catch (err) { Swal.fire('Error', 'Connection Failed', 'error'); }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 space-y-8 font-sans text-slate-700">
            <div className="max-w-[1600px] mx-auto space-y-8">

                {/* --- ส่วนที่ 1: ตารางรายชื่อ (Dynamic Filters) --- */}
                <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200/60 overflow-hidden">
                    <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight">Database Directory</h2>
                            <p className="text-slate-400 text-sm font-medium">จัดการรายชื่อตามข้อมูลจริงในระบบ</p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            {/* Filter Role - ดึงจาก DB */}
                            <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold outline-none text-blue-600">
                                <option value="all">ทุกประเภท ({dynamicOptions.roles.length})</option>
                                {dynamicOptions.roles.map(role => (
                                    <option key={role} value={role}>{role}</option>
                                ))}
                            </select>

                            {/* Filter Year - ดึงจาก DB */}
                            <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold outline-none text-slate-500">
                                <option value="all">ทุกชั้นปี ({dynamicOptions.years.length})</option>
                                {dynamicOptions.years.map(year => (
                                    <option key={year} value={year}>ปี {year}</option>
                                ))}
                            </select>

                            <input type="text" placeholder="ค้นหาชื่อ/รหัส..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none w-64 focus:ring-2 focus:ring-blue-100" />
                        </div>
                    </div>

                    <div className="overflow-x-auto max-h-[350px]">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest sticky top-0 z-10 border-b border-slate-100">
                                <tr>
                                    <th className="px-8 py-5">ชื่อ-นามสกุล</th>
                                    <th className="px-8 py-5">Note / ID</th>
                                    <th className="px-8 py-5">ประเภท</th>
                                    <th className="px-8 py-5 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 text-sm">
                                {filteredStudents.map((s, index) => (
                                    <tr key={s.id || index} className="hover:bg-blue-50/40 transition-colors">
                                        {/* <tr key={s.id} className="hover:bg-blue-50/40 transition-colors"> */}
                                        <td className="px-8 py-4 font-bold text-slate-700">{s.display_name_th || `${s.first_name} ${s.last_name}`}</td>
                                        <td className="px-8 py-4 font-mono text-slate-500">{s.note || '-'}</td>
                                        <td className="px-8 py-4">
                                            <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${s.user_type?.includes('Staff') ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                                                {s.user_type?.split('/')[1] || s.user_type || 'Unknown'}
                                            </span>
                                        </td>
                                        <td className="px-8 py-4 text-center">
                                            <button onClick={() => copyToClipboard(s.line_user_id)} className="bg-white border border-slate-200 text-slate-400 px-4 py-1.5 rounded-xl text-[10px] font-black hover:bg-blue-500 hover:text-white transition-all shadow-sm">COPY ID</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* --- ส่วนที่ 2: Broadcast & Preview --- */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                    <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200/60 p-10 flex flex-col justify-between">
                        <div>
                            <h1 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-3">
                                <span className="bg-blue-500/20 w-3 h-8 rounded-full"></span>
                                Broadcast Center
                            </h1>
                            <div className="flex bg-slate-50 p-1.5 rounded-2xl mb-8 border border-slate-100 text-center">
                                {['year', 'single', 'multi'].map((m) => (
                                    <button key={m} onClick={() => { setMode(m); setTags([]); setInputValue(''); }} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${mode === m ? 'bg-white text-blue-500 shadow-sm' : 'text-slate-400'}`}>
                                        {m === 'year' ? 'รายปี' : m === 'single' ? 'รายบุคคล' : 'หลายคน'}
                                    </button>
                                ))}
                            </div>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1">เป้าหมาย</label>
                                    {mode === 'multi' ? (
                                        <div className="flex flex-wrap gap-2 p-4 bg-slate-50 border border-slate-200 rounded-2xl min-h-[60px]">
                                            {tags.map((tag, index) => (
                                                <span key={index} className="flex items-center gap-1.5 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-xl text-xs font-bold animate-in zoom-in-95">{tag}<button onClick={() => setTags(tags.filter(t => t !== tag))} className="ml-1 hover:text-red-500">×</button></span>
                                            ))}
                                            <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown} className="flex-1 bg-transparent outline-none" placeholder="Type ID..." />
                                        </div>
                                    ) : (
                                        <input type="text" value={mode === 'year' ? targetYear : inputValue} onChange={(e) => mode === 'year' ? setTargetYear(e.target.value) : setInputValue(e.target.value)} placeholder={mode === 'year' ? "ระบุปี 2 หลัก" : "วาง User ID..."} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none font-medium" />
                                    )}
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1">ข้อความประกาศ</label>
                                    <textarea rows="4" value={message} onChange={(e) => setMessage(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none resize-none font-medium" placeholder="พิมพ์ข้อความ..." />
                                </div>
                            </div>
                        </div>
                        <button onClick={handleSend} disabled={loading} className="w-full mt-8 py-5 rounded-2xl font-black text-white text-lg bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all">
                            {loading ? 'SENDING...' : '🚀 BROADCAST'}
                        </button>
                    </div>

                    <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200/60 p-10 flex flex-col items-center justify-center min-h-full">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Live Preview</h3>
                        <div className="relative w-full flex justify-center items-center py-4">
                            <div className="bg-[#84a1c7] w-[260px] aspect-[9/17.5] rounded-[2.8rem] border-[10px] border-slate-900 shadow-2xl relative p-4 overflow-hidden transform scale-95">
                                <div className="bg-slate-900 h-5 w-1/3 mx-auto rounded-b-2xl mb-8"></div>
                                {message ? (
                                    <div className="flex items-start gap-2 animate-in slide-in-from-left-2">
                                        <div className="w-8 h-8 bg-slate-200/50 rounded-full flex-shrink-0 backdrop-blur-sm"></div>
                                        <div className="bg-white rounded-2xl rounded-tl-none p-3 text-[11px] leading-relaxed shadow-sm max-w-[85%] text-slate-700 break-words font-medium">
                                            {message}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-white/40 text-[9px] text-center mt-20 italic">พิมพ์ข้อความเพื่อพรีวิว...</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}