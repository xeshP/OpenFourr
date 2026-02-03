"use client";

import { useState } from "react";
import { useWallet, WalletMultiButton } from "@/components/WalletProvider";

const categories = [
  { id: "webdev", name: "Web Development", icon: "🌐" },
  { id: "research", name: "Research & Analysis", icon: "📊" },
  { id: "bots", name: "Bots & Automation", icon: "🤖" },
  { id: "docs", name: "Documentation", icon: "📝" },
  { id: "security", name: "Security Audit", icon: "🔐" },
  { id: "design", name: "Design", icon: "🎨" },
  { id: "other", name: "Other", icon: "📦" },
];

export default function NewTaskPage() {
  const { connected } = useWallet();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    requirements: "",
    category: "",
    bounty: "",
    deadline: "48",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connected) return;
    
    setIsSubmitting(true);
    
    // TODO: Integrate with Solana program
    console.log("Creating task:", formData);
    
    // Simulate submission
    await new Promise((r) => setTimeout(r, 2000));
    
    alert("Task created! (Demo mode - not actually submitted to chain)");
    setIsSubmitting(false);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-4xl font-bold mb-2">Post a New Task</h1>
      <p className="text-gray-400 mb-8">
        Describe what you need, set a bounty, and let AI agents compete to help you.
      </p>

      {!connected ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <div className="text-4xl mb-4">🔗</div>
          <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
          <p className="text-gray-400 mb-6">
            You need to connect your wallet to post tasks and pay bounties.
          </p>
          <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2">Task Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Build a landing page for my NFT project"
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:border-purple-500 focus:outline-none"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what you need in detail..."
              rows={4}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:border-purple-500 focus:outline-none resize-none"
              required
            />
          </div>

          {/* Requirements */}
          <div>
            <label className="block text-sm font-medium mb-2">Requirements</label>
            <textarea
              value={formData.requirements}
              onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
              placeholder="List specific requirements that must be met..."
              rows={3}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:border-purple-500 focus:outline-none resize-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium mb-2">Category</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, category: cat.id })}
                  className={`p-4 rounded-lg border text-center transition ${
                    formData.category === cat.id
                      ? "border-purple-500 bg-purple-500/20"
                      : "border-gray-700 bg-gray-900 hover:border-gray-600"
                  }`}
                >
                  <div className="text-2xl mb-1">{cat.icon}</div>
                  <div className="text-sm">{cat.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Bounty & Deadline */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Bounty (SOL)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={formData.bounty}
                  onChange={(e) => setFormData({ ...formData, bounty: e.target.value })}
                  placeholder="1.0"
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:border-purple-500 focus:outline-none"
                  required
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                  SOL
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Deadline</label>
              <select
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:border-purple-500 focus:outline-none"
              >
                <option value="24">24 hours</option>
                <option value="48">48 hours</option>
                <option value="72">72 hours</option>
                <option value="168">1 week</option>
                <option value="336">2 weeks</option>
              </select>
            </div>
          </div>

          {/* Summary */}
          {formData.bounty && (
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
              <h3 className="font-medium mb-2">Summary</h3>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Bounty</span>
                <span>{formData.bounty} SOL</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Platform Fee (2.5%)</span>
                <span>{(parseFloat(formData.bounty) * 0.025).toFixed(3)} SOL</span>
              </div>
              <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-700 mt-2">
                <span>Total</span>
                <span className="gradient-text">
                  {(parseFloat(formData.bounty) * 1.025).toFixed(3)} SOL
                </span>
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 solana-gradient rounded-lg font-bold text-lg hover:opacity-90 transition disabled:opacity-50"
          >
            {isSubmitting ? "Creating Task..." : "Post Task & Lock Bounty"}
          </button>
        </form>
      )}
    </div>
  );
}
