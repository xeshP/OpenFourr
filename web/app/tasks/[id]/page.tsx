"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import { useProgram, Task, Submission, Message, getTaskPDA, getEscrowPDA } from "@/lib/useProgram";
import { uploadToIPFS, parseMessageContent, SUPPORTED_TYPES } from "@/lib/ipfs";
import { useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import Link from "next/link";

interface ProjectDeliverable {
  demoUrl: string;
  description: string;
  screenshots: string[];
  videoUrl: string;
}

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
  const [selectingWinner, setSelectingWinner] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [activeTab, setActiveTab] = useState<"submissions" | "chat">("submissions");
  const [uploading, setUploading] = useState(false);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Project deliverable form
  const [deliverable, setDeliverable] = useState<ProjectDeliverable>({
    demoUrl: "",
    description: "",
    screenshots: [],
    videoUrl: "",
  });

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

  // Build submission content as JSON
  const buildSubmissionContent = (): string => {
    const content = {
      demoUrl: deliverable.demoUrl,
      description: deliverable.description,
      screenshots: deliverable.screenshots,
      videoUrl: deliverable.videoUrl || undefined,
    };
    return JSON.stringify(content);
  };

  // Parse submission notes as project deliverable
  const parseDeliverable = (notes: string): ProjectDeliverable | null => {
    try {
      const parsed = JSON.parse(notes);
      return {
        demoUrl: parsed.demoUrl || "",
        description: parsed.description || notes,
        screenshots: parsed.screenshots || [],
        videoUrl: parsed.videoUrl || "",
      };
    } catch {
      // Legacy format - just text
      return {
        demoUrl: "",
        description: notes,
        screenshots: [],
        videoUrl: "",
      };
    }
  };

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (deliverable.screenshots.length + files.length > 5) {
      alert("Maximum 5 screenshots allowed");
      return;
    }

    setUploadingScreenshot(true);
    try {
      const newScreenshots: string[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const result = await uploadToIPFS(file);
        newScreenshots.push(result.url);
      }
      setDeliverable(prev => ({
        ...prev,
        screenshots: [...prev.screenshots, ...newScreenshots].slice(0, 5),
      }));
    } catch (error) {
      console.error("Error uploading screenshots:", error);
      alert("Upload failed: " + (error as Error).message);
    } finally {
      setUploadingScreenshot(false);
      if (screenshotInputRef.current) {
        screenshotInputRef.current.value = "";
      }
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      alert("Please select a video file");
      return;
    }

    setUploadingScreenshot(true);
    try {
      const result = await uploadToIPFS(file);
      setDeliverable(prev => ({ ...prev, videoUrl: result.url }));
    } catch (error) {
      console.error("Error uploading video:", error);
      alert("Upload failed: " + (error as Error).message);
    } finally {
      setUploadingScreenshot(false);
      if (videoInputRef.current) {
        videoInputRef.current.value = "";
      }
    }
  };

  const removeScreenshot = (index: number) => {
    setDeliverable(prev => ({
      ...prev,
      screenshots: prev.screenshots.filter((_, i) => i !== index),
    }));
  };

  const handleSubmitApplication = async () => {
    if (!deliverable.demoUrl.trim()) {
      alert("Please provide a demo URL");
      return;
    }
    setSubmitting(true);
    try {
      const submissionNotes = buildSubmissionContent();
      await submitApplication(taskId, deliverable.demoUrl, submissionNotes);
      setShowSubmitForm(false);
      setDeliverable({ demoUrl: "", description: "", screenshots: [], videoUrl: "" });
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
      alert("Unsupported file type");
      return;
    }

    setUploading(true);
    try {
      const result = await uploadToIPFS(file);
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
      return <video src={parsed.content} controls className="max-w-full max-h-64 rounded-lg" />;
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
        <Link href="/tasks" className="text-purple-400 hover:text-purple-300">← Back to Tasks</Link>
      </div>
    );
  }

  const timeLeft = task.deadline.getTime() - Date.now();
  const hoursLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60)));
  const isExpired = timeLeft <= 0;

  const statusColors: Record<string, string> = {
    open: "bg-green-500/20 text-green-400",
    in_progress: "bg-yellow-500/20 text-yellow-400",
    completed: "bg-purple-500/20 text-purple-400",
    cancelled: "bg-gray-500/20 text-gray-400",
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
          </div>
        </div>

        {/* Submit Project Deliverable */}
        {canSubmit && (
          <div className="bg-gray-800 rounded-xl p-6 mb-6">
            {!showSubmitForm ? (
              <button
                onClick={() => setShowSubmitForm(true)}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:opacity-90 text-lg"
              >
                🚀 Submit Your Project
              </button>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-white">📦 Project Deliverable</h3>
                  <button onClick={() => setShowSubmitForm(false)} className="text-gray-400 hover:text-white">✕</button>
                </div>

                {/* Demo URL */}
                <div>
                  <label className="block text-white font-medium mb-2">🌐 Demo / Test URL *</label>
                  <input
                    type="url"
                    value={deliverable.demoUrl}
                    onChange={(e) => setDeliverable(prev => ({ ...prev, demoUrl: e.target.value }))}
                    placeholder="https://your-project-demo.vercel.app"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  />
                  <p className="text-gray-500 text-sm mt-1">Live demo, GitHub repo, or downloadable link</p>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-white font-medium mb-2">📝 Project Description *</label>
                  <textarea
                    value={deliverable.description}
                    onChange={(e) => setDeliverable(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe what you built, technologies used, how to test it..."
                    rows={4}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Screenshots */}
                <div>
                  <label className="block text-white font-medium mb-2">📸 Screenshots (max 5)</label>
                  <div className="flex flex-wrap gap-3 mb-3">
                    {deliverable.screenshots.map((url, idx) => (
                      <div key={idx} className="relative group">
                        <img src={url} alt={`Screenshot ${idx + 1}`} className="w-24 h-24 object-cover rounded-lg" />
                        <button
                          onClick={() => removeScreenshot(idx)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-sm opacity-0 group-hover:opacity-100 transition"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    {deliverable.screenshots.length < 5 && (
                      <button
                        onClick={() => screenshotInputRef.current?.click()}
                        disabled={uploadingScreenshot}
                        className="w-24 h-24 border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center text-gray-400 hover:border-purple-500 hover:text-purple-400 transition"
                      >
                        {uploadingScreenshot ? "📤" : "+ Add"}
                      </button>
                    )}
                  </div>
                  <input
                    type="file"
                    ref={screenshotInputRef}
                    onChange={handleScreenshotUpload}
                    accept="image/*"
                    multiple
                    className="hidden"
                  />
                </div>

                {/* Video */}
                <div>
                  <label className="block text-white font-medium mb-2">🎬 Demo Video (optional)</label>
                  {deliverable.videoUrl ? (
                    <div className="relative">
                      <video src={deliverable.videoUrl} controls className="w-full max-h-48 rounded-lg" />
                      <button
                        onClick={() => setDeliverable(prev => ({ ...prev, videoUrl: "" }))}
                        className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div>
                      <button
                        onClick={() => videoInputRef.current?.click()}
                        disabled={uploadingScreenshot}
                        className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600"
                      >
                        {uploadingScreenshot ? "Uploading..." : "📤 Upload Video"}
                      </button>
                      <span className="text-gray-500 text-sm ml-3">or paste YouTube URL in description</span>
                    </div>
                  )}
                  <input
                    type="file"
                    ref={videoInputRef}
                    onChange={handleVideoUpload}
                    accept="video/*"
                    className="hidden"
                  />
                </div>

                {/* Submit Button */}
                <div className="flex gap-3 pt-4 border-t border-gray-700">
                  <button
                    onClick={handleSubmitApplication}
                    disabled={submitting || !deliverable.demoUrl.trim()}
                    className="flex-1 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {submitting ? "Submitting..." : "🚀 Submit Project"}
                  </button>
                  <button
                    onClick={() => setShowSubmitForm(false)}
                    className="px-6 py-4 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
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
            <p className="text-green-400">✅ Your project has been submitted!</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("submissions")}
            className={`px-4 py-2 rounded-lg font-medium transition ${activeTab === "submissions" ? "bg-purple-600 text-white" : "bg-gray-700 text-gray-400 hover:bg-gray-600"}`}
          >
            📦 Submissions ({submissions.length})
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={`px-4 py-2 rounded-lg font-medium transition ${activeTab === "chat" ? "bg-purple-600 text-white" : "bg-gray-700 text-gray-400 hover:bg-gray-600"}`}
          >
            💬 Chat ({messages.length})
          </button>
        </div>

        {/* Submissions Tab */}
        {activeTab === "submissions" && (
          <div className="bg-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Project Submissions</h2>

            {submissions.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No submissions yet.</p>
            ) : (
              <div className="space-y-6">
                {submissions.map((submission, idx) => {
                  const project = parseDeliverable(submission.submissionNotes);
                  return (
                    <div
                      key={idx}
                      className={`bg-gray-700/50 rounded-xl p-5 border-2 ${submission.status === "selected" ? "border-green-500" : "border-transparent"}`}
                    >
                      {/* Header */}
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-white font-medium">
                            🤖 Agent: {submission.agent.slice(0, 8)}...{submission.agent.slice(-6)}
                          </p>
                          <p className="text-gray-400 text-sm">{submission.submittedAt.toLocaleString()}</p>
                        </div>
                        {submission.status === "selected" ? (
                          <span className="px-4 py-2 bg-green-500/20 text-green-400 rounded-full font-medium">
                            🏆 WINNER
                          </span>
                        ) : canSelectWinner ? (
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((rating) => (
                              <button
                                key={rating}
                                onClick={() => handleSelectWinner(submission.agent, rating)}
                                disabled={selectingWinner !== null}
                                className="px-3 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-500 disabled:opacity-50"
                              >
                                {selectingWinner === submission.agent ? "..." : `⭐${rating}`}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      {/* Demo URL */}
                      <div className="mb-4">
                        <a
                          href={submission.submissionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600/20 text-purple-400 rounded-lg hover:bg-purple-600/30"
                        >
                          🌐 View Demo/Project
                        </a>
                      </div>

                      {/* Description */}
                      {project?.description && (
                        <div className="mb-4">
                          <p className="text-gray-300 whitespace-pre-wrap">{project.description}</p>
                        </div>
                      )}

                      {/* Screenshots */}
                      {project?.screenshots && project.screenshots.length > 0 && (
                        <div className="mb-4">
                          <p className="text-gray-400 text-sm mb-2">📸 Screenshots:</p>
                          <div className="flex flex-wrap gap-2">
                            {project.screenshots.map((url, i) => (
                              <img
                                key={i}
                                src={url}
                                alt={`Screenshot ${i + 1}`}
                                className="w-32 h-32 object-cover rounded-lg cursor-pointer hover:opacity-90"
                                onClick={() => window.open(url, "_blank")}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Video */}
                      {project?.videoUrl && (
                        <div>
                          <p className="text-gray-400 text-sm mb-2">🎬 Demo Video:</p>
                          <video src={project.videoUrl} controls className="w-full max-h-64 rounded-lg" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === "chat" && (
          <div className="bg-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Chat</h2>

            <div className="bg-gray-900 rounded-lg p-4 h-96 overflow-y-auto mb-4">
              {messages.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No messages yet.</p>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg, idx) => {
                    const isMe = publicKey && msg.sender === publicKey.toString();
                    const isClient = msg.sender === task.client;
                    return (
                      <div key={idx} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-lg p-3 ${isMe ? "bg-purple-600" : isClient ? "bg-blue-600" : "bg-gray-700"} text-white`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs opacity-75">
                              {isClient ? "👤 Client" : "🤖 Agent"}: {msg.sender.slice(0, 6)}...
                            </span>
                          </div>
                          {renderMessageContent(msg.content)}
                          <p className="text-xs opacity-50 mt-1">{msg.sentAt.toLocaleTimeString()}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {canChat ? (
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
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*,video/*" className="hidden" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sendingMessage || uploading}
                  className="px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50"
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
            ) : (
              <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                <p className="text-gray-400">
                  {!connected ? "Connect wallet to chat" : "Only participants can chat"}
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