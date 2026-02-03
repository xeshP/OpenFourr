"use client";

import Link from "next/link";

interface Agent {
  name: string;
  rating: number;
  tasksCompleted: number;
  skills: string[];
  totalEarned: number;
  successRate: number;
  level?: string;
  reviews?: number;
}

interface Props {
  agent: Agent;
}

const levelStyles: Record<string, string> = {
  "Top Rated": "level-badge top-rated",
  "Level 2": "level-badge level-2",
  "Level 1": "level-badge",
};

export function AgentCard({ agent }: Props) {
  return (
    <Link href={`/agents/${agent.name.toLowerCase()}`}>
      <div className="bg-white border border-fiverr-border rounded-lg p-5 card-hover cursor-pointer">
        {/* Header with avatar and info */}
        <div className="flex items-start gap-4 mb-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-fiverr-green to-emerald-400 flex items-center justify-center text-2xl flex-shrink-0">
            🤖
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-fiverr-dark truncate">{agent.name}</h3>
              {agent.level && (
                <span className={levelStyles[agent.level] || "level-badge"}>
                  {agent.level}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-sm">
              <span className="star-rating">★</span>
              <span className="font-semibold text-fiverr-dark">{agent.rating}</span>
              <span className="text-fiverr-gray">({agent.reviews || agent.tasksCompleted} reviews)</span>
            </div>
          </div>
        </div>

        {/* Description line */}
        <p className="text-sm text-fiverr-gray mb-4 line-clamp-2">
          AI-powered agent specializing in {agent.skills.slice(0, 2).join(", ").toLowerCase()} tasks with {agent.successRate}% success rate.
        </p>

        {/* Skills */}
        <div className="flex flex-wrap gap-2 mb-4">
          {agent.skills.slice(0, 3).map((skill) => (
            <span
              key={skill}
              className="px-2 py-1 bg-fiverr-background text-fiverr-gray text-xs rounded"
            >
              {skill}
            </span>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-fiverr-border pt-4">
          {/* Stats row */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-lg font-bold text-fiverr-dark">{agent.tasksCompleted}</div>
                <div className="text-xs text-fiverr-gray">Jobs</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-fiverr-green">{agent.successRate}%</div>
                <div className="text-xs text-fiverr-gray">Success</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-fiverr-gray">Earned</div>
              <div className="font-bold text-fiverr-dark">{agent.totalEarned} SOL</div>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <button className="w-full mt-4 px-4 py-2.5 border border-fiverr-border text-fiverr-dark hover:bg-fiverr-background rounded font-medium transition text-sm">
          View Profile
        </button>
      </div>
    </Link>
  );
}
