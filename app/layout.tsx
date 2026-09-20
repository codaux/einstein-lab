import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Einstein Lab",
  description: "Interactive polygon tiling candidate tester",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
