use anchor_lang::prelude::*;

declare_id!("2YmU1jJSZvn99rUPz4yAsCcyjCQ5aZPRA2FXKQZK4T9o");

#[program]
pub mod openfourr {
    use super::*;

    /// Initialize the platform (one-time setup)
    pub fn initialize(ctx: Context<Initialize>, platform_fee_bps: u16) -> Result<()> {
        let platform = &mut ctx.accounts.platform;
        platform.authority = ctx.accounts.authority.key();
        platform.fee_bps = platform_fee_bps; // e.g., 250 = 2.5%
        platform.total_tasks = 0;
        platform.total_completed = 0;
        platform.total_volume = 0;
        platform.bump = ctx.bumps.platform;
        Ok(())
    }

    /// Register a new agent profile
    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        name: String,
        bio: String,
        skills: Vec<String>,
        hourly_rate: u64,
    ) -> Result<()> {
        require!(name.len() <= 32, OpenfourrError::NameTooLong);
        require!(bio.len() <= 500, OpenfourrError::BioTooLong);
        require!(skills.len() <= 10, OpenfourrError::TooManySkills);

        let agent = &mut ctx.accounts.agent_profile;
        agent.owner = ctx.accounts.owner.key();
        agent.name = name;
        agent.bio = bio;
        agent.skills = skills;
        agent.hourly_rate = hourly_rate;
        agent.tasks_completed = 0;
        agent.tasks_failed = 0;
        agent.total_earned = 0;
        agent.rating_sum = 0;
        agent.rating_count = 0;
        agent.registered_at = Clock::get()?.unix_timestamp;
        agent.is_active = true;
        agent.bump = ctx.bumps.agent_profile;
        Ok(())
    }

    /// Update agent profile
    pub fn update_agent(
        ctx: Context<UpdateAgent>,
        name: Option<String>,
        bio: Option<String>,
        skills: Option<Vec<String>>,
        hourly_rate: Option<u64>,
        is_active: Option<bool>,
    ) -> Result<()> {
        let agent = &mut ctx.accounts.agent_profile;
        
        if let Some(n) = name {
            require!(n.len() <= 32, OpenfourrError::NameTooLong);
            agent.name = n;
        }
        if let Some(b) = bio {
            require!(b.len() <= 500, OpenfourrError::BioTooLong);
            agent.bio = b;
        }
        if let Some(s) = skills {
            require!(s.len() <= 10, OpenfourrError::TooManySkills);
            agent.skills = s;
        }
        if let Some(r) = hourly_rate {
            agent.hourly_rate = r;
        }
        if let Some(a) = is_active {
            agent.is_active = a;
        }
        Ok(())
    }

    /// Create a new task with bounty (human posts task)
    pub fn create_task(
        ctx: Context<CreateTask>,
        title: String,
        description: String,
        requirements: String,
        category: String,
        bounty_amount: u64,
        deadline_hours: u64,
    ) -> Result<()> {
        require!(title.len() <= 100, OpenfourrError::TitleTooLong);
        require!(description.len() <= 2000, OpenfourrError::DescriptionTooLong);
        require!(bounty_amount > 0, OpenfourrError::InvalidBounty);
        require!(deadline_hours > 0 && deadline_hours <= 720, OpenfourrError::InvalidDeadline); // max 30 days

        let task = &mut ctx.accounts.task;
        let platform = &mut ctx.accounts.platform;

        // Transfer bounty to escrow
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.client.to_account_info(),
                to: ctx.accounts.escrow.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, bounty_amount)?;

        task.id = platform.total_tasks;
        task.client = ctx.accounts.client.key();
        task.title = title;
        task.description = description;
        task.requirements = requirements;
        task.category = category;
        task.bounty_amount = bounty_amount;
        task.created_at = Clock::get()?.unix_timestamp;
        task.deadline = Clock::get()?.unix_timestamp + (deadline_hours as i64 * 3600);
        task.status = TaskStatus::Open;
        task.assigned_agent = None;
        task.submission_url = None;
        task.submission_notes = None;
        task.rating = None;
        task.bump = ctx.bumps.task;
        task.escrow_bump = ctx.bumps.escrow;

        platform.total_tasks += 1;

        emit!(TaskCreated {
            task_id: task.id,
            client: task.client,
            title: task.title.clone(),
            bounty: bounty_amount,
            deadline: task.deadline,
        });

        Ok(())
    }

    /// Agent claims a task
    pub fn claim_task(ctx: Context<ClaimTask>) -> Result<()> {
        let task = &mut ctx.accounts.task;
        let agent = &ctx.accounts.agent_profile;

        require!(task.status == TaskStatus::Open, OpenfourrError::TaskNotOpen);
        require!(agent.is_active, OpenfourrError::AgentNotActive);
        require!(Clock::get()?.unix_timestamp < task.deadline, OpenfourrError::TaskExpired);

        task.status = TaskStatus::InProgress;
        task.assigned_agent = Some(agent.owner);
        task.claimed_at = Some(Clock::get()?.unix_timestamp);

        emit!(TaskClaimed {
            task_id: task.id,
            agent: agent.owner,
        });

        Ok(())
    }

    /// Agent submits completed work
    pub fn submit_work(
        ctx: Context<SubmitWork>,
        submission_url: String,
        submission_notes: String,
    ) -> Result<()> {
        let task = &mut ctx.accounts.task;

        require!(task.status == TaskStatus::InProgress, OpenfourrError::TaskNotInProgress);
        require!(
            task.assigned_agent == Some(ctx.accounts.agent_owner.key()),
            OpenfourrError::NotAssignedAgent
        );
        require!(submission_url.len() <= 500, OpenfourrError::UrlTooLong);

        task.submission_url = Some(submission_url);
        task.submission_notes = Some(submission_notes);
        task.status = TaskStatus::PendingReview;
        task.submitted_at = Some(Clock::get()?.unix_timestamp);

        emit!(WorkSubmitted {
            task_id: task.id,
            agent: ctx.accounts.agent_owner.key(),
        });

        Ok(())
    }

    /// AI Judge or Client approves the work - releases payment
    pub fn approve_work(ctx: Context<ApproveWork>, rating: u8) -> Result<()> {
        let task = &mut ctx.accounts.task;
        let agent = &mut ctx.accounts.agent_profile;
        let platform = &mut ctx.accounts.platform;

        require!(task.status == TaskStatus::PendingReview, OpenfourrError::TaskNotPendingReview);
        require!(rating >= 1 && rating <= 5, OpenfourrError::InvalidRating);

        // Calculate fees
        let platform_fee = (task.bounty_amount * platform.fee_bps as u64) / 10000;
        let agent_payout = task.bounty_amount - platform_fee;

        // Transfer from escrow to agent
        let task_id_bytes = task.id.to_le_bytes();
        let escrow_bump = [task.escrow_bump];
        let _seeds = &[
            b"escrow".as_ref(),
            task_id_bytes.as_ref(),
            escrow_bump.as_ref(),
        ];

        // Pay agent
        **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? -= agent_payout;
        **ctx.accounts.agent_wallet.to_account_info().try_borrow_mut_lamports()? += agent_payout;

        // Pay platform fee
        if platform_fee > 0 {
            **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? -= platform_fee;
            **ctx.accounts.platform_treasury.to_account_info().try_borrow_mut_lamports()? += platform_fee;
        }

        // Update task
        task.status = TaskStatus::Completed;
        task.rating = Some(rating);
        task.completed_at = Some(Clock::get()?.unix_timestamp);

        // Update agent stats
        agent.tasks_completed += 1;
        agent.total_earned += agent_payout;
        agent.rating_sum += rating as u64;
        agent.rating_count += 1;

        // Update platform stats
        platform.total_completed += 1;
        platform.total_volume += task.bounty_amount;

        emit!(TaskCompleted {
            task_id: task.id,
            agent: agent.owner,
            payout: agent_payout,
            rating,
        });

        Ok(())
    }

    /// Reject work - agent can resubmit or task goes back to open
    pub fn reject_work(ctx: Context<RejectWork>, reason: String) -> Result<()> {
        let task = &mut ctx.accounts.task;

        require!(task.status == TaskStatus::PendingReview, OpenfourrError::TaskNotPendingReview);

        task.status = TaskStatus::Rejected;
        task.rejection_reason = Some(reason.clone());

        emit!(WorkRejected {
            task_id: task.id,
            reason,
        });

        Ok(())
    }

    /// Cancel task (only if not claimed) - refund to client
    pub fn cancel_task(ctx: Context<CancelTask>) -> Result<()> {
        let task = &mut ctx.accounts.task;

        require!(
            task.status == TaskStatus::Open || task.status == TaskStatus::Rejected,
            OpenfourrError::CannotCancel
        );

        // Refund from escrow to client
        **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? -= task.bounty_amount;
        **ctx.accounts.client.to_account_info().try_borrow_mut_lamports()? += task.bounty_amount;

        task.status = TaskStatus::Cancelled;

        emit!(TaskCancelled {
            task_id: task.id,
        });

        Ok(())
    }
}

// ============ ACCOUNTS ============

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Platform::INIT_SPACE,
        seeds = [b"platform"],
        bump
    )]
    pub platform: Account<'info, Platform>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterAgent<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + AgentProfile::INIT_SPACE,
        seeds = [b"agent", owner.key().as_ref()],
        bump
    )]
    pub agent_profile: Account<'info, AgentProfile>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateAgent<'info> {
    #[account(
        mut,
        seeds = [b"agent", owner.key().as_ref()],
        bump = agent_profile.bump,
        has_one = owner
    )]
    pub agent_profile: Account<'info, AgentProfile>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct CreateTask<'info> {
    #[account(
        init,
        payer = client,
        space = 8 + Task::INIT_SPACE,
        seeds = [b"task", platform.total_tasks.to_le_bytes().as_ref()],
        bump
    )]
    pub task: Account<'info, Task>,
    #[account(
        mut,
        seeds = [b"platform"],
        bump = platform.bump
    )]
    pub platform: Account<'info, Platform>,
    /// CHECK: Escrow PDA for holding bounty
    #[account(
        mut,
        seeds = [b"escrow", platform.total_tasks.to_le_bytes().as_ref()],
        bump
    )]
    pub escrow: AccountInfo<'info>,
    #[account(mut)]
    pub client: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimTask<'info> {
    #[account(mut)]
    pub task: Account<'info, Task>,
    #[account(
        seeds = [b"agent", agent_owner.key().as_ref()],
        bump = agent_profile.bump
    )]
    pub agent_profile: Account<'info, AgentProfile>,
    pub agent_owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct SubmitWork<'info> {
    #[account(mut)]
    pub task: Account<'info, Task>,
    pub agent_owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct ApproveWork<'info> {
    #[account(mut)]
    pub task: Account<'info, Task>,
    #[account(
        mut,
        seeds = [b"agent", agent_profile.owner.as_ref()],
        bump = agent_profile.bump
    )]
    pub agent_profile: Account<'info, AgentProfile>,
    /// CHECK: Agent's wallet to receive payment
    #[account(mut)]
    pub agent_wallet: AccountInfo<'info>,
    /// CHECK: Escrow holding the bounty
    #[account(mut)]
    pub escrow: AccountInfo<'info>,
    #[account(
        mut,
        seeds = [b"platform"],
        bump = platform.bump
    )]
    pub platform: Account<'info, Platform>,
    /// CHECK: Platform treasury for fees
    #[account(mut)]
    pub platform_treasury: AccountInfo<'info>,
    /// Either client or authorized judge
    pub approver: Signer<'info>,
}

#[derive(Accounts)]
pub struct RejectWork<'info> {
    #[account(mut)]
    pub task: Account<'info, Task>,
    /// Either client or authorized judge
    pub rejector: Signer<'info>,
}

#[derive(Accounts)]
pub struct CancelTask<'info> {
    #[account(mut, has_one = client)]
    pub task: Account<'info, Task>,
    /// CHECK: Escrow holding the bounty
    #[account(mut)]
    pub escrow: AccountInfo<'info>,
    #[account(mut)]
    pub client: Signer<'info>,
}

// ============ STATE ============

#[account]
#[derive(InitSpace)]
pub struct Platform {
    pub authority: Pubkey,
    pub fee_bps: u16,           // Platform fee in basis points (e.g., 250 = 2.5%)
    pub total_tasks: u64,
    pub total_completed: u64,
    pub total_volume: u64,      // Total SOL transacted
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct AgentProfile {
    pub owner: Pubkey,
    #[max_len(32)]
    pub name: String,
    #[max_len(500)]
    pub bio: String,
    #[max_len(10, 32)]
    pub skills: Vec<String>,
    pub hourly_rate: u64,       // In lamports
    pub tasks_completed: u64,
    pub tasks_failed: u64,
    pub total_earned: u64,
    pub rating_sum: u64,
    pub rating_count: u64,
    pub registered_at: i64,
    pub is_active: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Task {
    pub id: u64,
    pub client: Pubkey,
    #[max_len(100)]
    pub title: String,
    #[max_len(2000)]
    pub description: String,
    #[max_len(1000)]
    pub requirements: String,
    #[max_len(32)]
    pub category: String,
    pub bounty_amount: u64,
    pub created_at: i64,
    pub deadline: i64,
    pub status: TaskStatus,
    pub assigned_agent: Option<Pubkey>,
    pub claimed_at: Option<i64>,
    pub submitted_at: Option<i64>,
    pub completed_at: Option<i64>,
    #[max_len(500)]
    pub submission_url: Option<String>,
    #[max_len(1000)]
    pub submission_notes: Option<String>,
    #[max_len(500)]
    pub rejection_reason: Option<String>,
    pub rating: Option<u8>,
    pub bump: u8,
    pub escrow_bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum TaskStatus {
    Open,
    InProgress,
    PendingReview,
    Completed,
    Rejected,
    Cancelled,
    Disputed,
}

// ============ EVENTS ============

#[event]
pub struct TaskCreated {
    pub task_id: u64,
    pub client: Pubkey,
    pub title: String,
    pub bounty: u64,
    pub deadline: i64,
}

#[event]
pub struct TaskClaimed {
    pub task_id: u64,
    pub agent: Pubkey,
}

#[event]
pub struct WorkSubmitted {
    pub task_id: u64,
    pub agent: Pubkey,
}

#[event]
pub struct TaskCompleted {
    pub task_id: u64,
    pub agent: Pubkey,
    pub payout: u64,
    pub rating: u8,
}

#[event]
pub struct WorkRejected {
    pub task_id: u64,
    pub reason: String,
}

#[event]
pub struct TaskCancelled {
    pub task_id: u64,
}

// ============ ERRORS ============

#[error_code]
pub enum OpenfourrError {
    #[msg("Name exceeds maximum length of 32 characters")]
    NameTooLong,
    #[msg("Bio exceeds maximum length of 500 characters")]
    BioTooLong,
    #[msg("Too many skills (max 10)")]
    TooManySkills,
    #[msg("Title exceeds maximum length")]
    TitleTooLong,
    #[msg("Description exceeds maximum length")]
    DescriptionTooLong,
    #[msg("Invalid bounty amount")]
    InvalidBounty,
    #[msg("Invalid deadline")]
    InvalidDeadline,
    #[msg("Task is not open")]
    TaskNotOpen,
    #[msg("Task is not in progress")]
    TaskNotInProgress,
    #[msg("Task is not pending review")]
    TaskNotPendingReview,
    #[msg("Agent is not active")]
    AgentNotActive,
    #[msg("Task has expired")]
    TaskExpired,
    #[msg("Not the assigned agent")]
    NotAssignedAgent,
    #[msg("URL too long")]
    UrlTooLong,
    #[msg("Invalid rating (must be 1-5)")]
    InvalidRating,
    #[msg("Cannot cancel task in current status")]
    CannotCancel,
}
