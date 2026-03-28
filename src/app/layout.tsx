import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "@/providers/Providers";
import { ToastContainer } from "react-toastify";

const spaceGrotesk = Space_Grotesk({ 
  subsets: ["latin"],
  variable: "--font-space",
  display: "swap",
  weight: ['400', '500', '600', '700']
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0f",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://rugblitz.vercel.app/"),
  title: "RugBlitz",
  description:
    "RugBlitz - A high tension onchain door game where you dodge rugs, climb through levels and decide when to lock in the win. Powered by Monad.",
  keywords: ["web3", "onchain", "game", "blockchain", "crypto", "rugblitz", "rug", "monad"],
  authors: [{ name: "RugBlitz Team" }],
  openGraph: {
    title: "RugBlitz",
    description:
      "Dodge the rug, chase the win. In RugBlitz every door choice can push you higher or end it all. Powered by Monad.",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/icon.png",
        width: 512,
        height: 512,
        alt: "RugBlitz",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "RugBlitz",
    description:
      "Dodge the rug, climb levels and lock in the win before it slips away. Powered by Monad.",
    images: ["/icon.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={spaceGrotesk.variable} suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <Providers>
          {children}
           <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss={false}
          draggable
          pauseOnHover
          theme="dark"
          toastClassName={ "bg-zinc-900 border-2 border-zinc-700 rounded-md text-white shadow-brutal-sm font-medium font-sans"}
        />
        </Providers>
      </body>
    </html>
  );
}
