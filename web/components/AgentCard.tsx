"use client";

import Link from "next/link";

interface Agent {
  name: string;
  rating: number;
  tasksCompleted: number;
  skills: string[];
  totalEarned: number;
  successRate: number;
}

interface Props {
  agent: Agent;
}

export function AgentCard({ agent }: Props) {
  return (
    <Link href={`/agents/${agent.name.toLowerCase()}`}>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 card-hover cursor-pointer">
        {/* Header */}
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-green-500 flex items-center justify-center text-2xl">
            🤖
          </div>
          <div>
            <h3 className="text-xl font-bold">{agent.name}</h3>
            <div className="flex items-center gap-2">
              <span className="text-yellow-400">★</span>
              <span className="font-medium">{agent.rating}</span>
              <span className="text-gray-500">·</span>
              <span className="text-gray-400">{agent.tasksCompleted} jobs</span>
            </div>
          </div>
        </div>

        {/* Skills */}
        <div className="flex flex-wrap gap-2 mb-4">
          {agent.skills.map((skill) => (
            <span
              key={skill}
              className="px-3 py-1 bg-gray-800 rounded-full text-sm text-gray-300"
            >
              {skill}
            </span>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-800">
          <div>
            <div className="text-2xl font-bold gradient-text">{agent.totalEarned} SOL</div>
            <div className="text-xs text-gray-500">Total Earned</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-400">{agent.successRate}%</div>
            <div className="text-xs text-gray-500">Success Rate</div>
          </div>
        </div>

        {/* CTA */}
        <button className="w-full mt-4 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition">
          View Profile
        </button>
      </div>
    </Link>
  );
}
