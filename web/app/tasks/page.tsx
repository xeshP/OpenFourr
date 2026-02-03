"use client";

import { TaskCard } from "@/components/TaskCard";
import { useState, useEffect } from "react";
import { useProgram, Task } from "@/lib/useProgram";
import Link from "next/link";

const categories = ["All", "Web Development", "Research", "Bots & Automation", "Smart Contracts", "Design", "Writing"];

export default function TasksPage() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { fetchAllTasks } = useProgram();

  useEffect(() => {
    async function loadTasks() {
      setLoading(true);
      try {
        const data = await fetchAllTasks();
        setTasks(data);
      } catch (e) {
        console.error("Failed to load tasks:", e);
      }
      setLoading(false);
    }
    loadTasks();
  }, [fetchAllTasks]);

  const filteredTasks = tasks.filter((task) => {
    const categoryMatch = selectedCategory === "All" || task.category === selectedCategory;
    const statusMatch = statusFilter === "all" || task.status === statusFilter;
    return categoryMatch && statusMatch;
  });

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-fiverr-dark mb-2">Browse Tasks</h1>
          <p className="text-fiverr-gray">Find tasks that match your skills and start earning</p>
        </div>
        <Link 
          href="/tasks/new"
          className="px-6 py-3 bg-fiverr-green hover:bg-fiverr-green-dark text-white rounded font-semibold transition"
        >
          Post a Task
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-8 pb-6 border-b border-fiverr-border">
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`category-pill ${selectedCategory === cat ? "active" : ""}`}
            >
              {cat}
            </button>
          ))}
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-fiverr-border rounded-lg text-fiverr-dark bg-white outline-none focus:border-fiverr-dark"
        >
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="pending_review">Pending Review</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Results count */}
      <p className="text-fiverr-gray mb-6">{filteredTasks.length} tasks available</p>

      {/* Loading state */}
      {loading ? (
        <div className="text-center py-12 text-fiverr-gray">Loading tasks from Solana...</div>
      ) : filteredTasks.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredTasks.map((task) => (
            <TaskCard key={task.id} task={{
              id: task.id,
              title: task.title,
              description: task.description,
              category: task.category,
              bounty: task.bounty,
              deadline: getDeadlineString(task.deadline),
              status: task.status,
              client: shortenAddress(task.client),
              agent: task.assignedAgent ? shortenAddress(task.assignedAgent) : undefined,
            }} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-fiverr-background rounded-xl">
          <div className="text-4xl mb-4">📋</div>
          <p className="text-fiverr-gray mb-4">No tasks found on-chain yet.</p>
          <Link href="/tasks/new" className="px-6 py-3 bg-fiverr-green hover:bg-fiverr-green-dark text-white rounded font-semibold transition inline-block">
            Post the First Task
          </Link>
        </div>
      )}
    </div>
  );
}

function shortenAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function getDeadlineString(deadline: Date): string {
  const now = new Date();
  const diff = deadline.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  
  if (hours < 0) return "Expired";
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
