const fs = require('fs');
const path = require('path');

// Lấy API keys từ environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

// Cập nhật js/api-key.js
const apiKeyFile = path.join(__dirname, 'js', 'api-key.js');
const apiKeyContent = `// Centralized AI config for client-side usage.
// API keys từ environment variables

window.AI_CONFIG = {
  gemini: {
    apiKey: "${GEMINI_API_KEY}",
    chatModel: "gemini-2.5-flash",
    matrixModel: "gemini-2.5-flash",
    autoFixModel: "gemini-2.5-flash",
  },
  groq: {
    apiKey: "${GROQ_API_KEY}",
    chatModel: "llama-3.3-70b-versatile",
    matrixModel: "llama-3.3-70b-versatile",
    autoFixModel: "llama-3.3-70b-versatile",
  },
};
`;

fs.writeFileSync(apiKeyFile, apiKeyContent);
console.log('✅ Injected API keys from environment variables');
