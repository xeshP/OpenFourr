use anchor_lang::prelude::*;

declare_id!("FBtigfHS7NXnQYgjaGACFY8SVmd3sX2XmsdWna2ak99L");

#[program]
pub mod openfourr {
    use super::*;

    /// Initialize the platform (one-time setup)
    pub fn initialize(ctx: Context<Initialize>, platform_fee_bps: u16) -> Result<()> {
        let platform = &mut ctx.accounts.platform;
        platform.authority = ctx.accounts.authority.key();
        platform.fee_bps = platform_fee_bps;
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
        require!(deadline_hours > 0 && deadline_hours <= 720, OpenfourrError::InvalidDeadline);

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
        task.submission_count = 0;
        task.winning_submission = None;
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

    /// Submit work/application for a task (competition model)
    /// Any registered agent can submit - multiple submissions allowed per task
    pub fn submit_application(
        ctx: Context<SubmitApplication>,
        submission_url: String,
        submission_notes: String,
    ) -> Result<()> {
        let task = &mut ctx.accounts.task;
        let agent = &ctx.accounts.agent_profile;
        let submission = &mut ctx.accounts.submission;

        require!(task.status == TaskStatus::Open, OpenfourrError::TaskNotOpen);
        require!(agent.is_active, OpenfourrError::AgentNotActive);
        require!(Clock::get()?.unix_timestamp < task.deadline, OpenfourrError::TaskExpired);
        require!(submission_url.len() <= 500, OpenfourrError::UrlTooLong);

        submission.task_id = task.id;
        submission.agent = agent.owner;
        submission.submission_url = submission_url.clone();
        submission.submission_notes = submission_notes;
        submission.submitted_at = Clock::get()?.unix_timestamp;
        submission.status = SubmissionStatus::Pending;
        submission.bump = ctx.bumps.submission;

        task.submission_count += 1;

        emit!(ApplicationSubmitted {
            task_id: task.id,
            agent: agent.owner,
            submission_url,
        });

        Ok(())
    }

    /// Task creator selects a winning submission and pays the agent
    pub fn select_winner(
        ctx: Context<SelectWinner>,
        rating: u8,
    ) -> Result<()> {
        require!(rating >= 1 && rating <= 5, OpenfourrError::InvalidRating);

        let task = &mut ctx.accounts.task;
        let submission = &mut ctx.accounts.submission;
        let agent = &mut ctx.accounts.agent_profile;
        let platform = &mut ctx.accounts.platform;

        require!(task.status == TaskStatus::Open, OpenfourrError::TaskNotOpen);
        require!(submission.status == SubmissionStatus::Pending, OpenfourrError::SubmissionNotPending);
        require!(task.client == ctx.accounts.client.key(), OpenfourrError::NotTaskClient);

        // Calculate payout
        let fee = task.bounty_amount * (platform.fee_bps as u64) / 10000;
        let payout = task.bounty_amount - fee;

        // Transfer from escrow to agent
        let task_id_bytes = task.id.to_le_bytes();
        let escrow_seeds = &[
            b"escrow".as_ref(),
            task_id_bytes.as_ref(),
            &[task.escrow_bump],
        ];
        let signer_seeds = &[&escrow_seeds[..]];

        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.escrow.to_account_info(),
                to: ctx.accounts.agent_wallet.to_account_info(),
            },
            signer_seeds,
        );
        anchor_lang::system_program::transfer(cpi_context, payout)?;

        // Transfer fee to platform treasury
        if fee > 0 {
            let fee_context = CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.escrow.to_account_info(),
                    to: ctx.accounts.platform_treasury.to_account_info(),
                },
                signer_seeds,
            );
            anchor_lang::system_program::transfer(fee_context, fee)?;
        }

        // Update submission status
        submission.status = SubmissionStatus::Selected;

        // Update task
        task.status = TaskStatus::Completed;
        task.winning_submission = Some(ctx.accounts.submission.key());
        task.completed_at = Some(Clock::get()?.unix_timestamp);

        // Update agent stats
        agent.tasks_completed += 1;
        agent.total_earned += payout;
        agent.rating_sum += rating as u64;
        agent.rating_count += 1;

        // Update platform stats
        platform.total_completed += 1;
        platform.total_volume += task.bounty_amount;

        emit!(WinnerSelected {
            task_id: task.id,
            agent: agent.owner,
            payout,
            rating,
        });

        Ok(())
    }

    /// Cancel task and refund bounty (only if no submissions yet)
    pub fn cancel_task(ctx: Context<CancelTask>) -> Result<()> {
        let task = &mut ctx.accounts.task;

        require!(task.status == TaskStatus::Open, OpenfourrError::CannotCancel);
        require!(task.submission_count == 0, OpenfourrError::HasSubmissions);

        // Refund bounty from escrow to client
        let task_id_bytes = task.id.to_le_bytes();
        let escrow_seeds = &[
            b"escrow".as_ref(),
            task_id_bytes.as_ref(),
            &[task.escrow_bump],
        ];
        let signer_seeds = &[&escrow_seeds[..]];

        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.escrow.to_account_info(),
                to: ctx.accounts.client.to_account_info(),
            },
            signer_seeds,
        );
        anchor_lang::system_program::transfer(cpi_context, task.bounty_amount)?;

        task.status = TaskStatus::Cancelled;

        emit!(TaskCancelled {
            task_id: task.id,
        });

        Ok(())
    }

    // Legacy claim_task - kept for backward compatibility but not recommended
    pub fn claim_task(ctx: Context<ClaimTask>) -> Result<()> {
        let task = &mut ctx.accounts.task;
        let agent = &ctx.accounts.agent_profile;

        require!(task.status == TaskStatus::Open, OpenfourrError::TaskNotOpen);
        require!(agent.is_active, OpenfourrError::AgentNotActive);
        require!(Clock::get()?.unix_timestamp < task.deadline, OpenfourrError::TaskExpired);

        task.status = TaskStatus::InProgress;

        emit!(TaskClaimed {
            task_id: task.id,
            agent: agent.owner,
        });

        Ok(())
    }
}

// ============ CONTEXTS ============

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
        bump = platform.bump,
    )]
    pub platform: Account<'info, Platform>,
    /// CHECK: Escrow PDA to hold bounty
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
pub struct SubmitApplication<'info> {
    #[account(
        init,
        payer = agent_owner,
        space = 8 + Submission::INIT_SPACE,
        seeds = [b"submission", task.key().as_ref(), agent_owner.key().as_ref()],
        bump
    )]
    pub submission: Account<'info, Submission>,
    #[account(mut)]
    pub task: Account<'info, Task>,
    #[account(
        seeds = [b"agent", agent_owner.key().as_ref()],
        bump = agent_profile.bump,
    )]
    pub agent_profile: Account<'info, AgentProfile>,
    #[account(mut)]
    pub agent_owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SelectWinner<'info> {
    #[account(mut)]
    pub task: Account<'info, Task>,
    #[account(
        mut,
        constraint = submission.task_id == task.id,
    )]
    pub submission: Account<'info, Submission>,
    #[account(
        mut,
        seeds = [b"agent", submission.agent.as_ref()],
        bump = agent_profile.bump,
    )]
    pub agent_profile: Account<'info, AgentProfile>,
    /// CHECK: Agent's wallet to receive payment
    #[account(mut, constraint = agent_wallet.key() == submission.agent)]
    pub agent_wallet: AccountInfo<'info>,
    /// CHECK: Escrow PDA
    #[account(
        mut,
        seeds = [b"escrow", task.id.to_le_bytes().as_ref()],
        bump = task.escrow_bump,
    )]
    pub escrow: AccountInfo<'info>,
    #[account(
        mut,
        seeds = [b"platform"],
        bump = platform.bump,
    )]
    pub platform: Account<'info, Platform>,
    /// CHECK: Platform treasury
    #[account(mut, constraint = platform_treasury.key() == platform.authority)]
    pub platform_treasury: AccountInfo<'info>,
    #[account(mut, constraint = client.key() == task.client)]
    pub client: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelTask<'info> {
    #[account(
        mut,
        constraint = task.client == client.key(),
    )]
    pub task: Account<'info, Task>,
    /// CHECK: Escrow PDA
    #[account(
        mut,
        seeds = [b"escrow", task.id.to_le_bytes().as_ref()],
        bump = task.escrow_bump,
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
        bump = agent_profile.bump,
    )]
    pub agent_profile: Account<'info, AgentProfile>,
    pub agent_owner: Signer<'info>,
}

// ============ STATE ============

#[account]
#[derive(InitSpace)]
pub struct Platform {
    pub authority: Pubkey,
    pub fee_bps: u16,
    pub total_tasks: u64,
    pub total_completed: u64,
    pub total_volume: u64,
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
    pub hourly_rate: u64,
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
    pub submission_count: u64,           // Number of submissions
    pub winning_submission: Option<Pubkey>, // PDA of winning submission
    pub completed_at: Option<i64>,
    pub bump: u8,
    pub escrow_bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Submission {
    pub task_id: u64,
    pub agent: Pubkey,
    #[max_len(500)]
    pub submission_url: String,
    #[max_len(1000)]
    pub submission_notes: String,
    pub submitted_at: i64,
    pub status: SubmissionStatus,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum TaskStatus {
    Open,
    InProgress,  // Legacy - kept for backward compatibility
    PendingReview, // Legacy
    Completed,
    Rejected,    // Legacy
    Cancelled,
    Disputed,    // Legacy
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum SubmissionStatus {
    Pending,
    Selected,
    NotSelected,
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
pub struct ApplicationSubmitted {
    pub task_id: u64,
    pub agent: Pubkey,
    pub submission_url: String,
}

#[event]
pub struct WinnerSelected {
    pub task_id: u64,
    pub agent: Pubkey,
    pub payout: u64,
    pub rating: u8,
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
    #[msg("Task has submissions, cannot cancel")]
    HasSubmissions,
    #[msg("Not the task client")]
    NotTaskClient,
    #[msg("Submission is not pending")]
    SubmissionNotPending,
}
