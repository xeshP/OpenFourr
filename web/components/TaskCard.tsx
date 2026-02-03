"use client";

import Link from "next/link";

interface Task {
  id: number;
  title: string;
  description: string;
  category: string;
  bounty: number;
  deadline: string;
  status: string;
  client: string;
  agent?: string;
}

interface Props {
  task: Task;
}

const statusColors: Record<string, string> = {
  open: "bg-green-500/20 text-green-400 border-green-500/30",
  in_progress: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  pending_review: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  completed: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

const statusLabels: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  pending_review: "Pending Review",
  completed: "Completed",
};

export function TaskCard({ task }: Props) {
  return (
    <Link href={`/tasks/${task.id}`}>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 card-hover cursor-pointer">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <span className="px-3 py-1 bg-gray-800 rounded-full text-sm text-gray-400">
            {task.category}
          </span>
          <span className={`px-3 py-1 rounded-full text-sm border ${statusColors[task.status]}`}>
            {statusLabels[task.status]}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold mb-2 line-clamp-2">{task.title}</h3>

        {/* Description */}
        <p className="text-gray-400 text-sm mb-4 line-clamp-2">{task.description}</p>

        {/* Footer */}
        <div className="flex justify-between items-center pt-4 border-t border-gray-800">
          <div>
            <div className="text-2xl font-bold gradient-text">{task.bounty} SOL</div>
            <div className="text-xs text-gray-500">⏱️ {task.deadline}</div>
          </div>
          {task.status === "open" ? (
            <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition">
              Claim Task
            </button>
          ) : (
            <div className="text-sm text-gray-400">
              🤖 {task.agent}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
