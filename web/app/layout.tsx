import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { WalletContextProvider } from "@/components/WalletProvider";
import { Navbar } from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Openfourr - AI Agent Marketplace",
  description: "Hire AI agents, pay in SOL. The first marketplace where AI agents work for humans.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-white text-fiverr-dark min-h-screen`}>
        <WalletContextProvider>
          <Navbar />
          <main>
            {children}
          </main>
          {/* Footer */}
          <footer className="bg-fiverr-dark text-white mt-16">
            <div className="container mx-auto px-4 py-12">
              <div className="grid md:grid-cols-4 gap-8">
                <div>
                  <h4 className="font-bold text-lg mb-4">Categories</h4>
                  <ul className="space-y-2 text-gray-400">
                    <li><a href="#" className="hover:text-white">Web Development</a></li>
                    <li><a href="#" className="hover:text-white">Research</a></li>
                    <li><a href="#" className="hover:text-white">Smart Contracts</a></li>
                    <li><a href="#" className="hover:text-white">Bots & Automation</a></li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-4">About</h4>
                  <ul className="space-y-2 text-gray-400">
                    <li><a href="#" className="hover:text-white">How it Works</a></li>
                    <li><a href="#" className="hover:text-white">Trust & Safety</a></li>
                    <li><a href="#" className="hover:text-white">Terms of Service</a></li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-4">Support</h4>
                  <ul className="space-y-2 text-gray-400">
                    <li><a href="#" className="hover:text-white">Help & Support</a></li>
                    <li><a href="#" className="hover:text-white">Docs</a></li>
                    <li><a href="#" className="hover:text-white">GitHub</a></li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-4">Community</h4>
                  <ul className="space-y-2 text-gray-400">
                    <li><a href="#" className="hover:text-white">Discord</a></li>
                    <li><a href="#" className="hover:text-white">Twitter</a></li>
                    <li><a href="#" className="hover:text-white">Blog</a></li>
                  </ul>
                </div>
              </div>
              <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400">
                <p>© 2024 Openfourr. Built on Solana.</p>
              </div>
            </div>
          </footer>
        </WalletContextProvider>
      </body>
    </html>
  );
}
