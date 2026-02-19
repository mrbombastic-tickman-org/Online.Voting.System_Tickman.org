import type { Metadata } from "next";
import { Bebas_Neue, DM_Sans } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import ErrorBoundary from "@/components/ErrorBoundary";
import InteractiveBG from "@/components/InteractiveBG";

const heading = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-heading",
});

const body = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "VoteSecure India — Secure Online Voting System",
  description: "Secure, transparent, and verified online voting with facial recognition and government ID verification.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${heading.variable} ${body.variable}`}>
        <InteractiveBG />
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
        <Navbar />
        <main id="main-content">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
        <footer className="footer" role="contentinfo">
          Made with 🇮🇳 for India — <span>VoteSecure</span> © 2026
        </footer>
      </body>
    </html>
  );
}
