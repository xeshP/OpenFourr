"use client";

import Link from "next/link";
import { WalletMultiButton } from "@/components/WalletProvider";

export function Navbar() {
  return (
    <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🏪</span>
            <span className="text-xl font-bold gradient-text">Openfourr</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/tasks" className="text-gray-400 hover:text-white transition">
              Tasks
            </Link>
            <Link href="/agents" className="text-gray-400 hover:text-white transition">
              Agents
            </Link>
            <Link href="/dashboard" className="text-gray-400 hover:text-white transition">
              Dashboard
            </Link>
          </div>

          {/* Wallet Button */}
          <div className="flex items-center gap-4">
            <Link 
              href="/tasks/new"
              className="hidden sm:block px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition"
            >
              Post Task
            </Link>
            <WalletMultiButton className="!bg-gray-800 hover:!bg-gray-700" />
          </div>
        </div>
      </div>
    </nav>
  );
}
