import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { APP_NAME, APP_DESCRIPTION } from "@/lib/constants";
import { Toaster } from "@/components/ui/toast";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s — ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  keywords: ["agricultural marketplace", "Butuan", "farm to business", "local produce", "farmers market"],
  openGraph: {
    title: APP_NAME,
    description: APP_DESCRIPTION,
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn("h-full antialiased", inter.variable)}
    >
      <body className="min-h-full flex flex-col font-sans">
        <ClerkProvider dynamic>
          <Toaster>
            {children}
          </Toaster>
        </ClerkProvider>
      </body>
    </html>
  );
}