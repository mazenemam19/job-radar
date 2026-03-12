// src/lib/gemini.ts
import { GoogleGenAI } from "@google/genai";
import type { Job, GeminiFilterResult } from "../types";
import { PERSONAL_SKILLS } from "./constants";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Fallback queue: Pro -> Flash -> Flash Lite (Cascading from newest to most stable)
const MODEL_QUEUE = [
  "gemini-3.1-pro-preview",
  "gemini-3.1-flash-lite-preview",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
];

const genAI = GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: GEMINI_API_KEY,
      httpOptions: {
        apiVersion: "v1beta",
      },
    })
  : null;

/**
 * Filter jobs using Gemini LLM with a fallback queue for high availability.
 * Batches jobs to save on tokens and requests.
 */
export async function filterJobsWithGemini(
  jobs: Job[],
): Promise<{ passed: Job[]; rejectedIds: string[] }> {
  if (!genAI || jobs.length === 0) {
    return { passed: jobs, rejectedIds: [] };
  }

  const results: Job[] = [];
  const rejectedIds: string[] = [];

  // Track the first working model index to avoid repeated fallbacks in the same run
  let currentModelIndex = 0;

  // Batch size: 5-8 jobs per prompt is a good balance for token limit and clarity
  const BATCH_SIZE = 5;
  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE);
    const { results: batchResult, modelIndex } = await processBatchWithFallback(
      batch,
      currentModelIndex,
    );
    currentModelIndex = modelIndex;

    for (const res of batchResult) {
      const job = batch.find((j) => j.id === res.id);
      if (job) {
        if (res.passed) {
          results.push({
            ...job,
            geminiPassed: true,
            geminiReason: res.reason,
            redFlags: res.redFlags || [],
          });
        } else {
          rejectedIds.push(job.id);
          const quoteText = res.quote ? ` | Quote: "${res.quote}"` : "";
          console.log(`[gemini] Rejected ${job.id} (${job.company}): ${res.reason}${quoteText}`);
        }
      }
    }
  }

  return { passed: results, rejectedIds };
}

async function processBatchWithFallback(
  batch: Job[],
  startIndex: number,
): Promise<{ results: GeminiFilterResult[]; modelIndex: number }> {
  let lastError: unknown = null;

  for (let i = startIndex; i < MODEL_QUEUE.length; i++) {
    const modelName = MODEL_QUEUE[i];
    try {
      const result = await callGemini(batch, modelName);
      if (i > startIndex) {
        console.log(`[gemini] Successfully filtered batch using ${modelName}`);
      }
      return { results: result, modelIndex: i };
    } catch (err: unknown) {
      lastError = err;
      const status =
        (err as { status?: number })?.status ||
        (err as { response?: { status?: number } })?.response?.status;

      console.warn(`[gemini] Model ${modelName} failed (Status: ${status}). Falling back...`);

      // If it's a rate limit (429), wait a bit before falling back
      if (status === 429) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      continue;
    }
  }

  const errorMessage = lastError instanceof Error ? lastError.message : JSON.stringify(lastError);
  console.error("[gemini] All models in queue failed. Last error:", errorMessage);

  return {
    results: batch.map((j) => ({
      id: j.id,
      passed: true,
      reason: "Gemini analysis skipped due to API failure",
    })),
    modelIndex: startIndex, // Reset or keep current for next batch
  };
}

async function callGemini(batch: Job[], modelName: string): Promise<GeminiFilterResult[]> {
  const jobData = batch.map((j) => ({
    id: j.id,
    title: j.title,
    company: j.company,
    location: j.location,
    description: j.description.substring(0, 3000), // Increased to catch footer restrictions
  }));

  const prompt = `
YOU ARE A STRICT JOB FILTERING AGENT for a Senior React Developer based in Egypt (GMT+2).
Your goal is to REJECT any job that has even a small hint of location restriction that excludes Egypt, or any tech/seniority mismatch. 
Additionally, you must IDENTIFY cultural "Red Flags" (toxic environments, poor work-life balance signals).

CRITICAL REJECTION RULES (If ANY apply, "passed": false):

1. STRICT LOCATION & TIMEZONE:
   - REJECT if the description mentions "Must be in the US", "US Only", "United States", "UK Only", "Canada Only", "Europe Only", "LATAM Only", "APAC Only".
   - REJECT if it mentions "US Hubs", "US Citizenship", "Green Card", or "Security Clearance" (unless for Egypt).
   - REJECT if the role is remote but restricted to a specific country/region that is NOT Global or EMEA.
   - REJECT if the timezone is PST, EST, CST, MST, or "North America" without mentioning "Global" or "EMEA" flexibility.
   - REJECT if it mentions "office presence", "hybrid", "onsite in X city" (unless it is Cairo/Giza).
   - EXCEPTION: If a global remote company mentions "office anchor days" ONLY for employees living near their hubs (e.g. Vercel), but the role is otherwise open to Egypt/EMEA, do NOT reject.
   - BE AGGRESSIVE: If it says "Remote in the US", it is a REJECT.

2. ISRAEL-RELATED (BDS ALIGNMENT):
   - REJECT if the company is headquartered in Israel (e.g., Wix, Fiverr, Monday.com, Check Point, Papaya Global, Tipalti, etc.).
   - REJECT if the company has major R&D centers in Israel or is known for direct military tech support to Israel.

3. TECH STACK (NO EXCEPTIONS):
   - REJECT if "React", "Next.js", or "React Native" is not the PRIMARY frontend technology.
   - REJECT "Fullstack" roles if they are heavily backend-skewed (Java, .NET, Go, Rust, Python).
   - REJECT purely Backend, DevOps, SRE, or Mobile (Swift/Kotlin) roles.

4. SENIORITY GATE (PIPELINE AWARE):
   - ALLOW both "Mid-level" and "Senior" individual contributor roles for ALL pipelines (Egypt, Global, and Visa).
   - ALWAYS REJECT Intern, Junior, Trainee, Graduate, or "Associate" RANK roles (e.g. Associate Developer). 
   - NOTE: Some companies use "Associate" as a general term for employee (e.g. "Associates at X company"); do NOT reject these if the job title is Mid-level or Senior.
   - ALWAYS REJECT "Lead", "Staff", "Principal", "Architect", "Director", "VP", or "Head of" roles. We only want Mid to Senior individual contributors.

CULTURAL RED FLAG DETECTION:
Identify signals like:
- "Rockstar/Ninja" expectations (indicates ego-driven or unstable environments).
- "Work hard, play hard" or "Whatever it takes" (burnout risk).
- "We are a family" (blurred professional boundaries).
- Mentions of consistent overtime or high-pressure without compensation.
- Extreme "fast-paced" environments where "chaos is normal".

OUTPUT FORMAT:
Return ONLY a valid JSON array of objects: 
[{"id": "string", "passed": boolean, "reason": "concise explanation", "quote": "exact quote from description that caused rejection", "redFlags": ["flag1", "flag2"]}]
If "passed" is true, the "quote" field can be an empty string. If no red flags are found, return an empty array for "redFlags".

JOBS TO EVALUATE:
${JSON.stringify(jobData, null, 2)}
`;

  const result = await genAI!.models.generateContent({
    model: modelName,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });

  if (!result || !result.text) {
    throw new Error("Invalid or empty Gemini response");
  }

  const text = result.text;

  // Clean up JSON response if model adds markdown blocks
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("Invalid Gemini response format");
  }

  return JSON.parse(jsonMatch[0]) as GeminiFilterResult[];
}

/**
 * Generate a personalized application strategy for a specific job.
 */
export async function generateApplicationStrategy(job: Job): Promise<string> {
  if (!genAI) {
    return "Gemini API key not configured. Cannot generate strategy.";
  }

  const prompt = `
YOU ARE AN EXPERT CAREER COACH for a Senior React Developer.
Given the following Job Description and my Personal Skills, generate a bullet-point application strategy.

MY PERSONAL SKILLS:
${Array.from(PERSONAL_SKILLS).join(", ")}

JOB DETAILS:
Title: ${job.title}
Company: ${job.company}
Description: ${job.description.substring(0, 4000)}

GOAL: Provide 4-6 actionable, high-impact bullet points on what to emphasize in my cover letter or interview to stand out. 
Identify direct matches between my skills and their requirements. 
Keep it professional, strategic, and concise. Do NOT use markdown bolding in the bullet points themselves, just plain text bullets starting with "-".

OUTPUT FORMAT:
Plain text bullet points only.
`;

  let lastError: unknown = null;
  for (const modelName of MODEL_QUEUE) {
    try {
      const result = await genAI.models.generateContent({
        model: modelName,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
      if (result.text) return result.text.trim();
    } catch (err: unknown) {
      lastError = err;
      const status =
        (err as { status?: number })?.status ||
        (err as { response?: { status?: number } })?.response?.status;
      console.warn(
        `[gemini] Strategy generation failed for ${modelName} (Status: ${status}). Trying next...`,
      );
      if (status === 429) {
        // Wait a bit if rate limited
        await new Promise((r) => setTimeout(r, 1000));
      }
      continue;
    }
  }

  console.error("[gemini] All models failed for strategy generation.", lastError);
  return "Failed to generate strategy after multiple attempts. Please try again later.";
}
