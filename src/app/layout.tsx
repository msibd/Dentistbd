import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import BootstrapScripts from "@/components/shared/bootstrap-scripts";
import ThemeProvider from "@/components/shared/theme-provider";
import PwaRegistration from "@/components/shared/pwa-registration";
import AppToaster from "@/components/shared/app-toaster";
import "./design-tokens.css";
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
  // Absolute address used to build social-preview and canonical links.
  metadataBase: new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000"),
  title: { default: "Dr Ovi's Dental Care", template: "%s | Dr Ovi's Dental Care" },
  applicationName: "Dr Ovi's Dental Care",
  openGraph: { type: "website", siteName: "Dr Ovi's Dental Care", locale: "bn_BD", title: "Dr Ovi's Dental Care & Endodontics" },
  formatDetection: { telephone: false },
  description: "Dr Ovi's Dental Care clinic administration dashboard",
  icons: {
    apple: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Dr Ovi Dental",
  },
};

export const viewport: Viewport = {
  // The browser bar follows the device's light or dark setting.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#c2410c" },
    { media: "(prefers-color-scheme: dark)", color: "#1a2027" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
};

const themeBootstrap = `try {
  const savedTheme = localStorage.getItem("clinic-theme");
  const dark = savedTheme === "dark" ||
    (savedTheme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
} catch {
  document.documentElement.dataset.theme = "light";
}`;

// The public site is server-rendered in English (the page is cached and cannot know the visitor's
// language). If a visitor saved Bengali, hide the public content until React has rendered it in
// Bengali, so the English text never flashes. The timeout is a safety net if hydration fails.
const publicLanguageBootstrap = `try {
  if (localStorage.getItem("clinic-public-language") === "bn") {
    const root = document.documentElement;
    root.dataset.publicLang = "bn";
    setTimeout(function () { root.dataset.publicReady = "1"; }, 3000);
  }
} catch {}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="bn" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {/* Run before the page is shown so the saved theme and language apply with no flash. */}
        <BootstrapScripts scripts={[{ id: "theme-bootstrap", code: themeBootstrap }, { id: "public-language-bootstrap", code: publicLanguageBootstrap }]} />
        <ThemeProvider>{children}</ThemeProvider>
        <PwaRegistration />
        <AppToaster />
      </body>
    </html>
  );
}
