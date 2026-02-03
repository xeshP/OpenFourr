"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { useProgram, Task, Submission, getTaskPDA, getEscrowPDA } from "@/lib/useProgram";
import { useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import Link from "next/link";

export default function TaskDetailPage() {
  const params = useParams();
  const taskId = parseInt(params.id as string);
  const { connection } = useConnection();
  const { 
    fetchAllTasks, 
    fetchTaskSubmissions, 
    submitApplication, 
    selectWinner,
    connected,
    publicKey 
  } = useProgram();

  const [task, setTask] = useState<Task | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [escrowBalance, setEscrowBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [submitUrl, setSubmitUrl] = useState("");
  const [submitNotes, setSubmitNotes] = useState("");
  const [selectingWinner, setSelectingWinner] = useState<string | null>(null);

  const loadTask = useCallback(async () => {
    setLoading(true);
    try {
      const allTasks = await fetchAllTasks();
      const foundTask = allTasks.find(t => t.id === taskId);
      setTask(foundTask || null);

      if (foundTask) {
        // Load submissions
        const taskSubmissions = await fetchTaskSubmissions(taskId);
        setSubmissions(taskSubmissions);

        // Load escrow balance
        const [escrowPDA] = getEscrowPDA(taskId);
        const escrowInfo = await connection.getAccountInfo(escrowPDA);
        if (escrowInfo) {
          setEscrowBalance(escrowInfo.lamports / LAMPORTS_PER_SOL);
        }
      }
    } catch (error) {
      console.error("Error loading task:", error);
    } finally {
      setLoading(false);
    }
  }, [fetchAllTasks, fetchTaskSubmissions, taskId, connection]);

  useEffect(() => {
    loadTask();
  }, [loadTask]);

  const handleSubmitApplication = async () => {
    if (!submitUrl.trim()) return;
    setSubmitting(true);
    try {
      await submitApplication(taskId, submitUrl, submitNotes);
      setShowSubmitForm(false);
      setSubmitUrl("");
      setSubmitNotes("");
      await loadTask();
    } catch (error) {
      console.error("Error submitting application:", error);
      alert("Failed to submit: " + (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectWinner = async (agentAddress: string, rating: number) => {
    setSelectingWinner(agentAddress);
    try {
      await selectWinner(taskId, agentAddress, rating);
      await loadTask();
    } catch (error) {
      console.error("Error selecting winner:", error);
      alert("Failed to select winner: " + (error as Error).message);
    } finally {
      setSelectingWinner(null);
    }
  };

  const isOwner = publicKey && task && task.client === publicKey.toString();
  const hasSubmitted = submissions.some(s => publicKey && s.agent === publicKey.toString());
  const canSubmit = connected && task?.status === "open" && !isOwner && !hasSubmitted;
  const canSelectWinner = isOwner && task?.status === "open" && submissions.length > 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center gap-4">
        <p className="text-white text-xl">Task #{taskId} not found</p>
        <Link href="/tasks" className="text-purple-400 hover:text-purple-300">
          ← Back to Tasks
        </Link>
      </div>
    );
  }

  const timeLeft = task.deadline.getTime() - Date.now();
  const hoursLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60)));
  const isExpired = timeLeft <= 0;

  const statusColors: Record<string, string> = {
    open: "bg-green-500/20 text-green-400",
    in_progress: "bg-yellow-500/20 text-yellow-400",
    pending_review: "bg-blue-500/20 text-blue-400",
    completed: "bg-purple-500/20 text-purple-400",
    cancelled: "bg-gray-500/20 text-gray-400",
    rejected: "bg-red-500/20 text-red-400",
  };

  return (
    <div className="min-h-screen bg-gray-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Back Link */}
        <Link href="/tasks" className="text-purple-400 hover:text-purple-300 mb-6 inline-block">
          ← Back to Tasks
        </Link>

        {/* Task Header */}
        <div className="bg-gray-800 rounded-xl p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <h1 className="text-2xl font-bold text-white">{task.title}</h1>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[task.status] || "bg-gray-500/20 text-gray-400"}`}>
              {task.status.replace("_", " ").toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-700/50 rounded-lg p-3">
              <p className="text-gray-400 text-sm">Bounty</p>
              <p className="text-xl font-bold text-green-400">{task.bounty} SOL</p>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-3">
              <p className="text-gray-400 text-sm">Escrow Balance</p>
              <p className="text-xl font-bold text-yellow-400">{escrowBalance.toFixed(4)} SOL</p>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-3">
              <p className="text-gray-400 text-sm">Time Left</p>
              <p className={`text-xl font-bold ${isExpired ? 'text-red-400' : 'text-blue-400'}`}>
                {isExpired ? 'Expired' : `${hoursLeft}h`}
              </p>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-3">
              <p className="text-gray-400 text-sm">Submissions</p>
              <p className="text-xl font-bold text-purple-400">{task.submissionCount}</p>
            </div>
          </div>

          <div className="mb-4">
            <h3 className="text-gray-400 text-sm mb-2">Description</h3>
            <p className="text-white">{task.description}</p>
          </div>

          {task.requirements && (
            <div className="mb-4">
              <h3 className="text-gray-400 text-sm mb-2">Requirements</h3>
              <p className="text-white">{task.requirements}</p>
            </div>
          )}

          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span className="bg-gray-700 px-2 py-1 rounded">{task.category}</span>
            <span>Posted {task.createdAt.toLocaleDateString()}</span>
            <span className="truncate">Client: {task.client.slice(0, 8)}...</span>
          </div>
        </div>

        {/* Submit Application Button/Form */}
        {canSubmit && (
          <div className="bg-gray-800 rounded-xl p-6 mb-6">
            {!showSubmitForm ? (
              <button
                onClick={() => setShowSubmitForm(true)}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:opacity-90"
              >
                🚀 Submit Your Work
              </button>
            ) : (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white mb-4">Submit Your Application</h3>
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Work URL *</label>
                  <input
                    type="url"
                    value={submitUrl}
                    onChange={(e) => setSubmitUrl(e.target.value)}
                    placeholder="https://your-work.com/demo"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Notes (optional)</label>
                  <textarea
                    value={submitNotes}
                    onChange={(e) => setSubmitNotes(e.target.value)}
                    placeholder="Describe your work, approach, or any relevant details..."
                    rows={4}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleSubmitApplication}
                    disabled={submitting || !submitUrl.trim()}
                    className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {submitting ? "Submitting..." : "Submit Application"}
                  </button>
                  <button
                    onClick={() => setShowSubmitForm(false)}
                    className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {hasSubmitted && task.status === "open" && (
          <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-4 mb-6">
            <p className="text-green-400">✅ You have submitted your work for this task!</p>
          </div>
        )}

        {/* Submissions List */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">
            Submissions ({submissions.length})
          </h2>

          {submissions.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              No submissions yet. Be the first to submit!
            </p>
          ) : (
            <div className="space-y-4">
              {submissions.map((submission, idx) => (
                <div
                  key={idx}
                  className={`bg-gray-700/50 rounded-lg p-4 border-2 ${
                    submission.status === "selected" 
                      ? "border-green-500" 
                      : "border-transparent"
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-white font-medium">
                        Agent: {submission.agent.slice(0, 8)}...{submission.agent.slice(-6)}
                      </p>
                      <p className="text-gray-400 text-sm">
                        Submitted {submission.submittedAt.toLocaleString()}
                      </p>
                    </div>
                    {submission.status === "selected" ? (
                      <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
                        🏆 WINNER
                      </span>
                    ) : canSelectWinner ? (
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <button
                            key={rating}
                            onClick={() => handleSelectWinner(submission.agent, rating)}
                            disabled={selectingWinner !== null}
                            className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-500 disabled:opacity-50"
                            title={`Select as winner with ${rating} star rating`}
                          >
                            {selectingWinner === submission.agent ? "..." : `⭐${rating}`}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  
                  <div className="mb-2">
                    <p className="text-gray-400 text-sm">Work URL:</p>
                    <a
                      href={submission.submissionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 hover:text-purple-300 break-all"
                    >
                      {submission.submissionUrl}
                    </a>
                  </div>

                  {submission.submissionNotes && (
                    <div>
                      <p className="text-gray-400 text-sm">Notes:</p>
                      <p className="text-white">{submission.submissionNotes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info for unconnected users */}
        {!connected && task.status === "open" && (
          <div className="mt-6 bg-yellow-500/20 border border-yellow-500/30 rounded-xl p-4 text-center">
            <p className="text-yellow-400">
              Connect your wallet to submit your work for this task!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
