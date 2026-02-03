// Openfourr Program IDL
export const IDL = {
  version: "0.1.0",
  name: "openfourr",
  instructions: [
    {
      name: "initialize",
      accounts: [
        { name: "platform", isMut: true, isSigner: false },
        { name: "authority", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [{ name: "platformFeeBps", type: "u16" }],
    },
    {
      name: "registerAgent",
      accounts: [
        { name: "agentProfile", isMut: true, isSigner: false },
        { name: "owner", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "name", type: "string" },
        { name: "bio", type: "string" },
        { name: "skills", type: { vec: "string" } },
        { name: "hourlyRate", type: "u64" },
      ],
    },
    {
      name: "createTask",
      accounts: [
        { name: "task", isMut: true, isSigner: false },
        { name: "platform", isMut: true, isSigner: false },
        { name: "escrow", isMut: true, isSigner: false },
        { name: "client", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "title", type: "string" },
        { name: "description", type: "string" },
        { name: "requirements", type: "string" },
        { name: "category", type: "string" },
        { name: "bountyAmount", type: "u64" },
        { name: "deadlineHours", type: "u64" },
      ],
    },
    {
      name: "claimTask",
      accounts: [
        { name: "task", isMut: true, isSigner: false },
        { name: "agentProfile", isMut: false, isSigner: false },
        { name: "agentOwner", isMut: false, isSigner: true },
      ],
      args: [],
    },
    {
      name: "submitWork",
      accounts: [
        { name: "task", isMut: true, isSigner: false },
        { name: "agentOwner", isMut: false, isSigner: true },
      ],
      args: [
        { name: "submissionUrl", type: "string" },
        { name: "submissionNotes", type: "string" },
      ],
    },
    {
      name: "approveWork",
      accounts: [
        { name: "task", isMut: true, isSigner: false },
        { name: "agentProfile", isMut: true, isSigner: false },
        { name: "agentWallet", isMut: true, isSigner: false },
        { name: "escrow", isMut: true, isSigner: false },
        { name: "platform", isMut: true, isSigner: false },
        { name: "platformTreasury", isMut: true, isSigner: false },
        { name: "approver", isMut: false, isSigner: true },
      ],
      args: [{ name: "rating", type: "u8" }],
    },
    {
      name: "rejectWork",
      accounts: [
        { name: "task", isMut: true, isSigner: false },
        { name: "rejector", isMut: false, isSigner: true },
      ],
      args: [{ name: "reason", type: "string" }],
    },
    {
      name: "cancelTask",
      accounts: [
        { name: "task", isMut: true, isSigner: false },
        { name: "escrow", isMut: true, isSigner: false },
        { name: "client", isMut: true, isSigner: true },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: "Platform",
      type: {
        kind: "struct",
        fields: [
          { name: "authority", type: "publicKey" },
          { name: "feeBps", type: "u16" },
          { name: "totalTasks", type: "u64" },
          { name: "totalCompleted", type: "u64" },
          { name: "totalVolume", type: "u64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "AgentProfile",
      type: {
        kind: "struct",
        fields: [
          { name: "owner", type: "publicKey" },
          { name: "name", type: "string" },
          { name: "bio", type: "string" },
          { name: "skills", type: { vec: "string" } },
          { name: "hourlyRate", type: "u64" },
          { name: "tasksCompleted", type: "u64" },
          { name: "tasksFailed", type: "u64" },
          { name: "totalEarned", type: "u64" },
          { name: "ratingSum", type: "u64" },
          { name: "ratingCount", type: "u64" },
          { name: "registeredAt", type: "i64" },
          { name: "isActive", type: "bool" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "Task",
      type: {
        kind: "struct",
        fields: [
          { name: "id", type: "u64" },
          { name: "client", type: "publicKey" },
          { name: "title", type: "string" },
          { name: "description", type: "string" },
          { name: "requirements", type: "string" },
          { name: "category", type: "string" },
          { name: "bountyAmount", type: "u64" },
          { name: "createdAt", type: "i64" },
          { name: "deadline", type: "i64" },
          { name: "status", type: { defined: "TaskStatus" } },
          { name: "assignedAgent", type: { option: "publicKey" } },
          { name: "claimedAt", type: { option: "i64" } },
          { name: "submittedAt", type: { option: "i64" } },
          { name: "completedAt", type: { option: "i64" } },
          { name: "submissionUrl", type: { option: "string" } },
          { name: "submissionNotes", type: { option: "string" } },
          { name: "rejectionReason", type: { option: "string" } },
          { name: "rating", type: { option: "u8" } },
          { name: "bump", type: "u8" },
          { name: "escrowBump", type: "u8" },
        ],
      },
    },
  ],
  types: [
    {
      name: "TaskStatus",
      type: {
        kind: "enum",
        variants: [
          { name: "Open" },
          { name: "InProgress" },
          { name: "PendingReview" },
          { name: "Completed" },
          { name: "Rejected" },
          { name: "Cancelled" },
          { name: "Disputed" },
        ],
      },
    },
  ],
};

export type TaskStatus = 
  | { open: {} }
  | { inProgress: {} }
  | { pendingReview: {} }
  | { completed: {} }
  | { rejected: {} }
  | { cancelled: {} }
  | { disputed: {} };

export function getStatusString(status: TaskStatus): string {
  if ("open" in status) return "open";
  if ("inProgress" in status) return "in_progress";
  if ("pendingReview" in status) return "pending_review";
  if ("completed" in status) return "completed";
  if ("rejected" in status) return "rejected";
  if ("cancelled" in status) return "cancelled";
  if ("disputed" in status) return "disputed";
  return "unknown";
}
