# RAG Cloudflare

A Retrieval-Augmented Generation (RAG) pipeline that ingests PDF documents into Cloudflare Vectorize and answers questions using an LLM via OpenRouter. Built with Bun.

## How It Works

1. **Ingest** - PDFs in the `data/` folder are read, split into chunks, embedded, and stored in a Cloudflare Vectorize index.
2. **Query** - A user question is embedded, the most relevant chunks are retrieved from Vectorize, and an LLM generates an answer grounded in those chunks.

## Prerequisites

- Bun 1.0+
- An OpenRouter API key
- A Cloudflare account ID
- A Cloudflare API token with Vectorize permissions

## Setup

1. **Install dependencies**

   ```bash
   bun install
   ```

2. **Configure environment variables**

   Copy the example file and fill in your credentials:

   ```bash
   cp .env.example .env
   ```

3. **Edit `.env`**

   ```env
   OPENROUTER_API_BASE=https://openrouter.ai/api/v1
   OPENROUTER_API_KEY=your_openrouter_api_key
   OPENROUTER_MODEL=deepseek/deepseek-v4-pro
   OPENROUTER_CONTEXT_MODEL=gpt-4o-mini
   OPENROUTER_MAX_TOKENS=512
   OPENROUTER_EMBEDDING_MODEL=text-embedding-3-small
   CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
   CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
   CLOUDFLARE_VECTORIZE_INDEX=belajar-rag
   ```

4. **Add PDF files**

   Place your PDF files in `data/`.

## Usage

### Ingest PDFs

```bash
bun ingest.js
```

To completely reset the index before ingesting:

```bash
bun ingest.js --delete-old
```

This will:
- Read all `.pdf` files from `data/`
- Split text into chunks with overlap
- (Optionally) Reset the Cloudflare Vectorize index if `--delete-old` is provided
- Upload fresh embeddings with stable IDs (subsequent runs without `--delete-old` will update existing documents rather than duplicating them)

### Query

```bash
bun query.js "What is the main topic of the document?"
```

The output includes the answer and source chunks with relevance scores.

## Project Structure

```text
├── config.js
├── ingest.js
├── query.js
├── .env.example
├── package.json
└── data/
```
