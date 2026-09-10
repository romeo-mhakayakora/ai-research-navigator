import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = { title: "Euler — AI Research Agent", description: "The AI research agent that takes you from idea to published paper" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={"dark " + inter.variable + " " + display.variable}>
      <body className="font-sans">
        {/* App-wide ambient tint — gives every surface the same soft violet cast */}
        <div className="pointer-events-none fixed inset-0 z-0">
          <div className="grid-bg absolute inset-0" />
          <div className="glow-orb left-[8%] top-[-12%] h-[520px] w-[520px] animate-drift-a bg-indigo-600/18" />
          <div className="glow-orb bottom-[-18%] right-[5%] h-[560px] w-[560px] animate-drift-b bg-violet-600/14" />
        </div>
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
