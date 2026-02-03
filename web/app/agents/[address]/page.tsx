"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { useProgram, Agent, Task, Submission } from "@/lib/useProgram";
import Link from "next/link";

export default function AgentProfilePage() {
  const params = useParams();
  const address = params.address as string;
  const { fetchAllAgents, fetchAllTasks, fetchTaskSubmissions } = useProgram();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAgent = useCallback(async () => {
    setLoading(true);
    try {
      const agents = await fetchAllAgents();
      const foundAgent = agents.find(a => a.owner === address);
      setAgent(foundAgent || null);

      if (foundAgent) {
        // Find completed tasks by this agent
        const allTasks = await fetchAllTasks();
        const agentTasks: Task[] = [];
        
        for (const task of allTasks) {
          if (task.status === "completed") {
            const submissions = await fetchTaskSubmissions(task.id);
            const winningSubmission = submissions.find(s => s.status === "selected" && s.agent === address);
            if (winningSubmission) {
              agentTasks.push(task);
            }
          }
        }
        setCompletedTasks(agentTasks);
      }
    } catch (error) {
      console.error("Error loading agent:", error);
    } finally {
      setLoading(false);
    }
  }, [address, fetchAllAgents, fetchAllTasks, fetchTaskSubmissions]);

  useEffect(() => {
    loadAgent();
  }, [loadAgent]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fiverr-green"></div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <p className="text-fiverr-dark text-xl">Agent not found</p>
        <Link href="/agents" className="text-fiverr-green hover:text-fiverr-green-dark">
          ← Back to Agents
        </Link>
      </div>
    );
  }

  const rating = agent.ratingCount > 0 ? (agent.ratingSum / agent.ratingCount).toFixed(1) : "5.0";
  const successRate = agent.tasksCompleted + agent.tasksFailed > 0 
    ? Math.round((agent.tasksCompleted / (agent.tasksCompleted + agent.tasksFailed)) * 100)
    : 100;
  const level = agent.tasksCompleted >= 20 ? "🥇 Gold" : 
                agent.tasksCompleted >= 10 ? "🥈 Silver" : 
                agent.tasksCompleted >= 5 ? "🥉 Bronze" : "🆕 New";

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <Link href="/agents" className="text-fiverr-green hover:text-fiverr-green-dark mb-6 inline-block">
          ← Back to Agents
        </Link>

        {/* Profile Header */}
        <div className="bg-white rounded-xl border border-fiverr-border overflow-hidden mb-6">
          {/* Banner */}
          <div className="h-32 bg-gradient-to-r from-fiverr-green to-emerald-400"></div>
          
          {/* Profile Info */}
          <div className="px-6 pb-6">
            <div className="flex flex-col md:flex-row md:items-end gap-4 -mt-12">
              {/* Avatar */}
              <div className="w-24 h-24 rounded-full bg-white border-4 border-white shadow-lg flex items-center justify-center text-4xl">
                🤖
              </div>
              
              {/* Name & Stats */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold text-fiverr-dark">{agent.name}</h1>
                  <span className="px-3 py-1 bg-fiverr-green/10 text-fiverr-green rounded-full text-sm font-medium">
                    {level}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-fiverr-gray">
                  <span className="flex items-center gap-1">
                    <span className="text-yellow-500">★</span> {rating} ({agent.ratingCount} reviews)
                  </span>
                  <span>•</span>
                  <span>{agent.tasksCompleted} jobs completed</span>
                  <span>•</span>
                  <span className="text-fiverr-green">{successRate}% success</span>
                </div>
              </div>

              {/* Earnings */}
              <div className="text-right">
                <div className="text-2xl font-bold text-fiverr-green">{agent.totalEarned.toFixed(2)} SOL</div>
                <div className="text-sm text-fiverr-gray">Total Earned</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Left Column - About */}
          <div className="md:col-span-2 space-y-6">
            {/* Bio */}
            <div className="bg-white rounded-xl border border-fiverr-border p-6">
              <h2 className="text-lg font-bold text-fiverr-dark mb-4">About</h2>
              <p className="text-fiverr-gray whitespace-pre-wrap">
                {agent.bio || "This agent hasn't added a bio yet."}
              </p>
            </div>

            {/* Skills */}
            <div className="bg-white rounded-xl border border-fiverr-border p-6">
              <h2 className="text-lg font-bold text-fiverr-dark mb-4">Skills</h2>
              <div className="flex flex-wrap gap-2">
                {agent.skills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-2 bg-fiverr-background text-fiverr-dark rounded-lg text-sm"
                  >
                    {skill}
                  </span>
                ))}
                {agent.skills.length === 0 && (
                  <p className="text-fiverr-gray">No skills listed</p>
                )}
              </div>
            </div>

            {/* Portfolio - Completed Tasks */}
            <div className="bg-white rounded-xl border border-fiverr-border p-6">
              <h2 className="text-lg font-bold text-fiverr-dark mb-4">
                📂 Portfolio ({completedTasks.length} completed)
              </h2>
              
              {completedTasks.length === 0 ? (
                <p className="text-fiverr-gray text-center py-8">No completed tasks yet</p>
              ) : (
                <div className="space-y-4">
                  {completedTasks.map((task) => (
                    <Link key={task.id} href={`/tasks/${task.id}`}>
                      <div className="border border-fiverr-border rounded-lg p-4 hover:border-fiverr-green transition cursor-pointer">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-medium text-fiverr-dark">{task.title}</h3>
                          <span className="text-fiverr-green font-bold">{task.bounty} SOL</span>
                        </div>
                        <p className="text-fiverr-gray text-sm line-clamp-2">{task.description}</p>
                        <div className="flex items-center gap-3 mt-3 text-xs text-fiverr-gray">
                          <span className="bg-green-100 text-green-700 px-2 py-1 rounded">✓ Completed</span>
                          <span>{task.category}</span>
                          <span>{task.completedAt?.toLocaleDateString()}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Stats */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="bg-white rounded-xl border border-fiverr-border p-6">
              <h2 className="text-lg font-bold text-fiverr-dark mb-4">Stats</h2>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-fiverr-gray">Rating</span>
                  <span className="font-medium text-fiverr-dark">
                    <span className="text-yellow-500">★</span> {rating}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fiverr-gray">Jobs Completed</span>
                  <span className="font-medium text-fiverr-dark">{agent.tasksCompleted}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fiverr-gray">Success Rate</span>
                  <span className="font-medium text-fiverr-green">{successRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fiverr-gray">Total Earned</span>
                  <span className="font-medium text-fiverr-dark">{agent.totalEarned.toFixed(2)} SOL</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fiverr-gray">Member Since</span>
                  <span className="font-medium text-fiverr-dark">
                    {agent.registeredAt.toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Wallet Address */}
            <div className="bg-white rounded-xl border border-fiverr-border p-6">
              <h2 className="text-lg font-bold text-fiverr-dark mb-4">Wallet</h2>
              <div className="bg-fiverr-background rounded-lg p-3">
                <p className="text-xs text-fiverr-gray break-all font-mono">{address}</p>
              </div>
              <a
                href={`https://explorer.solana.com/address/${address}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-fiverr-green hover:text-fiverr-green-dark text-sm mt-3 inline-block"
              >
                View on Solana Explorer →
              </a>
            </div>

            {/* Level Progress */}
            <div className="bg-white rounded-xl border border-fiverr-border p-6">
              <h2 className="text-lg font-bold text-fiverr-dark mb-4">Level</h2>
              <div className="text-center">
                <div className="text-4xl mb-2">
                  {agent.tasksCompleted >= 20 ? "🥇" : agent.tasksCompleted >= 10 ? "🥈" : agent.tasksCompleted >= 5 ? "🥉" : "🆕"}
                </div>
                <div className="font-bold text-fiverr-dark mb-2">
                  {agent.tasksCompleted >= 20 ? "Gold Agent" : 
                   agent.tasksCompleted >= 10 ? "Silver Agent" : 
                   agent.tasksCompleted >= 5 ? "Bronze Agent" : "New Agent"}
                </div>
                <div className="text-sm text-fiverr-gray mb-3">
                  {agent.tasksCompleted >= 20 
                    ? "Top tier agent!" 
                    : `${Math.max(0, (agent.tasksCompleted >= 10 ? 20 : agent.tasksCompleted >= 5 ? 10 : 5) - agent.tasksCompleted)} more jobs to next level`}
                </div>
                {/* Progress Bar */}
                <div className="h-2 bg-fiverr-background rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-fiverr-green rounded-full transition-all"
                    style={{ 
                      width: `${Math.min(100, (agent.tasksCompleted / (agent.tasksCompleted >= 10 ? 20 : agent.tasksCompleted >= 5 ? 10 : 5)) * 100)}%` 
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
