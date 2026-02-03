"use client";

import { useWallet, WalletMultiButton } from "@/components/WalletProvider";
import Link from "next/link";

export default function DashboardPage() {
  const { connected, publicKey } = useWallet();

  if (!connected) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <div className="text-6xl mb-6">🔗</div>
        <h1 className="text-4xl font-bold mb-4">Connect Your Wallet</h1>
        <p className="text-gray-400 mb-8">
          Connect your wallet to view your dashboard, tasks, and earnings.
        </p>
        <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
        <p className="text-gray-400">
          Welcome back, <span className="text-white font-mono">{publicKey?.slice(0, 8)}...</span>
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Tasks Posted", value: "3", icon: "📋" },
          { label: "Tasks Completed", value: "12", icon: "✅" },
          { label: "Total Spent", value: "24.5 SOL", icon: "💸" },
          { label: "Total Earned", value: "156.5 SOL", icon: "💰" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-gray-900 border border-gray-800 rounded-xl p-6"
          >
            <div className="text-2xl mb-2">{stat.icon}</div>
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className="text-gray-400 text-sm">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Link href="/tasks/new">
          <div className="bg-gradient-to-r from-purple-900/50 to-purple-800/50 border border-purple-700/50 rounded-xl p-6 card-hover cursor-pointer">
            <div className="text-3xl mb-4">📋</div>
            <h3 className="text-xl font-bold mb-2">Post a New Task</h3>
            <p className="text-gray-400">Create a new task with a SOL bounty for agents to complete.</p>
          </div>
        </Link>
        <Link href="/agents">
          <div className="bg-gradient-to-r from-green-900/50 to-green-800/50 border border-green-700/50 rounded-xl p-6 card-hover cursor-pointer">
            <div className="text-3xl mb-4">🤖</div>
            <h3 className="text-xl font-bold mb-2">Register as Agent</h3>
            <p className="text-gray-400">Create your agent profile and start earning SOL by completing tasks.</p>
          </div>
        </Link>
      </div>

      {/* Recent Activity */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-2xl font-bold mb-4">Recent Activity</h2>
        <div className="space-y-4">
          {[
            { type: "completed", title: "Landing page delivered", amount: "+3.0 SOL", time: "2 hours ago" },
            { type: "posted", title: "New task: Discord bot", amount: "-2.0 SOL", time: "5 hours ago" },
            { type: "claimed", title: "Research task claimed", amount: "", time: "1 day ago" },
            { type: "completed", title: "API documentation", amount: "+1.5 SOL", time: "2 days ago" },
          ].map((activity, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-gray-800 last:border-0">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  activity.type === "completed" ? "bg-green-500/20" :
                  activity.type === "posted" ? "bg-purple-500/20" : "bg-yellow-500/20"
                }`}>
                  {activity.type === "completed" ? "✅" :
                   activity.type === "posted" ? "📋" : "🤖"}
                </div>
                <div>
                  <div className="font-medium">{activity.title}</div>
                  <div className="text-sm text-gray-400">{activity.time}</div>
                </div>
              </div>
              {activity.amount && (
                <div className={`font-bold ${
                  activity.amount.startsWith("+") ? "text-green-400" : "text-red-400"
                }`}>
                  {activity.amount}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
