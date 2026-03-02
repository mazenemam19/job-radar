---
name: source-test-generator
description: Guided workflow for creating standalone verification scripts for new job source integrations.
---

# Skill Instructions

When creating a new standalone test script (e.g., `src/scripts/test-[source].ts`), follow these rules strictly:

1. **Environmental Setup**:
   - Always use `dotenv` to load `.env.local` at the very beginning.
   - Use `path.resolve` to ensure the path is correct regardless of where the script is run from.

   ```typescript
   import { config } from "dotenv";
   import path from "path";
   config({ path: path.resolve(process.cwd(), ".env.local") });
   ```

2. **No Module Extension**:
   - Never add `.js` or `.ts` extensions to your internal relative imports. Stick to the default Next.js/TypeScript behavior.
   - Example: `import { fetchSomething } from "../lib/sources/something";`

3. **Mandate Verification**:
   - The test script must log the raw job count before filtering.
   - The test script must log the final job count after filtering.
   - The test script must print at least one full sample job object to verify mapping and scoring correctness.

4. **Clean Execution**:
   - Ensure the script uses `process.exit(0)` on success and `process.exit(1)` on error.
   - Include a `try/catch` block around the main execution logic.

5. **Naming Convention**:
   - Always name the file `src/scripts/test-[source-name].ts`.
