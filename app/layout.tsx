import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '麦麦补给局 · 每一餐，都能出发',
  description:
    '每天三次专属于你的补给冒险。探索真实门店、搭配餐品、挑战预算，和 AI 一起把每一餐变成一场小冒险。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
