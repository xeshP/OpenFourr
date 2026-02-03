"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { 
  PublicKey, 
  SystemProgram, 
  LAMPORTS_PER_SOL, 
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { useMemo, useCallback } from "react";
import { PROGRAM_ID, PLATFORM_SEED, AGENT_SEED, TASK_SEED, ESCROW_SEED } from "./constants";
import * as borsh from "borsh";

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

// Instruction discriminators (first 8 bytes of sha256("global:instruction_name"))
const DISCRIMINATORS = {
  createTask: Buffer.from([194, 80, 6, 180, 232, 141, 89, 226]), // sha256("global:create_task")[0:8]
};

// Borsh schema for serializing instruction data
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
      const data = accountInfo.data.slice(8);
      // authority: 32 bytes, feeBps: 2 bytes, totalTasks: 8 bytes, totalCompleted: 8 bytes, totalVolume: 8 bytes
      const totalTasks = Number(data.readBigUInt64LE(34));
      const totalCompleted = Number(data.readBigUInt64LE(42));
      const totalVolume = Number(data.readBigUInt64LE(50));
      const feeBps = data.readUInt16LE(32);
      
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
      const accounts = await connection.getProgramAccounts(PROGRAM_ID);
      const tasks: Task[] = [];
      
      for (const { account } of accounts) {
        // Check if this is a Task account by size (Tasks are larger)
        if (account.data.length > 500) {
          try {
            const data = account.data.slice(8); // Skip discriminator
            // Basic parsing - this would need proper borsh deserialization
            // For now, we'll return empty array since parsing is complex
          } catch (e) {
            // Not a task account or parsing error
          }
        }
      }
      
      return tasks;
    } catch (e) {
      console.error("Failed to fetch tasks:", e);
      return [];
    }
  }, [connection]);

  const fetchAllAgents = useCallback(async (): Promise<Agent[]> => {
    try {
      return [];
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
    const platformData = platformInfo.data.slice(8);
    const taskId = Number(platformData.readBigUInt64LE(34));
    
    const [taskPDA, taskBump] = getTaskPDA(taskId);
    const [escrowPDA, escrowBump] = getEscrowPDA(taskId);
    
    const bountyLamports = BigInt(Math.floor(bountySOL * LAMPORTS_PER_SOL));
    
    // Build instruction data
    // Discriminator (8) + title (4+len) + description (4+len) + requirements (4+len) + category (4+len) + bounty (8) + deadline (8)
    const instructionData = Buffer.concat([
      DISCRIMINATORS.createTask,
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

    const transaction = new Transaction().add(instruction);
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
    claimTask,
    submitWork,
  };
}
