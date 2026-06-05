const { getEmbedding, queryVectors, callLLM } = require('./config');

function getPrompt() {
  const prompt = process.argv.slice(2).join(' ').trim();
  if (!prompt) {
    console.error('Usage: node query.js "your question"');
    process.exit(1);
  }
  return prompt;
}

function previewText(text, limit = 400) {
  const cleaned = text.split(/\s+/).join(' ');
  if (cleaned.length <= limit) return cleaned;
  return cleaned.substring(0, limit).trim() + '...';
}

function printSources(matches) {
  console.log('\nSources:');
  if (!matches || matches.length === 0) {
    console.log('No source nodes returned.');
    return;
  }

  matches.forEach((match, idx) => {
    const score = match.score;
    const metadata = match.metadata || {};
    const text = metadata.text || '';

    console.log(`\nSource ${idx + 1}`);
    console.log(`Score: ${score !== undefined ? score : 'N/A'}`);
    console.log(`Metadata: ${JSON.stringify({ file_name: metadata.file_name, page_number: metadata.page_number })}`);
    console.log(`Preview: ${previewText(text)}`);
  });
}

async function main() {
  try {
    const prompt = getPrompt();
    console.log('Prompt:');
    console.log(prompt);

    console.log('\nEmbedding query...');
    const queryVector = await getEmbedding(prompt);

    console.log('Querying Cloudflare Vectorize...');
    const result = await queryVectors(queryVector, 5);

    const matches = result.matches || [];
    
    // Construct context from search results
    const context = matches
      .map(match => match.metadata && match.metadata.text ? match.metadata.text : '')
      .filter(text => text.length > 0)
      .join('\n\n');

    if (!context) {
      console.log('\nNo matching context found. Asking LLM directly...');
    }

    const systemPrompt = `You are a helpful assistant. Use the following pieces of retrieved context to answer the question. If you don't know the answer, say that you don't know.
    
Context:
${context}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ];

    console.log('Generating answer...');
    const response = await callLLM(messages);

    console.log('\nAnswer:');
    console.log(response);

    printSources(matches);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
