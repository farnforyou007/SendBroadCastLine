'use client';
import { useState } from 'react';

export default function AdminDashboard() {
    const [mode, setMode] = useState('year'); // 'year', 'single', 'multi'
    const [targetYear, setTargetYear] = useState(''); // สำหรับโหมดส่งตามปี
    const [tags, setTags] = useState([]); // สำหรับโหมดส่งหลายคน (Pills)
    const [inputValue, setInputValue] = useState(''); // ค่าที่กำลังพิมพ์ในช่อง Tag
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    // ฟังก์ชันจัดการ Tag (Pills)
    const handleKeyDown = (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && inputValue.trim() !== '') {
            e.preventDefault();
            if (!tags.includes(inputValue.trim())) {
                setTags([...tags, inputValue.trim()]);
            }
            setInputValue('');
        } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
            setTags(tags.slice(0, -1));
        }
    };

    const removeTag = (indexToRemove) => {
        setTags(tags.filter((_, index) => index !== indexToRemove));
    };

    const handleSend = async () => {
        let finalTarget;
        if (mode === 'year') finalTarget = targetYear;
        else if (mode === 'single') finalTarget = inputValue;
        else finalTarget = tags;

        if (!finalTarget || (Array.isArray(finalTarget) && finalTarget.length === 0) || !message) {
            return alert('กรุณาระบุผู้รับและข้อความให้ครบถ้วน');
        }

        setLoading(true);
        try {
            const res = await fetch('/api/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode, target: finalTarget, message }),
            });
            const result = await res.json();
            if (result.success) alert(`ส่งสำเร็จหาผู้รับ ${result.count} คน`);
            else alert('Error: ' + result.error);
        } catch (err) {
            alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-10 font-sans">
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">

                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200/60 p-8">
                        <h1 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
                            <span className="bg-blue-500/20 w-3 h-8 rounded-full"></span>
                            LINE Broadcast
                        </h1>

                        {/* Mode Selector - สีเทาอ่อนสะอาดตา */}
                        <div className="flex bg-slate-50 p-1.5 rounded-2xl mb-8 border border-slate-100">
                            {['year', 'single', 'multi'].map((m) => (
                                <button
                                    key={m}
                                    onClick={() => { setMode(m); setTags([]); setInputValue(''); }}
                                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${mode === m
                                            ? 'bg-white text-blue-500 shadow-sm'
                                            : 'text-slate-400 hover:text-slate-600'
                                        }`}
                                >
                                    {m === 'year' ? 'ส่งตามปี' : m === 'single' ? 'รายบุคคล' : 'ระบุหลายคน'}
                                </button>
                            ))}
                        </div>

                        <div className="mb-6">
                            <label className="block text-[13px] font-black uppercase tracking-[0.15em] text-slate-400 mb-3 ml-1">ผู้รับข้อความ</label>

                            {mode === 'multi' ? (
                                /* Tags Input - ปรับสีให้อ่อนลง (Soft Blue Pills) */
                                <div className="flex flex-wrap gap-2 p-4 bg-slate-50/50 border border-slate-200 rounded-2xl min-h-[70px] focus-within:ring-4 focus-within:ring-blue-500/5 focus-within:border-blue-200 transition-all duration-300">
                                    {tags.map((tag, index) => (
                                        <span
                                            key={index}
                                            className="flex items-center gap-1.5 bg-blue-50 text-blue-600 border border-blue-100 pl-3 pr-1.5 py-1.5 rounded-xl text-sm font-semibold animate-in zoom-in-95"
                                        >
                                            {tag}
                                            <button
                                                onClick={() => removeTag(index)}
                                                className="hover:bg-blue-100 text-blue-400 hover:text-blue-600 rounded-lg w-5 h-5 flex items-center justify-center transition-colors"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                    <input
                                        type="text"
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder={tags.length === 0 ? "พิมพ์ ID แล้วกด Enter..." : ""}
                                        className="flex-1 bg-transparent outline-none text-slate-600 min-w-[150px] py-1 placeholder:text-slate-300"
                                    />
                                </div>
                            ) : (
                                /* Input ทั่วไป */
                                <input
                                    type="text"
                                    value={mode === 'year' ? targetYear : inputValue}
                                    onChange={(e) => mode === 'year' ? setTargetYear(e.target.value) : setInputValue(e.target.value)}
                                    placeholder={mode === 'year' ? "ระบุรหัสปี 2 หลัก" : "วาง Line User ID ที่นี่"}
                                    className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl px-6 py-4 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-200 outline-none transition-all text-slate-600 font-medium placeholder:text-slate-300"
                                />
                            )}
                        </div>

                        <div className="mb-8">
                            <label className="block text-[13px] font-black uppercase tracking-[0.15em] text-slate-400 mb-3 ml-1">ข้อความประกาศ</label>
                            <textarea
                                rows="5"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="พิมพ์ข้อความที่ต้องการส่ง..."
                                className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl px-6 py-4 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-200 outline-none transition-all resize-none text-slate-600 font-medium placeholder:text-slate-300"
                            ></textarea>
                        </div>

                        {/* ปุ่มส่ง - ปรับเป็นสีน้ำเงินสะอาด (Royal Blue) */}
                        <button
                            onClick={handleSend}
                            disabled={loading}
                            className={`w-full py-5 rounded-2xl font-bold text-white text-lg transition-all duration-300 active:scale-[0.98] ${loading
                                    ? 'bg-slate-200 text-slate-400'
                                    : 'bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-500/20'
                                }`}
                        >
                            {loading ? 'กำลังส่งข้อมูล...' : 'ส่งข้อความประกาศ'}
                        </button>
                    </div>
                </div>

                {/* Preview Section - ปรับสีพื้นหลังจำลองแชทให้ซอฟต์ลง */}
                <div className="hidden lg:block">
                    <div className="sticky top-10">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 ml-4">Live Preview</h3>
                        <div className="bg-[#84a1c7] w-full aspect-[9/18.5] rounded-[3.5rem] border-[12px] border-slate-900 shadow-2xl relative p-5">
                            <div className="bg-slate-900 h-6 w-1/3 mx-auto rounded-b-3xl mb-8"></div>
                            {message && (
                                <div className="flex items-start gap-2.5 animate-in slide-in-from-left-3 duration-300">
                                    <div className="w-9 h-9 bg-slate-200/50 rounded-full flex-shrink-0 backdrop-blur-sm"></div>
                                    <div className="bg-white rounded-2xl rounded-tl-none p-3.5 text-[13px] leading-relaxed shadow-sm max-w-[85%] text-slate-700">
                                        {message}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}