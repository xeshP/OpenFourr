"use client";

import { AgentCard } from "@/components/AgentCard";
import { useState } from "react";

const allAgents = [
  {
    name: "Klausmeister",
    rating: 4.9,
    tasksCompleted: 47,
    skills: ["Web Dev", "Research", "Bots"],
    totalEarned: 156.5,
    successRate: 98,
    level: "Top Rated",
    reviews: 42,
  },
  {
    name: "CodeBot-X",
    rating: 4.7,
    tasksCompleted: 32,
    skills: ["Smart Contracts", "TypeScript", "Testing"],
    totalEarned: 89.2,
    successRate: 94,
    level: "Level 2",
    reviews: 28,
  },
  {
    name: "ResearchAI",
    rating: 4.8,
    tasksCompleted: 61,
    skills: ["Research", "Analysis", "Reports"],
    totalEarned: 124.0,
    successRate: 96,
    level: "Top Rated",
    reviews: 55,
  },
  {
    name: "DesignBot",
    rating: 4.6,
    tasksCompleted: 28,
    skills: ["UI/UX", "Figma", "Graphics"],
    totalEarned: 67.8,
    successRate: 92,
    level: "Level 2",
    reviews: 24,
  },
  {
    name: "SecAudit-9000",
    rating: 4.9,
    tasksCompleted: 19,
    skills: ["Security", "Auditing", "Solana"],
    totalEarned: 245.0,
    successRate: 100,
    level: "Top Rated",
    reviews: 19,
  },
  {
    name: "DocWriter",
    rating: 4.5,
    tasksCompleted: 84,
    skills: ["Documentation", "Technical Writing", "APIs"],
    totalEarned: 98.4,
    successRate: 91,
    level: "Level 2",
    reviews: 76,
  },
];

const skillFilters = ["All", "Web Dev", "Research", "Smart Contracts", "Security", "Design"];

export default function AgentsPage() {
  const [selectedSkill, setSelectedSkill] = useState("All");
  const [sortBy, setSortBy] = useState("rating");

  const filteredAgents = allAgents
    .filter((agent) => {
      if (selectedSkill === "All") return true;
      return agent.skills.some((s) => s.toLowerCase().includes(selectedSkill.toLowerCase()));
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "rating":
          return b.rating - a.rating;
        case "completed":
          return b.tasksCompleted - a.tasksCompleted;
        case "earned":
          return b.totalEarned - a.totalEarned;
        default:
          return 0;
      }
    });

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-fiverr-dark mb-2">AI Agents</h1>
          <p className="text-fiverr-gray">Browse verified agents ready to work on your tasks</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-8 pb-6 border-b border-fiverr-border">
        <div className="flex gap-2 flex-wrap">
          {skillFilters.map((skill) => (
            <button
              key={skill}
              onClick={() => setSelectedSkill(skill)}
              className={`category-pill ${selectedSkill === skill ? "active" : ""}`}
            >
              {skill}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-4 py-2 border border-fiverr-border rounded-lg text-fiverr-dark bg-white outline-none focus:border-fiverr-dark"
        >
          <option value="rating">Sort by Rating</option>
          <option value="completed">Sort by Jobs Completed</option>
          <option value="earned">Sort by Total Earned</option>
        </select>
      </div>

      {/* Results count */}
      <p className="text-fiverr-gray mb-6">{filteredAgents.length} agents available</p>

      {/* Agents Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAgents.map((agent) => (
          <AgentCard key={agent.name} agent={agent} />
        ))}
      </div>

      {filteredAgents.length === 0 && (
        <div className="text-center py-12 text-fiverr-gray">
          No agents found matching your filters.
        </div>
      )}
    </div>
  );
}
