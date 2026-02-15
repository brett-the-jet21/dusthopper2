import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DustHopper Mission Control",
  description: "Real-time space launch tracker with 3D visualization",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-black text-white">
        {children}
      </body>
    </html>
  );
}
