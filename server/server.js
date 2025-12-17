const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();

/* =======================
   CORS CONFIGURATION
   ======================= */
app.use(
  cors({
    origin: "*", // Allow all origins for now
    methods: ["GET", "POST"],
    credentials: true
  })
);

const server = http.createServer(app);

/* =======================
   SOCKET.IO CONFIG
   ======================= */
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

/* =======================
   ROUTES
   ======================= */
app.get("/", (req, res) => {
  res.send("🚀 LinguaBridge Translation API is running successfully");
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "LinguaBridge Translation API",
    uptime: process.uptime()
  });
});

/* =======================
   LANGUAGE CODE NORMALIZATION
   ======================= */
function normalizeLang(lang) {
  if (!lang) return 'en'; // Default to English
  
  const langStr = String(lang).toLowerCase().trim();
  
  const map = {
    // Full language names
    'english': 'en',
    'hindi': 'hi',
    'spanish': 'es',
    'french': 'fr',
    'german': 'de',
    'japanese': 'ja',
    'korean': 'ko',
    'chinese': 'zh',
    'arabic': 'ar',
    
    // Language codes
    'en': 'en',
    'hi': 'hi',
    'es': 'es',
    'fr': 'fr',
    'de': 'de',
    'ja': 'ja',
    'ko': 'ko',
    'zh': 'zh',
    'ar': 'ar',
    'en-us': 'en',
    'hi-in': 'hi',
    'es-es': 'es',
    'fr-fr': 'fr',
    'de-de': 'de',
    'ja-jp': 'ja',
    'ko-kr': 'ko',
    'zh-cn': 'zh',
    'ar-sa': 'ar'
  };
  
  return map[langStr] || langStr.slice(0, 2); // Return normalized or first 2 chars
}

/* =======================
   TRANSLATION SERVICES WITH PROPER TIMEOUT
   ======================= */
async function translateWithTimeout(fetchPromise, timeoutMs = 8000) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Translation request timeout'));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([fetchPromise, timeoutPromise]);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function translateWithMyMemory(message, sourceLang, targetLang) {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(message)}&langpair=${sourceLang}|${targetLang}`;
    
    console.log(`🔗 MyMemory API URL: ${url}`);
    
    const fetchPromise = fetch(url);
    const response = await translateWithTimeout(fetchPromise, 10000);
    
    if (!response.ok) {
      throw new Error(`MyMemory API returned ${response.status}`);
    }
    
    const data = await response.json();

    console.log("MyMemory API Response received");

    // Try matches first
    if (Array.isArray(data.matches)) {
      // Sort by quality (higher quality first)
      const sortedMatches = data.matches.sort((a, b) => (b.match || 0) - (a.match || 0));
      
      const goodMatch = sortedMatches.find(
        (m) =>
          typeof m.translation === "string" &&
          m.translation.trim().length > 0 &&
          !m.translation.toLowerCase().includes('no translation') &&
          !m.translation.toLowerCase().includes('not found') &&
          m.translation.toLowerCase() !== 'never' &&
          m.translation !== message // Not the same as input
      );

      if (goodMatch) {
        console.log("✅ Found match from MyMemory (quality:", goodMatch.match, "):", goodMatch.translation);
        return goodMatch.translation.trim();
      }
    }

    // Fallback to responseData
    if (data?.responseData?.translatedText) {
      const translated = data.responseData.translatedText.trim();
      if (translated && translated !== message) {
        console.log("✅ Using MyMemory responseData:", translated);
        return translated;
      }
    }

    throw new Error("No valid translation found in MyMemory response");
  } catch (error) {
    console.warn("⚠️ MyMemory API failed:", error.message);
    throw error;
  }
}

async function translateWithLibreTranslate(message, sourceLang, targetLang) {
  const LIBRE_APIS = [
    "https://libretranslate.de/translate",
    "https://translate.astian.org/translate",
    "https://translate.argosopentech.com/translate"
  ];

  for (const api of LIBRE_APIS) {
    try {
      console.log(`🔗 Trying LibreTranslate: ${api}`);
      
      const fetchPromise = fetch(api, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          q: message,
          source: sourceLang,
          target: targetLang,
          format: "text"
        })
      });

      const response = await translateWithTimeout(fetchPromise, 8000);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data?.translatedText) {
        const translated = data.translatedText.trim();
        console.log(`✅ LibreTranslate success from ${api}:`, translated);
        return translated;
      }
    } catch (err) {
      console.warn(`⚠️ LibreTranslate API failed (${api}):`, err.message);
      continue; // Try next API
    }
  }
  
  throw new Error("All LibreTranslate services unavailable");
}

async function translateText(message, sourceLang, targetLang) {
  console.log(`🔍 Translating: "${message}" from ${sourceLang} to ${targetLang}`);
  
  // Normalize language codes
  sourceLang = normalizeLang(sourceLang);
  targetLang = normalizeLang(targetLang);
  
  console.log(`🔧 Normalized languages: ${sourceLang} → ${targetLang}`);

  // Try different translation strategies based on language pair
  try {
    // For Hindi translations, MyMemory usually works better
    if (targetLang === 'hi' || sourceLang === 'hi') {
      console.log("🎯 Using MyMemory (better for Hindi)");
      return await translateWithMyMemory(message, sourceLang, targetLang);
    }
    
    // For other languages, try LibreTranslate first
    console.log("🎯 Trying LibreTranslate first");
    return await translateWithLibreTranslate(message, sourceLang, targetLang);
    
  } catch (error) {
    console.log("⚠️ Primary translation failed, trying fallback...");
    
    // Fallback: Try the other service
    try {
      if (targetLang === 'hi' || sourceLang === 'hi') {
        // If MyMemory failed for Hindi, try LibreTranslate
        return await translateWithLibreTranslate(message, sourceLang, targetLang);
      } else {
        // If LibreTranslate failed for others, try MyMemory
        return await translateWithMyMemory(message, sourceLang, targetLang);
      }
    } catch (error2) {
      console.error("❌ All translation services failed");
      
      // Last resort: Common phrases dictionary
      const commonTranslation = getCommonTranslation(message, sourceLang, targetLang);
      if (commonTranslation) {
        console.log("📚 Using common phrases dictionary");
        return commonTranslation;
      }
      
      throw new Error("Translation service unavailable. Please try again later.");
    }
  }
}

function getCommonTranslation(message, sourceLang, targetLang) {
  const lowerMessage = message.toLowerCase().trim();
  
  // English to Hindi common phrases
  if (sourceLang === 'en' && targetLang === 'hi') {
    const translations = {
      "hello": "नमस्ते",
      "hi": "नमस्ते",
      "hey": "नमस्ते",
      "how are you": "आप कैसे हैं?",
      "how are you doing": "आप कैसे हैं?",
      "what's up": "क्या हाल है?",
      "what is up": "क्या हाल है?",
      "good morning": "शुभ प्रभात",
      "good afternoon": "शुभ अपराह्न",
      "good evening": "शुभ संध्या",
      "good night": "शुभ रात्रि",
      "thank you": "धन्यवाद",
      "thanks": "धन्यवाद",
      "please": "कृपया",
      "sorry": "माफ़ कीजिए",
      "excuse me": "माफ़ कीजिए",
      "yes": "हाँ",
      "no": "नहीं",
      "maybe": "शायद",
      "okay": "ठीक है",
      "ok": "ठीक है",
      "i love you": "मैं तुमसे प्यार करता हूँ",
      "what is your name": "आपका नाम क्या है?",
      "my name is": "मेरा नाम है",
      "where are you from": "आप कहाँ से हैं?",
      "nice to meet you": "आपसे मिलकर खुशी हुई",
      "see you later": "बाद में मिलते हैं",
      "goodbye": "अलविदा",
      "bye": "अलविदा",
      "how much is this": "यह कितने का है?",
      "can you help me": "क्या आप मेरी मदद कर सकते हैं?",
      "i need help": "मुझे मदद चाहिए",
      "where is the bathroom": "बाथरूम कहाँ है?",
      "water": "पानी",
      "food": "खाना",
      "help": "मदद",
      "welcome": "स्वागत है",
      "how much": "कितना",
      "where": "कहाँ",
      "when": "कब",
      "why": "क्यों",
      "who": "कौन",
      "what": "क्या",
      "good": "अच्छा",
      "bad": "बुरा",
      "happy": "खुश",
      "sad": "उदास"
    };
    
    return translations[lowerMessage];
  }
  
  // Hindi to English common phrases
  if (sourceLang === 'hi' && targetLang === 'en') {
    const translations = {
      "नमस्ते": "Hello",
      "नमस्कार": "Hello",
      "प्रणाम": "Greetings",
      "आप कैसे हैं": "How are you?",
      "आप कैसे हो": "How are you?",
      "क्या हाल है": "What's up?",
      "कैसे हो": "How are you?",
      "शुभ प्रभात": "Good morning",
      "शुभ संध्या": "Good evening",
      "शुभ रात्रि": "Good night",
      "धन्यवाद": "Thank you",
      "शुक्रिया": "Thanks",
      "कृपया": "Please",
      "माफ़ कीजिए": "Sorry",
      "क्षमा कीजिए": "Excuse me",
      "हाँ": "Yes",
      "नहीं": "No",
      "जी हाँ": "Yes",
      "जी नहीं": "No",
      "शायद": "Maybe",
      "ठीक है": "Okay",
      "मेरा नाम है": "My name is",
      "आपका नाम क्या है": "What is your name?",
      "आप कहाँ से हैं": "Where are you from?",
      "मुझे मदद चाहिए": "I need help",
      "कितने का है": "How much is this?",
      "यह कितने का है": "How much is this?",
      "पानी": "Water",
      "खाना": "Food",
      "मदद": "Help",
      "स्वागत है": "Welcome",
      "कितना": "How much",
      "कहाँ": "Where",
      "कब": "When",
      "क्यों": "Why",
      "कौन": "Who",
      "क्या": "What",
      "अच्छा": "Good",
      "बुरा": "Bad",
      "खुश": "Happy",
      "उदास": "Sad"
    };
    
    // Try exact match first
    if (translations[message.trim()]) {
      return translations[message.trim()];
    }
    
    // Try case-insensitive match
    const normalizedHindi = message.trim();
    return translations[normalizedHindi];
  }
  
  return null;
}

/* =======================
   SOCKET CONNECTION
   ======================= */
io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  // Send welcome message
  socket.emit("connected", {
    message: "Connected to LinguaBridge translation server",
    timestamp: new Date().toISOString()
  });

  socket.on("sendMessage", async ({ message, sourceLang, targetLang }) => {
    console.log("\n" + "=".repeat(50));
    console.log("📨 NEW TRANSLATION REQUEST");
    console.log("=".repeat(50));
    console.log("Message:", message);
    console.log("Raw sourceLang:", sourceLang);
    console.log("Raw targetLang:", targetLang);

    try {
      // Validate input
      if (!message || message.trim().length === 0) {
        throw new Error("Message cannot be empty");
      }

      if (!sourceLang || !targetLang) {
        throw new Error("Languages must be specified");
      }

      // Normalize language codes
      const normalizedSourceLang = normalizeLang(sourceLang);
      const normalizedTargetLang = normalizeLang(targetLang);
      
      console.log("Normalized sourceLang:", normalizedSourceLang);
      console.log("Normalized targetLang:", normalizedTargetLang);

      if (normalizedSourceLang === normalizedTargetLang) {
        throw new Error("Source and target languages cannot be the same");
      }

      // Translate
      const translatedText = await translateText(
        message.trim(),
        normalizedSourceLang,
        normalizedTargetLang
      );

      console.log("✅ SUCCESS - Translation:", translatedText);
      console.log("=".repeat(50) + "\n");

      // Send back to client
      socket.emit("receiveMessage", {
        original: message,
        translated: translatedText,
        sourceLang: normalizedSourceLang,
        targetLang: normalizedTargetLang,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error("❌ ERROR - Translation failed:", error.message);
      console.log("=".repeat(50) + "\n");

      // Send error to client
      socket.emit("translation_error", {
        error: error.message,
        message: message,
        sourceLang: normalizeLang(sourceLang),
        targetLang: normalizeLang(targetLang)
      });

      // Also send a fallback response
      const normalizedSourceLang = normalizeLang(sourceLang);
      const normalizedTargetLang = normalizeLang(targetLang);
      
      const fallbackTranslation = getCommonTranslation(message, normalizedSourceLang, normalizedTargetLang) || 
        `[${normalizedTargetLang.toUpperCase()} Translation] ${message}`;
      
      socket.emit("receiveMessage", {
        original: message,
        translated: fallbackTranslation,
        sourceLang: normalizedSourceLang,
        targetLang: normalizedTargetLang,
        isFallback: true,
        timestamp: new Date().toISOString()
      });
    }
  });

  socket.on("disconnect", (reason) => {
    console.log("🔴 User disconnected:", socket.id, "Reason:", reason);
  });
});

/* =======================
   SERVER START
   ======================= */
const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log("🌐 WebSocket server ready");
  console.log("📡 CORS enabled for all origins");
  console.log("\n🔧 Available translation services:");
  console.log("   - MyMemory Translate API");
  console.log("   - LibreTranslate (multiple instances)");
  console.log("   - Common phrases dictionary");
  console.log("\n🔧 Language normalization enabled");
  console.log("   - Converts 'English' → 'en'");
  console.log("   - Converts 'Hindi' → 'hi'");
  console.log("   - Handles various language code formats");
});