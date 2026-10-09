const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pdfParse = require('pdf-parse');
const { config, getEmbedding, ensureVectorizeIndex, upsertVectors, deleteAllVectors } = require('./config');

function chunkText(text, chunkSize = 512, overlap = 64) {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  if (words.length <= chunkSize) {
    return [words.join(' ')];
  }
  const chunks = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    const chunk = words.slice(start, end).join(' ');
    chunks.push(chunk);
    start += (chunkSize - overlap);
  }

  return chunks;
}

/**
 * Infer category for metadata extraction (Focus 3)
 * Default options: "billing", "api_docs", "general_policy"
 */
function inferCategory(fileName, text = '') {
  const lowerName = fileName.toLowerCase();
  const lowerText = text.toLowerCase().slice(0, 300);

  if (
    lowerName.includes('bill') ||
    lowerName.includes('pricing') ||
    lowerName.includes('invoice') ||
    lowerText.includes('invoice') ||
    lowerText.includes('subscription')
  ) {
    return 'billing';
  }

  if (
    lowerName.includes('policy') ||
    lowerName.includes('terms') ||
    lowerName.includes('privacy') ||
    lowerText.includes('privacy policy') ||
    lowerText.includes('terms of service')
  ) {
    return 'general_policy';
  }

  return 'api_docs';
}

async function loadPdfDocuments(inputDir = './data') {
  const documents = [];
  const dataDir = path.resolve(inputDir);

  if (!fs.existsSync(dataDir)) {
    throw new Error(`Directory not found: ${dataDir}`);
  }

  const files = fs.readdirSync(dataDir).filter(f => f.toLowerCase().endsWith('.pdf'));

  if (files.length === 0) {
    throw new Error('No PDF files found in ./data');
  }

  for (const file of files) {
    const filePath = path.join(dataDir, file);
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    const pages = data.text.split(/\f/).map(page => page.trim());

    for (let pageNumber = 0; pageNumber < pages.length; pageNumber++) {
      const text = pages[pageNumber];
      if (text.length === 0) continue;

      documents.push({
        text: text,
        metadata: {
          file_name: file,
          page_number: pageNumber + 1,
          category: inferCategory(file, text),
        },
      });
    }
  }

  return documents;
}

async function main() {
  try {
    console.log(`Starting ingestion pipeline...`);
    console.log(`Embedding model: ${config.openrouter.embeddingModel} (via ${config.openrouter.apiBase})`);

    console.log('Loading PDF documents from ./data...');
    const documents = await loadPdfDocuments();
    console.log(`Loaded ${documents.length} pages from ./data`);

    console.log('Ensuring Vectorize index exists...');
    await ensureVectorizeIndex();

    const shouldDelete = process.argv.includes('--delete-old');
    if (shouldDelete) {
      console.log('Deleting old vectors (--delete-old specified)...');
      try {
        await deleteAllVectors();
        console.log('Old vectors deleted.');
      } catch (err) {
        console.log('No old vectors to delete or delete not supported, continuing...');
      }
    } else {
      console.log('Skipping deletion of old vectors. Use --delete-old to reset the index before ingesting.');
    }

    const allVectors = [];

    for (const doc of documents) {
      const chunks = chunkText(doc.text);

      for (let i = 0; i < chunks.length; i++) {
        const chunkText = chunks[i];
        console.log(`Embedding chunk ${i + 1}/${chunks.length} from ${doc.metadata.file_name} (Category: ${doc.metadata.category})...`);

        // Standard REST embedding from configured provider
        const embedding = await getEmbedding(chunkText);

        const vectorId = crypto
          .createHash('sha256')
          .update(`${doc.metadata.file_name}:${doc.metadata.page_number}:${i}`)
          .digest('hex')
          .substring(0, 32);

        allVectors.push({
          id: vectorId,
          values: embedding,
          metadata: {
            text: chunkText,
            file_name: doc.metadata.file_name,
            page_number: doc.metadata.page_number,
            chunk_index: i,
            category: doc.metadata.category, // Focus 3: Used for Vectorize metadata filtering
          },
        });
      }
    }

    console.log(`Upserting ${allVectors.length} vectors to Cloudflare Vectorize...`);
    await upsertVectors(allVectors);
    console.log('Ingestion complete. Data stored in Cloudflare Vectorize with category metadata.');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { loadPdfDocuments, chunkText, inferCategory };
