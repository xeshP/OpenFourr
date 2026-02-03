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

// Task Templates
const templates = [
  {
    id: "landing",
    name: "Landing Page",
    icon: "🌐",
    category: "Web Development",
    title: "Build a Landing Page",
    description: "Create a modern, responsive landing page for my project.\n\nKey features needed:\n- Hero section with CTA\n- Features section\n- Pricing table\n- Contact form\n- Mobile responsive",
    requirements: "- Use React/Next.js or similar modern framework\n- Must be fully responsive\n- Include source code\n- Deploy to Vercel/Netlify\n- Lighthouse score > 90",
    bounty: "1",
    deadline: "72",
  },
  {
    id: "smartcontract",
    name: "Smart Contract",
    icon: "📜",
    category: "Smart Contracts",
    title: "Develop a Solana Smart Contract",
    description: "Build a Solana smart contract (Anchor) for my project.\n\nFunctionality needed:\n- [Describe your use case]\n- State management\n- Access controls\n- Event emissions",
    requirements: "- Use Anchor framework\n- Include unit tests\n- Document all functions\n- Deploy to devnet for testing\n- Provide IDL file",
    bounty: "2",
    deadline: "168",
  },
  {
    id: "audit",
    name: "Security Audit",
    icon: "🔐",
    category: "Smart Contracts",
    title: "Smart Contract Security Audit",
    description: "Perform a security audit on my Solana smart contract.\n\nContract details:\n- [Link to code]\n- [Description of functionality]\n\nLooking for:\n- Vulnerability assessment\n- Best practice review\n- Gas optimization suggestions",
    requirements: "- Detailed audit report\n- Severity classification (Critical/High/Medium/Low)\n- Remediation suggestions\n- Re-audit after fixes (if needed)",
    bounty: "3",
    deadline: "168",
  },
  {
    id: "bot",
    name: "Discord/Telegram Bot",
    icon: "🤖",
    category: "Bots & Automation",
    title: "Create a Discord/Telegram Bot",
    description: "Build a bot for my community.\n\nFeatures needed:\n- Welcome messages\n- Role management\n- Custom commands\n- [Add your features]",
    requirements: "- Node.js/Python\n- Host-ready (Docker/PM2)\n- Documentation for setup\n- Admin commands\n- Error handling",
    bounty: "0.5",
    deadline: "72",
  },
  {
    id: "research",
    name: "Market Research",
    icon: "📊",
    category: "Research",
    title: "Comprehensive Market Research",
    description: "Conduct research on [TOPIC/INDUSTRY].\n\nAreas to cover:\n- Market size and growth\n- Key players and competitors\n- Trends and opportunities\n- Risk assessment",
    requirements: "- Professional report (PDF)\n- Data sources cited\n- Charts and visualizations\n- Executive summary\n- Actionable insights",
    bounty: "0.8",
    deadline: "72",
  },
  {
    id: "logo",
    name: "Logo Design",
    icon: "🎨",
    category: "Design",
    title: "Design a Logo for My Project",
    description: "Create a unique, modern logo for my brand.\n\nBrand info:\n- Name: [Your project name]\n- Industry: [Your industry]\n- Style preference: [Modern/Minimalist/Bold/etc.]\n- Colors: [Preferred colors]",
    requirements: "- 3 initial concepts\n- Final design in multiple formats (PNG, SVG, AI)\n- Variations (light/dark background)\n- Brand guidelines document",
    bounty: "0.5",
    deadline: "48",
  },
  {
    id: "docs",
    name: "Technical Docs",
    icon: "📝",
    category: "Writing",
    title: "Write Technical Documentation",
    description: "Create comprehensive documentation for my project.\n\nNeeded:\n- Getting started guide\n- API reference\n- Code examples\n- FAQ section",
    requirements: "- Clear and concise writing\n- Markdown format\n- Code snippets with syntax highlighting\n- Table of contents\n- Suitable for developers",
    bounty: "0.5",
    deadline: "48",
  },
  {
    id: "api",
    name: "API Development",
    icon: "⚡",
    category: "Web Development",
    title: "Build a REST API",
    description: "Develop a RESTful API for my application.\n\nEndpoints needed:\n- [List your endpoints]\n- Authentication (JWT)\n- Rate limiting\n- Error handling",
    requirements: "- Node.js/Python/Rust\n- OpenAPI/Swagger documentation\n- Unit tests (>80% coverage)\n- Docker deployment ready\n- Environment configuration",
    bounty: "1.5",
    deadline: "168",
  },
];

export default function NewTaskPage() {
  const { connected, publicKey } = useWallet();
  const { createTask } = useProgram();
  const router = useRouter();
  const [showTemplates, setShowTemplates] = useState(true);
  
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

  const applyTemplate = (template: typeof templates[0]) => {
    setFormData({
      title: template.title,
      description: template.description,
      requirements: template.requirements,
      category: template.category,
      bounty: template.bounty,
      deadline: template.deadline,
    });
    setShowTemplates(false);
  };

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
      setTimeout(() => router.push("/tasks"), 2000);
      
    } catch (err: any) {
      console.error("Failed to create task:", err);
      setError(err.message || "Failed to create task. Please try again.");
    }
    
    setIsSubmitting(false);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
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
          <>
            {/* Template Selector */}
            {showTemplates && (
              <div className="bg-white border border-fiverr-border rounded-xl p-6 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold text-fiverr-dark">📋 Quick Start with Templates</h2>
                  <button
                    onClick={() => setShowTemplates(false)}
                    className="text-fiverr-gray hover:text-fiverr-dark text-sm"
                  >
                    Skip →
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => applyTemplate(template)}
                      className="p-4 rounded-lg border border-fiverr-border hover:border-fiverr-green hover:bg-fiverr-green/5 transition text-left"
                    >
                      <div className="text-2xl mb-2">{template.icon}</div>
                      <div className="text-sm font-medium text-fiverr-dark">{template.name}</div>
                      <div className="text-xs text-fiverr-gray mt-1">~{template.bounty} SOL</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Show template button if hidden */}
            {!showTemplates && (
              <button
                onClick={() => setShowTemplates(true)}
                className="text-fiverr-green hover:text-fiverr-green-dark text-sm mb-4 flex items-center gap-1"
              >
                📋 Use a template
              </button>
            )}

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
                  rows={6}
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
                  rows={4}
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
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-fiverr-gray">SOL</span>
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
                    <option value="72">3 days</option>
                    <option value="168">1 week</option>
                    <option value="336">2 weeks</option>
                    <option value="720">1 month</option>
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
                    <span className="text-fiverr-green">{parseFloat(formData.bounty).toFixed(4)} SOL</span>
                  </div>
                  <p className="text-xs text-fiverr-gray mt-2">
                    * Bounty is locked in escrow. Platform fee is deducted when winner is selected.
                  </p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting || !formData.category || !formData.bounty || !formData.title}
                className="w-full py-4 bg-fiverr-green hover:bg-fiverr-green-dark text-white rounded-lg font-semibold text-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Creating Task on Solana..." : "🚀 Post Task & Lock Bounty"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
