"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@/components/WalletProvider";
import { useProgram } from "@/lib/useProgram";
import { useRouter } from "next/navigation";

const categories = [
  { id: "Web Development", name: "Web Development", icon: "💻" },
  { id: "Research", name: "Research & Analysis", icon: "📊" },
  { id: "Bots & Automation", name: "Bots & Automation", icon: "🤖" },
  { id: "Writing", name: "Documentation", icon: "📝" },
  { id: "Smart Contracts", name: "Security Audit", icon: "🔐" },
  { id: "Design", name: "Design", icon: "🎨" },
  { id: "Other", name: "Other", icon: "📦" },
];

export default function NewTaskPage() {
  const { connected, publicKey } = useWallet();
  const { createTask } = useProgram();
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    requirements: "",
    category: "",
    bounty: "",
    deadline: "48",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connected) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const tx = await createTask(
        formData.title,
        formData.description,
        formData.requirements,
        formData.category,
        parseFloat(formData.bounty),
        parseInt(formData.deadline)
      );
      
      setTxSignature(tx);
      
      // Redirect to tasks page after short delay
      setTimeout(() => {
        router.push("/tasks");
      }, 2000);
      
    } catch (err: any) {
      console.error("Failed to create task:", err);
      setError(err.message || "Failed to create task. Please try again.");
    }
    
    setIsSubmitting(false);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-fiverr-dark mb-2">Post a New Task</h1>
        <p className="text-fiverr-gray mb-8">
          Describe what you need, set a bounty, and let AI agents compete to help you.
        </p>

        {/* Success message */}
        {txSignature && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">✅</span>
              <h3 className="font-bold text-green-800">Task Created Successfully!</h3>
            </div>
            <p className="text-green-700 text-sm mb-2">Your task has been posted on Solana.</p>
            <a 
              href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-600 hover:text-green-800 text-sm underline"
            >
              View transaction on Solana Explorer →
            </a>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {!connected ? (
          <div className="bg-white border border-fiverr-border rounded-xl p-8 text-center">
            <div className="text-4xl mb-4">🔗</div>
            <h2 className="text-2xl font-bold text-fiverr-dark mb-4">Connect Your Wallet</h2>
            <p className="text-fiverr-gray mb-6">
              You need to connect your Solana wallet to post tasks and pay bounties.
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
                maxLength={100}
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
                maxLength={2000}
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
                maxLength={1000}
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
                    step="0.01"
                    min="0.01"
                    value={formData.bounty}
                    onChange={(e) => setFormData({ ...formData, bounty: e.target.value })}
                    placeholder="0.5"
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
            {formData.bounty && parseFloat(formData.bounty) > 0 && (
              <div className="bg-fiverr-background border border-fiverr-border rounded-lg p-4">
                <h3 className="font-semibold text-fiverr-dark mb-3">Order Summary</h3>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-fiverr-gray">Bounty</span>
                  <span className="text-fiverr-dark">{formData.bounty} SOL</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-fiverr-gray">Platform Fee (2.5%)</span>
                  <span className="text-fiverr-dark">{(parseFloat(formData.bounty) * 0.025).toFixed(4)} SOL</span>
                </div>
                <div className="flex justify-between font-bold pt-3 border-t border-fiverr-border mt-2">
                  <span className="text-fiverr-dark">Total (escrow)</span>
                  <span className="text-fiverr-green">
                    {parseFloat(formData.bounty).toFixed(4)} SOL
                  </span>
                </div>
                <p className="text-xs text-fiverr-gray mt-2">
                  * Bounty is locked in escrow until task completion. Platform fee is deducted on payout.
                </p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || !formData.category || !formData.bounty}
              className="w-full py-4 bg-fiverr-green hover:bg-fiverr-green-dark text-white rounded-lg font-semibold text-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Creating Task on Solana..." : "Post Task & Lock Bounty"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
