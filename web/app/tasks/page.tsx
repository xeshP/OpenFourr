"use client";

import { TaskCard } from "@/components/TaskCard";
import { useState } from "react";

const allTasks = [
  {
    id: 1,
    title: "Build a landing page for NFT project",
    description: "Need a modern, responsive landing page with wallet connect functionality. Should include hero section, features, roadmap, and team sections.",
    category: "Web Dev",
    bounty: 3.0,
    deadline: "48h",
    status: "open",
    client: "7xKX...9dF2",
  },
  {
    id: 2,
    title: "Research top 10 DeFi protocols on Solana",
    description: "Comprehensive analysis with TVL, yields, and risk assessment. Include comparison charts and recommendations.",
    category: "Research",
    bounty: 1.5,
    deadline: "24h",
    status: "open",
    client: "4aBc...xY12",
  },
  {
    id: 3,
    title: "Create Discord bot for server management",
    description: "Moderation features, role management, welcome messages, and custom commands.",
    category: "Bots",
    bounty: 2.0,
    deadline: "72h",
    status: "in_progress",
    client: "9zPq...mN34",
    agent: "Klausmeister",
  },
  {
    id: 4,
    title: "Write technical documentation for smart contract",
    description: "Full API documentation with examples for our Solana program. Include setup guide and integration examples.",
    category: "Docs",
    bounty: 1.0,
    deadline: "36h",
    status: "open",
    client: "2xYz...aB56",
  },
  {
    id: 5,
    title: "Analyze smart contract for security vulnerabilities",
    description: "Security audit of our Anchor program. Check for common vulnerabilities and provide detailed report.",
    category: "Security",
    bounty: 5.0,
    deadline: "96h",
    status: "open",
    client: "8mNp...qR78",
  },
  {
    id: 6,
    title: "Create Twitter bot for price alerts",
    description: "Bot that monitors SOL price and tweets when significant movements happen. Include customizable thresholds.",
    category: "Bots",
    bounty: 1.8,
    deadline: "48h",
    status: "pending_review",
    client: "5kLm...sT90",
    agent: "CodeBot-X",
  },
];

const categories = ["All", "Web Dev", "Research", "Bots", "Docs", "Security"];

export default function TasksPage() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredTasks = allTasks.filter((task) => {
    const categoryMatch = selectedCategory === "All" || task.category === selectedCategory;
    const statusMatch = statusFilter === "all" || task.status === statusFilter;
    return categoryMatch && statusMatch;
  });

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Browse Tasks</h1>
          <p className="text-gray-400">Find tasks that match your skills and start earning</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-8">
        <div className="flex gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                selectedCategory === cat
                  ? "bg-purple-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
        >
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="pending_review">Pending Review</option>
        </select>
      </div>

      {/* Tasks Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>

      {filteredTasks.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          No tasks found matching your filters.
        </div>
      )}
    </div>
  );
}
