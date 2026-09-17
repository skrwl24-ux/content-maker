import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "콘텐츠 메이커",
  description: "본문을 분석해 카드뉴스와 쇼츠 이미지를 제작하는 콘텐츠 도구",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        {children}
        <a
          href="/apartment-bulk"
          aria-label="아파트 단지 대량발행 모드 열기"
          style={{
            position: "fixed",
            right: 18,
            bottom: 18,
            zIndex: 80,
            padding: "12px 16px",
            borderRadius: 999,
            background: "#0f827f",
            color: "white",
            textDecoration: "none",
            fontWeight: 800,
            fontSize: 13,
            boxShadow: "0 10px 28px rgba(15,130,127,.28)",
          }}
        >
          🏢 아파트 단지 대량발행
        </a>
      </body>
    </html>
  );
}
