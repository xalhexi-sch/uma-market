import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { APP_NAME, APP_DESCRIPTION } from "@/lib/constants";
import { Toaster } from "@/components/ui/toast";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ),
  title: {
    default: APP_NAME,
    template: `%s — ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  keywords: ["agricultural marketplace", "Butuan", "farm to business", "local produce", "farmers market", "wholesale", "B2B"],
  openGraph: {
    title: APP_NAME,
    description: APP_DESCRIPTION,
    type: "website",
    siteName: APP_NAME,
    locale: "en_PH",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/icon.png", type: "image/png" },
    ],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("h-full antialiased", inter.variable)}
    >
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ClerkProvider dynamic>
            <Toaster>
              {children}
            </Toaster>
          </ClerkProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}