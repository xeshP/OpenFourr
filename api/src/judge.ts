import Anthropic from "@anthropic-ai/sdk";

interface TaskSubmission {
  taskId: number;
  title: string;
  description: string;
  requirements: string;
  submissionUrl: string;
  submissionNotes: string;
}

interface JudgeResult {
  approved: boolean;
  rating: number; // 1-5
  reasoning: string;
  feedback: string;
}

export class AIJudge {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async evaluateSubmission(submission: TaskSubmission): Promise<JudgeResult> {
    const prompt = `You are an AI Judge for Openfourr, a marketplace where AI agents complete tasks for humans.

Your job is to evaluate whether a task submission meets the requirements and should be approved for payment.

## Task Details
- **Title**: ${submission.title}
- **Description**: ${submission.description}
- **Requirements**: ${submission.requirements}

## Submission
- **URL**: ${submission.submissionUrl}
- **Agent's Notes**: ${submission.submissionNotes}

## Your Evaluation

Please evaluate this submission and respond in JSON format:

\`\`\`json
{
  "approved": true/false,
  "rating": 1-5,
  "reasoning": "Your detailed reasoning for the decision",
  "feedback": "Constructive feedback for the agent"
}
\`\`\`

### Rating Scale:
- 5: Exceptional - Exceeds all requirements, high quality
- 4: Good - Meets all requirements well
- 3: Acceptable - Meets minimum requirements
- 2: Needs improvement - Partially meets requirements
- 1: Rejected - Does not meet requirements

### Evaluation Criteria:
1. Does the submission URL work and point to valid content?
2. Are all stated requirements fulfilled?
3. Is the quality acceptable for the bounty amount?
4. Did the agent provide clear documentation/notes?

Be fair but thorough. If the submission clearly doesn't work or misses major requirements, reject it. If it's functional and meets requirements, approve it.

Respond ONLY with the JSON object.`;

    const message = await this.client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Parse the response
    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    try {
      // Extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const result = JSON.parse(jsonMatch[0]) as JudgeResult;

      // Validate rating
      if (result.rating < 1 || result.rating > 5) {
        result.rating = Math.min(5, Math.max(1, Math.round(result.rating)));
      }

      return result;
    } catch (error) {
      console.error("Failed to parse AI Judge response:", error);
      // Default to needs review
      return {
        approved: false,
        rating: 2,
        reasoning: "Unable to automatically evaluate. Manual review required.",
        feedback: "The AI Judge could not evaluate this submission automatically.",
      };
    }
  }

  async verifyUrl(url: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const response = await fetch(url, { method: "HEAD" });
      return {
        valid: response.ok,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

export default AIJudge;
