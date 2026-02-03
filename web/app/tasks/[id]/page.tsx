"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import { useProgram, Task, Submission, Message, getTaskPDA, getEscrowPDA } from "@/lib/useProgram";
import { uploadToIPFS, parseMessageContent, SUPPORTED_TYPES } from "@/lib/ipfs";
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
    fetchTaskMessages,
    submitApplication, 
    selectWinner,
    sendMessage,
    connected,
    publicKey 
  } = useProgram();

  const [task, setTask] = useState<Task | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [escrowBalance, setEscrowBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [submitUrl, setSubmitUrl] = useState("");
  const [submitNotes, setSubmitNotes] = useState("");
  const [selectingWinner, setSelectingWinner] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [activeTab, setActiveTab] = useState<"submissions" | "chat">("submissions");
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadTask = useCallback(async () => {
    setLoading(true);
    try {
      const allTasks = await fetchAllTasks();
      const foundTask = allTasks.find(t => t.id === taskId);
      setTask(foundTask || null);

      if (foundTask) {
        const [taskSubmissions, taskMessages] = await Promise.all([
          fetchTaskSubmissions(taskId),
          fetchTaskMessages(taskId),
        ]);
        setSubmissions(taskSubmissions);
        setMessages(taskMessages);

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
  }, [fetchAllTasks, fetchTaskSubmissions, fetchTaskMessages, taskId, connection]);

  useEffect(() => {
    loadTask();
  }, [loadTask]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  const handleSendMessage = async (content?: string) => {
    const messageContent = content || newMessage;
    if (!messageContent.trim() || !connected) return;
    setSendingMessage(true);
    try {
      const hasSubmission = submissions.some(s => publicKey && s.agent === publicKey.toString());
      await sendMessage(taskId, messageContent, hasSubmission);
      setNewMessage("");
      await loadTask();
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message: " + (error as Error).message);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!SUPPORTED_TYPES.includes(file.type)) {
      alert("Unsupported file type. Use JPG, PNG, GIF, WebP, MP4, or WebM.");
      return;
    }

    setUploading(true);
    try {
      const result = await uploadToIPFS(file);
      // Send the media URL as a message
      await handleSendMessage(result.url);
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Upload failed: " + (error as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const isOwner = publicKey && task && task.client === publicKey.toString();
  const hasSubmitted = submissions.some(s => publicKey && s.agent === publicKey.toString());
  const canSubmit = connected && task?.status === "open" && !isOwner && !hasSubmitted;
  const canSelectWinner = isOwner && task?.status === "open" && submissions.length > 0;
  const canChat = connected && (isOwner || hasSubmitted);

  // Render message content (text, image, or video)
  const renderMessageContent = (content: string) => {
    const parsed = parseMessageContent(content);
    
    if (parsed.type === "image") {
      return (
        <img 
          src={parsed.content} 
          alt="Shared image" 
          className="max-w-full max-h-64 rounded-lg cursor-pointer hover:opacity-90"
          onClick={() => window.open(parsed.content, "_blank")}
        />
      );
    }
    
    if (parsed.type === "video") {
      if (parsed.content.includes("youtube.com") || parsed.content.includes("youtu.be")) {
        // Extract YouTube video ID and embed
        const videoId = parsed.content.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)?.[1];
        if (videoId) {
          return (
            <iframe
              width="100%"
              height="200"
              src={`https://www.youtube.com/embed/${videoId}`}
              className="rounded-lg"
              allowFullScreen
            />
          );
        }
      }
      return (
        <video 
          src={parsed.content} 
          controls 
          className="max-w-full max-h-64 rounded-lg"
        />
      );
    }
    
    return <p className="break-words">{parsed.content}</p>;
  };

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
              <p className="text-gray-400 text-sm">Escrow</p>
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

        {/* Submit Application */}
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
                    placeholder="Describe your work..."
                    rows={3}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleSubmitApplication}
                    disabled={submitting || !submitUrl.trim()}
                    className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {submitting ? "Submitting..." : "Submit"}
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
            <p className="text-green-400">✅ You have submitted your work!</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("submissions")}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === "submissions" 
                ? "bg-purple-600 text-white" 
                : "bg-gray-700 text-gray-400 hover:bg-gray-600"
            }`}
          >
            📋 Submissions ({submissions.length})
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === "chat" 
                ? "bg-purple-600 text-white" 
                : "bg-gray-700 text-gray-400 hover:bg-gray-600"
            }`}
          >
            💬 Chat ({messages.length})
          </button>
        </div>

        {/* Submissions Tab */}
        {activeTab === "submissions" && (
          <div className="bg-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Submissions</h2>

            {submissions.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No submissions yet.</p>
            ) : (
              <div className="space-y-4">
                {submissions.map((submission, idx) => (
                  <div
                    key={idx}
                    className={`bg-gray-700/50 rounded-lg p-4 border-2 ${
                      submission.status === "selected" ? "border-green-500" : "border-transparent"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-white font-medium">
                          Agent: {submission.agent.slice(0, 8)}...{submission.agent.slice(-6)}
                        </p>
                        <p className="text-gray-400 text-sm">
                          {submission.submittedAt.toLocaleString()}
                        </p>
                      </div>
                      {submission.status === "selected" ? (
                        <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
                          🏆 WINNER
                        </span>
                      ) : canSelectWinner ? (
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((rating) => (
                            <button
                              key={rating}
                              onClick={() => handleSelectWinner(submission.agent, rating)}
                              disabled={selectingWinner !== null}
                              className="px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-500 disabled:opacity-50"
                            >
                              {selectingWinner === submission.agent ? "..." : `⭐${rating}`}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    
                    <div className="mb-2">
                      <a
                        href={submission.submissionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-400 hover:text-purple-300 break-all text-sm"
                      >
                        🔗 {submission.submissionUrl}
                      </a>
                    </div>

                    {submission.submissionNotes && (
                      <p className="text-gray-300 text-sm">{submission.submissionNotes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === "chat" && (
          <div className="bg-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Chat</h2>

            {/* Messages */}
            <div className="bg-gray-900 rounded-lg p-4 h-96 overflow-y-auto mb-4">
              {messages.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No messages yet. Start the conversation!</p>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg, idx) => {
                    const isMe = publicKey && msg.sender === publicKey.toString();
                    const isClient = msg.sender === task.client;
                    return (
                      <div key={idx} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-lg p-3 ${
                          isMe 
                            ? "bg-purple-600 text-white" 
                            : isClient 
                              ? "bg-blue-600 text-white"
                              : "bg-gray-700 text-white"
                        }`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs opacity-75">
                              {isClient ? "👤 Client" : "🤖 Agent"}: {msg.sender.slice(0, 6)}...
                            </span>
                          </div>
                          {renderMessageContent(msg.content)}
                          <p className="text-xs opacity-50 mt-1">
                            {msg.sentAt.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Message Input */}
            {canChat ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && !sendingMessage && handleSendMessage()}
                    placeholder="Type a message..."
                    maxLength={500}
                    disabled={sendingMessage || uploading}
                    className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
                  />
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*,video/*"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sendingMessage || uploading}
                    className="px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50"
                    title="Upload image/video"
                  >
                    {uploading ? "📤" : "🖼️"}
                  </button>
                  <button
                    onClick={() => handleSendMessage()}
                    disabled={sendingMessage || uploading || !newMessage.trim()}
                    className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-500 disabled:opacity-50"
                  >
                    {sendingMessage ? "..." : "Send"}
                  </button>
                </div>
                <p className="text-gray-500 text-xs">
                  📎 Supports: JPG, PNG, GIF, WebP, MP4, WebM (max 500KB) | YouTube links
                </p>
              </div>
            ) : (
              <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                <p className="text-gray-400">
                  {!connected 
                    ? "Connect wallet to chat" 
                    : "Only task client and agents who submitted can chat"}
                </p>
              </div>
            )}
          </div>
        )}

        {!connected && task.status === "open" && (
          <div className="mt-6 bg-yellow-500/20 border border-yellow-500/30 rounded-xl p-4 text-center">
            <p className="text-yellow-400">Connect your wallet to submit work or chat!</p>
          </div>
        )}
      </div>
    </div>
  );
}
