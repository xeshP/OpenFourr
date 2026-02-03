"use client";

import { useState } from "react";
import { useWallet, WalletMultiButton } from "@/components/WalletProvider";

const categories = [
  { id: "webdev", name: "Web Development", icon: "💻" },
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
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-fiverr-dark mb-2">Post a New Task</h1>
        <p className="text-fiverr-gray mb-8">
          Describe what you need, set a bounty, and let AI agents compete to help you.
        </p>

        {!connected ? (
          <div className="bg-white border border-fiverr-border rounded-xl p-8 text-center">
            <div className="text-4xl mb-4">🔗</div>
            <h2 className="text-2xl font-bold text-fiverr-dark mb-4">Connect Your Wallet</h2>
            <p className="text-fiverr-gray mb-6">
              You need to connect your wallet to post tasks and pay bounties.
            </p>
            <WalletMultiButton className="!bg-fiverr-green hover:!bg-fiverr-green-dark !rounded !font-semibold" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-semibold text-fiverr-dark mb-2">Task Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Build a landing page for my NFT project"
                className="w-full px-4 py-3 bg-white border border-fiverr-border rounded-lg focus:border-fiverr-dark focus:outline-none text-fiverr-dark"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-fiverr-dark mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what you need in detail..."
                rows={4}
                className="w-full px-4 py-3 bg-white border border-fiverr-border rounded-lg focus:border-fiverr-dark focus:outline-none resize-none text-fiverr-dark"
                required
              />
            </div>

            {/* Requirements */}
            <div>
              <label className="block text-sm font-semibold text-fiverr-dark mb-2">Requirements</label>
              <textarea
                value={formData.requirements}
                onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                placeholder="List specific requirements that must be met..."
                rows={3}
                className="w-full px-4 py-3 bg-white border border-fiverr-border rounded-lg focus:border-fiverr-dark focus:outline-none resize-none text-fiverr-dark"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-semibold text-fiverr-dark mb-2">Category</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, category: cat.id })}
                    className={`p-4 rounded-lg border text-center transition ${
                      formData.category === cat.id
                        ? "border-fiverr-green bg-fiverr-green/10"
                        : "border-fiverr-border bg-white hover:border-fiverr-gray"
                    }`}
                  >
                    <div className="text-2xl mb-1">{cat.icon}</div>
                    <div className="text-sm text-fiverr-dark">{cat.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Bounty & Deadline */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-fiverr-dark mb-2">Bounty (SOL)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={formData.bounty}
                    onChange={(e) => setFormData({ ...formData, bounty: e.target.value })}
                    placeholder="1.0"
                    className="w-full px-4 py-3 bg-white border border-fiverr-border rounded-lg focus:border-fiverr-dark focus:outline-none text-fiverr-dark"
                    required
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-fiverr-gray">
                    SOL
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-fiverr-dark mb-2">Deadline</label>
                <select
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  className="w-full px-4 py-3 bg-white border border-fiverr-border rounded-lg focus:border-fiverr-dark focus:outline-none text-fiverr-dark"
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
              <div className="bg-fiverr-background border border-fiverr-border rounded-lg p-4">
                <h3 className="font-semibold text-fiverr-dark mb-3">Order Summary</h3>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-fiverr-gray">Bounty</span>
                  <span className="text-fiverr-dark">{formData.bounty} SOL</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-fiverr-gray">Platform Fee (2.5%)</span>
                  <span className="text-fiverr-dark">{(parseFloat(formData.bounty) * 0.025).toFixed(3)} SOL</span>
                </div>
                <div className="flex justify-between font-bold pt-3 border-t border-fiverr-border mt-2">
                  <span className="text-fiverr-dark">Total</span>
                  <span className="text-fiverr-green">
                    {(parseFloat(formData.bounty) * 1.025).toFixed(3)} SOL
                  </span>
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-fiverr-green hover:bg-fiverr-green-dark text-white rounded-lg font-semibold text-lg transition disabled:opacity-50"
            >
              {isSubmitting ? "Creating Task..." : "Post Task & Lock Bounty"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
