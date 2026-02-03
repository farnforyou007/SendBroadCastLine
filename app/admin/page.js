'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import Swal from 'sweetalert2';
import Image from 'next/image';

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
    X,
    GraduationCap, // เพิ่มอันนี้
    Zap,
    Trash,

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

    // state chat
    const [chatMessages, setChatMessages] = useState([]);
    const [activeChatId, setActiveChatId] = useState(null); // เก็บ ID คนที่เรากำลังคุยด้วย

    const chatEndRef = useRef(null);
    const [broadcastLogs, setBroadcastLogs] = useState([]);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [onlyUnread, setOnlyUnread] = useState(false); // ✅ เพิ่มตัวนี้
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        background: '#ffffff',
        // ✅ ใส่ Animation ตอนเด้งเข้า-ออก
        showClass: {
            popup: 'animate__animated animate__fadeInRight animate__faster'
        },
        hideClass: {
            popup: 'animate__animated animate__fadeOutRight animate__faster'
        },
        // ✅ ตกแต่งกรอบให้โค้งมนและมีเงา
        customClass: {
            popup: 'rounded-[1.5rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] border border-slate-50',
            title: 'text-slate-800 font-bold text-[15px]',
            htmlContainer: 'text-slate-500 text-[13px] font-medium'
        },
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer)
            toast.addEventListener('mouseleave', Swal.resumeTimer)
        }
    });

    // 1. เพิ่ม State สำหรับเก็บจำนวน Unread
    const [unreadCounts, setUnreadCounts] = useState({});

    // 2. ฟังก์ชันดึงจำนวนข้อความที่ยังไม่อ่านทั้งหมด
    const fetchUnreadCounts = async () => {
        const { data, error } = await supabase
            .from('chat_messages')
            .select('line_user_id')
            .eq('sender_type', 'user')
            .eq('is_read', false);

        if (!error) {
            // นับจำนวนแยกตามรายชื่อ
            const counts = data.reduce((acc, msg) => {
                acc[msg.line_user_id] = (acc[msg.line_user_id] || 0) + 1;
                return acc;
            }, {});
            setUnreadCounts(counts);
        }
    };

    const getStudentName = (lineUserId) => {
        if (!students || students.length === 0) return 'กำลังโหลด...';
        const student = students.find(s => s.line_user_id === lineUserId);
        return student ? (student.display_name_th || student.first_name) : 'นักศึกษาใหม่';
    };

    // 2. ปรับปรุง useEffect สำหรับ Realtime
    useEffect(() => {
        // ฟังก์ชันดึงเลข Unread (ตัวเดิมที่คุณทำไว้)
        fetchUnreadCounts();

        const channel = supabase
            .channel('chat_notifications')
            .on('postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chat_messages',
                    filter: "sender_type=eq.user" // ✅ ฟังเฉพาะข้อความที่ส่งมาจากฝั่ง User
                },
                (payload) => {
                    const newMessage = payload.new;
                    const senderName = getStudentName(newMessage.line_user_id);
                    // อัปเดต State unreadCounts โดยการบวกเพิ่ม 1 ใน ID นั้นๆ
                    setUnreadCounts(prev => ({
                        ...prev,
                        [newMessage.line_user_id]: (prev[newMessage.line_user_id] || 0) + 1
                    }));

                    let displayMsg = "";
                    // ✅ เช็คประเภทจาก message_type หรือข้อความที่เป็นลิงก์สติกเกอร์
                    if (newMessage.message_type === 'sticker' || (newMessage.message_text && newMessage.message_text.includes('stickershop'))) {
                        displayMsg = "ส่งสติกเกอร์ถึงคุณ... 🧸";
                    } else if (newMessage.message_type === 'image') {
                        displayMsg = "ส่งรูปภาพถึงคุณ... 🖼️";
                    } else {
                        displayMsg = newMessage.message_text || "ส่งข้อความถึงคุณ...";
                    }

                    showCustomToast(senderName, displayMsg);
                    // fetchUnreadCounts(); // ✅ อัปเดตเลข Badge ในตารางทันที

                    // ถ้าคุยกับคนนี้อยู่ ให้ดึงแชทใหม่มาโชว์
                    if (mode === 'single' && targetYear === newMessage.line_user_id) {
                        fetchChatMessages(newMessage.line_user_id);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [students, mode, targetYear]); // ใส่ dependencies ให้ครบเพื่อให้ Logic เช็คชื่อและแชทปัจจุบันทำงานได้

    const showCustomToast = (name, msg) => {
        Swal.fire({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 5000,
            timerProgressBar: true,
            background: '#ffffff',
            html: `
            <div style="display: flex; align-items: center; gap: 12px; text-align: left;">
                <div style="background: #eef2ff; padding: 10px; border-radius: 14px;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>
                </div>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 800; font-size: 13px; color: #1e293b; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.5px;">ข้อความใหม่</div>
                    <div style="font-weight: 600; font-size: 14px; color: #6366f1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</div>
                    <div style="font-weight: 500; font-size: 12px; color: #64748b; margin-top: 1px;">${msg}</div>
                </div>
            </div>
        `,
            showClass: {
                popup: 'animate__animated animate__fadeInRight animate__faster'
            },
            hideClass: {
                popup: 'animate__animated animate__fadeOutRight animate__faster'
            },
            customClass: {
                popup: 'rounded-[1.5rem] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] border border-slate-100'
            }
        });
    };


    // ตัวอย่างการดึงข้อมูล unread แบบง่ายๆ ใน useEffect
    useEffect(() => {
        const fetchUnread = async () => {
            const { data } = await supabase
                .from('chat_messages')
                .select('line_user_id')
                .eq('sender_type', 'user')
                .eq('is_read', false);

            const counts = data.reduce((acc, msg) => {
                acc[msg.line_user_id] = (acc[msg.line_user_id] || 0) + 1;
                return acc;
            }, {});
            setUnreadCounts(counts);
        };

        fetchUnread();
        // ถ้าอยากให้ Real-time ต้องทำ Subscription เพิ่มเติมครับ
    }, []);


    const fetchLogs = async () => {
        // 1. ดึงข้อมูล Log
        const { data: logs, error: logsError } = await supabase
            .from('broadcast_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);

        if (logsError) return;

        // 2. ดึงข้อมูลนักศึกษามาไว้สำหรับเทียบชื่อ
        const { data: studentsData } = await supabase
            .from('mst_personal')
            .select('line_user_id, display_name_th, first_name');

        // 3. แปลงข้อมูล Log ให้มีชื่อนักศึกษา (student_name)
        const formattedData = logs.map(log => {
            let nameList = [];

            // ✅ ตรวจสอบว่า target_id มีหลายคน (คั่นด้วย comma) หรือไม่
            if (log.target_id && log.target_id.includes(',')) {
                const ids = log.target_id.split(',');
                // วนลูปหาชื่อทุกคนจาก IDs
                nameList = ids.map(id => {
                    const student = studentsData?.find(s => s.line_user_id === id.trim());
                    return student ? (student.display_name_th || student.first_name) : 'ไม่พบชื่อ';
                });
            } else {
                // กรณีคนเดียว
                const student = studentsData?.find(s => s.line_user_id === log.target_id);
                nameList = student ? [student.display_name_th || student.first_name] : [log.target_id];
            }

            return {
                ...log,
                // ✅ รวมชื่อทุกคนเป็น String คั่นด้วย comma เพื่อเอาไปใส่ใน title (Tooltip)
                student_name: nameList.join(', ')
            };
        });

        setBroadcastLogs(formattedData);
    };

    useEffect(() => {
        document.title = "ระบบจัดการหลังบ้าน | Admin Dashboard";
        fetchLogs();
    }, []);

    useEffect(() => { fetchStudents(); }, []);

    const fetchStudents = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('mst_personal')
            .select('*')
            // ✅ เปลี่ยนจาก last_chat_at เป็น created_at (เพราะใน DB ไม่มี last_chat_at)
            .order('created_at', { ascending: false });

        if (!error) {
            setStudents(data);
        } else {
            console.error("Fetch Error:", error);
        }
        setLoading(false);
    };

    const sortedStudents = useMemo(() => {
        return [...students].sort((a, b) => {
            const countA = unreadCounts[a.line_user_id] || 0;
            const countB = unreadCounts[b.line_user_id] || 0;

            // 1. ใครมีข้อความค้าง (Unread) ให้ขึ้นก่อน
            if (countA !== countB) {
                return countB - countA;
            }

            // 2. ถ้า Unread เท่ากัน (เช่น 0 ทั้งคู่) ให้เรียงตามเวลาที่บันทึกหรือชื่อ
            return 0;
        });
    }, [students, unreadCounts]);

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

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };
    // เมื่อมีข้อความใหม่ (chatMessages เปลี่ยน) ให้สั่งเลื่อนลง
    useEffect(() => {
        scrollToBottom();
    }, [chatMessages]);

    // --- แก้ไขฟังก์ชัน handleSelectRow ให้ฉลาดขึ้น ---
    const handleSelectRow = async (student) => {
        const id = student.line_user_id;
        const name = student.display_name_th || student.first_name;
        if (!id) return;

        const { error } = await supabase
            .from('chat_messages')
            .update({ is_read: true })
            .eq('line_user_id', student.line_user_id)
            .eq('is_read', false);

        if (!error) {
            // อัปเดต State unreadCounts ในหน้าจอทันที
            setUnreadCounts(prev => ({
                ...prev,
                [student.line_user_id]: 0
            }));
        }

        if (mode === 'year' || mode === 'single') {
            setMode('single');
            setTargetYear(id);
            setSelectedName(name);
            setTags([]);
            Toast.fire({ icon: 'success', title: `เลือก: ${name}` });

            // 2. เรียกใช้การเลื่อนหน้าจอ
            setTimeout(scrollToBroadcast, 100);
            setActiveChatId(id); // เปิดแชทคนนี้
            scrollToBroadcast();
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


    const fetchChatMessages = async (lineUserId) => {
        if (!lineUserId) return;

        const { data, error } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('line_user_id', lineUserId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching chat:', error);
        } else {
            setChatMessages(data || []); // อัปเดตข้อความในหน้าจอ
        }
    };

    // const filteredStudents = useMemo(() => {
    //     return students.filter(s => {
    //         const name = (s.display_name_th || s.first_name || "").toLowerCase();
    //         const studentId = (s.note || "").toLowerCase();
    //         const matchesSearch = name.includes(searchTerm.toLowerCase()) || studentId.includes(searchTerm.toLowerCase());
    //         const matchesYear = filterYear === 'all' || s.note?.startsWith(filterYear);
    //         return matchesSearch && matchesYear;
    //     });
    // }, [students, searchTerm, filterYear]);



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

        const messageSnapshot = message;
        setIsSending(true);
        setMessage('');

        try {
            const res = await fetch('/api/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode, target: finalTarget, message: messageSnapshot }),
            });
            const result = await res.json();

            if (result.success) {
                let logId = "";
                // ✅ เปลี่ยนจากการบันทึกเลขปี ให้บันทึกรายชื่อ ID ทั้งหมดคั่นด้วย Comma
                if ((mode === 'year' || mode === 'multi') && result.sentIds) {
                    logId = result.sentIds.join(',');
                } else {
                    logId = String(finalTarget);
                }

                // บันทึกลง broadcast_logs เพียงจุดเดียว
                const { error: logError } = await supabase
                    .from('broadcast_logs')
                    .insert([{
                        target_type: mode,
                        target_id: logId,
                        message_text: messageSnapshot
                    }]);

                if (!logError) fetchLogs(); // โหลดประวัติใหม่ทันที

                // ✅ ลบโค้ดส่วนที่เรียกใช้ "tasks" ที่ทำให้เกิด Error ออกแล้ว

                if (mode === 'single') fetchChatMessages(finalTarget);

                Toast.fire({ icon: 'success', title: `ส่งสำเร็จ ${result.count} รายการ` });
                if (mode === 'multi') setTags([]);
                if (mode === 'single' || mode === 'year') {
                    setSelectedName('');
                    setTargetYear('');
                }
            } else {
                throw new Error(result.error);
            }
        } catch (err) {
            setMessage(messageSnapshot);
            Swal.fire('Error', err.message, 'error');
        } finally {
            setIsSending(false);
        }
    };


    useEffect(() => {
        if (mode === 'single' && targetYear) {
            fetchChatMessages(targetYear);
        }
    }, [targetYear, mode]);


    useEffect(() => {
        if (!activeChatId) return;

        // 1. ดึงประวัติเก่ามาโชว์ก่อน
        const fetchChatHistory = async () => {
            const { data } = await supabase
                .from('chat_messages')
                .select('*')
                .eq('line_user_id', activeChatId)
                .order('created_at', { ascending: true });
            setChatMessages(data || []);
        };
        fetchChatHistory();

        // 2. ฟังข้อความใหม่ที่กำลังจะเข้ามา
        const channel = supabase
            .channel(`chat_${activeChatId}`)
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `line_user_id=eq.${activeChatId}` },
                (payload) => {
                    setChatMessages(prev => [...prev, payload.new]);
                    // ถ้าเป็นข้อความจาก User ให้แจ้งเตือนเบาๆ
                    if (payload.new.sender_type === 'user') {
                        Toast.fire({ icon: 'info', title: 'มีข้อความใหม่เข้า!' });
                    }
                }
            ).subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [activeChatId]);

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


    // แก้ไขฟังก์ชัน clearChatHistory ใน app/admin/page.js
    const clearChatHistory = async () => {
        // ✅ เปลี่ยนจาก selectedUser เป็น targetYear
        if (!targetYear) return;

        const confirm = await Swal.fire({
            title: 'ยืนยันการล้างแชท?',
            text: "ประวัติการสนทนาทั้งหมดของคนนี้จะถูกลบถาวรจากระบบ",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#94a3b8',
            confirmButtonText: 'ใช่, ลบเลย!',
            cancelButtonText: 'ยกเลิก'
        });

        if (confirm.isConfirmed) {
            try {
                const { error } = await supabase
                    .from('chat_messages')
                    .delete()
                    .eq('line_user_id', targetYear); // ✅ ใช้ targetYear ซึ่งเก็บ Line ID ไว้

                if (error) throw error;

                setChatMessages([]);
                Toast.fire({ icon: 'success', title: 'ล้างประวัติแชทเรียบร้อยแล้ว' });
            } catch (err) {
                console.error('Clear chat error:', err);
                Swal.fire('Error', 'ไม่สามารถล้างประวัติแชทได้', 'error');
            }
        }
    };

    // ลบทีละรายการ
    const handleDeleteLog = async (id) => {
        const confirm = await Swal.fire({
            title: 'ยืนยันการลบ?',
            text: "ข้อมูลประวัตินี้จะหายไป แต่ข้อความในแชทนักศึกษายังอยู่นะครับ",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'ลบเลย',
            cancelButtonText: 'ยกเลิก'
        });

        if (confirm.isConfirmed) {
            const { error } = await supabase.from('broadcast_logs').delete().eq('id', id);
            if (!error) {
                Toast.fire({ icon: 'success', title: 'ลบรายการแล้ว' });
                fetchLogs();
            }
        }
    };

    // ล้างประวัติ LOG ทั้งหมด
    const handleClearAllLogs = async () => {
        const confirm = await Swal.fire({
            title: 'ล้างประวัติทั้งหมด?',
            text: "ประวัติการประกาศทั้งหมดจะถูกลบถาวร!",
            icon: 'danger',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'ล้างทั้งหมด',
            cancelButtonText: 'ยกเลิก'
        });

        if (confirm.isConfirmed) {
            const { error } = await supabase.from('broadcast_logs').delete().neq('id', 0); // ลบทุก id ที่ไม่เป็น 0
            if (!error) {
                Toast.fire({ icon: 'success', title: 'ล้างประวัติเรียบร้อย' });
                fetchLogs();
            }
        }
    };

    // Logic สำหรับกรองและจัดลำดับ (Sorting)
    const filteredAndSortedStudents = useMemo(() => {
        // 1. Filter ข้อมูลตามปกติ
        let result = students.filter(s => {
            const name = (s.display_name_th || s.first_name || "").toLowerCase();
            const studentId = (s.note || "").toLowerCase();
            const matchesSearch = name.includes(searchTerm.toLowerCase()) ||
                studentId.includes(searchTerm.toLowerCase());
            const matchesYear = filterYear === 'all' || s.note?.startsWith(filterYear);

            if (onlyUnread) {
                return matchesSearch && matchesYear && (unreadCounts[s.line_user_id] > 0);
            }
            return matchesSearch && matchesYear;
        });

        // 2. ✅ จัดลำดับ: ใครมีข้อความค้าง (Unread) ให้ขึ้นอันดับ 1
        return result.sort((a, b) => {
            const countA = unreadCounts[a.line_user_id] || 0;
            const countB = unreadCounts[b.line_user_id] || 0;

            // ถ้าคน B มีข้อความใหม่ แต่คน A ไม่มี ให้คน B ขึ้นก่อน
            if (countA !== countB) return countB - countA;

            // ถ้าไม่มีข้อความใหม่ทั้งคู่ ให้เรียงตามรหัสวิชา/โน้ต (หรือ ID)
            return (b.note || "").localeCompare(a.note || "");
        });
    }, [students, searchTerm, filterYear, unreadCounts, onlyUnread]);
    // แก้ไขตัวแปรสำหรับแบ่งหน้า (Pagination)
    const currentDisplayItems = filteredAndSortedStudents.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const totalPages = Math.ceil(filteredAndSortedStudents.length / itemsPerPage);
    // const currentItems = filteredAndSortedStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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

                {/* KPI Section */}
                {/* Premium KPI Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {[
                        {
                            label: 'Students',
                            title: 'นักศึกษาทั้งหมด',
                            value: students.length,
                            unit: 'คน',
                            icon: Users,
                            color: 'from-blue-500 to-indigo-600',
                            shadow: 'shadow-blue-100'
                        },
                        {
                            label: 'Daily Active',
                            title: 'ลงทะเบียนวันนี้',
                            value: students.filter(s => new Date(s.created_at).toDateString() === new Date().toDateString()).length,
                            unit: 'รายใหม่',
                            icon: Calendar,
                            color: 'from-emerald-400 to-teal-600',
                            shadow: 'shadow-emerald-100'
                        },
                        {
                            label: 'Batch Breakdown',
                            title: 'แยกตามชั้นปี',
                            value: dynamicYears.length,
                            unit: 'รุ่น',
                            icon: GraduationCap,
                            color: 'from-purple-500 to-fuchsia-600',
                            shadow: 'shadow-purple-100',
                            isBatch: true // ระบุว่าเป็น Card ชั้นปีเพื่อใช้ Logic Hover

                        },
                        {
                            label: 'System Status',
                            title: 'การเชื่อมต่อ',
                            value: 'Online',
                            unit: 'Live',
                            icon: Zap,
                            color: 'from-amber-400 to-orange-500',
                            shadow: 'shadow-amber-100',
                            animate: true
                        }
                    ].map((kpi, i) => (
                        <div
                            key={i}
                            className={`group relative overflow-hidden bg-white p-4 rounded-[2rem] border border-slate-100 shadow-xl ${kpi.shadow} transition-all duration-500 hover:shadow-2xl h-[100px] flex items-center`}
                        >
                            <div className={`absolute -right-2 -top-2 w-16 h-16 bg-gradient-to-br ${kpi.color} opacity-[0.05] rounded-full`}></div>

                            <div className="relative flex items-center justify-between w-full gap-3">
                                {/* ฝั่งซ้าย: Icon และ หัวข้อ */}
                                <div className="flex items-center gap-3">
                                    <div className={`flex-shrink-0 w-10 h-10 bg-gradient-to-br ${kpi.color} rounded-2xl flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform`}>
                                        <kpi.icon className={`w-5 h-5 ${kpi.animate ? 'animate-pulse' : ''}`} />
                                    </div>
                                    <div>
                                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-wider">{kpi.label}</span>
                                        <h4 className="text-[13px] font-black text-slate-600 leading-tight">{kpi.title}</h4>
                                    </div>
                                </div>

                                {/* ฝั่งขวา: ตัวเลข (จะหายไปเมื่อ Hover ใน Card ชั้นปี) */}
                                <div className={`text-right transition-all duration-300 ${kpi.isBatch ? 'group-hover:opacity-0 group-hover:translate-x-4' : ''}`}>
                                    <div className="flex items-baseline justify-end gap-2">
                                        <h3 className="text-2xl font-black text-slate-800 tracking-tighter">
                                            {typeof kpi.value === 'number' ? kpi.value.toLocaleString() : kpi.value}
                                        </h3>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase ml-1">{kpi.unit}</span>
                                    </div>
                                </div>

                                {/* พิเศษ: ส่วนข้อมูลแยกชั้นปี (แสดงเมื่อ Hover) */}
                                {kpi.isBatch && (
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-2 translate-x-10 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-500">
                                        <div className="flex flex-col gap-1 items-end max-h-[80px] overflow-y-auto pr-1 custom-scrollbar-mini">
                                            {dynamicYears.map(year => {
                                                const count = students.filter(s => {
                                                    const usertype = s.user_type || '';
                                                    return usertype.includes(`Student${year}`);
                                                }).length;

                                                return (
                                                    <div key={year} className="text-[9px] font-black bg-purple-50 text-purple-600 px-2 py-0.5 rounded-lg border border-purple-100">
                                                        รุ่น {year}: {count} คน
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Filter Bar */}
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
                    <div className="p-5 border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-20">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

                            {/* ฝั่งซ้าย: แสดงสถานะและจำนวน */}
                            <div className="flex items-center gap-4">
                                <div className="bg-blue-50 px-4 py-2 rounded-2xl flex items-center gap-3 border border-blue-100/50">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                    </span>
                                    <p className="text-[13px] font-bold text-blue-700 tracking-tight">
                                        ทั้งหมด <span className="text-blue-900 mx-1">{filteredAndSortedStudents.length}</span> รายชื่อ
                                    </p>
                                </div>

                                {/* ตัวเลือกหน้าละ (Compact Style) */}
                                <div className="hidden sm:flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Show</span>
                                    <select
                                        value={itemsPerPage}
                                        onChange={(e) => setItemsPerPage(Number(e.target.value))}
                                        className="bg-transparent text-xs font-bold text-slate-600 outline-none cursor-pointer"
                                    >
                                        <option value={10}>10</option>
                                        <option value={20}>20</option>
                                        <option value={50}>50</option>
                                    </select>
                                </div>
                            </div>

                            {/* ฝั่งขวา: การกรอง (Action Area) */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        setOnlyUnread(!onlyUnread);
                                        setCurrentPage(1);
                                    }}
                                    className={`flex items-center gap-3 px-5 py-2.5 rounded-2xl font-bold text-[13px] transition-all duration-500 transform active:scale-95 ${onlyUnread
                                        ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-[0_10px_20px_-5px_rgba(244,63,94,0.4)] ring-4 ring-red-50'
                                        : 'bg-white text-slate-600 border border-slate-200 hover:border-red-200 hover:bg-red-50/30'
                                        }`}
                                >
                                    <div className="relative flex items-center justify-center">
                                        <div className={`w-2.5 h-2.5 rounded-full transition-colors ${onlyUnread ? 'bg-white animate-pulse' : 'bg-red-500'}`} />
                                        {onlyUnread && <div className="absolute w-2.5 h-2.5 rounded-full bg-white animate-ping opacity-75" />}
                                    </div>
                                    {onlyUnread ? 'แสดงเฉพาะข้อความใหม่' : 'กรองข้อความที่ยังไม่ได้อ่าน'}

                                    {/* แสดงตัวเลข Unread รวมเล็กๆ ถ้าต้องการ */}
                                    {!onlyUnread && Object.values(unreadCounts).filter(c => c > 0).length > 0 && (
                                        <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-lg text-[10px]">
                                            {Object.values(unreadCounts).filter(c => c > 0).length}
                                        </span>
                                    )}
                                </button>
                            </div>

                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        {/* เพิ่มปุ่ม Filter เหนือตาราง */}
                        <div className="flex gap-2 mb-4">

                        </div>
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
                                ) : currentDisplayItems.length === 0 ? ( // ✅ เช็คกรณีไม่มีข้อมูลหลังกรอง
                                    <tr><td colSpan="6" className="py-20 text-center text-slate-400 font-medium italic">ไม่พบข้อมูลที่ต้องการ</td></tr>
                                ) : currentDisplayItems.map((s, index) => ( // ✅ เปลี่ยนเป็น currentDisplayItems
                                    <tr key={s.id} onClick={() => handleSelectRow(s)} className="hover:bg-slate-50/80 transition-all cursor-pointer group">
                                        {mode === 'multi' && (
                                            <td className="px-8 py-5 text-center">
                                                <div className={`w-5 h-5 mx-auto rounded-md border-2 transition-all flex items-center justify-center ${tags.find(t => t.id === s.line_user_id) ? 'bg-[#1e293b] border-[#1e293b] scale-110' : 'border-slate-200 bg-white'}`}>
                                                    {tags.find(t => t.id === s.line_user_id) && <Check className="w-3.5 h-3.5 text-white" strokeWidth={4} />}
                                                </div>
                                            </td>
                                        )}
                                        <td className="text-[12px] px-8 py-5 text-center text-slate-400 font-medium italic">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                                        <td className="text-[8px] px-8 py-5">
                                            <span className="bg-slate-100 text-slate-500 px-3.5 py-1.5 rounded-full text-[12px] font-medium border border-slate-200 shadow-sm uppercase">
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
                                            <div className="flex justify-center items-center gap-2">
                                                <div
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSelectRow(s);
                                                    }}
                                                    // ✅ เพิ่ม relative เพื่อให้ badge แปะบนปุ่มได้
                                                    className={`relative cursor-pointer inline-flex items-center justify-center w-10 h-10 rounded-2xl transition-all duration-300 ${(mode === 'single' && targetYear === s.line_user_id) ||
                                                        (mode === 'multi' && tags.find(t => t.id === s.line_user_id))
                                                        ? 'bg-slate-800 text-white shadow-xl scale-110'
                                                        : 'bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-400 hover:bg-slate-50 shadow-sm'
                                                        }`}
                                                >
                                                    {/* ✅ ส่วนการแสดงเลขแจ้งเตือน (Unread Badge) */}
                                                    {unreadCounts[s.line_user_id] > 0 && (
                                                        <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white animate-pulse shadow-md z-10">
                                                            {unreadCounts[s.line_user_id] > 9 ? '9+' : unreadCounts[s.line_user_id]}
                                                        </span>
                                                    )}

                                                    {mode === 'multi' && tags.find(t => t.id === s.line_user_id) ? (
                                                        <Check className="w-4 h-4" strokeWidth={3} />
                                                    ) : (
                                                        <MessageSquare className="w-4 h-4" />
                                                    )}
                                                </div>
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
                            หน้าปัจจุบัน <span className="text-slate-900 font-bold">{filteredAndSortedStudents.length > 0 ? currentPage : 0}</span> / {totalPages || 0}
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch pb-20 font-['Prompt']">

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

                    {/* --- ส่วน Live Preview เดิม เราจะเปลี่ยนเป็นแท็บสลับระหว่าง Preview กับ Chat History --- */}
                    <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-xl shadow-slate-200/30 flex flex-col h-full min-h-[650px]">
                        <div className="flex items-center justify-between mb-8">
                            <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 italic">
                                <span className="w-4 h-[1px] bg-slate-200"></span>
                                {activeChatId ? 'Chat History' : 'Live Preview'}
                                <span className="w-4 h-[1px] bg-slate-200"></span>
                            </div>
                            {activeChatId && (
                                <button
                                    onClick={() => { setActiveChatId(null); setChatMessages([]); }}
                                    className="text-[10px] font-bold text-rose-500 hover:bg-rose-50 px-3 py-1 rounded-full transition-colors"
                                >
                                    ปิดแชท
                                </button>
                            )}
                        </div>

                        {activeChatId ? (
                            /* --- 💬 ส่วนแสดงประวัติแชท (Chat History UI) --- */
                            < div className="flex-grow flex flex-col bg-[#F1F5F9] rounded-[2rem] p-4 overflow-hidden border border-slate-200 shadow-inner h-[500px]">
                                {/* ส่วนหัวของช่องแชท */}
                                <div className="rounded-3xl  p-4 border-b border-slate-100 bg-white flex items-center justify-between">
                                    <div className="flex items-center gap-3 ">
                                        <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                                            {selectedName?.charAt(0) || 'U'}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-800 text-sm">{selectedName || 'เลือกผู้ใช้งาน'}</h3>
                                            <p className="text-[10px] text-emerald-500 flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                                                Active Now
                                            </p>
                                        </div>
                                    </div>

                                    {/* ✅ ปุ่มล้างประวัติแชท (ถังขยะ) */}
                                    {targetYear && (
                                        <button
                                            onClick={clearChatHistory}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                            title="ล้างประวัติแชท"
                                        >
                                            <Trash className="w-4 h-4" /> {/* หรือใช้ไอคอน Trash จาก lucide-react ก็ได้ครับ */}
                                        </button>
                                    )}
                                </div>

                                <div className="flex-grow overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                                    {chatMessages.length > 0 ? (
                                        /* ใช้แผงควบคุมหลักเพื่อแยกส่วนรายการข้อความกับตัวเลื่อน */
                                        <div className="flex flex-col gap-4">
                                            {chatMessages.map((msg, index) => (
                                                <div
                                                    /* ✅ Key ต้องอยู่ที่ Div นอกสุดของลูปเสมอ */
                                                    key={`chat-msg-${msg.id || index}`}
                                                    className={`flex ${msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}
                                                >
                                                    {/* <div className={`max-w-[80%] p-3 rounded-2xl text-[13px] leading-relaxed shadow-sm ${msg.sender_type === 'admin'
                                                        ? 'bg-slate-800 text-white rounded-tr-none'
                                                        : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'
                                                        }`}>
                                                        <p className="break-words whitespace-pre-wrap">{msg.message_text}</p>
                                                        <p className={`text-[9px] mt-1 opacity-50 ${msg.sender_type === 'admin' ? 'text-right' : 'text-left'}`}>
                                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div> */}

                                                    <div className={`max-w-[80%] p-3 rounded-2xl ${msg.sender_type === 'admin' ? 'bg-slate-800 text-white' : 'bg-white text-slate-800 shadow-sm'}`}>
                                                        {/* เช็คว่าเป็นสติกเกอร์หรือไม่ (เช็คจาก message_type หรือดูว่ามีคำว่า stickershop ในลิงก์) */}
                                                        {msg.message_type === 'sticker' || msg.message_text.includes('stickershop') ? (
                                                            <div className="relative w-24 h-24 p-1">
                                                                <Image
                                                                    src={msg.message_text}
                                                                    alt="LINE Sticker"
                                                                    fill // ใช้ fill เพื่อให้รูปขยายเต็มพื้นที่ div ที่ครอบอยู่
                                                                    sizes="96px"
                                                                    className="object-contain"
                                                                    priority={false} // รูปแชทไม่จำเป็นต้องโหลดก่อนเพื่อน
                                                                />
                                                            </div>
                                                        ) : (
                                                            <p className="text-[13px] wrap-break-word whitespace-pre-wrap leading-relaxed">
                                                                {msg.message_text}
                                                            </p>
                                                        )}

                                                        <div className={`text-[9px] mt-1 opacity-50 ${msg.sender_type === 'admin' ? 'text-right' : 'text-left'}`}>
                                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            {/* ✅ ย้าย ref ออกมาไว้นอกลูป map แต่อยู่ในส่วนที่เลื่อนได้ */}
                                            <div ref={chatEndRef} className="h-2" />
                                        </div>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-400 italic space-y-2">
                                            <MessageSquare className="w-8 h-8 opacity-20" />
                                            <p className="text-xs">ยังไม่มีประวัติการคุย</p>
                                        </div>
                                    )}
                                </div>
                                {/* สถานะผู้รับที่กำลังเปิดแชทอยู่ */}
                                <div className="mt-4 pt-3 border-t border-slate-200 text-center flex-shrink-0">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                                        คุยกับ: <span className="text-slate-900">{selectedName}</span>
                                    </p>
                                </div>
                            </div>
                        ) : (
                            /* --- 📱 ส่วน Live Preview เดิม (แสดงเมื่อยังไม่ได้เลือกแชท) --- */
                            <div className="flex-grow flex items-center justify-center">
                                <div className="bg-[#94A3B8] w-[280px] aspect-[9/18] rounded-[3.5rem] border-[12px] border-slate-900 shadow-2xl relative p-6 transform scale-95 transition-transform duration-700 overflow-hidden">
                                    <div className="bg-slate-900 h-6 w-1/3 mx-auto rounded-b-3xl mb-12"></div>
                                    {message ? (
                                        <div className="flex items-start gap-3 animate-in slide-in-from-left-3 duration-500">
                                            <div className="w-8 h-8 bg-slate-400 rounded-full flex-shrink-0"></div>
                                            <div className="bg-white rounded-2xl rounded-tl-none p-3 text-[12px] shadow-lg text-slate-700 max-w-[180px] break-words">
                                                {message}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-[70%] text-white/30 italic">
                                            <MessageSquare className="w-12 h-12 opacity-20 mb-4" />
                                            <p className="text-[10px] font-bold uppercase tracking-widest">No Preview</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {/* --- 🔘 ปุ่มไอคอนประวัติขวามือ --- */}
            <button
                onClick={() => { setIsHistoryOpen(true); fetchLogs(); }}
                className="fixed right-8 bottom-8 z-[60] w-14 h-14 bg-slate-800 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all group"
            >
                <Calendar className="w-6 h-6" />
                <span className="absolute right-full mr-4 px-3 py-1.5 bg-slate-800 text-white text-[11px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    ดูประวัติการส่ง
                </span>
            </button>

            {/* --- 🕒 Side History Drawer --- */}
            {isHistoryOpen && (
                <div className="fixed inset-0 z-[100] flex justify-end font-['Prompt']">
                    {/* Backdrop - พื้นหลังเบลอเมื่อเปิด Drawer */}
                    <div
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300"
                        onClick={() => setIsHistoryOpen(false)}
                    />

                    {/* Panel - แถบประวัติ */}
                    <div className="relative w-full max-w-md bg-slate-50 h-full shadow-2xl animate-in slide-in-from-right duration-500 flex flex-col">

                        {/* Header */}
                        <div className="p-6 bg-white border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                                    <Calendar className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-slate-800 text-lg">ประวัติการส่ง</h2>
                                    <p className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">Broadcast History</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {/* ✅ ปุ่มล้างทั้งหมด */}
                                {broadcastLogs.length > 0 && (
                                    <button
                                        onClick={handleClearAllLogs}
                                        className="text-[11px] font-bold text-red-400 hover:text-red-600 transition-colors flex items-center gap-1 bg-red-50 px-2 py-1 rounded-lg"
                                    >
                                        <Trash className="w-3 h-3" /> ล้างทั้งหมด
                                    </button>
                                )}
                                <button onClick={() => setIsHistoryOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                    <X className="w-5 h-5 text-slate-400" />
                                </button>
                            </div>
                        </div>

                        {/* Content List */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
                            {broadcastLogs.length > 0 ? (
                                broadcastLogs.map((log) => (
                                    <div key={log.id} className="p-5 rounded-[2rem] border border-slate-100 bg-white shadow-sm hover:shadow-md transition-all group relative">

                                        {/* ✅ ปุ่มลบทีละรายการ (จะขึ้นเมื่อ Hover) */}
                                        <button
                                            onClick={() => handleDeleteLog(log.id)}
                                            className="absolute top-4 right-4 p-2 bg-red-50 text-red-400 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white"
                                        >
                                            <Trash className="w-3.5 h-3.5" />
                                        </button>

                                        <div className="flex justify-between items-center mb-3 pr-8">
                                            <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-tighter ${log.target_type === 'single' ? 'bg-blue-50 text-blue-600' :
                                                log.target_type === 'multi' ? 'bg-indigo-50 text-indigo-600' : 'bg-purple-50 text-purple-600'
                                                }`}>
                                                {log.target_type === 'single' ? '● รายบุคคล' :
                                                    log.target_type === 'multi' ? '● กลุ่มพิเศษ' : `● ประกาศรายปี`}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-bold bg-slate-50 px-2 py-1 rounded-lg border border-slate-100/50">
                                                {new Date(log.created_at).toLocaleDateString('th-TH', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: '2-digit' // หรือ 'numeric' ถ้าอยากได้ปีเต็ม 2567
                                                })}
                                                {' • '}
                                                {new Date(log.created_at).toLocaleTimeString('th-TH', {
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })} น.
                                            </span>
                                        </div>

                                        {/* ส่วนแสดงชื่อ (ตามที่เราปรับกันไว้) */}
                                        <div className="mb-3 px-1">
                                            <div className="flex items-start gap-2.5">
                                                <div className="p-1.5 bg-slate-50 rounded-lg group-hover:bg-indigo-50 transition-colors">
                                                    <Users className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500" />
                                                </div>
                                                <div className="flex flex-col min-w-0 flex-1">
                                                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-0.5">ผู้รับข้อความ</span>
                                                    <span className="text-[13px] text-slate-700 font-bold break-words line-clamp-1" title={log.student_name}>
                                                        {log.target_type === 'year'
                                                            ? `นักศึกษาชั้นปีที่เลือก (ส่งแล้ว ${log.target_id.split(',').length} ราย)`
                                                            : (log.student_name || 'ไม่ทราบชื่อ')
                                                        }
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* ข้อความ */}
                                        <div className="bg-slate-50/50 p-4 rounded-[1.5rem] text-[12px] text-slate-600 leading-relaxed break-words border border-slate-50 group-hover:bg-white group-hover:border-slate-100 transition-all">
                                            {log.message_text}
                                        </div>
                                    </div>
                                ))

                            ) : (
                                <div className="flex flex-col items-center justify-center py-32 text-slate-300">
                                    <MessageSquare className="w-16 h-16 mb-4 opacity-20" />
                                    <p className="text-sm font-medium italic">ยังไม่มีประวัติการส่งข้อความ</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div >
            )
            }
        </div >


    );
}