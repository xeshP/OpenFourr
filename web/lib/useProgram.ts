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
import { useCallback } from "react";
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
  submissionCount: number;
  winningSubmission?: string;
  completedAt?: Date;
}

export interface Submission {
  taskId: number;
  agent: string;
  submissionUrl: string;
  submissionNotes: string;
  submittedAt: Date;
  status: string;
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
  submission: Buffer.from([58, 194, 159, 158, 75, 102, 178, 197]),
};

// Instruction discriminators from IDL
const INSTRUCTION_DISCRIMINATORS = {
  createTask: Buffer.from([194, 80, 6, 180, 232, 127, 48, 171]),
  registerAgent: Buffer.from([135, 157, 66, 195, 2, 113, 175, 30]),
  submitApplication: Buffer.from([27, 71, 89, 170, 144, 203, 50, 8]),
  selectWinner: Buffer.from([119, 66, 44, 236, 79, 158, 82, 51]),
  cancelTask: Buffer.from([69, 228, 134, 187, 134, 105, 238, 48]),
};

// Task status mapping
const TASK_STATUS = ["open", "in_progress", "pending_review", "completed", "rejected", "cancelled", "disputed"];
const SUBMISSION_STATUS = ["pending", "selected", "not_selected"];

// PDA helpers
export function getPlatformPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from(PLATFORM_SEED)], PROGRAM_ID);
}

export function getAgentPDA(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from(AGENT_SEED), owner.toBuffer()], PROGRAM_ID);
}

export function getTaskPDA(taskId: number): [PublicKey, number] {
  const taskIdBuffer = Buffer.alloc(8);
  taskIdBuffer.writeBigUInt64LE(BigInt(taskId));
  return PublicKey.findProgramAddressSync([Buffer.from(TASK_SEED), taskIdBuffer], PROGRAM_ID);
}

export function getEscrowPDA(taskId: number): [PublicKey, number] {
  const taskIdBuffer = Buffer.alloc(8);
  taskIdBuffer.writeBigUInt64LE(BigInt(taskId));
  return PublicKey.findProgramAddressSync([Buffer.from(ESCROW_SEED), taskIdBuffer], PROGRAM_ID);
}

export function getSubmissionPDA(taskPDA: PublicKey, agentOwner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("submission"), taskPDA.toBuffer(), agentOwner.toBuffer()], PROGRAM_ID);
}

// Borsh parsing helpers
function readString(data: Buffer, offset: number): { value: string; newOffset: number } {
  const length = data.readUInt32LE(offset);
  const value = data.slice(offset + 4, offset + 4 + length).toString('utf-8');
  return { value, newOffset: offset + 4 + length };
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

function readOptionPubkey(data: Buffer, offset: number): { value: string | null; newOffset: number } {
  const hasValue = data.readUInt8(offset) === 1;
  if (!hasValue) return { value: null, newOffset: offset + 1 };
  const result = readPubkey(data, offset + 1);
  return { value: result.value, newOffset: result.newOffset };
}

function readOptionI64(data: Buffer, offset: number): { value: number | null; newOffset: number } {
  const hasValue = data.readUInt8(offset) === 1;
  if (!hasValue) return { value: null, newOffset: offset + 1 };
  const result = readI64(data, offset + 1);
  return { value: result.value, newOffset: result.newOffset };
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

// Parse Task account data (NEW structure)
function parseTaskAccount(data: Buffer): Task | null {
  try {
    const discriminator = data.slice(0, 8);
    if (!discriminator.equals(DISCRIMINATORS.task)) return null;

    let offset = 8;
    const id = readU64(data, offset); offset = id.newOffset;
    const client = readPubkey(data, offset); offset = client.newOffset;
    const title = readString(data, offset); offset = title.newOffset;
    const description = readString(data, offset); offset = description.newOffset;
    const requirements = readString(data, offset); offset = requirements.newOffset;
    const category = readString(data, offset); offset = category.newOffset;
    const bountyAmount = readU64(data, offset); offset = bountyAmount.newOffset;
    const createdAt = readI64(data, offset); offset = createdAt.newOffset;
    const deadline = readI64(data, offset); offset = deadline.newOffset;
    const statusByte = readU8(data, offset); offset = statusByte.newOffset;
    const submissionCount = readU64(data, offset); offset = submissionCount.newOffset;
    const winningSubmission = readOptionPubkey(data, offset); offset = winningSubmission.newOffset;
    const completedAt = readOptionI64(data, offset);

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
      status: TASK_STATUS[statusByte.value] || "unknown",
      submissionCount: submissionCount.value,
      winningSubmission: winningSubmission.value || undefined,
      completedAt: completedAt.value ? new Date(completedAt.value * 1000) : undefined,
    };
  } catch (e) {
    console.error("Failed to parse task:", e);
    return null;
  }
}

// Parse Submission account data
function parseSubmissionAccount(data: Buffer): Submission | null {
  try {
    const discriminator = data.slice(0, 8);
    if (!discriminator.equals(DISCRIMINATORS.submission)) return null;

    let offset = 8;
    const taskId = readU64(data, offset); offset = taskId.newOffset;
    const agent = readPubkey(data, offset); offset = agent.newOffset;
    const submissionUrl = readString(data, offset); offset = submissionUrl.newOffset;
    const submissionNotes = readString(data, offset); offset = submissionNotes.newOffset;
    const submittedAt = readI64(data, offset); offset = submittedAt.newOffset;
    const statusByte = readU8(data, offset);

    return {
      taskId: taskId.value,
      agent: agent.value,
      submissionUrl: submissionUrl.value,
      submissionNotes: submissionNotes.value,
      submittedAt: new Date(submittedAt.value * 1000),
      status: SUBMISSION_STATUS[statusByte.value] || "unknown",
    };
  } catch (e) {
    console.error("Failed to parse submission:", e);
    return null;
  }
}

// Parse Agent account data
function parseAgentAccount(data: Buffer): Agent | null {
  try {
    const discriminator = data.slice(0, 8);
    if (!discriminator.equals(DISCRIMINATORS.agent)) return null;

    let offset = 8;
    const owner = readPubkey(data, offset); offset = owner.newOffset;
    const name = readString(data, offset); offset = name.newOffset;
    const bio = readString(data, offset); offset = bio.newOffset;
    const skills = readStringVec(data, offset); offset = skills.newOffset;
    const hourlyRate = readU64(data, offset); offset = hourlyRate.newOffset;
    const tasksCompleted = readU64(data, offset); offset = tasksCompleted.newOffset;
    const tasksFailed = readU64(data, offset); offset = tasksFailed.newOffset;
    const totalEarned = readU64(data, offset); offset = totalEarned.newOffset;
    const ratingSum = readU64(data, offset); offset = ratingSum.newOffset;
    const ratingCount = readU64(data, offset); offset = ratingCount.newOffset;
    const registeredAt = readI64(data, offset); offset = registeredAt.newOffset;
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

function serializeU8(value: number): Buffer {
  const buffer = Buffer.alloc(1);
  buffer.writeUInt8(value);
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
      if (!accountInfo) return null;
      
      const data = accountInfo.data.slice(8);
      const feeBps = data.readUInt16LE(32);
      const totalTasks = Number(data.readBigUInt64LE(34));
      const totalCompleted = Number(data.readBigUInt64LE(42));
      const totalVolume = Number(data.readBigUInt64LE(50));
      
      return { totalTasks, totalCompleted, totalVolume: totalVolume / LAMPORTS_PER_SOL, feeBps };
    } catch (e) {
      console.error("Failed to fetch platform stats:", e);
      return null;
    }
  }, [connection]);

  const fetchAllTasks = useCallback(async (): Promise<Task[]> => {
    try {
      const accounts = await connection.getProgramAccounts(PROGRAM_ID);
      const tasks: Task[] = [];
      for (const { account } of accounts) {
        const task = parseTaskAccount(account.data);
        if (task) tasks.push(task);
      }
      tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return tasks;
    } catch (e) {
      console.error("Failed to fetch tasks:", e);
      return [];
    }
  }, [connection]);

  const fetchAllAgents = useCallback(async (): Promise<Agent[]> => {
    try {
      const accounts = await connection.getProgramAccounts(PROGRAM_ID);
      const agents: Agent[] = [];
      for (const { account } of accounts) {
        const agent = parseAgentAccount(account.data);
        if (agent) agents.push(agent);
      }
      agents.sort((a, b) => b.tasksCompleted - a.tasksCompleted);
      return agents;
    } catch (e) {
      console.error("Failed to fetch agents:", e);
      return [];
    }
  }, [connection]);

  const fetchTaskSubmissions = useCallback(async (taskId: number): Promise<Submission[]> => {
    try {
      const accounts = await connection.getProgramAccounts(PROGRAM_ID);
      const submissions: Submission[] = [];
      for (const { account } of accounts) {
        const submission = parseSubmissionAccount(account.data);
        if (submission && submission.taskId === taskId) {
          submissions.push(submission);
        }
      }
      submissions.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
      return submissions;
    } catch (e) {
      console.error("Failed to fetch submissions:", e);
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
    if (!wallet.publicKey || !wallet.signTransaction) throw new Error("Wallet not connected");

    const [platformPDA] = getPlatformPDA();
    const platformInfo = await connection.getAccountInfo(platformPDA);
    if (!platformInfo) throw new Error("Platform not initialized");
    
    const platformData = platformInfo.data.slice(8);
    const taskId = Number(platformData.readBigUInt64LE(34));
    
    const [taskPDA] = getTaskPDA(taskId);
    const [escrowPDA] = getEscrowPDA(taskId);
    const bountyLamports = BigInt(Math.floor(bountySOL * LAMPORTS_PER_SOL));

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

    const transaction = new Transaction()
      .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }))
      .add(instruction);
    transaction.feePayer = wallet.publicKey;
    
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    const signed = await wallet.signTransaction(transaction);
    const txid = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction({ signature: txid, blockhash, lastValidBlockHeight });

    return txid;
  }, [connection, wallet]);

  const registerAgent = useCallback(async (
    name: string,
    bio: string,
    skills: string[],
    hourlyRate: number
  ): Promise<string> => {
    if (!wallet.publicKey || !wallet.signTransaction) throw new Error("Wallet not connected");

    const [agentPDA] = getAgentPDA(wallet.publicKey);
    const hourlyRateLamports = BigInt(Math.floor(hourlyRate * LAMPORTS_PER_SOL));

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

    const transaction = new Transaction()
      .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }))
      .add(instruction);
    transaction.feePayer = wallet.publicKey;
    
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    const signed = await wallet.signTransaction(transaction);
    const txid = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction({ signature: txid, blockhash, lastValidBlockHeight });

    return txid;
  }, [connection, wallet]);

  const submitApplication = useCallback(async (
    taskId: number,
    submissionUrl: string,
    submissionNotes: string
  ): Promise<string> => {
    if (!wallet.publicKey || !wallet.signTransaction) throw new Error("Wallet not connected");

    const [taskPDA] = getTaskPDA(taskId);
    const [agentPDA] = getAgentPDA(wallet.publicKey);
    const [submissionPDA] = getSubmissionPDA(taskPDA, wallet.publicKey);

    const instructionData = Buffer.concat([
      INSTRUCTION_DISCRIMINATORS.submitApplication,
      serializeString(submissionUrl),
      serializeString(submissionNotes),
    ]);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: submissionPDA, isSigner: false, isWritable: true },
        { pubkey: taskPDA, isSigner: false, isWritable: true },
        { pubkey: agentPDA, isSigner: false, isWritable: false },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: instructionData,
    });

    const transaction = new Transaction()
      .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }))
      .add(instruction);
    transaction.feePayer = wallet.publicKey;
    
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    const signed = await wallet.signTransaction(transaction);
    const txid = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction({ signature: txid, blockhash, lastValidBlockHeight });

    return txid;
  }, [connection, wallet]);

  const selectWinner = useCallback(async (
    taskId: number,
    submissionAgent: string,
    rating: number
  ): Promise<string> => {
    if (!wallet.publicKey || !wallet.signTransaction) throw new Error("Wallet not connected");

    const [taskPDA] = getTaskPDA(taskId);
    const submissionAgentPubkey = new PublicKey(submissionAgent);
    const [submissionPDA] = getSubmissionPDA(taskPDA, submissionAgentPubkey);
    const [agentPDA] = getAgentPDA(submissionAgentPubkey);
    const [escrowPDA] = getEscrowPDA(taskId);
    const [platformPDA] = getPlatformPDA();

    const platformInfo = await connection.getAccountInfo(platformPDA);
    if (!platformInfo) throw new Error("Platform not found");
    const platformAuthority = new PublicKey(platformInfo.data.slice(8, 40));

    const instructionData = Buffer.concat([
      INSTRUCTION_DISCRIMINATORS.selectWinner,
      serializeU8(rating),
    ]);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: taskPDA, isSigner: false, isWritable: true },
        { pubkey: submissionPDA, isSigner: false, isWritable: true },
        { pubkey: agentPDA, isSigner: false, isWritable: true },
        { pubkey: submissionAgentPubkey, isSigner: false, isWritable: true },
        { pubkey: escrowPDA, isSigner: false, isWritable: true },
        { pubkey: platformPDA, isSigner: false, isWritable: true },
        { pubkey: platformAuthority, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: instructionData,
    });

    const transaction = new Transaction()
      .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }))
      .add(instruction);
    transaction.feePayer = wallet.publicKey;
    
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    const signed = await wallet.signTransaction(transaction);
    const txid = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction({ signature: txid, blockhash, lastValidBlockHeight });

    return txid;
  }, [connection, wallet]);

  return {
    connected: !!wallet.publicKey,
    publicKey: wallet.publicKey,
    fetchPlatformStats,
    fetchAllTasks,
    fetchAllAgents,
    fetchTaskSubmissions,
    createTask,
    registerAgent,
    submitApplication,
    selectWinner,
  };
}
