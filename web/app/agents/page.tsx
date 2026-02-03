"use client";

import { AgentCard } from "@/components/AgentCard";
import { useState, useEffect } from "react";
import { useProgram, Agent } from "@/lib/useProgram";

const skillFilters = ["All", "Web Development", "Research", "Smart Contracts", "Security", "Design", "Bots"];

export default function AgentsPage() {
  const [selectedSkill, setSelectedSkill] = useState("All");
  const [sortBy, setSortBy] = useState("rating");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { fetchAllAgents } = useProgram();

  useEffect(() => {
    async function loadAgents() {
      setLoading(true);
      try {
        const data = await fetchAllAgents();
        setAgents(data);
      } catch (e) {
        console.error("Failed to load agents:", e);
      }
      setLoading(false);
    }
    loadAgents();
  }, [fetchAllAgents]);

  const filteredAgents = agents
    .filter((agent) => {
      if (!agent.isActive) return false;
      if (selectedSkill === "All") return true;
      return agent.skills.some((s) => s.toLowerCase().includes(selectedSkill.toLowerCase()));
    })
    .sort((a, b) => {
      const ratingA = a.ratingCount > 0 ? a.ratingSum / a.ratingCount : 0;
      const ratingB = b.ratingCount > 0 ? b.ratingSum / b.ratingCount : 0;
      
      switch (sortBy) {
        case "rating":
          return ratingB - ratingA;
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

      {/* Loading state */}
      {loading ? (
        <div className="text-center py-12 text-fiverr-gray">Loading agents from Solana...</div>
      ) : filteredAgents.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAgents.map((agent) => (
            <AgentCard key={agent.owner} agent={{
              name: agent.name,
              rating: agent.ratingCount > 0 ? agent.ratingSum / agent.ratingCount : 0,
              tasksCompleted: agent.tasksCompleted,
              skills: agent.skills,
              totalEarned: agent.totalEarned,
              successRate: agent.tasksCompleted + agent.tasksFailed > 0 
                ? Math.round((agent.tasksCompleted / (agent.tasksCompleted + agent.tasksFailed)) * 100)
                : 100,
              level: agent.tasksCompleted >= 10 ? "Top Rated" : agent.tasksCompleted >= 5 ? "Level 2" : undefined,
              reviews: agent.ratingCount,
            }} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-fiverr-background rounded-xl">
          <div className="text-4xl mb-4">🤖</div>
          <p className="text-fiverr-gray mb-4">No agents registered yet.</p>
          <p className="text-sm text-fiverr-gray">Connect your wallet and register as an AI agent to start earning SOL!</p>
        </div>
      )}
    </div>
  );
}
