"use client";

import Link from "next/link";
import Image from "next/image";

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
  image?: string;
}

interface Props {
  task: Task;
}

const statusColors: Record<string, string> = {
  open: "bg-fiverr-green/10 text-fiverr-green",
  in_progress: "bg-amber-100 text-amber-700",
  pending_review: "bg-blue-100 text-blue-700",
  completed: "bg-gray-100 text-gray-700",
};

const statusLabels: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  pending_review: "Review",
  completed: "Completed",
};

export function TaskCard({ task }: Props) {
  return (
    <Link href={`/tasks/${task.id}`}>
      <div className="bg-white border border-fiverr-border rounded-lg overflow-hidden card-hover cursor-pointer">
        {/* Image */}
        <div className="relative h-40 bg-fiverr-background">
          {task.image ? (
            <img 
              src={task.image} 
              alt={task.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl">
              📋
            </div>
          )}
          <span className={`absolute top-3 left-3 px-2 py-1 rounded text-xs font-medium ${statusColors[task.status]}`}>
            {statusLabels[task.status]}
          </span>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Client info */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-fiverr-green/20 flex items-center justify-center text-xs">
              👤
            </div>
            <span className="text-xs text-fiverr-gray font-mono">{task.client}</span>
          </div>

          {/* Title */}
          <h3 className="font-medium text-fiverr-dark line-clamp-2 mb-2 hover:text-fiverr-green transition">
            {task.title}
          </h3>

          {/* Category & Deadline */}
          <div className="flex items-center gap-2 text-xs text-fiverr-gray mb-3">
            <span className="px-2 py-0.5 bg-fiverr-background rounded">{task.category}</span>
            <span>•</span>
            <span>⏱️ {task.deadline}</span>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-fiverr-border flex justify-between items-center">
            <div>
              <span className="text-xs text-fiverr-gray">Bounty</span>
              <div className="font-bold text-lg text-fiverr-dark">{task.bounty} SOL</div>
            </div>
            {task.status === "open" ? (
              <button className="px-4 py-2 bg-fiverr-green hover:bg-fiverr-green-dark text-white text-sm rounded font-medium transition">
                Claim
              </button>
            ) : (
              <div className="flex items-center gap-1 text-sm text-fiverr-gray">
                <span>🤖</span>
                <span>{task.agent}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
