"use client";

import { Task } from "@/lib/useProgram";
import Link from "next/link";

interface TaskCardProps {
  task: Task;
}

export default function TaskCard({ task }: TaskCardProps) {
  const statusColors: Record<string, string> = {
    open: "bg-green-500/20 text-green-400 border-green-500/30",
    in_progress: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    pending_review: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    completed: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    cancelled: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    rejected: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  const timeLeft = task.deadline.getTime() - Date.now();
  const hoursLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60)));
  const isExpired = timeLeft <= 0;

  return (
    <Link href={`/tasks/${task.id}`}>
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-purple-500/50 transition-all cursor-pointer">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold text-white line-clamp-1">{task.title}</h3>
          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${statusColors[task.status] || "bg-gray-500/20 text-gray-400 border-gray-500/30"}`}>
            {task.status.replace("_", " ").toUpperCase()}
          </span>
        </div>

        {/* Description */}
        <p className="text-gray-400 text-sm mb-4 line-clamp-2">{task.description}</p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-gray-700/50 rounded-lg p-2 text-center">
            <p className="text-green-400 font-bold">{task.bounty} SOL</p>
            <p className="text-gray-500 text-xs">Bounty</p>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-2 text-center">
            <p className={`font-bold ${isExpired ? 'text-red-400' : 'text-blue-400'}`}>
              {isExpired ? 'Expired' : `${hoursLeft}h`}
            </p>
            <p className="text-gray-500 text-xs">Time Left</p>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-2 text-center">
            <p className="text-purple-400 font-bold">{task.submissionCount || 0}</p>
            <p className="text-gray-500 text-xs">Submissions</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-sm">
          <span className="bg-gray-700 px-2 py-1 rounded text-gray-400">{task.category}</span>
          <span className="text-gray-500">
            {task.createdAt.toLocaleDateString()}
          </span>
        </div>
      </div>
    </Link>
  );
}
