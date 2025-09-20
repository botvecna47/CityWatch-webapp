const prisma = require('./database');
const axios = require('axios');

// Configuration from environment variables
const CONFIG = {
  enabled: process.env.DUPLICATE_CHECK_ENABLED === 'true' || true, // Enable by default
  geoRadiusMeters: parseInt(process.env.DUPLICATE_GEO_RADIUS_METERS) || 200, // Increased radius
  timeWindowMinutes: parseInt(process.env.DUPLICATE_TIME_WINDOW_MINUTES) || 10080, // 1 week
  embeddingThreshold: parseFloat(process.env.DUPLICATE_EMBEDDING_THRESHOLD) || 0.75, // Lower threshold for more sensitivity
  ollamaUrl: process.env.OLLAMA_URL,
  openaiApiKey: process.env.OPENAI_API_KEY,
  // Rule-based thresholds (more aggressive)
  stringSimilarityThreshold: 0.80, // Lower threshold
  jaccardThreshold: 0.65, // Lower threshold
  levenshteinThreshold: 0.75 // Lower threshold
};

/**
 * Generate embedding for text using available model (Ollama > OpenAI > null)
 * @param {string} text - Text to generate embedding for
 * @returns {Promise<number[]|null>} - Embedding vector or null if no model available
 */
async function generateEmbedding(text) {
  if (!CONFIG.enabled) return null;

  try {
    // Try Ollama first if available
    if (CONFIG.ollamaUrl) {
      return await generateOllamaEmbedding(text);
    }
    
    // Try OpenAI if available
    if (CONFIG.openaiApiKey) {
      return await generateOpenAIEmbedding(text);
    }
    
    return null; // No model available, use rule-based fallback
  } catch (error) {
    console.error('Error generating embedding:', error);
    return null; // Fallback to rule-based
  }
}

/**
 * Generate embedding using Ollama
 */
async function generateOllamaEmbedding(text) {
  try {
    const response = await axios.post(`${CONFIG.ollamaUrl}/api/embeddings`, {
      model: 'nomic-embed-text', // Default model, can be configured
      prompt: text
    }, {
      timeout: 10000 // 10 second timeout
    });
    
    return response.data.embedding;
  } catch (error) {
    console.error('Ollama embedding error:', error.message);
    throw error;
  }
}

/**
 * Generate embedding using OpenAI
 */
async function generateOpenAIEmbedding(text) {
  try {
    const response = await axios.post('https://api.openai.com/v1/embeddings', {
      model: 'text-embedding-3-small', // Cost-effective model
      input: text
    }, {
      headers: {
        'Authorization': `Bearer ${CONFIG.openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    return response.data.data[0].embedding;
  } catch (error) {
    console.error('OpenAI embedding error:', error.message);
    throw error;
  }
}

/**
 * Find nearby candidate reports for duplicate checking
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {string} cityId - City ID to scope search
 * @param {number} radiusMeters - Search radius in meters
 * @param {number} timeWindowMinutes - Time window in minutes
 * @returns {Promise<Array>} - Array of candidate reports
 */
async function findNearbyCandidates(lat, lng, cityId, radiusMeters = CONFIG.geoRadiusMeters, timeWindowMinutes = CONFIG.timeWindowMinutes) {
  if (!CONFIG.enabled) return [];

  const timeWindow = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
  
  try {
    // Get all reports in the city within time window
    const candidates = await prisma.report.findMany({
      where: {
        cityId,
        deleted: false,
        createdAt: {
          gte: timeWindow
        },
        // Only include reports with coordinates for geo filtering
        latitude: { not: null },
        longitude: { not: null }
      },
      select: {
        id: true,
        title: true,
        description: true,
        latitude: true,
        longitude: true,
        status: true,
        createdAt: true,
        embedding: {
          select: {
            embedding: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 100 // Limit to prevent performance issues
    });

    // Filter by geographic distance
    const nearbyCandidates = candidates.filter(report => {
      if (!report.latitude || !report.longitude) return false;
      
      const distance = calculateDistance(lat, lng, report.latitude, report.longitude);
      return distance <= radiusMeters;
    });

    return nearbyCandidates;
  } catch (error) {
    console.error('Error finding nearby candidates:', error);
    return [];
  }
}

/**
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1 - Latitude 1
 * @param {number} lng1 - Longitude 1
 * @param {number} lat2 - Latitude 2
 * @param {number} lng2 - Longitude 2
 * @returns {number} - Distance in meters
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Compare embeddings using cosine similarity
 * @param {number[]} embedding1 - First embedding
 * @param {number[]} embedding2 - Second embedding
 * @returns {number} - Cosine similarity score (0-1)
 */
function compareEmbeddings(embedding1, embedding2) {
  if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
    return 0;
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }

  norm1 = Math.sqrt(norm1);
  norm2 = Math.sqrt(norm2);

  if (norm1 === 0 || norm2 === 0) return 0;

  return dotProduct / (norm1 * norm2);
}

/**
 * Rule-based text similarity matching
 * @param {string} text1 - First text
 * @param {string} text2 - Second text
 * @returns {number} - Similarity score (0-1)
 */
function ruleBasedMatch(text1, text2) {
  const normalized1 = normalizeText(text1);
  const normalized2 = normalizeText(text2);

  // Exact match
  if (normalized1 === normalized2) return 1.0;

  // Jaccard similarity
  const jaccardScore = calculateJaccardSimilarity(normalized1, normalized2);
  if (jaccardScore >= CONFIG.jaccardThreshold) return jaccardScore;

  // Levenshtein distance
  const levenshteinScore = calculateLevenshteinSimilarity(normalized1, normalized2);
  if (levenshteinScore >= CONFIG.levenshteinThreshold) return levenshteinScore;

  return Math.max(jaccardScore, levenshteinScore);
}

/**
 * Normalize text for comparison
 */
function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Calculate Jaccard similarity
 */
function calculateJaccardSimilarity(text1, text2) {
  const tokens1 = new Set(text1.split(' ').filter(token => token.length > 2));
  const tokens2 = new Set(text2.split(' ').filter(token => token.length > 2));
  
  const intersection = new Set([...tokens1].filter(token => tokens2.has(token)));
  const union = new Set([...tokens1, ...tokens2]);
  
  return intersection.size / union.size;
}

/**
 * Calculate Levenshtein similarity
 */
function calculateLevenshteinSimilarity(text1, text2) {
  const distance = levenshteinDistance(text1, text2);
  const maxLength = Math.max(text1.length, text2.length);
  return maxLength === 0 ? 1 : (maxLength - distance) / maxLength;
}

/**
 * Calculate Levenshtein distance
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Main duplicate checking function
 * @param {Object} params - Parameters for duplicate check
 * @param {string} params.title - Report title
 * @param {string} params.description - Report description
 * @param {number} params.latitude - Latitude
 * @param {number} params.longitude - Longitude
 * @param {string} params.cityId - City ID
 * @returns {Promise<Object>} - Duplicate check result
 */
async function checkDuplicate({ title, description, latitude, longitude, cityId }) {
  if (!CONFIG.enabled) {
    return { duplicate: false, matches: [] };
  }

  try {
    const combinedText = `${title} ${description}`;
    
    // Find nearby candidates
    const candidates = await findNearbyCandidates(latitude, longitude, cityId);
    
    if (candidates.length === 0) {
      return { duplicate: false, matches: [] };
    }

    const matches = [];

    // Try embedding-based comparison first
    const newEmbedding = await generateEmbedding(combinedText);
    
    if (newEmbedding) {
      // Use embedding-based comparison
      for (const candidate of candidates) {
        if (candidate.embedding?.embedding) {
          const similarity = compareEmbeddings(newEmbedding, candidate.embedding.embedding);
          
          if (similarity >= CONFIG.embeddingThreshold) {
            matches.push({
              id: candidate.id,
              title: candidate.title,
              excerpt: candidate.description.substring(0, 100) + '...',
              similarity: similarity,
              status: candidate.status,
              createdAt: candidate.createdAt
            });
          }
        }
      }
    } else {
      // Fallback to rule-based comparison
      for (const candidate of candidates) {
        const candidateText = `${candidate.title} ${candidate.description}`;
        const similarity = ruleBasedMatch(combinedText, candidateText);
        
        if (similarity >= CONFIG.stringSimilarityThreshold) {
          matches.push({
            id: candidate.id,
            title: candidate.title,
            excerpt: candidate.description.substring(0, 100) + '...',
            similarity: similarity,
            status: candidate.status,
            createdAt: candidate.createdAt
          });
        }
      }
    }

    // Sort by similarity (highest first)
    matches.sort((a, b) => b.similarity - a.similarity);

    return {
      duplicate: matches.length > 0,
      matches: matches.slice(0, 5) // Return top 5 matches
    };

  } catch (error) {
    console.error('Error in duplicate check:', error);
    return { duplicate: false, matches: [] };
  }
}

/**
 * Store embedding for a report
 * @param {string} reportId - Report ID
 * @param {number[]} embedding - Embedding vector
 */
async function storeEmbedding(reportId, embedding) {
  if (!CONFIG.enabled || !embedding) return;

  try {
    await prisma.reportEmbedding.upsert({
      where: { reportId },
      update: { embedding },
      create: {
        reportId,
        embedding
      }
    });
  } catch (error) {
    console.error('Error storing embedding:', error);
  }
}

module.exports = {
  checkDuplicate,
  generateEmbedding,
  storeEmbedding,
  compareEmbeddings,
  ruleBasedMatch,
  calculateDistance,
  calculateJaccardSimilarity,
  calculateLevenshteinSimilarity,
  normalizeText,
  findNearbyCandidates,
  CONFIG
};
