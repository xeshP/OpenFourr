import { 
  Connection, 
  Keypair, 
  PublicKey, 
  SystemProgram, 
  Transaction, 
  TransactionInstruction, 
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL 
} from "@solana/web3.js";
import * as fs from "fs";
// Custom Borsh encoding helpers below

const PROGRAM_ID = new PublicKey("FBtigfHS7NXnQYgjaGACFY8SVmd3sX2XmsdWna2ak99L");
const RPC_URL = "https://api.devnet.solana.com";

// Load keypair
const keypairPath = process.env.HOME + "/.config/solana/id.json";
const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
const client = Keypair.fromSecretKey(Uint8Array.from(keypairData));

// Helper: encode string for Borsh (length-prefixed)
function encodeString(str: string): Buffer {
  const strBuffer = Buffer.from(str, "utf-8");
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32LE(strBuffer.length);
  return Buffer.concat([lengthBuffer, strBuffer]);
}

// Helper: encode u64
function encodeU64(value: bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(value);
  return buf;
}

async function createTask() {
  const connection = new Connection(RPC_URL, "confirmed");
  
  // Get platform PDA
  const [platformPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("platform")],
    PROGRAM_ID
  );
  
  console.log("=".repeat(50));
  console.log("🚀 OPENFOURR - CREATE TASK SIMULATION");
  console.log("=".repeat(50));
  console.log("\n📍 Program ID:", PROGRAM_ID.toString());
  console.log("📍 Platform PDA:", platformPDA.toString());
  console.log("👤 Client:", client.publicKey.toString());
  
  // Check platform state
  const platformInfo = await connection.getAccountInfo(platformPDA);
  if (!platformInfo) {
    console.log("\n❌ Platform not initialized! Running initialize first...");
    // Initialize the platform first
    await initializePlatform(connection);
  }
  
  // Parse platform data to get total_tasks
  // Platform structure: discriminator(8) + authority(32) + fee_bps(2) + total_tasks(8) + ...
  let totalTasks = BigInt(0);
  if (platformInfo && platformInfo.data.length >= 50) {
    totalTasks = platformInfo.data.readBigUInt64LE(42); // offset: 8 + 32 + 2 = 42
    console.log("\n📊 Current total tasks:", totalTasks.toString());
  }
  
  // Calculate PDAs
  const taskIdBuffer = Buffer.alloc(8);
  taskIdBuffer.writeBigUInt64LE(totalTasks);
  
  const [taskPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("task"), taskIdBuffer],
    PROGRAM_ID
  );
  
  const [escrowPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), taskIdBuffer],
    PROGRAM_ID
  );
  
  console.log("📋 Task PDA:", taskPDA.toString());
  console.log("💰 Escrow PDA:", escrowPDA.toString());
  
  // Task details
  const title = "Build a Telegram Bot";
  const description = "Create a Telegram bot that can respond to /start and /help commands and send welcome messages. Should use Node.js and the Telegraf library.";
  const requirements = "1. Node.js code\n2. Works with Telegraf\n3. Handles /start and /help\n4. Clean code with comments";
  const category = "Bots";
  const bountyAmount = BigInt(0.1 * LAMPORTS_PER_SOL); // 0.1 SOL
  const deadlineHours = BigInt(48); // 48 hours
  
  console.log("\n📝 TASK DETAILS:");
  console.log("   Title:", title);
  console.log("   Category:", category);
  console.log("   Bounty:", (Number(bountyAmount) / LAMPORTS_PER_SOL).toFixed(2), "SOL");
  console.log("   Deadline:", deadlineHours.toString(), "hours");
  
  // Build instruction data
  const discriminator = Buffer.from([194, 80, 6, 180, 232, 127, 48, 171]);
  
  const instructionData = Buffer.concat([
    discriminator,
    encodeString(title),
    encodeString(description),
    encodeString(requirements),
    encodeString(category),
    encodeU64(bountyAmount),
    encodeU64(deadlineHours),
  ]);
  
  console.log("\n📦 Instruction data length:", instructionData.length, "bytes");
  
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: taskPDA, isSigner: false, isWritable: true },
      { pubkey: platformPDA, isSigner: false, isWritable: true },
      { pubkey: escrowPDA, isSigner: false, isWritable: true },
      { pubkey: client.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: instructionData,
  });
  
  const transaction = new Transaction().add(instruction);
  
  // Get balance before
  const balanceBefore = await connection.getBalance(client.publicKey);
  console.log("\n💵 Balance before:", (balanceBefore / LAMPORTS_PER_SOL).toFixed(4), "SOL");
  
  console.log("\n🔄 Sending transaction...");
  
  try {
    const txid = await sendAndConfirmTransaction(
      connection, 
      transaction, 
      [client],
      { commitment: "confirmed" }
    );
    
    console.log("\n✅ TASK CREATED SUCCESSFULLY!");
    console.log("📜 Transaction:", txid);
    console.log("🔗 Explorer: https://explorer.solana.com/tx/" + txid + "?cluster=devnet");
    
    // Get balance after
    const balanceAfter = await connection.getBalance(client.publicKey);
    console.log("\n💵 Balance after:", (balanceAfter / LAMPORTS_PER_SOL).toFixed(4), "SOL");
    console.log("💸 Cost (bounty + fees):", ((balanceBefore - balanceAfter) / LAMPORTS_PER_SOL).toFixed(4), "SOL");
    
    // Verify escrow
    const escrowBalance = await connection.getBalance(escrowPDA);
    console.log("🏦 Escrow balance:", (escrowBalance / LAMPORTS_PER_SOL).toFixed(4), "SOL");
    
    console.log("\n" + "=".repeat(50));
    console.log("🎉 Task ID:", totalTasks.toString());
    console.log("=".repeat(50));
    
  } catch (e: any) {
    console.error("\n❌ Transaction failed:", e.message);
    if (e.logs) {
      console.error("\n📜 Program logs:");
      e.logs.forEach((log: string) => console.log("  ", log));
    }
  }
}

async function initializePlatform(connection: Connection) {
  const [platformPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("platform")],
    PROGRAM_ID
  );
  
  const discriminator = Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]);
  const feeBps = Buffer.alloc(2);
  feeBps.writeUInt16LE(250); // 2.5%
  
  const instructionData = Buffer.concat([discriminator, feeBps]);
  
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: platformPDA, isSigner: false, isWritable: true },
      { pubkey: client.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: instructionData,
  });
  
  const transaction = new Transaction().add(instruction);
  
  console.log("🔄 Initializing platform...");
  const txid = await sendAndConfirmTransaction(connection, transaction, [client]);
  console.log("✅ Platform initialized:", txid);
}

createTask();
