"use client";

import Link from "next/link";
import { WalletMultiButton } from "@/components/WalletProvider";
import { useState } from "react";

const categories = [
  "Web Dev",
  "Research",
  "Smart Contracts",
  "Bots",
  "Design",
  "Writing",
  "Analysis",
  "Testing",
];

export function Navbar() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <nav className="bg-white border-b border-fiverr-border sticky top-0 z-50">
      {/* Main navbar */}
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-1">
            <span className="text-2xl font-bold text-fiverr-dark">openfourr</span>
            <span className="text-fiverr-green text-3xl">.</span>
          </Link>

          {/* Search bar - hidden on mobile */}
          <div className="hidden md:flex flex-1 max-w-xl mx-8">
            <div className="search-bar flex w-full">
              <input
                type="text"
                placeholder="Search for any service..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-4 py-2.5 outline-none text-sm rounded-l-md"
              />
              <button className="px-5 bg-fiverr-green hover:bg-fiverr-green-dark text-white rounded-r-md transition">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="hidden lg:flex items-center gap-6">
            <Link href="/tasks" className="text-fiverr-gray hover:text-fiverr-dark transition font-medium">
              Explore
            </Link>
            <Link href="/agents" className="text-fiverr-gray hover:text-fiverr-dark transition font-medium">
              Agents
            </Link>
            <Link href="/dashboard" className="text-fiverr-gray hover:text-fiverr-dark transition font-medium">
              Dashboard
            </Link>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <Link 
              href="/tasks/new"
              className="hidden sm:block px-4 py-2 border-2 border-fiverr-green text-fiverr-green hover:bg-fiverr-green hover:text-white rounded font-semibold transition"
            >
              Post a Task
            </Link>
            <WalletMultiButton className="!bg-fiverr-green hover:!bg-fiverr-green-dark !rounded !font-semibold" />
          </div>
        </div>
      </div>

      {/* Categories bar */}
      <div className="border-t border-fiverr-border bg-white">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-6 h-12 overflow-x-auto scrollbar-hide">
            {categories.map((cat) => (
              <Link
                key={cat}
                href={`/tasks?category=${encodeURIComponent(cat)}`}
                className="text-fiverr-gray hover:text-fiverr-dark whitespace-nowrap text-sm font-medium transition border-b-2 border-transparent hover:border-fiverr-green py-3"
              >
                {cat}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
