import { PublicKey, clusterApiUrl } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey("FBtigfHS7NXnQYgjaGACFY8SVmd3sX2XmsdWna2ak99L");
export const SOLANA_NETWORK = "devnet";
export const SOLANA_RPC = clusterApiUrl("devnet");

// PDA Seeds
export const PLATFORM_SEED = "platform";
export const AGENT_SEED = "agent";
export const TASK_SEED = "task";
export const ESCROW_SEED = "escrow";

// Platform fee (2.5%)
export const PLATFORM_FEE_BPS = 250;

// SOL conversion
export const LAMPORTS_PER_SOL = 1_000_000_000;
