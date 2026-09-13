import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "110G",
  description: "Beheeromgeving voor de woongroep",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "110G",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0f14",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  // Without this, iOS treats the on-screen keyboard as an overlay: the
  // layout viewport (and anything sized off 100dvh) never actually shrinks,
  // so a field lower on the page — or one in a vertically centered form
  // like login/setup — can end up hidden behind the keyboard with no native
  // scroll-into-view happening. "resizes-content" makes the keyboard
  // genuinely shrink the layout viewport, the same way desktop browser
  // chrome does, so dvh-based layouts resize correctly and the browser's
  // own focus-scroll behavior has room to work.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className="dark">
      <body className="min-h-screen bg-background font-sans">
        {children}
        <Toaster theme="dark" position="top-center" richColors />
      </body>
    </html>
  );
}
