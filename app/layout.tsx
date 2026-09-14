import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RepoMind — Multi-agent code intelligence",
  description:
    "Paste a GitHub URL. Five LangGraph agents map the architecture, surface risks, and answer questions over the codebase via RAG.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {children}
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: "rgba(22, 27, 34, 0.95)",
              border: "1px solid var(--border)",
              backdropFilter: "blur(16px)",
              color: "var(--fg)",
            },
          }}
        />
      </body>
    </html>
  );
}
