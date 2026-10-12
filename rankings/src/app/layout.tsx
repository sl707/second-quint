import type { Metadata, Viewport } from "next";
import { Anton, Fraunces, Fredoka, Geist } from "next/font/google";
import "./globals.css";
import type { Variant } from "@/lib/prototype-variant";
import { readVariant } from "@/lib/prototype-variant-server";
import { PrototypeVariantSwitcher } from "./prototype-variant-switcher";
import { SiteHeader } from "./site-header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// PROTOTYPE: display faces for the three visual directions.
const anton = Anton({ variable: "--font-anton", weight: "400", subsets: ["latin"] });
const fredoka = Fredoka({ variable: "--font-fredoka", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: { default: "Second Quint Rankings", template: "%s · Second Quint Rankings" },
  description: "Pick winners in 1v1 matches and see how everyone's picks add up.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const bodyClass: Record<Variant, string> = {
  current: "bg-zinc-50 text-zinc-900",
  A: "variant-A bg-[#0b0712] text-white selection:bg-[#ff2e88]",
  B: "gacha-bg font-gacha text-[#f6eaff]",
  C: "bg-[#171513] text-[#efe8dc] selection:bg-[#efe8dc] selection:text-[#171513]",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const variant = await readVariant();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${anton.variable} ${fredoka.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className={`min-h-full flex flex-col ${bodyClass[variant]}`}>
        <SiteHeader />
        {children}
        {process.env.NODE_ENV !== "production" && <PrototypeVariantSwitcher current={variant} />}
      </body>
    </html>
  );
}
