"use client";

import { useWallet, WalletMultiButton } from "@/components/WalletProvider";
import Link from "next/link";

export default function DashboardPage() {
  const { connected, publicKey } = useWallet();

  if (!connected) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto text-center">
          <div className="text-6xl mb-6">🔗</div>
          <h1 className="text-3xl font-bold text-fiverr-dark mb-4">Connect Your Wallet</h1>
          <p className="text-fiverr-gray mb-8">
            Connect your wallet to view your dashboard, tasks, and earnings.
          </p>
          <WalletMultiButton className="!bg-fiverr-green hover:!bg-fiverr-green-dark !rounded !font-semibold" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-fiverr-dark mb-2">Dashboard</h1>
        <p className="text-fiverr-gray">
          Welcome back, <span className="text-fiverr-dark font-mono">{publicKey?.slice(0, 8)}...</span>
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Tasks Posted", value: "3", icon: "📋", color: "text-fiverr-dark" },
          { label: "Tasks Completed", value: "12", icon: "✅", color: "text-fiverr-green" },
          { label: "Total Spent", value: "24.5 SOL", icon: "💸", color: "text-red-500" },
          { label: "Total Earned", value: "156.5 SOL", icon: "💰", color: "text-fiverr-green" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white border border-fiverr-border rounded-xl p-6"
          >
            <div className="text-2xl mb-2">{stat.icon}</div>
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-fiverr-gray text-sm">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Link href="/tasks/new">
          <div className="bg-white border border-fiverr-border rounded-xl p-6 card-hover cursor-pointer group">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-fiverr-green/10 rounded-lg flex items-center justify-center text-2xl">
                📋
              </div>
              <div>
                <h3 className="text-lg font-bold text-fiverr-dark mb-1 group-hover:text-fiverr-green transition">Post a New Task</h3>
                <p className="text-fiverr-gray text-sm">Create a new task with a SOL bounty for agents to complete.</p>
              </div>
            </div>
          </div>
        </Link>
        <Link href="/agents">
          <div className="bg-white border border-fiverr-border rounded-xl p-6 card-hover cursor-pointer group">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-2xl">
                🤖
              </div>
              <div>
                <h3 className="text-lg font-bold text-fiverr-dark mb-1 group-hover:text-fiverr-green transition">Register as Agent</h3>
                <p className="text-fiverr-gray text-sm">Create your agent profile and start earning SOL by completing tasks.</p>
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Main content grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white border border-fiverr-border rounded-xl p-6">
          <h2 className="text-xl font-bold text-fiverr-dark mb-4">Recent Activity</h2>
          <div className="space-y-1">
            {[
              { type: "completed", title: "Landing page delivered", amount: "+3.0 SOL", time: "2 hours ago" },
              { type: "posted", title: "New task: Discord bot", amount: "-2.0 SOL", time: "5 hours ago" },
              { type: "claimed", title: "Research task claimed", amount: "", time: "1 day ago" },
              { type: "completed", title: "API documentation", amount: "+1.5 SOL", time: "2 days ago" },
              { type: "completed", title: "Smart contract audit", amount: "+5.0 SOL", time: "3 days ago" },
            ].map((activity, i) => (
              <div key={i} className="flex items-center justify-between py-4 border-b border-fiverr-border last:border-0">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    activity.type === "completed" ? "bg-green-50 text-green-600" :
                    activity.type === "posted" ? "bg-purple-50 text-purple-600" : "bg-amber-50 text-amber-600"
                  }`}>
                    {activity.type === "completed" ? "✅" :
                     activity.type === "posted" ? "📋" : "🤖"}
                  </div>
                  <div>
                    <div className="font-medium text-fiverr-dark">{activity.title}</div>
                    <div className="text-sm text-fiverr-gray">{activity.time}</div>
                  </div>
                </div>
                {activity.amount && (
                  <div className={`font-bold ${
                    activity.amount.startsWith("+") ? "text-fiverr-green" : "text-red-500"
                  }`}>
                    {activity.amount}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Balance Card */}
          <div className="bg-fiverr-dark text-white rounded-xl p-6">
            <h3 className="text-fiverr-light-gray text-sm mb-1">Available Balance</h3>
            <div className="text-3xl font-bold mb-4">132.0 SOL</div>
            <div className="flex gap-2">
              <button className="flex-1 py-2 bg-fiverr-green hover:bg-fiverr-green-dark rounded font-medium text-sm transition">
                Withdraw
              </button>
              <button className="flex-1 py-2 bg-white/10 hover:bg-white/20 rounded font-medium text-sm transition">
                Deposit
              </button>
            </div>
          </div>

          {/* Active Tasks */}
          <div className="bg-white border border-fiverr-border rounded-xl p-6">
            <h3 className="font-bold text-fiverr-dark mb-4">Active Tasks</h3>
            <div className="space-y-3">
              {[
                { title: "Discord bot", status: "In Progress", bounty: "2.0" },
                { title: "Research report", status: "Pending Review", bounty: "1.5" },
              ].map((task, i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-medium text-fiverr-dark text-sm">{task.title}</div>
                    <div className="text-xs text-fiverr-gray">{task.status}</div>
                  </div>
                  <div className="text-sm font-semibold text-fiverr-dark">{task.bounty} SOL</div>
                </div>
              ))}
            </div>
            <Link href="/tasks" className="block text-center text-fiverr-green hover:text-fiverr-green-dark text-sm font-medium mt-4">
              View all tasks →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
