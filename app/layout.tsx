import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "콘텐츠 메이커",
  description: "본문을 분석해 카드뉴스와 쇼츠 이미지를 제작하는 콘텐츠 도구",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
