import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Keypair, Connection } from "@solana/web3.js";

// Types
export interface AgentProfile {
  owner: PublicKey;
  name: string;
  bio: string;
  skills: string[];
  hourlyRate: BN;
  tasksCompleted: BN;
  tasksFailed: BN;
  totalEarned: BN;
  ratingSum: BN;
  ratingCount: BN;
  registeredAt: BN;
  isActive: boolean;
}

export interface Task {
  id: BN;
  client: PublicKey;
  title: string;
  description: string;
  requirements: string;
  category: string;
  bountyAmount: BN;
  createdAt: BN;
  deadline: BN;
  status: TaskStatus;
  assignedAgent: PublicKey | null;
  claimedAt: BN | null;
  submittedAt: BN | null;
  completedAt: BN | null;
  submissionUrl: string | null;
  submissionNotes: string | null;
  rejectionReason: string | null;
  rating: number | null;
}

export enum TaskStatus {
  Open = "open",
  InProgress = "inProgress",
  PendingReview = "pendingReview",
  Completed = "completed",
  Rejected = "rejected",
  Cancelled = "cancelled",
  Disputed = "disputed",
}

export class OpenfourrSDK {
  private program: Program;
  private provider: AnchorProvider;

  constructor(provider: AnchorProvider, programId: PublicKey) {
    this.provider = provider;
    // Program would be loaded from IDL in production
    this.program = null as any; // Placeholder
  }

  // ============ PDA Helpers ============

  static getPlatformPDA(programId: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("platform")],
      programId
    );
  }

  static getAgentPDA(owner: PublicKey, programId: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), owner.toBuffer()],
      programId
    );
  }

  static getTaskPDA(taskId: number, programId: PublicKey): [PublicKey, number] {
    const taskIdBuffer = Buffer.alloc(8);
    taskIdBuffer.writeBigUInt64LE(BigInt(taskId));
    return PublicKey.findProgramAddressSync(
      [Buffer.from("task"), taskIdBuffer],
      programId
    );
  }

  static getEscrowPDA(taskId: number, programId: PublicKey): [PublicKey, number] {
    const taskIdBuffer = Buffer.alloc(8);
    taskIdBuffer.writeBigUInt64LE(BigInt(taskId));
    return PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), taskIdBuffer],
      programId
    );
  }

  // ============ Agent Methods ============

  async registerAgent(
    name: string,
    bio: string,
    skills: string[],
    hourlyRate: number
  ): Promise<string> {
    const owner = this.provider.wallet.publicKey;
    const [agentPDA] = OpenfourrSDK.getAgentPDA(owner, this.program.programId);

    const tx = await this.program.methods
      .registerAgent(name, bio, skills, new BN(hourlyRate))
      .accounts({
        agentProfile: agentPDA,
        owner,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  async getAgent(owner: PublicKey): Promise<AgentProfile | null> {
    const [agentPDA] = OpenfourrSDK.getAgentPDA(owner, this.program.programId);
    try {
      return await this.program.account.agentProfile.fetch(agentPDA);
    } catch {
      return null;
    }
  }

  async updateAgent(updates: {
    name?: string;
    bio?: string;
    skills?: string[];
    hourlyRate?: number;
    isActive?: boolean;
  }): Promise<string> {
    const owner = this.provider.wallet.publicKey;
    const [agentPDA] = OpenfourrSDK.getAgentPDA(owner, this.program.programId);

    const tx = await this.program.methods
      .updateAgent(
        updates.name || null,
        updates.bio || null,
        updates.skills || null,
        updates.hourlyRate ? new BN(updates.hourlyRate) : null,
        updates.isActive ?? null
      )
      .accounts({
        agentProfile: agentPDA,
        owner,
      })
      .rpc();

    return tx;
  }

  // ============ Task Methods ============

  async createTask(
    title: string,
    description: string,
    requirements: string,
    category: string,
    bountyAmount: number,
    deadlineHours: number
  ): Promise<{ tx: string; taskId: number }> {
    const [platformPDA] = OpenfourrSDK.getPlatformPDA(this.program.programId);
    const platform = await this.program.account.platform.fetch(platformPDA);
    const taskId = platform.totalTasks.toNumber();

    const [taskPDA] = OpenfourrSDK.getTaskPDA(taskId, this.program.programId);
    const [escrowPDA] = OpenfourrSDK.getEscrowPDA(taskId, this.program.programId);

    const tx = await this.program.methods
      .createTask(
        title,
        description,
        requirements,
        category,
        new BN(bountyAmount),
        new BN(deadlineHours)
      )
      .accounts({
        task: taskPDA,
        platform: platformPDA,
        escrow: escrowPDA,
        client: this.provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { tx, taskId };
  }

  async getTask(taskId: number): Promise<Task | null> {
    const [taskPDA] = OpenfourrSDK.getTaskPDA(taskId, this.program.programId);
    try {
      return await this.program.account.task.fetch(taskPDA);
    } catch {
      return null;
    }
  }

  async listOpenTasks(): Promise<Task[]> {
    const tasks = await this.program.account.task.all([
      {
        memcmp: {
          offset: 8 + 32 + 8, // After discriminator, client pubkey, id
          bytes: anchor.utils.bytes.bs58.encode(Buffer.from([0])), // Open status
        },
      },
    ]);
    return tasks.map((t) => t.account as Task);
  }

  async claimTask(taskId: number): Promise<string> {
    const [taskPDA] = OpenfourrSDK.getTaskPDA(taskId, this.program.programId);
    const agentOwner = this.provider.wallet.publicKey;
    const [agentPDA] = OpenfourrSDK.getAgentPDA(agentOwner, this.program.programId);

    const tx = await this.program.methods
      .claimTask()
      .accounts({
        task: taskPDA,
        agentProfile: agentPDA,
        agentOwner,
      })
      .rpc();

    return tx;
  }

  async submitWork(
    taskId: number,
    submissionUrl: string,
    submissionNotes: string
  ): Promise<string> {
    const [taskPDA] = OpenfourrSDK.getTaskPDA(taskId, this.program.programId);

    const tx = await this.program.methods
      .submitWork(submissionUrl, submissionNotes)
      .accounts({
        task: taskPDA,
        agentOwner: this.provider.wallet.publicKey,
      })
      .rpc();

    return tx;
  }

  // ============ Review Methods ============

  async approveWork(taskId: number, rating: number): Promise<string> {
    const [taskPDA] = OpenfourrSDK.getTaskPDA(taskId, this.program.programId);
    const [platformPDA] = OpenfourrSDK.getPlatformPDA(this.program.programId);
    const [escrowPDA] = OpenfourrSDK.getEscrowPDA(taskId, this.program.programId);

    const task = await this.getTask(taskId);
    if (!task || !task.assignedAgent) throw new Error("Task not found or not assigned");

    const [agentPDA] = OpenfourrSDK.getAgentPDA(task.assignedAgent, this.program.programId);
    const platform = await this.program.account.platform.fetch(platformPDA);

    const tx = await this.program.methods
      .approveWork(rating)
      .accounts({
        task: taskPDA,
        agentProfile: agentPDA,
        agentWallet: task.assignedAgent,
        escrow: escrowPDA,
        platform: platformPDA,
        platformTreasury: platform.authority,
        approver: this.provider.wallet.publicKey,
      })
      .rpc();

    return tx;
  }

  async rejectWork(taskId: number, reason: string): Promise<string> {
    const [taskPDA] = OpenfourrSDK.getTaskPDA(taskId, this.program.programId);

    const tx = await this.program.methods
      .rejectWork(reason)
      .accounts({
        task: taskPDA,
        rejector: this.provider.wallet.publicKey,
      })
      .rpc();

    return tx;
  }

  // ============ Utility Methods ============

  getAgentRating(agent: AgentProfile): number {
    if (agent.ratingCount.toNumber() === 0) return 0;
    return agent.ratingSum.toNumber() / agent.ratingCount.toNumber();
  }

  getAgentSuccessRate(agent: AgentProfile): number {
    const total = agent.tasksCompleted.toNumber() + agent.tasksFailed.toNumber();
    if (total === 0) return 0;
    return (agent.tasksCompleted.toNumber() / total) * 100;
  }
}

export default OpenfourrSDK;
