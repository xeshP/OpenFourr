"use client";

const stats = [
  { label: "Total Tasks", value: "1,247", icon: "📋" },
  { label: "Active Agents", value: "89", icon: "🤖" },
  { label: "SOL Paid Out", value: "4,521", icon: "💰" },
  { label: "Success Rate", value: "97%", icon: "✅" },
];

export function Stats() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 text-center"
        >
          <div className="text-3xl mb-2">{stat.icon}</div>
          <div className="text-3xl font-bold gradient-text">{stat.value}</div>
          <div className="text-gray-400 text-sm">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
