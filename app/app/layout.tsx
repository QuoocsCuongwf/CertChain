import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CertChain | Xác thực văn bằng số",
  description: "MVP xác thực chứng chỉ số trên Solana",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
