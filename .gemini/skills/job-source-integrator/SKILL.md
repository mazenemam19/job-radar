---
name: job-source-integrator
description: Guided workflow for adding and verifying new job board integrations in the Job Radar project.
---

# Skill Instructions

When integrating a new job board, follow this mandatory workflow:

1. **Research API**: Verify the job board provides a direct JSON API. **NO HTML SCRAPING** is allowed unless explicitly authorized and verified.
2. **Tech Gate Verification**: Implement filtering for **React**, **Next.js**, and **React Native**. Ensure non-matching roles are skipped early in the fetcher.
3. **Level Gate Verification**: Exclude **Junior**, **Intern**, **Trainee**, **Associate**, and **Managerial** roles.
4. **Testing Mandate**:
   - DO NOT run `pnpm run cron:now` to test the integration.
   - Create a file `src/scripts/test-[board-name].ts`.
   - The test script should fetch a sample batch of jobs, log them, and verify the filtering logic.
   - Example script boilerplate:
     ```typescript
     import { fetchFrom[BoardName] } from '../lib/sources/[board-name]';
     async function test() {
       const jobs = await fetchFrom[BoardName]();
       console.log(`Fetched ${jobs.length} jobs`);
       // ... verification logic
     }
     test();
     ```
5. **Parallel Execution**: Ensure the new fetcher is added to the correct pipeline in `src/scripts/cron.ts` to run in parallel with existing scans.
6. **Final Validation**: Only after the standalone test script passes, run the full cron job once as a final sanity check.
