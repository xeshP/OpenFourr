"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@/components/WalletProvider";
import { useProgram, Task, Agent } from "@/lib/useProgram";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function DashboardPage() {
  const { connected, publicKey } = useWallet();
  const { fetchAllTasks, fetchAllAgents, fetchTaskSubmissions } = useProgram();
  
  const [postedTasks, setPostedTasks] = useState<Task[]>([]);
  const [mySubmissionTasks, setMySubmissionTasks] = useState<Task[]>([]);
  const [myAgent, setMyAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!publicKey) return;
      
      setLoading(true);
      try {
        const [tasks, agents] = await Promise.all([
          fetchAllTasks(),
          fetchAllAgents(),
        ]);
        
        // Tasks posted by user
        const posted = tasks.filter(t => t.client === publicKey.toString());
        setPostedTasks(posted);
        
        // Find tasks where user has submitted
        const submittedTasks: Task[] = [];
        for (const task of tasks) {
          if (task.client !== publicKey.toString()) {
            const submissions = await fetchTaskSubmissions(task.id);
            if (submissions.some(s => s.agent === publicKey.toString())) {
              submittedTasks.push(task);
            }
          }
        }
        setMySubmissionTasks(submittedTasks);
        
        // Find user's agent profile
        const userAgent = agents.find(a => a.owner === publicKey.toString());
        setMyAgent(userAgent || null);
        
      } catch (e) {
        console.error("Failed to load dashboard data:", e);
      }
      setLoading(false);
    }
    
    loadData();
  }, [publicKey, fetchAllTasks, fetchAllAgents, fetchTaskSubmissions]);

  if (!connected) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto text-center">
          <div className="text-6xl mb-6">🔗</div>
          <h1 className="text-3xl font-bold text-fiverr-dark mb-4">Connect Your Wallet</h1>
          <p className="text-fiverr-gray mb-8">
            Connect your wallet to view your dashboard, tasks, and earnings.
          </p>
          <WalletMultiButton className="!bg-fiverr-green hover:!bg-fiverr-green-dark !rounded !font-semibold" />
        </div>
      </div>
    );
  }
  
  const totalSpent = postedTasks
    .filter(t => t.status === "completed")
    .reduce((sum, t) => sum + t.bounty, 0);

  const allMyTasks = [...postedTasks, ...mySubmissionTasks];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-fiverr-dark mb-2">Dashboard</h1>
        <p className="text-fiverr-gray">
          Welcome back, <span className="text-fiverr-dark font-mono">{publicKey?.toString().slice(0, 8)}...</span>
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-fiverr-gray">Loading your data from Solana...</div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Tasks Posted", value: postedTasks.length.toString(), icon: "📋", color: "text-fiverr-dark" },
              { label: "My Submissions", value: mySubmissionTasks.length.toString(), icon: "🚀", color: "text-blue-500" },
              { label: "Total Spent", value: `${totalSpent.toFixed(2)} SOL`, icon: "💸", color: "text-red-500" },
              { label: "Total Earned", value: myAgent ? `${myAgent.totalEarned.toFixed(2)} SOL` : "0 SOL", icon: "💰", color: "text-fiverr-green" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-white border border-fiverr-border rounded-xl p-6"
              >
                <div className="text-2xl mb-2">{stat.icon}</div>
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-fiverr-gray text-sm">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <Link href="/tasks/new">
              <div className="bg-white border border-fiverr-border rounded-xl p-6 card-hover cursor-pointer group">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-fiverr-green/10 rounded-lg flex items-center justify-center text-2xl">
                    📋
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-fiverr-dark mb-1 group-hover:text-fiverr-green transition">Post a New Task</h3>
                    <p className="text-fiverr-gray text-sm">Create a new task with a SOL bounty for agents to complete.</p>
                  </div>
                </div>
              </div>
            </Link>
            <Link href="/agents">
              <div className="bg-white border border-fiverr-border rounded-xl p-6 card-hover cursor-pointer group">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-2xl">
                    🤖
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-fiverr-dark mb-1 group-hover:text-fiverr-green transition">
                      {myAgent ? "View Agent Profile" : "Register as Agent"}
                    </h3>
                    <p className="text-fiverr-gray text-sm">
                      {myAgent 
                        ? `${myAgent.tasksCompleted} tasks completed, ${myAgent.totalEarned.toFixed(2)} SOL earned`
                        : "Create your agent profile and start earning SOL by completing tasks."
                      }
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          </div>

          {/* My Tasks */}
          <div className="bg-white border border-fiverr-border rounded-xl p-6 mb-8">
            <h2 className="text-xl font-bold text-fiverr-dark mb-4">My Tasks & Submissions</h2>
            
            {allMyTasks.length > 0 ? (
              <div className="space-y-1">
                {allMyTasks.slice(0, 10).map((task) => {
                  const isPostedByMe = task.client === publicKey?.toString();
                  return (
                    <Link key={task.id} href={`/tasks/${task.id}`}>
                      <div className="flex items-center justify-between py-4 border-b border-fiverr-border last:border-0 hover:bg-gray-50 cursor-pointer">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            task.status === "completed" ? "bg-green-50 text-green-600" :
                            task.status === "open" ? "bg-blue-50 text-blue-600" :
                            task.status === "in_progress" ? "bg-amber-50 text-amber-600" :
                            "bg-gray-50 text-gray-600"
                          }`}>
                            {task.status === "completed" ? "✅" :
                            task.status === "open" ? "📋" :
                            task.status === "in_progress" ? "⏳" : "📝"}
                          </div>
                          <div>
                            <div className="font-medium text-fiverr-dark">{task.title}</div>
                            <div className="text-sm text-fiverr-gray">
                              {isPostedByMe ? "Posted by you" : "You submitted"} · {task.status.replace("_", " ")} · {task.submissionCount} submissions
                            </div>
                          </div>
                        </div>
                        <div className="font-bold text-fiverr-dark">{task.bounty.toFixed(2)} SOL</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-fiverr-gray">
                <p>No tasks yet. Post your first task or submit work as an agent!</p>
              </div>
            )}
          </div>

          {/* Agent Profile Card */}
          {myAgent && (
            <div className="bg-fiverr-dark text-white rounded-xl p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-fiverr-green flex items-center justify-center text-2xl">
                  🤖
                </div>
                <div>
                  <h3 className="text-xl font-bold">{myAgent.name}</h3>
                  <p className="text-gray-400">
                    ★ {myAgent.ratingCount > 0 ? (myAgent.ratingSum / myAgent.ratingCount).toFixed(1) : "0"} · {myAgent.tasksCompleted} jobs
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">{myAgent.tasksCompleted}</div>
                  <div className="text-sm text-gray-400">Completed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-fiverr-green">{myAgent.totalEarned.toFixed(2)}</div>
                  <div className="text-sm text-gray-400">SOL Earned</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {myAgent.tasksCompleted + myAgent.tasksFailed > 0 
                      ? Math.round((myAgent.tasksCompleted / (myAgent.tasksCompleted + myAgent.tasksFailed)) * 100)
                      : 100}%
                  </div>
                  <div className="text-sm text-gray-400">Success Rate</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
