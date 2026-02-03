"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@/components/WalletProvider";
import { useProgram, Task, getTaskPDA, getEscrowPDA } from "@/lib/useProgram";
import Link from "next/link";
import { useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

export default function TaskDetailPage() {
  const params = useParams();
  const taskId = parseInt(params.id as string);
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const { fetchAllTasks, claimTask, submitWork } = useProgram();
  
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [escrowBalance, setEscrowBalance] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTask() {
      setLoading(true);
      try {
        const tasks = await fetchAllTasks();
        const found = tasks.find(t => t.id === taskId);
        setTask(found || null);
        
        // Get escrow balance
        if (found) {
          const [escrowPDA] = getEscrowPDA(taskId);
          const balance = await connection.getBalance(escrowPDA);
          setEscrowBalance(balance / LAMPORTS_PER_SOL);
        }
      } catch (e) {
        console.error("Failed to load task:", e);
        setError("Failed to load task");
      }
      setLoading(false);
    }
    
    if (!isNaN(taskId)) {
      loadTask();
    }
  }, [taskId, fetchAllTasks, connection]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-green-100 text-green-800";
      case "in_progress": return "bg-blue-100 text-blue-800";
      case "pending_review": return "bg-yellow-100 text-yellow-800";
      case "completed": return "bg-purple-100 text-purple-800";
      case "rejected": return "bg-red-100 text-red-800";
      case "cancelled": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusText = (status: string) => {
    return status.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeRemaining = (deadline: Date) => {
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();
    
    if (diff < 0) return "Expired";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} left`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} left`;
    return "Less than 1 hour left";
  };

  const isOwner = publicKey && task?.client === publicKey.toString();
  const isAssignedAgent = publicKey && task?.assignedAgent === publicKey.toString();

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-fiverr-gray">Loading task from Solana...</p>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-fiverr-dark mb-4">Task Not Found</h1>
          <p className="text-fiverr-gray mb-6">This task doesn't exist or has been removed.</p>
          <Link href="/tasks" className="px-6 py-3 bg-fiverr-green text-white rounded font-semibold">
            Browse Tasks
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link href="/tasks" className="text-fiverr-green hover:underline">← Back to Tasks</Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div className="bg-white border border-fiverr-border rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(task.status)}`}>
                  {getStatusText(task.status)}
                </span>
                <span className="ml-2 text-sm text-fiverr-gray">#{task.id}</span>
              </div>
              <span className="text-sm text-fiverr-gray">{task.category}</span>
            </div>
            
            <h1 className="text-2xl font-bold text-fiverr-dark mb-4">{task.title}</h1>
            
            <div className="flex items-center gap-4 text-sm text-fiverr-gray">
              <span>Posted {formatDate(task.createdAt)}</span>
              <span>•</span>
              <span className={task.deadline < new Date() ? "text-red-500" : "text-fiverr-dark"}>
                {getTimeRemaining(task.deadline)}
              </span>
            </div>
          </div>

          {/* Description */}
          <div className="bg-white border border-fiverr-border rounded-xl p-6">
            <h2 className="text-lg font-bold text-fiverr-dark mb-4">Description</h2>
            <p className="text-fiverr-dark whitespace-pre-wrap">{task.description}</p>
          </div>

          {/* Requirements */}
          {task.requirements && (
            <div className="bg-white border border-fiverr-border rounded-xl p-6">
              <h2 className="text-lg font-bold text-fiverr-dark mb-4">Requirements</h2>
              <p className="text-fiverr-dark whitespace-pre-wrap">{task.requirements}</p>
            </div>
          )}

          {/* Submission (if any) */}
          {task.submissionUrl && (
            <div className="bg-white border border-fiverr-border rounded-xl p-6">
              <h2 className="text-lg font-bold text-fiverr-dark mb-4">📦 Submission</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-fiverr-gray">Submission URL:</label>
                  <a href={task.submissionUrl} target="_blank" rel="noopener noreferrer" 
                     className="block text-fiverr-green hover:underline break-all">
                    {task.submissionUrl}
                  </a>
                </div>
                {task.submissionNotes && (
                  <div>
                    <label className="text-sm text-fiverr-gray">Notes:</label>
                    <p className="text-fiverr-dark">{task.submissionNotes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Rating (if completed) */}
          {task.status === "completed" && task.rating && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6">
              <h2 className="text-lg font-bold text-green-800 mb-2">✅ Task Completed</h2>
              <div className="flex items-center gap-2">
                <span className="text-yellow-500 text-xl">{"★".repeat(task.rating)}</span>
                <span className="text-fiverr-gray">{task.rating}/5 rating</span>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Bounty Card */}
          <div className="bg-white border border-fiverr-border rounded-xl p-6">
            <div className="text-center mb-6">
              <div className="text-4xl font-bold text-fiverr-green mb-1">{task.bounty.toFixed(2)} SOL</div>
              <div className="text-sm text-fiverr-gray">Bounty Amount</div>
            </div>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-fiverr-gray">Escrow Balance:</span>
                <span className="font-medium text-fiverr-dark">{escrowBalance.toFixed(4)} SOL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fiverr-gray">Platform Fee:</span>
                <span className="font-medium text-fiverr-dark">2.5%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fiverr-gray">Agent Receives:</span>
                <span className="font-medium text-fiverr-green">{(task.bounty * 0.975).toFixed(4)} SOL</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 space-y-3">
              {!connected ? (
                <WalletMultiButton className="!w-full !bg-fiverr-green hover:!bg-fiverr-green-dark !rounded !font-semibold !justify-center" />
              ) : task.status === "open" && !isOwner ? (
                <button 
                  onClick={() => alert("Coming soon! Register as an agent first.")}
                  className="w-full py-3 bg-fiverr-green hover:bg-fiverr-green-dark text-white rounded-lg font-semibold transition"
                >
                  Claim Task
                </button>
              ) : task.status === "in_progress" && isAssignedAgent ? (
                <button 
                  onClick={() => alert("Coming soon!")}
                  className="w-full py-3 bg-fiverr-green hover:bg-fiverr-green-dark text-white rounded-lg font-semibold transition"
                >
                  Submit Work
                </button>
              ) : task.status === "pending_review" && isOwner ? (
                <div className="space-y-2">
                  <button 
                    onClick={() => alert("Coming soon!")}
                    className="w-full py-3 bg-fiverr-green hover:bg-fiverr-green-dark text-white rounded-lg font-semibold transition"
                  >
                    Approve & Pay
                  </button>
                  <button 
                    onClick={() => alert("Coming soon!")}
                    className="w-full py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition"
                  >
                    Reject
                  </button>
                </div>
              ) : isOwner && task.status === "open" ? (
                <div className="text-center text-fiverr-gray text-sm">
                  Waiting for an agent to claim this task...
                </div>
              ) : null}
            </div>
          </div>

          {/* Client Info */}
          <div className="bg-white border border-fiverr-border rounded-xl p-6">
            <h3 className="font-bold text-fiverr-dark mb-4">Client</h3>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-fiverr-green/10 rounded-full flex items-center justify-center">
                👤
              </div>
              <div>
                <div className="font-medium text-fiverr-dark font-mono text-sm">
                  {task.client.slice(0, 4)}...{task.client.slice(-4)}
                </div>
                {isOwner && (
                  <span className="text-xs text-fiverr-green">(You)</span>
                )}
              </div>
            </div>
          </div>

          {/* Assigned Agent (if any) */}
          {task.assignedAgent && (
            <div className="bg-white border border-fiverr-border rounded-xl p-6">
              <h3 className="font-bold text-fiverr-dark mb-4">Assigned Agent</h3>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
                  🤖
                </div>
                <div>
                  <div className="font-medium text-fiverr-dark font-mono text-sm">
                    {task.assignedAgent.slice(0, 4)}...{task.assignedAgent.slice(-4)}
                  </div>
                  {isAssignedAgent && (
                    <span className="text-xs text-fiverr-green">(You)</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Task PDAs */}
          <div className="bg-fiverr-background border border-fiverr-border rounded-xl p-4 text-xs">
            <div className="font-semibold text-fiverr-dark mb-2">On-Chain Info</div>
            <div className="space-y-1 text-fiverr-gray font-mono break-all">
              <div>Task ID: {task.id}</div>
              <div>Deadline: {task.deadline.toISOString()}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
