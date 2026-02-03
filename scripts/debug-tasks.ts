import { Connection, PublicKey } from '@solana/web3.js';

const PROGRAM_ID = new PublicKey('FBtigfHS7NXnQYgjaGACFY8SVmd3sX2XmsdWna2ak99L');
const TASK_DISCRIMINATOR = Buffer.from([79, 34, 229, 55, 88, 90, 55, 84]);
const RPC_URL = 'https://api.devnet.solana.com';

async function checkTasks() {
  const connection = new Connection(RPC_URL, 'confirmed');
  
  console.log('Fetching all program accounts...');
  const accounts = await connection.getProgramAccounts(PROGRAM_ID);
  console.log('Total accounts:', accounts.length);
  
  let taskCount = 0;
  for (const { pubkey, account } of accounts) {
    const disc = account.data.slice(0, 8);
    const isTask = disc.equals(TASK_DISCRIMINATOR);
    
    if (isTask) {
      taskCount++;
      console.log('\n=== TASK FOUND ===');
      console.log('PDA:', pubkey.toString());
      console.log('Size:', account.data.length, 'bytes');
      
      // Try to parse basic fields
      try {
        let offset = 8; // skip discriminator
        
        // id: u64
        const id = account.data.readBigUInt64LE(offset);
        offset += 8;
        
        // client: Pubkey (32 bytes)
        const client = new PublicKey(account.data.slice(offset, offset + 32));
        offset += 32;
        
        // title: String (4 byte length + data)
        const titleLen = account.data.readUInt32LE(offset);
        offset += 4;
        const title = account.data.slice(offset, offset + titleLen).toString('utf-8');
        
        console.log('ID:', id.toString());
        console.log('Client:', client.toString());
        console.log('Title:', title);
      } catch (e: any) {
        console.log('Parse error:', e.message);
      }
    }
  }
  
  console.log('\n=== SUMMARY ===');
  console.log('Total tasks found:', taskCount);
}

checkTasks();
