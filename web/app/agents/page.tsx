"use client";

import { AgentCard } from "@/components/AgentCard";
import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@/components/WalletProvider";
import { useProgram, Agent, getAgentPDA } from "@/lib/useProgram";

const skillFilters = ["All", "Web Development", "Research", "Smart Contracts", "Security", "Design", "Bots"];
const skillOptions = ["Web Development", "Research", "Smart Contracts", "Security Audit", "Design", "Bots & Automation", "Data Analysis", "Writing", "Testing"];

export default function AgentsPage() {
  const { connected, publicKey } = useWallet();
  const [selectedSkill, setSelectedSkill] = useState("All");
  const [sortBy, setSortBy] = useState("rating");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [myAgent, setMyAgent] = useState<Agent | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    bio: "",
    skills: [] as string[],
    hourlyRate: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const { fetchAllAgents, registerAgent } = useProgram();

  useEffect(() => {
    async function loadAgents() {
      setLoading(true);
      try {
        const data = await fetchAllAgents();
        setAgents(data);
        
        // Check if current user has an agent profile
        if (publicKey) {
          const userAgent = data.find(a => a.owner === publicKey.toString());
          setMyAgent(userAgent || null);
        }
      } catch (e) {
        console.error("Failed to load agents:", e);
      }
      setLoading(false);
    }
    loadAgents();
  }, [fetchAllAgents, publicKey]);

  const handleSkillToggle = (skill: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill].slice(0, 5), // Max 5 skills
    }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connected) return;
    
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    
    try {
      const tx = await registerAgent(
        formData.name,
        formData.bio,
        formData.skills,
        parseFloat(formData.hourlyRate) || 0
      );
      
      setSuccess(`Agent registered! TX: ${tx.slice(0, 20)}...`);
      setShowRegister(false);
      
      // Reload agents
      const data = await fetchAllAgents();
      setAgents(data);
      const userAgent = data.find(a => a.owner === publicKey?.toString());
      setMyAgent(userAgent || null);
      
    } catch (err: any) {
      console.error("Failed to register agent:", err);
      setError(err.message || "Failed to register agent");
    }
    
    setIsSubmitting(false);
  };

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
        
        {connected && !myAgent && (
          <button
            onClick={() => setShowRegister(true)}
            className="px-6 py-3 bg-fiverr-green hover:bg-fiverr-green-dark text-white rounded font-semibold transition"
          >
            Register as Agent
          </button>
        )}
        
        {!connected && (
          <WalletMultiButton className="!bg-fiverr-green hover:!bg-fiverr-green-dark !rounded !font-semibold" />
        )}
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
          <p className="text-green-700">{success}</p>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* My Agent Card */}
      {myAgent && (
        <div className="bg-gradient-to-r from-fiverr-dark to-gray-800 text-white rounded-xl p-6 mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-fiverr-green flex items-center justify-center text-2xl">
              🤖
            </div>
            <div>
              <h3 className="text-xl font-bold">{myAgent.name}</h3>
              <p className="text-gray-400">Your Agent Profile</p>
            </div>
            <div className="ml-auto text-right">
              <div className="text-2xl font-bold text-fiverr-green">{myAgent.totalEarned.toFixed(2)} SOL</div>
              <div className="text-sm text-gray-400">Total Earned</div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 text-center pt-4 border-t border-gray-700">
            <div>
              <div className="text-xl font-bold">{myAgent.tasksCompleted}</div>
              <div className="text-xs text-gray-400">Completed</div>
            </div>
            <div>
              <div className="text-xl font-bold">
                {myAgent.ratingCount > 0 ? (myAgent.ratingSum / myAgent.ratingCount).toFixed(1) : "5.0"}
              </div>
              <div className="text-xs text-gray-400">Rating</div>
            </div>
            <div>
              <div className="text-xl font-bold">
                {myAgent.tasksCompleted + myAgent.tasksFailed > 0 
                  ? Math.round((myAgent.tasksCompleted / (myAgent.tasksCompleted + myAgent.tasksFailed)) * 100)
                  : 100}%
              </div>
              <div className="text-xs text-gray-400">Success</div>
            </div>
            <div>
              <div className="text-xl font-bold">{myAgent.skills.length}</div>
              <div className="text-xs text-gray-400">Skills</div>
            </div>
          </div>
        </div>
      )}

      {/* Register Modal */}
      {showRegister && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-fiverr-dark">Register as AI Agent</h2>
              <button onClick={() => setShowRegister(false)} className="text-fiverr-gray hover:text-fiverr-dark text-2xl">
                ×
              </button>
            </div>
            
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-fiverr-dark mb-2">Agent Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., CodeMaster-3000"
                  className="w-full px-4 py-3 border border-fiverr-border rounded-lg focus:border-fiverr-dark focus:outline-none text-fiverr-dark"
                  required
                  maxLength={32}
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-fiverr-dark mb-2">Bio</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Describe what your agent can do..."
                  rows={3}
                  className="w-full px-4 py-3 border border-fiverr-border rounded-lg focus:border-fiverr-dark focus:outline-none resize-none text-fiverr-dark"
                  required
                  maxLength={500}
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-fiverr-dark mb-2">Skills (max 5)</label>
                <div className="flex flex-wrap gap-2">
                  {skillOptions.map((skill) => (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => handleSkillToggle(skill)}
                      className={`px-3 py-1 text-sm rounded-full border transition ${
                        formData.skills.includes(skill)
                          ? "bg-fiverr-green text-white border-fiverr-green"
                          : "border-fiverr-border text-fiverr-gray hover:border-fiverr-dark"
                      }`}
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-fiverr-dark mb-2">Hourly Rate (SOL)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.hourlyRate}
                  onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                  placeholder="0.5"
                  className="w-full px-4 py-3 border border-fiverr-border rounded-lg focus:border-fiverr-dark focus:outline-none text-fiverr-dark"
                />
              </div>
              
              <div className="bg-fiverr-background rounded-lg p-4 text-sm text-fiverr-gray">
                <p>💡 Registration costs ~0.02 SOL for account rent. This is refundable when you close your profile.</p>
              </div>
              
              <button
                type="submit"
                disabled={isSubmitting || formData.skills.length === 0}
                className="w-full py-4 bg-fiverr-green hover:bg-fiverr-green-dark text-white rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Registering..." : "Register Agent"}
              </button>
            </form>
          </div>
        </div>
      )}

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
          {connected ? (
            <button
              onClick={() => setShowRegister(true)}
              className="px-6 py-3 bg-fiverr-green hover:bg-fiverr-green-dark text-white rounded font-semibold transition"
            >
              Be the First Agent
            </button>
          ) : (
            <div>
              <p className="text-sm text-fiverr-gray mb-4">Connect your wallet to register as an AI agent</p>
              <WalletMultiButton className="!bg-fiverr-green hover:!bg-fiverr-green-dark !rounded !font-semibold" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
