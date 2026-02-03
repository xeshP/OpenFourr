"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { 
  PublicKey, 
  SystemProgram, 
  LAMPORTS_PER_SOL, 
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import { useMemo, useCallback } from "react";
import { PROGRAM_ID, PLATFORM_SEED, AGENT_SEED, TASK_SEED, ESCROW_SEED } from "./constants";

export interface Task {
  id: number;
  client: string;
  title: string;
  description: string;
  requirements: string;
  category: string;
  bounty: number;
  createdAt: Date;
  deadline: Date;
  status: string;
  assignedAgent?: string;
  submissionUrl?: string;
  submissionNotes?: string;
  rating?: number;
}

export interface Agent {
  owner: string;
  name: string;
  bio: string;
  skills: string[];
  hourlyRate: number;
  tasksCompleted: number;
  tasksFailed: number;
  totalEarned: number;
  ratingSum: number;
  ratingCount: number;
  registeredAt: Date;
  isActive: boolean;
}

export interface PlatformStats {
  totalTasks: number;
  totalCompleted: number;
  totalVolume: number;
  feeBps: number;
}

// Account discriminators from IDL
const DISCRIMINATORS = {
  task: Buffer.from([79, 34, 229, 55, 88, 90, 55, 84]),
  agent: Buffer.from([60, 227, 42, 24, 0, 87, 86, 205]),
  platform: Buffer.from([77, 92, 204, 58, 187, 98, 91, 12]),
};

// Instruction discriminators from IDL (anchor sighash - FIXED Feb 3 2026)
// Old wrong value was: [194, 80, 6, 180, 232, 141, 89, 226]
const INSTRUCTION_DISCRIMINATORS = {
  createTask: Buffer.from([194, 80, 6, 180, 232, 127, 48, 171]), // CORRECT from target/idl/openfourr.json
  registerAgent: Buffer.from([135, 157, 66, 195, 2, 113, 175, 30]), // from IDL
};

// Task status mapping
const TASK_STATUS = ["open", "in_progress", "pending_review", "completed", "rejected", "cancelled", "disputed"];

// PDA helpers
export function getPlatformPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PLATFORM_SEED)],
    PROGRAM_ID
  );
}

export function getAgentPDA(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(AGENT_SEED), owner.toBuffer()],
    PROGRAM_ID
  );
}

export function getTaskPDA(taskId: number): [PublicKey, number] {
  const taskIdBuffer = Buffer.alloc(8);
  taskIdBuffer.writeBigUInt64LE(BigInt(taskId));
  return PublicKey.findProgramAddressSync(
    [Buffer.from(TASK_SEED), taskIdBuffer],
    PROGRAM_ID
  );
}

export function getEscrowPDA(taskId: number): [PublicKey, number] {
  const taskIdBuffer = Buffer.alloc(8);
  taskIdBuffer.writeBigUInt64LE(BigInt(taskId));
  return PublicKey.findProgramAddressSync(
    [Buffer.from(ESCROW_SEED), taskIdBuffer],
    PROGRAM_ID
  );
}

// Borsh parsing helpers
function readString(data: Buffer, offset: number): { value: string; newOffset: number } {
  const length = data.readUInt32LE(offset);
  const value = data.slice(offset + 4, offset + 4 + length).toString('utf-8');
  return { value, newOffset: offset + 4 + length };
}

function readOption<T>(data: Buffer, offset: number, reader: (data: Buffer, offset: number) => { value: T; newOffset: number }): { value: T | null; newOffset: number } {
  const hasValue = data.readUInt8(offset) === 1;
  if (!hasValue) {
    return { value: null, newOffset: offset + 1 };
  }
  const result = reader(data, offset + 1);
  return { value: result.value, newOffset: result.newOffset };
}

function readPubkey(data: Buffer, offset: number): { value: string; newOffset: number } {
  const bytes = data.slice(offset, offset + 32);
  const pubkey = new PublicKey(bytes);
  return { value: pubkey.toString(), newOffset: offset + 32 };
}

function readU64(data: Buffer, offset: number): { value: number; newOffset: number } {
  const value = Number(data.readBigUInt64LE(offset));
  return { value, newOffset: offset + 8 };
}

function readI64(data: Buffer, offset: number): { value: number; newOffset: number } {
  const value = Number(data.readBigInt64LE(offset));
  return { value, newOffset: offset + 8 };
}

function readU8(data: Buffer, offset: number): { value: number; newOffset: number } {
  return { value: data.readUInt8(offset), newOffset: offset + 1 };
}

function readOptionString(data: Buffer, offset: number): { value: string | null; newOffset: number } {
  return readOption(data, offset, readString);
}

function readOptionPubkey(data: Buffer, offset: number): { value: string | null; newOffset: number } {
  return readOption(data, offset, readPubkey);
}

function readOptionI64(data: Buffer, offset: number): { value: number | null; newOffset: number } {
  return readOption(data, offset, readI64);
}

function readOptionU8(data: Buffer, offset: number): { value: number | null; newOffset: number } {
  return readOption(data, offset, readU8);
}

function readStringVec(data: Buffer, offset: number): { value: string[]; newOffset: number } {
  const length = data.readUInt32LE(offset);
  let currentOffset = offset + 4;
  const values: string[] = [];
  
  for (let i = 0; i < length; i++) {
    const result = readString(data, currentOffset);
    values.push(result.value);
    currentOffset = result.newOffset;
  }
  
  return { value: values, newOffset: currentOffset };
}

// Parse Task account data
function parseTaskAccount(data: Buffer): Task | null {
  try {
    // Check discriminator
    const discriminator = data.slice(0, 8);
    if (!discriminator.equals(DISCRIMINATORS.task)) {
      return null;
    }

    let offset = 8; // Skip discriminator

    // id: u64
    const id = readU64(data, offset);
    offset = id.newOffset;

    // client: Pubkey
    const client = readPubkey(data, offset);
    offset = client.newOffset;

    // title: String
    const title = readString(data, offset);
    offset = title.newOffset;

    // description: String
    const description = readString(data, offset);
    offset = description.newOffset;

    // requirements: String
    const requirements = readString(data, offset);
    offset = requirements.newOffset;

    // category: String
    const category = readString(data, offset);
    offset = category.newOffset;

    // bounty_amount: u64
    const bountyAmount = readU64(data, offset);
    offset = bountyAmount.newOffset;

    // created_at: i64
    const createdAt = readI64(data, offset);
    offset = createdAt.newOffset;

    // deadline: i64
    const deadline = readI64(data, offset);
    offset = deadline.newOffset;

    // status: TaskStatus (enum, single byte)
    const statusByte = readU8(data, offset);
    offset = statusByte.newOffset;
    const status = TASK_STATUS[statusByte.value] || "unknown";

    // assigned_agent: Option<Pubkey>
    const assignedAgent = readOptionPubkey(data, offset);
    offset = assignedAgent.newOffset;

    // claimed_at: Option<i64>
    const claimedAt = readOptionI64(data, offset);
    offset = claimedAt.newOffset;

    // submitted_at: Option<i64>
    const submittedAt = readOptionI64(data, offset);
    offset = submittedAt.newOffset;

    // completed_at: Option<i64>
    const completedAt = readOptionI64(data, offset);
    offset = completedAt.newOffset;

    // submission_url: Option<String>
    const submissionUrl = readOptionString(data, offset);
    offset = submissionUrl.newOffset;

    // submission_notes: Option<String>
    const submissionNotes = readOptionString(data, offset);
    offset = submissionNotes.newOffset;

    // rejection_reason: Option<String> - skip
    const rejectionReason = readOptionString(data, offset);
    offset = rejectionReason.newOffset;

    // rating: Option<u8>
    const rating = readOptionU8(data, offset);

    return {
      id: id.value,
      client: client.value,
      title: title.value,
      description: description.value,
      requirements: requirements.value,
      category: category.value,
      bounty: bountyAmount.value / LAMPORTS_PER_SOL,
      createdAt: new Date(createdAt.value * 1000),
      deadline: new Date(deadline.value * 1000),
      status,
      assignedAgent: assignedAgent.value || undefined,
      submissionUrl: submissionUrl.value || undefined,
      submissionNotes: submissionNotes.value || undefined,
      rating: rating.value || undefined,
    };
  } catch (e) {
    console.error("Failed to parse task:", e);
    return null;
  }
}

// Parse Agent account data
function parseAgentAccount(data: Buffer): Agent | null {
  try {
    // Check discriminator
    const discriminator = data.slice(0, 8);
    if (!discriminator.equals(DISCRIMINATORS.agent)) {
      return null;
    }

    let offset = 8; // Skip discriminator

    // owner: Pubkey
    const owner = readPubkey(data, offset);
    offset = owner.newOffset;

    // name: String
    const name = readString(data, offset);
    offset = name.newOffset;

    // bio: String
    const bio = readString(data, offset);
    offset = bio.newOffset;

    // skills: Vec<String>
    const skills = readStringVec(data, offset);
    offset = skills.newOffset;

    // hourly_rate: u64
    const hourlyRate = readU64(data, offset);
    offset = hourlyRate.newOffset;

    // tasks_completed: u64
    const tasksCompleted = readU64(data, offset);
    offset = tasksCompleted.newOffset;

    // tasks_failed: u64
    const tasksFailed = readU64(data, offset);
    offset = tasksFailed.newOffset;

    // total_earned: u64
    const totalEarned = readU64(data, offset);
    offset = totalEarned.newOffset;

    // rating_sum: u64
    const ratingSum = readU64(data, offset);
    offset = ratingSum.newOffset;

    // rating_count: u64
    const ratingCount = readU64(data, offset);
    offset = ratingCount.newOffset;

    // registered_at: i64
    const registeredAt = readI64(data, offset);
    offset = registeredAt.newOffset;

    // is_active: bool
    const isActive = data.readUInt8(offset) === 1;

    return {
      owner: owner.value,
      name: name.value,
      bio: bio.value,
      skills: skills.value,
      hourlyRate: hourlyRate.value / LAMPORTS_PER_SOL,
      tasksCompleted: tasksCompleted.value,
      tasksFailed: tasksFailed.value,
      totalEarned: totalEarned.value / LAMPORTS_PER_SOL,
      ratingSum: ratingSum.value,
      ratingCount: ratingCount.value,
      registeredAt: new Date(registeredAt.value * 1000),
      isActive,
    };
  } catch (e) {
    console.error("Failed to parse agent:", e);
    return null;
  }
}

// Borsh serialization helpers
function serializeString(str: string): Buffer {
  const strBytes = Buffer.from(str, 'utf-8');
  const lenBuffer = Buffer.alloc(4);
  lenBuffer.writeUInt32LE(strBytes.length);
  return Buffer.concat([lenBuffer, strBytes]);
}

function serializeU64(value: bigint): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(value);
  return buffer;
}

function serializeStringVec(strings: string[]): Buffer {
  const lenBuffer = Buffer.alloc(4);
  lenBuffer.writeUInt32LE(strings.length);
  const parts: Buffer[] = [lenBuffer];
  for (const s of strings) {
    parts.push(serializeString(s));
  }
  return Buffer.concat(parts);
}

export function useProgram() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const fetchPlatformStats = useCallback(async (): Promise<PlatformStats | null> => {
    try {
      const [platformPDA] = getPlatformPDA();
      const accountInfo = await connection.getAccountInfo(platformPDA);
      
      if (!accountInfo) {
        console.log("Platform not initialized yet");
        return null;
      }
      
      // Parse platform data (skip 8-byte discriminator)
      // Structure: authority(32) + fee_bps(2) + total_tasks(8) + total_completed(8) + total_volume(8) + bump(1)
      const data = accountInfo.data.slice(8);
      const feeBps = data.readUInt16LE(32);
      const totalTasks = Number(data.readBigUInt64LE(34));
      const totalCompleted = Number(data.readBigUInt64LE(42));
      const totalVolume = Number(data.readBigUInt64LE(50));
      
      return {
        totalTasks,
        totalCompleted,
        totalVolume: totalVolume / LAMPORTS_PER_SOL,
        feeBps,
      };
    } catch (e) {
      console.error("Failed to fetch platform stats:", e);
      return null;
    }
  }, [connection]);

  const fetchAllTasks = useCallback(async (): Promise<Task[]> => {
    try {
      console.log("Fetching all tasks from program:", PROGRAM_ID.toString());
      const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          {
            memcmp: {
              offset: 0,
              bytes: Buffer.from(DISCRIMINATORS.task).toString('base64'),
            },
          },
        ],
      });
      
      console.log("Found", accounts.length, "task accounts");
      const tasks: Task[] = [];
      
      for (const { account } of accounts) {
        const task = parseTaskAccount(account.data);
        if (task) {
          tasks.push(task);
        }
      }
      
      // Sort by creation date (newest first)
      tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      console.log("Parsed", tasks.length, "tasks");
      return tasks;
    } catch (e) {
      console.error("Failed to fetch tasks:", e);
      return [];
    }
  }, [connection]);

  const fetchAllAgents = useCallback(async (): Promise<Agent[]> => {
    try {
      console.log("Fetching all agents from program:", PROGRAM_ID.toString());
      const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          {
            memcmp: {
              offset: 0,
              bytes: Buffer.from(DISCRIMINATORS.agent).toString('base64'),
            },
          },
        ],
      });
      
      console.log("Found", accounts.length, "agent accounts");
      const agents: Agent[] = [];
      
      for (const { account } of accounts) {
        const agent = parseAgentAccount(account.data);
        if (agent) {
          agents.push(agent);
        }
      }
      
      // Sort by tasks completed (most first)
      agents.sort((a, b) => b.tasksCompleted - a.tasksCompleted);
      
      console.log("Parsed", agents.length, "agents");
      return agents;
    } catch (e) {
      console.error("Failed to fetch agents:", e);
      return [];
    }
  }, [connection]);

  const createTask = useCallback(async (
    title: string,
    description: string,
    requirements: string,
    category: string,
    bountySOL: number,
    deadlineHours: number
  ): Promise<string> => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      throw new Error("Wallet not connected");
    }

    // Get platform stats to determine task ID
    const [platformPDA] = getPlatformPDA();
    const platformInfo = await connection.getAccountInfo(platformPDA);
    
    if (!platformInfo) {
      throw new Error("Platform not initialized. Please contact admin.");
    }
    
    // Parse totalTasks from platform account
    // Structure after discriminator: authority(32) + fee_bps(2) + total_tasks(8)
    const platformData = platformInfo.data.slice(8);
    const taskId = Number(platformData.readBigUInt64LE(34));
    
    const [taskPDA] = getTaskPDA(taskId);
    const [escrowPDA] = getEscrowPDA(taskId);
    
    const bountyLamports = BigInt(Math.floor(bountySOL * LAMPORTS_PER_SOL));
    
    console.log("Creating task with:", {
      taskId,
      taskPDA: taskPDA.toString(),
      escrowPDA: escrowPDA.toString(),
      platformPDA: platformPDA.toString(),
      bountyLamports: bountyLamports.toString(),
    });

    // Build instruction data
    const instructionData = Buffer.concat([
      INSTRUCTION_DISCRIMINATORS.createTask,
      serializeString(title),
      serializeString(description),
      serializeString(requirements),
      serializeString(category),
      serializeU64(bountyLamports),
      serializeU64(BigInt(deadlineHours)),
    ]);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: taskPDA, isSigner: false, isWritable: true },
        { pubkey: platformPDA, isSigner: false, isWritable: true },
        { pubkey: escrowPDA, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: instructionData,
    });

    // Add compute budget instruction for sufficient compute units
    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 300_000,
    });

    const transaction = new Transaction()
      .add(computeBudgetIx)
      .add(instruction);
    transaction.feePayer = wallet.publicKey;
    
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    const signed = await wallet.signTransaction(transaction);
    const txid = await connection.sendRawTransaction(signed.serialize());
    
    await connection.confirmTransaction({
      signature: txid,
      blockhash,
      lastValidBlockHeight,
    });

    console.log("Task created! TX:", txid);
    return txid;
  }, [connection, wallet]);

  const registerAgent = useCallback(async (
    name: string,
    bio: string,
    skills: string[],
    hourlyRate: number
  ): Promise<string> => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      throw new Error("Wallet not connected");
    }

    const [agentPDA] = getAgentPDA(wallet.publicKey);
    
    const hourlyRateLamports = BigInt(Math.floor(hourlyRate * LAMPORTS_PER_SOL));
    
    console.log("Registering agent:", {
      agentPDA: agentPDA.toString(),
      name,
      skills,
    });

    // Build instruction data
    const instructionData = Buffer.concat([
      INSTRUCTION_DISCRIMINATORS.registerAgent,
      serializeString(name),
      serializeString(bio),
      serializeStringVec(skills),
      serializeU64(hourlyRateLamports),
    ]);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: agentPDA, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: instructionData,
    });

    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 300_000,
    });

    const transaction = new Transaction()
      .add(computeBudgetIx)
      .add(instruction);
    transaction.feePayer = wallet.publicKey;
    
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    const signed = await wallet.signTransaction(transaction);
    const txid = await connection.sendRawTransaction(signed.serialize());
    
    await connection.confirmTransaction({
      signature: txid,
      blockhash,
      lastValidBlockHeight,
    });

    console.log("Agent registered! TX:", txid);
    return txid;
  }, [connection, wallet]);

  const claimTask = useCallback(async (taskId: number): Promise<string> => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      throw new Error("Wallet not connected");
    }
    throw new Error("Coming soon - register as agent first!");
  }, [wallet]);

  const submitWork = useCallback(async (
    taskId: number,
    submissionUrl: string,
    submissionNotes: string
  ): Promise<string> => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      throw new Error("Wallet not connected");
    }
    throw new Error("Coming soon!");
  }, [wallet]);

  return {
    program: null,
    connected: !!wallet.publicKey,
    publicKey: wallet.publicKey,
    fetchPlatformStats,
    fetchAllTasks,
    fetchAllAgents,
    createTask,
    registerAgent,
    claimTask,
    submitWork,
  };
}
