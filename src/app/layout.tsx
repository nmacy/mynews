import { Suspense } from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { ConfigProvider } from "@/components/ConfigProvider";
import { Header } from "@/components/layout/Header";
import { TagTabs } from "@/components/layout/TagTabs";
import { SourceBar } from "@/components/layout/SourceBar";
import { ImportSettingsPrompt } from "@/components/ImportSettingsPrompt";
import { TagProvider } from "@/components/TagProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MyNews",
  description: "Your personalized news reader",
};

const themeScript = `
  (function() {
    var t = localStorage.getItem('theme');
    if (!t || t === 'system') t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    if (t === 'dark') document.documentElement.classList.add('dark');
    var palettes = {
      blue:   { light: ['#007AFF','#0066D6'], dark: ['#0A84FF','#409CFF'] },
      purple: { light: ['#AF52DE','#9A40C9'], dark: ['#BF5AF2','#D084F5'] },
      green:  { light: ['#34C759','#2AA147'], dark: ['#30D158','#5EDD7E'] },
      orange: { light: ['#FF9500','#D67E00'], dark: ['#FF9F0A','#FFB840'] },
      red:    { light: ['#FF3B30','#D63028'], dark: ['#FF453A','#FF6961'] },
      pink:   { light: ['#FF2D55','#D62548'], dark: ['#FF375F','#FF6482'] }
    };
    var a = localStorage.getItem('accent') || 'blue';
    var p = palettes[a] || palettes.blue;
    var c = p[t] || p.light;
    document.documentElement.style.setProperty('--mn-accent', c[0]);
    document.documentElement.style.setProperty('--mn-accent-hover', c[1]);
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.variable} antialiased`}>
        <ThemeProvider>
          <AuthProvider>
            <ConfigProvider>
              <TagProvider>
                <Header />
                <TagTabs />
                <Suspense><SourceBar /></Suspense>
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                  {children}
                </main>
                <ImportSettingsPrompt />
              </TagProvider>
            </ConfigProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
