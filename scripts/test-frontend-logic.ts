/**
 * This script tests the EXACT same logic the frontend uses
 * to create a task. If this works, the frontend should too.
 */

import { 
  Connection, 
  Keypair, 
  PublicKey, 
  SystemProgram, 
  LAMPORTS_PER_SOL, 
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import * as fs from "fs";

// Constants (same as frontend)
const PROGRAM_ID = new PublicKey("FBtigfHS7NXnQYgjaGACFY8SVmd3sX2XmsdWna2ak99L");
const PLATFORM_SEED = "platform";
const TASK_SEED = "task";
const ESCROW_SEED = "escrow";
const RPC_URL = "https://api.devnet.solana.com";

// Load keypair
const keypairPath = process.env.HOME + "/.config/solana/id.json";
const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
const wallet = Keypair.fromSecretKey(Uint8Array.from(keypairData));

// Discriminator from IDL (must match exactly!)
const DISCRIMINATOR_CREATE_TASK = Buffer.from([194, 80, 6, 180, 232, 127, 48, 171]);

// Helper functions (same as frontend)
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

function getPlatformPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PLATFORM_SEED)],
    PROGRAM_ID
  );
}

function getTaskPDA(taskId: number): [PublicKey, number] {
  const taskIdBuffer = Buffer.alloc(8);
  taskIdBuffer.writeBigUInt64LE(BigInt(taskId));
  return PublicKey.findProgramAddressSync(
    [Buffer.from(TASK_SEED), taskIdBuffer],
    PROGRAM_ID
  );
}

function getEscrowPDA(taskId: number): [PublicKey, number] {
  const taskIdBuffer = Buffer.alloc(8);
  taskIdBuffer.writeBigUInt64LE(BigInt(taskId));
  return PublicKey.findProgramAddressSync(
    [Buffer.from(ESCROW_SEED), taskIdBuffer],
    PROGRAM_ID
  );
}

async function testFrontendCreateTask() {
  console.log("=".repeat(60));
  console.log("🧪 TESTING FRONTEND LOGIC FOR CREATE TASK");
  console.log("=".repeat(60));
  
  const connection = new Connection(RPC_URL, "confirmed");
  
  console.log("\n📍 Program ID:", PROGRAM_ID.toString());
  console.log("👤 Wallet:", wallet.publicKey.toString());
  
  // Get platform PDA and read state (EXACTLY like frontend)
  const [platformPDA] = getPlatformPDA();
  console.log("📍 Platform PDA:", platformPDA.toString());
  
  const platformInfo = await connection.getAccountInfo(platformPDA);
  if (!platformInfo) {
    throw new Error("Platform not initialized");
  }
  
  // Parse totalTasks from platform account (EXACTLY like frontend)
  // Frontend does: platformInfo.data.slice(8) then readBigUInt64LE(34)
  const platformData = platformInfo.data.slice(8);
  const taskId = Number(platformData.readBigUInt64LE(34));
  
  console.log("\n📊 Parsed from platform:");
  console.log("   - Data slice length:", platformData.length);
  console.log("   - Task ID (totalTasks):", taskId);
  
  const [taskPDA] = getTaskPDA(taskId);
  const [escrowPDA] = getEscrowPDA(taskId);
  
  console.log("   - Task PDA:", taskPDA.toString());
  console.log("   - Escrow PDA:", escrowPDA.toString());
  
  // Task data
  const title = "Test Task from Frontend Logic";
  const description = "Testing the exact frontend logic";
  const requirements = "Must work!";
  const category = "Testing";
  const bountySOL = 0.05;
  const deadlineHours = 24;
  
  const bountyLamports = BigInt(Math.floor(bountySOL * LAMPORTS_PER_SOL));
  
  console.log("\n📝 Task Details:");
  console.log("   - Title:", title);
  console.log("   - Bounty:", bountySOL, "SOL (", bountyLamports.toString(), "lamports)");
  console.log("   - Deadline:", deadlineHours, "hours");
  
  // Build instruction data (EXACTLY like frontend)
  const instructionData = Buffer.concat([
    DISCRIMINATOR_CREATE_TASK,
    serializeString(title),
    serializeString(description),
    serializeString(requirements),
    serializeString(category),
    serializeU64(bountyLamports),
    serializeU64(BigInt(deadlineHours)),
  ]);
  
  console.log("\n📦 Instruction Data:");
  console.log("   - Discriminator:", DISCRIMINATOR_CREATE_TASK.toString('hex'));
  console.log("   - Total length:", instructionData.length, "bytes");
  console.log("   - First 16 bytes:", instructionData.slice(0, 16).toString('hex'));
  
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
  
  // Add compute budget (like frontend)
  const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
    units: 300_000,
  });

  const transaction = new Transaction()
    .add(computeBudgetIx)
    .add(instruction);
  
  transaction.feePayer = wallet.publicKey;
  
  console.log("\n🔄 Sending transaction...");
  
  try {
    const txid = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet],
      { commitment: "confirmed" }
    );
    
    console.log("\n✅ SUCCESS!");
    console.log("📜 TX:", txid);
    console.log("🔗 https://explorer.solana.com/tx/" + txid + "?cluster=devnet");
    
  } catch (e: any) {
    console.error("\n❌ FAILED:", e.message);
    if (e.logs) {
      console.log("\n📜 Program Logs:");
      e.logs.forEach((log: string) => console.log("  ", log));
    }
    
    // Compare with what my working script uses
    console.log("\n🔍 DEBUGGING INFO:");
    console.log("   Expected discriminator (from IDL): c2500634e87f30ab");
    console.log("   Used discriminator:", DISCRIMINATOR_CREATE_TASK.toString('hex'));
  }
}

testFrontendCreateTask();
