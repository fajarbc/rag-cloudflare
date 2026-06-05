require('dotenv').config();
const OpenAI = require('openai');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
}

const config = {
  openrouter: {
    apiBase: requireEnv('OPENROUTER_API_BASE'),
    apiKey: requireEnv('OPENROUTER_API_KEY'),
    model: requireEnv('OPENROUTER_MODEL'),
    contextModel: process.env.OPENROUTER_CONTEXT_MODEL || 'gpt-4o-mini',
    maxTokens: parseInt(process.env.OPENROUTER_MAX_TOKENS || '512'),
    embeddingModel: requireEnv('OPENROUTER_EMBEDDING_MODEL'),
  },
  cloudflare: {
    accountId: requireEnv('CLOUDFLARE_ACCOUNT_ID'),
    apiToken: requireEnv('CLOUDFLARE_API_TOKEN'),
    indexName: process.env.CLOUDFLARE_VECTORIZE_INDEX || 'belajar-rag',
  },
};

const openaiClient = new OpenAI({
  baseURL: config.openrouter.apiBase,
  apiKey: config.openrouter.apiKey,
  defaultHeaders: {
    'HTTP-Referer': 'https://github.com/fajarbc/rag-cloudflare',
    'X-Title': 'RAG Cloudflare',
  },
});

async function getEmbedding(text) {
  const response = await openaiClient.embeddings.create({
    model: config.openrouter.embeddingModel,
    input: text,
  });
  return response.data[0].embedding;
}

async function callLLM(messages) {
  const response = await openaiClient.chat.completions.create({
    model: config.openrouter.model,
    messages: messages,
    max_tokens: config.openrouter.maxTokens,
  });
  return response.choices[0].message.content;
}

async function vectorizeRequest(method, path, body = null) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${config.cloudflare.accountId}/vectorize/v2/indexes${path}`;
  
  const options = {
    method: method,
    headers: {
      'Authorization': `Bearer ${config.cloudflare.apiToken}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (!data.success) {
    throw new Error(`Vectorize API error: ${JSON.stringify(data.errors)}`);
  }

  return data.result;
}

async function ensureVectorizeIndex() {
  try {
    const indexes = await vectorizeRequest('GET', '');
    const exists = indexes.some(idx => idx.name === config.cloudflare.indexName);

    if (!exists) {
      console.log(`Creating Vectorize index: ${config.cloudflare.indexName}`);
      await vectorizeRequest('POST', '', {
        name: config.cloudflare.indexName,
        config: {
          dimensions: 1536,
          metric: 'cosine',
        },
        description: 'RAG Cloudflare index',
      });
      console.log('Index created successfully');
    }
  } catch (error) {
    throw new Error(`Failed to ensure Vectorize index: ${error.message}`);
  }
}

async function upsertVectors(vectors) {
  const indexPath = `/${config.cloudflare.indexName}/upsert`;
  return await vectorizeRequest('POST', indexPath, { vectors });
}

async function queryVectors(queryVector, topK = 5) {
  const indexPath = `/${config.cloudflare.indexName}/query`;
  return await vectorizeRequest('POST', indexPath, {
    vector: queryVector,
    topK: topK,
    returnMetadata: 'all',
  });
}

async function deleteAllVectors() {
  try {
    const indexPath = `/${config.cloudflare.indexName}`;
    console.log(`Deleting existing index ${config.cloudflare.indexName} to reset data...`);
    await vectorizeRequest('DELETE', indexPath);
    
    // Wait a couple of seconds for the deletion to propagate
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (error) {
    // If index doesn't exist, it's fine
    if (!error.message.includes('not found') && !error.message.includes('404')) {
      throw error;
    }
  }

  // Re-create the index
  await ensureVectorizeIndex();
}

module.exports = {
  config,
  openaiClient,
  getEmbedding,
  callLLM,
  ensureVectorizeIndex,
  upsertVectors,
  queryVectors,
  deleteAllVectors,
};
