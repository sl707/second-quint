import type { Metadata, Viewport } from "next";
import { Anton, Geist } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "./site-header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const anton = Anton({
  variable: "--font-anton",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Second Quint Rankings", template: "%s · Second Quint Rankings" },
  description: "Pick winners in 1v1 matches and see how everyone's picks add up.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0712",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${anton.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-ink text-white">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
