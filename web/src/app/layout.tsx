import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "漢字マスター - 일본어 상용 한자 2,136",
  description: "일본어 상용 한자 학습 - JLPT N5~N1, 획순 애니메이션, 한국어 훈음",
  keywords: ["한자", "일본어", "JLPT", "상용한자", "획순", "kanji"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
