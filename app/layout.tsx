import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Osco Lounge — Cold Brew Chase",
  description: "A retro arcade game! Control the iced coffee, collect money, break the record and win a FREE cold beverage from Osco Lounge!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "'VT323', monospace" }}>
        {children}
        <div className="crt-overlay" />
      </body>
    </html>
  );
}
