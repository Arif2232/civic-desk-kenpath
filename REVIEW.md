# Review together before submission

This is an AI-assisted draft. Run it yourself, make changes you agree with, and only describe work you understand and can explain. Nothing has been sent to Kenpath.

## Three-minute walkthrough

1. Start the app using the [README](README.md), sign in, and show the English/Hindi switch.
2. Open a received case. Explain that high priority is a demo input and the rest are ordered by age; the model does not rank cases.
3. Ask the assistant for a next step. If no API key is configured, show that the interface explicitly calls the result rule-based example guidance. With a key, it calls the OpenAI Responses API; the result remains a suggestion.
4. Enter a human work note and assign the case. Add a fictional field update, send it for review, then approve, reject or return it. Show the timeline and how return differs from closure.
5. Explain that the demo is not connected to MCD, sends no notifications and accepts only fictional reports. The MCD source supports assignment and review concepts, while this state machine is our proposed simplification.

## How the code fits together

- `src/main.tsx` renders the queue, bilingual controls, notes, actions and assistant panel. `src/i18n.ts` contains interface copy. Newly entered reports are kept in the language the officer entered.
- `server/workflow.ts` is the transition table. `server/db.ts` writes a case transition and its history event in one SQLite transaction and rejects stale versions.
- `server/app.ts` checks a demo session, validates actions, checks cross-origin mutations and rate-limits sign-in and suggestions. `server/ai.ts` asks for advice without giving the model any tools to change a case.
- `tests/workflow.test.ts` exercises the authenticated API, the workflow, stale edits, origin checks, the suggestion limit and the no-key preview.

## Questions to be ready for

- **Why this problem?** A missed waste pickup is concrete, local and has a plausible assignment and follow-up workflow supported by the linked public sources.
- **Where can AI help?** Draft a next-step suggestion from the case and recorded notes; it must not invent a visit, photograph, deadline or decision. Humans act and record their reasoning.
- **How would we measure impact?** In a permitted pilot, compare median time to assignment and verified closure against a baseline; also audit returned cases and unsupported AI statements. The demo makes no measured impact claim.
- **What would change for real government use?** Validate the actual service workflow and Hindi copy with officers, add accessible user research, real identity and role controls, durable shared sessions, proper permissions, privacy review, secure evidence handling, operational monitoring and an independently managed database.

Before submission, verify the reviewer can access the repository and live HTTPS demo and decide how to share the demo login privately. Do not put secrets in the repository.
