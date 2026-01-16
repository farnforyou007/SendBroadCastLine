import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: {
    default: 'ระบบแจ้งเตือนนักศึกษาผ่าน LINE',
    template: '%s | มหาวิทยาลัยสงขลานครินทร์ คณะการแพทย์แผนไทย',
  },
  description: 'ระบบแจ้งเตือนข่าวสารผ่าน LINE สำหรับนักศึกษา เพื่อไม่ให้พลาดกิจกรรมสำคัญและการประกาศจากคณะ',
  keywords: ['ลงทะเบียนนักศึกษา', 'LINE OA คณะ', 'ประกาศข่าวสาร', 'มหาวิทยาลัยสงขลานครินทร์', 'คณะการแพทย์แผนไทย', 'ข่าวสารนักศึกษา', 'ระบบลงทะเบียนรับข่าวสารคณะการแพทย์แผนไทย มอ'],
  openGraph: {
    title: 'ลงทะเบียนรับข่าวสารนักศึกษา',
    description: 'เชื่อมต่อ LINE เพื่อรับประกาศสำคัญได้ทันที',
    images: ['/og-image.png'], // รูปที่จะโชว์เวลาส่งลิงก์ใน LINE/Facebook
  },
  robots: 'index, follow',
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
