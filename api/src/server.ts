import express from "express";
import cors from "cors";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { AIJudge } from "./judge";
import OpenfourrSDK from "../../sdk/src";

const app = express();
app.use(cors());
app.use(express.json());

// Config
const SOLANA_RPC = process.env.SOLANA_RPC || "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey(
  process.env.PROGRAM_ID || "OpenFourrXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
);
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

// Initialize
const connection = new Connection(SOLANA_RPC, "confirmed");
const aiJudge = new AIJudge(ANTHROPIC_API_KEY);

// ============ AGENT ENDPOINTS ============

// List all agents
app.get("/api/agents", async (req, res) => {
  try {
    // In production, fetch from on-chain accounts
    // For now, return mock data
    res.json({
      agents: [],
      total: 0,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch agents" });
  }
});

// Get agent by wallet
app.get("/api/agents/:wallet", async (req, res) => {
  try {
    const wallet = new PublicKey(req.params.wallet);
    const [agentPDA] = OpenfourrSDK.getAgentPDA(wallet, PROGRAM_ID);

    // Fetch from chain
    // const agent = await sdk.getAgent(wallet);

    res.json({
      pda: agentPDA.toBase58(),
      // agent data would go here
    });
  } catch (error) {
    res.status(404).json({ error: "Agent not found" });
  }
});

// ============ TASK ENDPOINTS ============

// List all open tasks
app.get("/api/tasks", async (req, res) => {
  try {
    const { status, category, limit, offset } = req.query;

    // In production, fetch and filter from chain
    res.json({
      tasks: [],
      total: 0,
      hasMore: false,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// Get task by ID
app.get("/api/tasks/:id", async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const [taskPDA] = OpenfourrSDK.getTaskPDA(taskId, PROGRAM_ID);

    res.json({
      pda: taskPDA.toBase58(),
      // task data would go here
    });
  } catch (error) {
    res.status(404).json({ error: "Task not found" });
  }
});

// ============ AI JUDGE ENDPOINTS ============

// Submit work for AI evaluation
app.post("/api/judge/evaluate", async (req, res) => {
  try {
    const { taskId, title, description, requirements, submissionUrl, submissionNotes } =
      req.body;

    // Validate required fields
    if (!taskId || !title || !submissionUrl) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // First verify the URL is accessible
    const urlCheck = await aiJudge.verifyUrl(submissionUrl);
    if (!urlCheck.valid) {
      return res.json({
        approved: false,
        rating: 1,
        reasoning: `Submission URL is not accessible: ${urlCheck.error}`,
        feedback: "Please provide a working URL to your submission.",
      });
    }

    // Evaluate with AI
    const result = await aiJudge.evaluateSubmission({
      taskId,
      title,
      description: description || "",
      requirements: requirements || "",
      submissionUrl,
      submissionNotes: submissionNotes || "",
    });

    res.json(result);
  } catch (error) {
    console.error("Judge evaluation error:", error);
    res.status(500).json({ error: "Evaluation failed" });
  }
});

// ============ PLATFORM STATS ============

app.get("/api/stats", async (req, res) => {
  try {
    const [platformPDA] = OpenfourrSDK.getPlatformPDA(PROGRAM_ID);

    // In production, fetch from chain
    res.json({
      totalTasks: 0,
      totalCompleted: 0,
      totalVolume: 0,
      totalAgents: 0,
      platformPDA: platformPDA.toBase58(),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ============ HEALTH CHECK ============

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    version: "0.1.0",
    solanaRpc: SOLANA_RPC,
    programId: PROGRAM_ID.toBase58(),
  });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🏪 Openfourr API running on port ${PORT}`);
  console.log(`   Solana RPC: ${SOLANA_RPC}`);
  console.log(`   Program ID: ${PROGRAM_ID.toBase58()}`);
});

export default app;
