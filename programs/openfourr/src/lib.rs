use anchor_lang::prelude::*;

declare_id!("FBtigfHS7NXnQYgjaGACFY8SVmd3sX2XmsdWna2ak99L");

#[program]
pub mod openfourr {
    use super::*;

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
        task.title = title.clone();
        task.description = description;
        task.requirements = requirements;
        task.category = category;
        task.bounty_amount = bounty_amount;
        task.created_at = Clock::get()?.unix_timestamp;
        task.deadline = Clock::get()?.unix_timestamp + (deadline_hours as i64 * 3600);
        task.status = TaskStatus::Open;
        task.submission_count = 0;
        task.message_count = 0;
        task.extension_requested = false;
        task.extension_hours = 0;
        task.dispute_raised_by = None;
        task.winning_submission = None;
        task.completed_at = None;
        task.bump = ctx.bumps.task;
        task.escrow_bump = ctx.bumps.escrow;

        platform.total_tasks += 1;

        emit!(TaskCreated { task_id: task.id, client: task.client, title, bounty: bounty_amount, deadline: task.deadline });
        Ok(())
    }

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
        submission.submission_url = submission_url;
        submission.submission_notes = submission_notes;
        submission.submitted_at = Clock::get()?.unix_timestamp;
        submission.status = SubmissionStatus::Pending;
        submission.bump = ctx.bumps.submission;

        task.submission_count += 1;
        Ok(())
    }

    pub fn send_message(ctx: Context<SendMessage>, content: String) -> Result<()> {
        let task = &mut ctx.accounts.task;
        let message = &mut ctx.accounts.message;
        let sender = ctx.accounts.sender.key();

        require!(content.len() <= 500, OpenfourrError::MessageTooLong);
        require!(content.len() > 0, OpenfourrError::MessageEmpty);

        let is_client = task.client == sender;
        let is_agent = ctx.accounts.submission.is_some();
        require!(is_client || is_agent, OpenfourrError::NotTaskParticipant);

        message.task_id = task.id;
        message.message_id = task.message_count;
        message.sender = sender;
        message.content = content;
        message.sent_at = Clock::get()?.unix_timestamp;
        message.bump = ctx.bumps.message;

        task.message_count += 1;
        Ok(())
    }

    pub fn select_winner(ctx: Context<SelectWinner>, rating: u8) -> Result<()> {
        require!(rating >= 1 && rating <= 5, OpenfourrError::InvalidRating);

        let task = &mut ctx.accounts.task;
        let submission = &mut ctx.accounts.submission;
        let agent = &mut ctx.accounts.agent_profile;
        let platform = &mut ctx.accounts.platform;

        require!(task.status == TaskStatus::Open, OpenfourrError::TaskNotOpen);
        require!(submission.status == SubmissionStatus::Pending, OpenfourrError::SubmissionNotPending);

        let fee = task.bounty_amount * (platform.fee_bps as u64) / 10000;
        let payout = task.bounty_amount - fee;

        let task_id_bytes = task.id.to_le_bytes();
        let escrow_seeds = &[b"escrow".as_ref(), task_id_bytes.as_ref(), &[task.escrow_bump]];
        let signer_seeds = &[&escrow_seeds[..]];

        // Pay agent
        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.escrow.to_account_info(),
                to: ctx.accounts.agent_wallet.to_account_info(),
            },
            signer_seeds,
        );
        anchor_lang::system_program::transfer(cpi_context, payout)?;

        // Pay platform fee
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

        submission.status = SubmissionStatus::Selected;
        task.status = TaskStatus::Completed;
        task.winning_submission = Some(ctx.accounts.submission.key());
        task.completed_at = Some(Clock::get()?.unix_timestamp);

        agent.tasks_completed += 1;
        agent.total_earned += payout;
        agent.rating_sum += rating as u64;
        agent.rating_count += 1;

        platform.total_completed += 1;
        platform.total_volume += task.bounty_amount;

        emit!(WinnerSelected { task_id: task.id, agent: agent.owner, payout, rating });
        Ok(())
    }

    pub fn cancel_task(ctx: Context<CancelTask>) -> Result<()> {
        let task = &mut ctx.accounts.task;

        require!(task.status == TaskStatus::Open, OpenfourrError::CannotCancel);
        require!(task.submission_count == 0, OpenfourrError::HasSubmissions);

        let task_id_bytes = task.id.to_le_bytes();
        let escrow_seeds = &[b"escrow".as_ref(), task_id_bytes.as_ref(), &[task.escrow_bump]];
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
        emit!(TaskCancelled { task_id: task.id });
        Ok(())
    }

    /// Request deadline extension (by agent who submitted)
    pub fn request_extension(ctx: Context<RequestExtension>, extra_hours: u64) -> Result<()> {
        let task = &mut ctx.accounts.task;
        
        require!(task.status == TaskStatus::Open, OpenfourrError::TaskNotOpen);
        require!(extra_hours > 0 && extra_hours <= 168, OpenfourrError::InvalidExtension);
        require!(!task.extension_requested, OpenfourrError::ExtensionAlreadyRequested);

        task.extension_requested = true;
        task.extension_hours = extra_hours;

        emit!(ExtensionRequested { task_id: task.id, agent: ctx.accounts.agent_owner.key(), extra_hours });
        Ok(())
    }

    /// Approve extension (by client)
    pub fn approve_extension(ctx: Context<ApproveExtension>) -> Result<()> {
        let task = &mut ctx.accounts.task;

        require!(task.extension_requested, OpenfourrError::NoExtensionRequested);

        task.deadline += (task.extension_hours as i64) * 3600;
        task.extension_requested = false;
        task.extension_hours = 0;

        emit!(ExtensionApproved { task_id: task.id, new_deadline: task.deadline });
        Ok(())
    }

    /// Deny extension (by client)
    pub fn deny_extension(ctx: Context<ApproveExtension>) -> Result<()> {
        let task = &mut ctx.accounts.task;
        require!(task.extension_requested, OpenfourrError::NoExtensionRequested);

        task.extension_requested = false;
        task.extension_hours = 0;

        emit!(ExtensionDenied { task_id: task.id });
        Ok(())
    }

    /// Raise dispute
    pub fn raise_dispute(ctx: Context<RaiseDispute>) -> Result<()> {
        let task = &mut ctx.accounts.task;

        require!(task.status == TaskStatus::Open, OpenfourrError::TaskNotOpen);
        require!(task.submission_count > 0, OpenfourrError::NoSubmissions);

        task.status = TaskStatus::Disputed;
        task.dispute_raised_by = Some(ctx.accounts.raiser.key());

        emit!(DisputeRaised { task_id: task.id, raised_by: ctx.accounts.raiser.key() });
        Ok(())
    }

    /// Auto-refund expired task (7 days after deadline)
    pub fn auto_refund_expired(ctx: Context<AutoRefundExpired>) -> Result<()> {
        let task = &mut ctx.accounts.task;

        require!(task.status == TaskStatus::Open, OpenfourrError::TaskNotOpen);
        
        let grace_period = 7 * 24 * 3600;
        let current_time = Clock::get()?.unix_timestamp;
        require!(current_time > task.deadline + grace_period, OpenfourrError::GracePeriodNotOver);

        let task_id_bytes = task.id.to_le_bytes();
        let escrow_seeds = &[b"escrow".as_ref(), task_id_bytes.as_ref(), &[task.escrow_bump]];
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
        emit!(AutoRefunded { task_id: task.id });
        Ok(())
    }
}

// ============ CONTEXTS ============

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = 8 + Platform::INIT_SPACE, seeds = [b"platform"], bump)]
    pub platform: Account<'info, Platform>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterAgent<'info> {
    #[account(init, payer = owner, space = 8 + AgentProfile::INIT_SPACE, seeds = [b"agent", owner.key().as_ref()], bump)]
    pub agent_profile: Account<'info, AgentProfile>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateTask<'info> {
    #[account(init, payer = client, space = 8 + Task::INIT_SPACE, seeds = [b"task", platform.total_tasks.to_le_bytes().as_ref()], bump)]
    pub task: Account<'info, Task>,
    #[account(mut, seeds = [b"platform"], bump = platform.bump)]
    pub platform: Account<'info, Platform>,
    /// CHECK: Escrow PDA
    #[account(mut, seeds = [b"escrow", platform.total_tasks.to_le_bytes().as_ref()], bump)]
    pub escrow: AccountInfo<'info>,
    #[account(mut)]
    pub client: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitApplication<'info> {
    #[account(init, payer = agent_owner, space = 8 + Submission::INIT_SPACE, seeds = [b"submission", task.key().as_ref(), agent_owner.key().as_ref()], bump)]
    pub submission: Account<'info, Submission>,
    #[account(mut)]
    pub task: Account<'info, Task>,
    #[account(seeds = [b"agent", agent_owner.key().as_ref()], bump = agent_profile.bump)]
    pub agent_profile: Account<'info, AgentProfile>,
    #[account(mut)]
    pub agent_owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SendMessage<'info> {
    #[account(init, payer = sender, space = 8 + Message::INIT_SPACE, seeds = [b"message", task.key().as_ref(), task.message_count.to_le_bytes().as_ref()], bump)]
    pub message: Account<'info, Message>,
    #[account(mut)]
    pub task: Account<'info, Task>,
    pub submission: Option<Account<'info, Submission>>,
    #[account(mut)]
    pub sender: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SelectWinner<'info> {
    #[account(mut, constraint = task.client == client.key())]
    pub task: Account<'info, Task>,
    #[account(mut, constraint = submission.task_id == task.id)]
    pub submission: Account<'info, Submission>,
    #[account(mut, seeds = [b"agent", submission.agent.as_ref()], bump = agent_profile.bump)]
    pub agent_profile: Account<'info, AgentProfile>,
    /// CHECK: Agent wallet
    #[account(mut, constraint = agent_wallet.key() == submission.agent)]
    pub agent_wallet: AccountInfo<'info>,
    /// CHECK: Escrow
    #[account(mut, seeds = [b"escrow", task.id.to_le_bytes().as_ref()], bump = task.escrow_bump)]
    pub escrow: AccountInfo<'info>,
    #[account(mut, seeds = [b"platform"], bump = platform.bump)]
    pub platform: Account<'info, Platform>,
    /// CHECK: Treasury
    #[account(mut, constraint = platform_treasury.key() == platform.authority)]
    pub platform_treasury: AccountInfo<'info>,
    #[account(mut)]
    pub client: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelTask<'info> {
    #[account(mut, constraint = task.client == client.key())]
    pub task: Account<'info, Task>,
    /// CHECK: Escrow
    #[account(mut, seeds = [b"escrow", task.id.to_le_bytes().as_ref()], bump = task.escrow_bump)]
    pub escrow: AccountInfo<'info>,
    #[account(mut)]
    pub client: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RequestExtension<'info> {
    #[account(mut)]
    pub task: Account<'info, Task>,
    #[account(constraint = submission.task_id == task.id && submission.agent == agent_owner.key())]
    pub submission: Account<'info, Submission>,
    pub agent_owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct ApproveExtension<'info> {
    #[account(mut, constraint = task.client == client.key())]
    pub task: Account<'info, Task>,
    pub client: Signer<'info>,
}

#[derive(Accounts)]
pub struct RaiseDispute<'info> {
    #[account(mut)]
    pub task: Account<'info, Task>,
    pub raiser: Signer<'info>,
}

#[derive(Accounts)]
pub struct AutoRefundExpired<'info> {
    #[account(mut)]
    pub task: Account<'info, Task>,
    /// CHECK: Escrow
    #[account(mut, seeds = [b"escrow", task.id.to_le_bytes().as_ref()], bump = task.escrow_bump)]
    pub escrow: AccountInfo<'info>,
    /// CHECK: Client wallet
    #[account(mut, constraint = client.key() == task.client)]
    pub client: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
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
    pub submission_count: u64,
    pub message_count: u64,
    pub extension_requested: bool,
    pub extension_hours: u64,
    pub dispute_raised_by: Option<Pubkey>,
    pub winning_submission: Option<Pubkey>,
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

#[account]
#[derive(InitSpace)]
pub struct Message {
    pub task_id: u64,
    pub message_id: u64,
    pub sender: Pubkey,
    #[max_len(500)]
    pub content: String,
    pub sent_at: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum TaskStatus { Open, InProgress, PendingReview, Completed, Rejected, Cancelled, Disputed }

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum SubmissionStatus { Pending, Selected, NotSelected }

// ============ EVENTS ============

#[event]
pub struct TaskCreated { pub task_id: u64, pub client: Pubkey, pub title: String, pub bounty: u64, pub deadline: i64 }
#[event]
pub struct WinnerSelected { pub task_id: u64, pub agent: Pubkey, pub payout: u64, pub rating: u8 }
#[event]
pub struct TaskCancelled { pub task_id: u64 }
#[event]
pub struct ExtensionRequested { pub task_id: u64, pub agent: Pubkey, pub extra_hours: u64 }
#[event]
pub struct ExtensionApproved { pub task_id: u64, pub new_deadline: i64 }
#[event]
pub struct ExtensionDenied { pub task_id: u64 }
#[event]
pub struct DisputeRaised { pub task_id: u64, pub raised_by: Pubkey }
#[event]
pub struct AutoRefunded { pub task_id: u64 }

// ============ ERRORS ============

#[error_code]
pub enum OpenfourrError {
    #[msg("Name too long")] NameTooLong,
    #[msg("Bio too long")] BioTooLong,
    #[msg("Too many skills")] TooManySkills,
    #[msg("Title too long")] TitleTooLong,
    #[msg("Description too long")] DescriptionTooLong,
    #[msg("Invalid bounty")] InvalidBounty,
    #[msg("Invalid deadline")] InvalidDeadline,
    #[msg("Task not open")] TaskNotOpen,
    #[msg("Agent not active")] AgentNotActive,
    #[msg("Task expired")] TaskExpired,
    #[msg("URL too long")] UrlTooLong,
    #[msg("Invalid rating")] InvalidRating,
    #[msg("Cannot cancel")] CannotCancel,
    #[msg("Has submissions")] HasSubmissions,
    #[msg("Submission not pending")] SubmissionNotPending,
    #[msg("Message too long")] MessageTooLong,
    #[msg("Message empty")] MessageEmpty,
    #[msg("Not participant")] NotTaskParticipant,
    #[msg("Invalid extension")] InvalidExtension,
    #[msg("Extension already requested")] ExtensionAlreadyRequested,
    #[msg("No extension requested")] NoExtensionRequested,
    #[msg("No submissions")] NoSubmissions,
    #[msg("Grace period not over")] GracePeriodNotOver,
}
