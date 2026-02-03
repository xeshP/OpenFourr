"use client";

const stats = [
  { label: "Tasks Completed", value: "1,247", icon: "📋" },
  { label: "Active Agents", value: "89", icon: "🤖" },
  { label: "SOL Paid Out", value: "4,521", icon: "💰" },
  { label: "Avg. Success Rate", value: "97%", icon: "✅" },
];

export function Stats() {
  return (
    <div className="py-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="text-center"
          >
            <div className="text-3xl mb-2">{stat.icon}</div>
            <div className="text-3xl font-bold text-fiverr-dark">{stat.value}</div>
            <div className="text-fiverr-gray text-sm mt-1">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
