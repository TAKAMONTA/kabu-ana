import type { Metadata, Viewport } from "next";
import "./globals.css";
import { VercelAnalytics } from "@/components/VercelAnalytics";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/components/ThemeProvider";
import { APP_DESCRIPTION, APP_NAME, APP_URL } from "@/lib/constants";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  applicationName: APP_NAME,
  title: {
    default: `${APP_NAME} - 株式分析アプリ`,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  manifest: "/manifest.json",
  openGraph: {
    title: `${APP_NAME} - 株式分析アプリ`,
    description: APP_DESCRIPTION,
    url: APP_URL,
    siteName: APP_NAME,
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: `${APP_NAME} - 株式分析アプリ`,
    description: APP_DESCRIPTION,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
  icons: {
    icon: "/icon-192x192.png",
    apple: "/icon-192x192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#3b82f6",
  viewportFit: "cover",
  initialScale: 1,
  width: "device-width",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // manifest / theme-color / mobile-web-app-capable / apple-mobile-web-app-* /
    // apple-touch-icon は上の metadata・viewport から出力される
    // （以前は <head> にも手書きしており二重に出ていた）。
    // Service Worker は登録しない。株価は常に最新が必要なため。
    // public/sw.js は過去に登録された端末の後始末（自己登録解除）専用。
    <html lang="ja" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ErrorBoundary>{children}</ErrorBoundary>
        </ThemeProvider>
        <VercelAnalytics />
      </body>
    </html>
  );
}
