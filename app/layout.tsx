import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Archivo, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { ThemedToaster } from "@/components/themed-toaster";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import "./globals.css";

// Runs before hydration (strategy="beforeInteractive") so the stored theme
// is applied to <html> before the first paint — without this, the page
// would flash dark (the default, see below) and then flip to light for
// anyone who'd chosen light, since React doesn't get a chance to set the
// class until well after the server-rendered HTML has already painted.
// Dark is the default: the class is added unless localStorage explicitly
// says "light" (i.e. absent/anything-else still means dark).
const THEME_INIT_SCRIPT = `(function(){try{if(localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})!=="light")document.documentElement.classList.add("dark");}catch(e){}})();`;

// Two families, each with exactly one job, both chosen for legibility over
// personality: Archivo (display) is a geometric grotesk with a high
// x-height and no decorative details that fight fast scanning — used only
// for the wordmark, big numbers, and titles. IBM Plex Sans (body/UI) and
// IBM Plex Mono (data, timestamps, codes) were designed for long screen
// reading, not for mood. See tailwind.config.ts for how these map to
// font-display / font-sans / font-mono.
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["500", "600", "800", "900"],
  variable: "--font-display",
  display: "swap",
});
const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vezrap",
  description: "Beheeromgeving voor de woongroep",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Vezrap",
  },
};

export const viewport: Viewport = {
  themeColor: "#1c2420",
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
    <html lang="nl" className={`${archivo.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable}`}>
      <body className="min-h-screen bg-background font-sans">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        {children}
        <ThemedToaster />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
