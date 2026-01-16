// app/admin/layout.js

export const metadata = {
    title: 'ระบบจัดการหลังบ้าน | Admin Dashboard',
    description: 'Broadcast and Student Management System',
};

export default function AdminLayout({ children }) {
    return (
        <section>
            {/* คุณสามารถใส่ Navbar สำหรับ Admin ตรงนี้ได้ในอนาคต */}
            {children}
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css"/>
        </section>
    );
}