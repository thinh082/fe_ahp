// Centralized AI config for client-side usage.
// API keys lấy từ environment variables

window.AI_CONFIG = {
  gemini: {
    apiKey: window.GEMINI_API_KEY || "",
    chatModel: "gemini-2.5-flash",
    matrixModel: "gemini-2.5-flash",
    autoFixModel: "gemini-2.5-flash",
  },
  groq: {
    apiKey: window.GROQ_API_KEY || "",
    chatModel: "llama-3.3-70b-versatile",
    matrixModel: "llama-3.3-70b-versatile",
    autoFixModel: "llama-3.3-70b-versatile",
  },
};
