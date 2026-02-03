import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, sendAndConfirmTransaction } from "@solana/web3.js";
import * as fs from "fs";

const PROGRAM_ID = new PublicKey("FBtigfHS7NXnQYgjaGACFY8SVmd3sX2XmsdWna2ak99L");
const RPC_URL = "https://api.devnet.solana.com";

// Load deployer keypair
const keypairPath = process.env.HOME + "/.config/solana/id.json";
const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
const authority = Keypair.fromSecretKey(Uint8Array.from(keypairData));

async function initialize() {
  const connection = new Connection(RPC_URL, "confirmed");
  
  // Get platform PDA
  const [platformPDA, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("platform")],
    PROGRAM_ID
  );
  
  console.log("Platform PDA:", platformPDA.toString());
  console.log("Authority:", authority.publicKey.toString());
  
  // Check if already initialized
  const existingAccount = await connection.getAccountInfo(platformPDA);
  if (existingAccount) {
    console.log("Platform already initialized!");
    return;
  }
  
  // Build initialize instruction
  // Discriminator for "initialize" = sha256("global:initialize")[0:8]
  const discriminator = Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]);
  
  // Platform fee in basis points (250 = 2.5%)
  const feeBps = Buffer.alloc(2);
  feeBps.writeUInt16LE(250);
  
  const instructionData = Buffer.concat([discriminator, feeBps]);
  
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: platformPDA, isSigner: false, isWritable: true },
      { pubkey: authority.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: instructionData,
  });
  
  const transaction = new Transaction().add(instruction);
  
  console.log("Sending initialize transaction...");
  
  try {
    const txid = await sendAndConfirmTransaction(connection, transaction, [authority]);
    console.log("Platform initialized! TX:", txid);
    console.log("Explorer: https://explorer.solana.com/tx/" + txid + "?cluster=devnet");
  } catch (e: any) {
    console.error("Failed to initialize:", e.message);
    if (e.logs) {
      console.error("Logs:", e.logs);
    }
  }
}

initialize();
