import type { Metadata, Viewport } from "next"; // Import Viewport
import { Geist, Geist_Mono } from "next/font/google"; // Keep existing fonts
import "./globals.css";
import { ThemeProvider } from "./theme-provider"; // Import ThemeProvider

const geistSans = Geist({ // Keep existing font setup
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({ // Keep existing font setup
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI To-Do App", // Updated title
  description: "A Next.js to-do application with AI features", // Updated description
};

// Add viewport settings using generateViewport export
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  // themeColor: [ // Optional: if you want to set theme color for PWA or browser UI
  //   { media: '(prefers-color-scheme: light)', color: 'white' },
  //   { media: '(prefers-color-scheme: dark)', color: 'black' },
  // ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning> {/* suppressHydrationWarning for theme persistence */}
      {/* Apply font variables and base styling. ThemeProvider will toggle .dark on html */}
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[var(--color-background)] text-[var(--color-foreground)] transition-colors duration-300`}
      >
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
