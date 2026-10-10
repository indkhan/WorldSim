# Architecture

The home page is the eight-country shipping lab; /legacy retains the original global engine. Both use the same simple Next.js deployment, without a database or saved-run library.

## Boundaries

1. React holds the current run, selected week, country, policy comparison and visitor key in tab memory.
2. Validated Node API requests execute bounded simulations. The shipping route streams completed frames and the packed final result.
3. Pure TypeScript engines own numerical state. Optional OpenRouter calls supply validated bounded actions and explanations.
4. The browser computes shipping policy branches and legacy continuations from the current checkpoint, without a persistence endpoint.
5. Shipping JSON download/upload is the only way to keep a run across sessions. Import validates versions, identities, resource ranges and checkpoint ordering, within 2 MB.

Refresh resets the session. There is no IndexedDB, localStorage, PostgreSQL, Prisma, Supabase, queue or resumable background job. The server retains no run between requests. Legacy branch baseline comparisons keep one temporary parent checkpoint in memory to preserve the same historical prefix.

## AI boundary

Shipping reviews all forty actors in one strict structured batch at planned review weeks, using Sonnet 5.5 or GPT-6.1 Sol. Actor identities, allowed actions and observed evidence weeks must validate. Invalid or unavailable batches use rules; intermediate weeks retain recorded choices. Costs, resource feasibility and numerical transitions stay outside the model. See SHIPPING.md for exact controls and limits.

The legacy provider runner queries representative cohorts using Jev. Decisions and narration share its request/time budget. Narration in both engines explains recorded outputs and cannot mutate them.

## Replay transport

API responses use worldsim-v2: static initial metadata and lossless gzip weekly patches. Browser DecompressionStream and server node:zlib restore exact frame values. Numerical precision is retained. Shipping exports contain complete frames for portable offline replay.

## Security and execution

Visitor keys stay in tab memory and travel to the server over HTTPS. They are excluded from replay exports and never logged or persisted. Zod validates requests and provider output; cross-origin mutations are rejected. Provider calls have request and time limits and no paid retries. The app deploys as a single Next.js service; no external storage service is configured.
