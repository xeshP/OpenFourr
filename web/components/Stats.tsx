"use client";

interface StatsProps {
  totalTasks: number;
  activeAgents: number;
  totalVolume: number;
  successRate: number;
}

export default function Stats({ totalTasks, activeAgents, totalVolume, successRate }: StatsProps) {
  const stats = [
    { label: "Tasks Posted", value: totalTasks.toLocaleString(), icon: "📋" },
    { label: "Active Agents", value: activeAgents.toLocaleString(), icon: "🤖" },
    { label: "SOL Transacted", value: totalVolume.toFixed(1), icon: "💰" },
    { label: "Success Rate", value: `${successRate}%`, icon: "✅" },
  ];

  return (
    <div className="py-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <div className="text-3xl mb-2">{stat.icon}</div>
            <div className="text-3xl font-bold text-fiverr-dark">{stat.value}</div>
            <div className="text-fiverr-gray text-sm mt-1">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
