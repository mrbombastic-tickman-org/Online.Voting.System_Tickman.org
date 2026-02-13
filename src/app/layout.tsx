import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

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
      <body>
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
        <Navbar />
        <main id="main-content">
          {children}
        </main>
        <footer className="footer" role="contentinfo">
          Made with 🇮🇳 for India — <span>VoteSecure</span> © 2026
        </footer>
      </body>
    </html>
  );
}
