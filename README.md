# RAG Cloudflare with Clef-Flash (System 1 Decision Engine)

A Retrieval-Augmented Generation (RAG) pipeline built for Cloudflare Workers, Vectorize, and Workers AI.

In this branch (`feature/clef-flash-integration`), we introduce **Cloudflare Clef-Flash (`@cf/cloudflare/clef-flash`)** as a fast **System 1 Decision Gateway** protecting and optimizing the System 2 generative LLM (Llama 3.1).

---

## Architecture: 4 Fokus Update

```
User Query
    │
    ▼
┌────────────────────────────────────────────────────────┐
│ [Fokus 1 & 2] Clef-Flash: Intent & Pre-Retrieval Guard  │
│  - Guardrail (noul): Drop prompt injection (>85% prob)  │
│  - Intent (choice): "chitchat" -> Fast static reply    │
│                     "support"  -> Redirect to support  │
│                     "technical_rag" -> Continue RAG    │
└──────────────────────────┬─────────────────────────────┘
                           │ (technical_rag)
                           ▼
┌────────────────────────────────────────────────────────┐
│ [Fokus 3] Clef-Flash: Metadata Category Extraction     │
│  - Category (choice): "billing", "api_docs", "policy"  │
│  - Query Vectorize with filter: { category: { $eq } }  │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ Vectorize: Retrieve Top-K Semantically Matching Chunks  │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ [Fokus 4] Clef-Flash: Post-Retrieval Validation         │
│  - Context check (noul): Do docs contain sufficient    │
│    facts to answer the query?                          │
│  - If No -> Bypass LLM, return "Info not available"    │
│  - If Yes -> Proceed to System 2                       │
└──────────────────────────┬─────────────────────────────┘
                           │ (Yes)
                           ▼
┌────────────────────────────────────────────────────────┐
│ System 2: Workers AI Llama 3.1 8B Instruct             │
│ Generates grounded, hallucination-free final answer    │
└────────────────────────────────────────────────────────┘
```

---

## File Structure

```text
├── src/
│   └── worker.ts        # Cloudflare Worker with Clef-Flash System 1 Pipeline
├── wrangler.jsonc       # Wrangler config (AI binding & Vectorize binding)
├── config.js            # Existing Bun / Vectorize REST API config
├── ingest.js            # Existing PDF ingestion script
├── query.js             # Existing standalone CLI query script
├── package.json
└── data/
```

---

## Deploying the Worker

1. **Deploy to Cloudflare Workers:**
   ```bash
   npx wrangler deploy
   ```

2. **Test Endpoint:**
   ```bash
   curl -X POST https://rag-cloudflare-worker.<YOUR_SUBDOMAIN>.workers.dev \
     -H "Content-Type: application/json" \
     -d '{"query": "Bagaimana cara autentikasi API Cloudflare?"}'
   ```
