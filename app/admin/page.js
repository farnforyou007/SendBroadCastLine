'use client';
import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import Swal from 'sweetalert2';
import {
    Search,
    ChevronDown,
    Copy,
    Send,
    User,
    Users,
    Calendar,
    Check,
    RefreshCw,
    MessageSquare,
    ChevronLeft,
    ChevronRight,
    X
} from 'lucide-react';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function AdminDashboard() {
    // --- Table & Filter States ---
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterYear, setFilterYear] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // --- Broadcast States ---
    const [mode, setMode] = useState('year');
    const [selectedName, setSelectedName] = useState('');
    const [targetYear, setTargetYear] = useState('');
    const [tags, setTags] = useState([]);
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);

    const Toast = Swal.mixin({
        toast: true, position: 'top-end', showConfirmButton: false, timer: 2000
    });

    useEffect(() => { fetchStudents(); }, []);

    const fetchStudents = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('mst_personal')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            setStudents(data || []);
        } catch (err) {
            Swal.fire('Error', 'ไม่สามารถดึงข้อมูลได้', 'error');
        } finally { setLoading(false); }
    };

    const dynamicYears = useMemo(() => {
        const years = new Set();
        students.forEach(s => { if (s.note && s.note.length >= 2) years.add(s.note.substring(0, 2)); });
        return Array.from(years).sort((a, b) => b - a);
    }, [students]);

    // 1. เพิ่มฟังก์ชันเลื่อนหน้าจอ
    const scrollToBroadcast = () => {
        const element = document.getElementById('broadcast-section');
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };
    // --- แก้ไขฟังก์ชัน handleSelectRow ให้ฉลาดขึ้น ---
    const handleSelectRow = (student) => {
        const id = student.line_user_id;
        const name = student.display_name_th || student.first_name;
        if (!id) return;

        if (mode === 'year' || mode === 'single') {
            setMode('single');
            setTargetYear(id);
            setSelectedName(name);
            setTags([]);
            Toast.fire({ icon: 'success', title: `เลือก: ${name}` });

            // 2. เรียกใช้การเลื่อนหน้าจอ
            setTimeout(scrollToBroadcast, 100);
        }
        else if (mode === 'multi') {
            const exists = tags.find(t => t.id === id);
            if (!exists) {
                setTags(prev => [...prev, { id, name }]);
            } else {
                setTags(prev => prev.filter(t => t.id !== id));
            }
        }
    };
    const filteredStudents = useMemo(() => {
        return students.filter(s => {
            const name = (s.display_name_th || s.first_name || "").toLowerCase();
            const studentId = (s.note || "").toLowerCase();
            const matchesSearch = name.includes(searchTerm.toLowerCase()) || studentId.includes(searchTerm.toLowerCase());
            const matchesYear = filterYear === 'all' || s.note?.startsWith(filterYear);
            return matchesSearch && matchesYear;
        });
    }, [students, searchTerm, filterYear]);

    const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
    const currentItems = filteredStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    useEffect(() => { setCurrentPage(1); }, [searchTerm, filterYear, itemsPerPage]);

    const handleSend = async () => {
        let finalTarget = mode === 'year' ? targetYear : mode === 'single' ? targetYear : tags.map(t => t.id);

        if (!finalTarget || (Array.isArray(finalTarget) && finalTarget.length === 0) || !message) {
            return Toast.fire({ icon: 'warning', title: 'กรุณาระบุเป้าหมายและข้อความ' });
        }

        const confirm = await Swal.fire({
            title: 'ยืนยันการประกาศ?',
            text: `คุณกำลังจะส่งข้อความหากลุ่มเป้าหมายที่เลือก`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#475569',
            confirmButtonText: 'ยืนยันส่ง',
            cancelButtonText: 'ยกเลิก'
        });

        if (!confirm.isConfirmed) return;

        setIsSending(true);
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
                if (mode === 'single') { setSelectedName(''); setTargetYear(''); }
            } else {
                Swal.fire('Error', result.error || 'เกิดข้อผิดพลาดในการส่ง', 'error');
            }
        } catch (err) {
            Swal.fire('Error', 'การเชื่อมต่อล้มเหลว', 'error');
        } finally {
            setIsSending(false);
        }
    };

    useEffect(() => {
        // 1. สร้าง Channel สำหรับฟังการเปลี่ยนแปลงในตาราง mst_personal
        const channel = supabase
            .channel('realtime_students')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'mst_personal' },
                (payload) => {
                    console.log('พบคนลงทะเบียนใหม่:', payload.new);
                    // 2. เมื่อมีข้อมูลใหม่ ให้อัปเดต State โดยเอาคนใหม่ไปวางไว้หน้าสุด
                    setStudents((prev) => [payload.new, ...prev]);

                    // 3. แจ้งเตือนแอดมินเบาๆ ด้วย Toast
                    Toast.fire({
                        icon: 'info',
                        title: `มีคนลงทะเบียนใหม่: ${payload.new.display_name_th || payload.new.first_name}`
                    });
                }
            )
            .subscribe();

        // 4. ยกเลิกการฟังเมื่อปิดหน้าเพจ เพื่อประหยัดทรัพยากร
        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase]);

    useEffect(() => {
        // ฟังการเปลี่ยนแปลงจาก Supabase
        const channel = supabase
            .channel('realtime_mst_personal')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'mst_personal' },
                (payload) => {
                    // เพิ่มข้อมูลใหม่ลงในหน้าแรกของตารางทันที
                    setStudents((prev) => [payload.new, ...prev]);

                    // แจ้งเตือนแอดมิน
                    Toast.fire({
                        icon: 'info',
                        title: `พบผู้ลงทะเบียนใหม่: ${payload.new.display_name_th || payload.new.first_name}`
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel); // ปิดการเชื่อมต่อเมื่อออกหน้า
        };
    }, [supabase]);


    return (
        <div className="min-h-screen p-6 md:p-12 space-y-10 font-['Prompt'] bg-[#F8FAFC]">
            <div className="max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-700">

                {/* Header & Filter Section คงเดิม */}
                <div className="flex justify-between items-end">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-bold text-[#1e293b] tracking-tight">จัดการรายชื่อนักศึกษา</h1>
                        <p className="text-[#64748b] text-sm font-medium">จัดการข้อมูลบรอดแคสต์สมาชิกในระบบ</p>
                    </div>
                    <button onClick={fetchStudents} className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all shadow-sm active:scale-95">
                        <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                <div className="flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative w-full md:w-72 group">
                        <Calendar className="absolute left-5 top-3.5 w-4 h-4 text-slate-400 group-focus-within:text-slate-600 transition-colors" />
                        <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="w-full bg-white border border-slate-200 rounded-full pl-12 pr-10 py-3.5 outline-none focus:ring-4 focus:ring-slate-100 appearance-none cursor-pointer font-medium text-[#334155] shadow-sm transition-all">
                            <option value="all">เลือกชั้นปีทั้งหมด</option>
                            {dynamicYears.map(year => <option key={year} value={year}>นักศึกษารหัสปี {year}</option>)}
                        </select>
                        <ChevronDown className="absolute right-5 top-4 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>

                    <div className="relative flex-1 w-full group">
                        <Search className="absolute left-5 top-4 h-4 w-4 text-slate-400 group-focus-within:text-slate-600 transition-colors" />
                        <input type="text" placeholder="ค้นหาชื่อ หรือ รหัสนักศึกษา..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-white border border-slate-200 rounded-full px-12 py-3.5 outline-none focus:ring-4 focus:ring-slate-100 transition-all text-slate-600 shadow-sm font-medium" />
                    </div>
                </div>

                {/* Data Table - ลบปุ่มจัดการออกเพื่อให้ดูสะอาดตา */}
                <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden">
                    <div className="p-7 border-b border-slate-50 flex justify-between items-center bg-white/50">
                        <div className="text-xs font-bold text-slate-400 flex items-center gap-2 tracking-widest uppercase">
                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]"></span>
                            แสดงทั้งหมด {filteredStudents.length} รายชื่อ
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                            แสดงหน้าละ
                            <select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))} className="bg-slate-100 rounded-lg px-2 py-1 outline-none border-none cursor-pointer">
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                            </select>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-[#f8fafc] text-slate-600 text-[13px] font-mediam uppercase tracking-widest border-b border-slate-100">

                                <tr>{mode === 'multi' && <th className="px-8 py-5 w-16 text-center">เลือก</th>}
                                    <th className="px-8 py-5 w-20 text-center">ลำดับ</th>
                                    <th className="px-8 py-5">รหัสนักศึกษา</th>
                                    <th className="px-8 py-5">ชื่อ - นามสกุล</th>
                                    <th className="px-8 py-5">เบอร์โทรศัพท์</th>
                                    <th className="px-8 py-5 text-center">เลือกส่ง</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    <tr><td colSpan="6" className="py-20 text-center text-slate-400 font-medium animate-pulse">กำลังโหลดข้อมูล...</td></tr>
                                ) : currentItems.map((s, index) => (
                                    <tr key={s.id} onClick={() => handleSelectRow(s)} className="hover:bg-slate-50/80 transition-all cursor-pointer group">
                                        {mode === 'multi' && (
                                            <td className="px-8 py-5 text-center">
                                                <div className={`w-5 h-5 mx-auto rounded-md border-2 transition-all flex items-center justify-center ${tags.find(t => t.id === s.line_user_id) ? 'bg-[#1e293b] border-[#1e293b] scale-110' : 'border-slate-200 bg-white'}`}>
                                                    {tags.find(t => t.id === s.line_user_id) && <Check className="w-3.5 h-3.5 text-white" strokeWidth={4} />}
                                                </div>
                                            </td>
                                        )}
                                        <td className="text-[8px] px-8 py-5 text-center text-slate-400 font-medium italic">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                                        <td className="text-[8px] px-8 py-5">
                                            <span className="bg-slate-100 text-slate-500 px-3.5 py-1.5 rounded-full text-[11px] font-medium border border-slate-200 shadow-sm uppercase">
                                                {s.note || '-'}
                                            </span>
                                        </td>
                                        <td className="text-[15px] px-8 py-5 whitespace-nowrap">
                                            <div className="font-semibold text-[#334155] min-w-[150px]">
                                                {s.display_name_th || s.first_name}
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <span className={`text-[9px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${s.user_type === 'admin'
                                                        ? 'bg-purple-50 text-purple-600 border border-purple-100'
                                                        : 'bg-blue-50 text-blue-600 border border-blue-100'
                                                    }`}>
                                                    {s.user_type || 'Student'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="text-[13px] px-8 py-5 font-medium text-[#475569]">{s.phone || '-'}</td>
                                        <td className="px-8 py-5 text-center">
                                            <div
                                                className={`inline-flex items-center justify-center w-10 h-10 rounded-2xl transition-all duration-300 ${
                                                    // ถ้าเลือกคนนี้อยู่ในโหมด Single หรืออยู่ในรายชื่อ Tags ของโหมด Multi
                                                    (mode === 'single' && targetYear === s.line_user_id) ||
                                                        (mode === 'multi' && tags.find(t => t.id === s.line_user_id))
                                                        ? 'bg-slate-800 text-white shadow-lg scale-110'
                                                        : 'bg-slate-50 text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-600'
                                                    }`}
                                            >
                                                {mode === 'multi' && tags.find(t => t.id === s.line_user_id) ? (
                                                    <Check className="w-4 h-4" strokeWidth={3} />
                                                ) : (
                                                    <MessageSquare className="w-4 h-4" />
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Footer คงเดิม */}
                    <div className="p-6 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-white/50 backdrop-blur-sm font-['Prompt']">
                        {/* <div className="text-[13px] font-bold text-slate-500 flex items-center gap-2">
                            <span className="text-slate-900 font-black text-sm">ทั้งหมด {filteredStudents.length}</span> รายชื่อ
                        </div> */}
                        <div className="text-[13px] font-medium text-slate-500 flex items-center gap-2">
                            {mode === 'multi' && (
                                <>
                                    เลือกไว้แล้ว <span className="text-[#334155] font-black text-base">{tags.length}</span> รายชื่อ
                                    {tags.length > 0 && (
                                        <button
                                            onClick={() => setTags([])}
                                            className="ml-1 text-[10px] text-rose-500 hover:text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100 transition-colors"
                                        >
                                            ล้างทั้งหมด
                                        </button>
                                    )}
                                    <span className="text-slate-300 mx-1">|</span>
                                </>
                            )}
                            หน้าปัจจุบัน <span className="text-slate-900 font-bold">{filteredStudents.length > 0 ? currentPage : 0}</span> / {totalPages || 0}
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="flex items-center justify-center w-10 h-10 rounded-2xl border border-slate-200 text-slate-400 disabled:opacity-20 hover:bg-slate-50 hover:text-slate-800 transition-all shadow-sm active:scale-90">
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <div className="flex gap-1.5">
                                {[...Array(totalPages)].map((_, i) => (
                                    <button key={i + 1} onClick={() => setCurrentPage(i + 1)} className={`w-10 h-10 rounded-2xl text-sm font-bold transition-all ${currentPage === i + 1 ? 'bg-[#1e293b] text-white shadow-xl shadow-slate-300 scale-105' : 'text-slate-400 hover:bg-slate-100'}`}>
                                        {i + 1}
                                    </button>
                                ))}
                            </div>
                            <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} className="flex items-center justify-center w-10 h-10 rounded-2xl border border-slate-200 text-slate-400 disabled:opacity-20 hover:bg-slate-50 hover:text-slate-800 transition-all shadow-sm active:scale-90">
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Broadcast & Preview Layout */}
                <div  className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch pb-20 font-['Prompt']">

                    {/* Broadcast Center คงเดิม */}
                    <div id="broadcast-section" className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-xl shadow-slate-200/30 flex flex-col h-full">
                        {/* หัวข้อส่วนบรอดแคสต์ (New Header) */}
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-600 shadow-inner">
                                <Send className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-[#1e293b] tracking-tight">ส่งข้อความบรอดแคสต์</h2>
                                <p className="text-[#94a3b8] text-[12px] font-medium uppercase tracking-wider">Broadcast Message Center</p>
                            </div>
                        </div>

                        {/* ส่วนเลือกโหมด (Mode Switcher) */}
                        <div className="flex bg-[#f1f5f9] p-1.5 rounded-full mb-8 border border-slate-200 shadow-inner">
                            {['year', 'single', 'multi'].map(m => (
                                <button
                                    key={m}
                                    onClick={() => { setMode(m); setTags([]); setSelectedName(''); setTargetYear(''); }}
                                    className={`flex-1 py-3 rounded-full text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 ${mode === m ? 'bg-white text-slate-800 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {m === 'year' ? <Calendar className="w-4 h-4" /> : m === 'single' ? <User className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                                    {m === 'year' ? 'ตามชั้นปี' : m === 'single' ? 'รายบุคคล' : 'หลายคน'}
                                </button>
                            ))}
                        </div>

                        <div className="space-y-6 flex-grow">
                            <div>
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 block px-2 italic">รายชื่อที่ต้องการส่ง</label>
                                {mode === 'year' ? (
                                    <div className="relative group">
                                        <div className="absolute left-6 top-4.5 z-10"><Calendar className="w-4.5 h-4.5 text-slate-400" /></div>
                                        <select value={targetYear} onChange={(e) => setTargetYear(e.target.value)} className="w-full bg-[#f8fafc] border border-slate-200 rounded-full pl-14 pr-12 py-4.5 outline-none font-bold text-[#1e293b] appearance-none cursor-pointer focus:ring-4 focus:ring-slate-100 transition-all shadow-inner">
                                            <option value="">เลือกชั้นปีที่ต้องการส่ง...</option>
                                            {dynamicYears.map(year => <option key={year} value={year}>นักศึกษารหัสปี {year}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-6 top-5 w-4 h-4 text-slate-400 pointer-events-none" />
                                    </div>
                                ) : mode === 'multi' ? (
                                    <div className="flex flex-wrap gap-2 p-4 bg-[#f8fafc] border-2 border-dashed border-slate-200 rounded-[2rem] min-h-[90px] transition-all">
                                        {tags.length > 0 ? tags.map(t => (
                                            <span key={t.id} className="bg-slate-100 text-slate-600 pl-3 pr-1 py-1.5 rounded-full text-[11px] font-medium flex items-center gap-1.5 border border-slate-200 shadow-sm animate-in zoom-in-50">
                                                {t.name}
                                                <button onClick={() => setTags(tags.filter(i => i.id !== t.id))} className="hover:bg-slate-200 p-0.5 rounded-full transition-colors text-slate-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                                            </span>
                                        )) : <span className="text-slate-300 font-medium text-sm italic py-4 w-full text-center">คลิกเลือกรายชื่อจากตารางด้านบน...</span>}
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <div className="absolute left-6 top-4.5"><User className="w-4.5 h-4.5 text-slate-400" /></div>
                                        <input type="text" readOnly value={selectedName} placeholder="คลิกเลือกรายชื่อจากตารางด้านบน..." className="w-full bg-[#f8fafc] border border-slate-200 rounded-full pl-14 pr-6 py-4.5 outline-none font-bold text-[#1e293b] placeholder:font-medium placeholder:text-slate-300 shadow-inner cursor-default" />
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 block px-2 italic">รายละเอียดข้อความ</label>
                                <textarea rows="12" value={message} onChange={(e) => setMessage(e.target.value)} className="w-full bg-[#f8fafc] border border-slate-200 rounded-[2.5rem] px-8 py-6 outline-none font-medium focus:ring-4 focus:ring-slate-100 transition-all resize-none shadow-inner" placeholder="พิมพ์ข้อความประกาศ..." />
                            </div>

                            <button onClick={handleSend} disabled={isSending} className="w-full py-5 rounded-full bg-slate-600 hover:bg-slate-700 text-white font-bold text-lg shadow-[0_10px_20px_rgba(71,85,105,0.2)] flex items-center justify-center gap-3 active:scale-[0.98] transition-all group">
                                <Send className={`w-5 h-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1 ${isSending ? 'animate-pulse' : ''}`} />
                                {isSending ? 'กำลังประมวลผล...' : 'ส่งประกาศผ่าน LINE'}
                            </button>
                        </div>
                    </div>

                    {/* Live Preview - แก้ไขข้อความไหลออกข้าง */}
                    {/* Live Preview - ปรับขนาดจอกว้างขึ้น */}
                    <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-xl shadow-slate-200/30 flex flex-col items-center justify-center h-full">
                        <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-2 italic">
                            <span className="w-4 h-[1px] bg-slate-200"></span> Live Preview <span className="w-4 h-[1px] bg-slate-200"></span>
                        </div>
                        {/* ปรับ w-[320px] กว้างขึ้น */}
                        <div className="bg-[#94A3B8] w-[320px] aspect-[9/18] rounded-[3.5rem] border-[12px] border-slate-900 shadow-2xl relative p-6 transform scale-90 transition-transform hover:scale-95 duration-1000 overflow-hidden">
                            <div className="bg-slate-900 h-6 w-1/3 mx-auto rounded-b-3xl mb-12 shadow-md"></div>
                            {message ? (
                                <div className="flex items-start gap-3 animate-in slide-in-from-left-3 duration-500">
                                    <div className="w-10 h-10 bg-slate-400 rounded-full flex-shrink-0 border-2 border-white/20 shadow-sm"></div>
                                    <div className="bg-white rounded-2xl rounded-tl-none p-4 text-[13px] leading-relaxed shadow-xl text-slate-700 font-medium border-l-4 border-[#1e293b] max-w-[210px] break-words whitespace-pre-wrap">
                                        {message}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-[70%] text-white/30 space-y-4 italic">
                                    <MessageSquare className="w-14 h-14 opacity-30" strokeWidth={1} />
                                    <p className="text-[10px] tracking-widest uppercase font-bold text-center px-4">Ready to Broadcast</p>
                                </div>
                            )}
                        </div>
                        {/* </div> */}
                    </div>
                </div>
            </div>
        </div >
    );
}