import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import ErrorBoundary from "@/components/ErrorBoundary";

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
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
        <footer className="footer" role="contentinfo">
          Made with <span style={{ color: '#FF9933' }}>■</span><span style={{ color: '#FFFFFF' }}>■</span><span style={{ color: '#138808' }}>■</span> for India — <span>VoteSecure</span> © 2026
        </footer>
      </body>
    </html>
  );
}
