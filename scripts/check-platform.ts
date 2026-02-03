import { Connection, PublicKey } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("FBtigfHS7NXnQYgjaGACFY8SVmd3sX2XmsdWna2ak99L");
const RPC_URL = "https://api.devnet.solana.com";

async function checkPlatform() {
  const connection = new Connection(RPC_URL, "confirmed");
  
  const [platformPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("platform")],
    PROGRAM_ID
  );
  
  console.log("Platform PDA:", platformPDA.toString());
  
  const accountInfo = await connection.getAccountInfo(platformPDA);
  if (!accountInfo) {
    console.log("Platform NOT initialized!");
    return;
  }
  
  console.log("\nAccount Info:");
  console.log("  Owner:", accountInfo.owner.toString());
  console.log("  Lamports:", accountInfo.lamports);
  console.log("  Data length:", accountInfo.data.length, "bytes");
  
  // Print raw data hex
  console.log("\nRaw data (first 100 bytes):");
  console.log(accountInfo.data.slice(0, 100).toString('hex'));
  
  // Try to parse the Platform struct
  // Platform struct: authority(32) + fee_bps(u16) + total_tasks(u64) + total_completed(u64) + total_volume(u64) + bump(u8)
  const discriminator = accountInfo.data.slice(0, 8);
  console.log("\nDiscriminator:", discriminator.toString('hex'));
  
  // Authority (Pubkey) - 32 bytes starting at offset 8
  const authority = new PublicKey(accountInfo.data.slice(8, 40));
  console.log("Authority:", authority.toString());
  
  // fee_bps (u16) - 2 bytes starting at offset 40
  const feeBps = accountInfo.data.readUInt16LE(40);
  console.log("Fee BPS:", feeBps, "(", feeBps / 100, "%)");
  
  // total_tasks (u64) - 8 bytes starting at offset 42
  const totalTasks = accountInfo.data.readBigUInt64LE(42);
  console.log("Total Tasks:", totalTasks.toString());
  
  // total_completed (u64) - 8 bytes starting at offset 50
  const totalCompleted = accountInfo.data.readBigUInt64LE(50);
  console.log("Total Completed:", totalCompleted.toString());
  
  // total_volume (u64) - 8 bytes starting at offset 58
  const totalVolume = accountInfo.data.readBigUInt64LE(58);
  console.log("Total Volume:", totalVolume.toString(), "lamports");
  
  // Verify task PDA for task ID = totalTasks
  const taskIdBuffer = Buffer.alloc(8);
  taskIdBuffer.writeBigUInt64LE(totalTasks);
  
  const [taskPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("task"), taskIdBuffer],
    PROGRAM_ID
  );
  console.log("\nNext Task PDA (for ID", totalTasks.toString() + "):", taskPDA.toString());
  
  const [escrowPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), taskIdBuffer],
    PROGRAM_ID
  );
  console.log("Next Escrow PDA:", escrowPDA.toString());
}

checkPlatform();
