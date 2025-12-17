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
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  })
);

const server = http.createServer(app);

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
  if (!lang) return 'en';
  
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
    'ar': 'ar'
  };
  
  return map[langStr] || 'en'; // Default to English
}

/* =======================
   TRANSLATION SERVICES - STRICT FILTERING
   ======================= */

// Google Translate API (unofficial but reliable)
async function translateWithGoogleTranslate(message, sourceLang, targetLang) {
  try {
    // Using a free Google Translate API endpoint
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(message)}`;
    
    console.log(`🔗 Google Translate API: ${sourceLang} → ${targetLang}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Google API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data && data[0] && data[0][0] && data[0][0][0]) {
      const translated = data[0][0][0];
      console.log(`✅ Google Translate: "${translated}"`);
      return translated;
    }
    
    throw new Error("No translation found in Google response");
  } catch (error) {
    console.warn("⚠️ Google Translate failed:", error.message);
    throw error;
  }
}

// Improved MyMemory with strict filtering
async function translateWithMyMemory(message, sourceLang, targetLang) {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(message)}&langpair=${sourceLang}|${targetLang}`;
    
    console.log(`🔗 MyMemory API: ${sourceLang} → ${targetLang}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`MyMemory API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    // STRICT FILTERING RULES
    const inappropriateWords = ['allah', 'god', 'jesus', 'pray', 'religion', 'muslim', 'christian', 'hindu', 'allah', 'bible', 'quran'];
    const qualityThreshold = 60; // Minimum match quality
    
    if (Array.isArray(data.matches)) {
      // Filter out inappropriate and low-quality translations
      const goodMatches = data.matches.filter(match => {
        if (!match.translation || typeof match.translation !== 'string') return false;
        
        const translation = match.translation.toLowerCase();
        
        // Check for inappropriate content
        if (inappropriateWords.some(word => translation.includes(word))) {
          console.log(`🚫 Filtered inappropriate translation: ${match.translation}`);
          return false;
        }
        
        // Check quality
        if (match.match < qualityThreshold) {
          console.log(`📉 Low quality (${match.match}): ${match.translation}`);
          return false;
        }
        
        // Don't return same as input
        if (translation === message.toLowerCase()) {
          return false;
        }
        
        // Should look like a proper sentence
        if (translation.length < 2) return false;
        
        return true;
      });
      
      // Sort by quality (highest first)
      goodMatches.sort((a, b) => (b.match || 0) - (a.match || 0));
      
      if (goodMatches.length > 0) {
        const bestMatch = goodMatches[0];
        console.log(`✅ MyMemory best match (quality ${bestMatch.match}): "${bestMatch.translation}"`);
        return bestMatch.translation.trim();
      }
    }
    
    // Fallback to responseData with filtering
    if (data?.responseData?.translatedText) {
      const translation = data.responseData.translatedText.trim();
      const lowerTranslation = translation.toLowerCase();
      
      // Filter inappropriate content
      if (!inappropriateWords.some(word => lowerTranslation.includes(word)) && 
          translation !== message) {
        console.log(`✅ MyMemory responseData: "${translation}"`);
        return translation;
      }
    }
    
    throw new Error("No suitable translation found");
  } catch (error) {
    console.warn("⚠️ MyMemory API failed:", error.message);
    throw error;
  }
}

// Microsoft Bing Translator (alternative)
async function translateWithBing(message, sourceLang, targetLang) {
  try {
    // Using a public Bing Translate endpoint
    const url = `https://www.bing.com/ttranslatev3?isVertical=1&IG=1&IID=translator.5023`;
    
    const formData = new URLSearchParams();
    formData.append('text', message);
    formData.append('fromLang', sourceLang);
    formData.append('to', targetLang);
    
    console.log(`🔗 Bing Translator: ${sourceLang} → ${targetLang}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`Bing API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data && data[0] && data[0].translations && data[0].translations[0]) {
      const translated = data[0].translations[0].text;
      console.log(`✅ Bing Translator: "${translated}"`);
      return translated;
    }
    
    throw new Error("No translation found in Bing response");
  } catch (error) {
    console.warn("⚠️ Bing Translator failed:", error.message);
    throw error;
  }
}

// Smart translation with multiple fallbacks
async function translateText(message, sourceLang, targetLang) {
  console.log(`\n🔍 Translating: "${message}" from ${sourceLang} to ${targetLang}`);
  
  // Normalize language codes
  sourceLang = normalizeLang(sourceLang);
  targetLang = normalizeLang(targetLang);
  
  console.log(`🔧 Normalized: ${sourceLang} → ${targetLang}`);
  
  // Common phrases dictionary (highest priority - most accurate)
  const commonPhrase = getCommonTranslation(message, sourceLang, targetLang);
  if (commonPhrase) {
    console.log(`📚 Using verified common phrase: "${commonPhrase}"`);
    return commonPhrase;
  }
  
  // Try different services in order of reliability
  const services = [
    { name: 'Google', fn: translateWithGoogleTranslate },
    { name: 'Bing', fn: translateWithBing },
    { name: 'MyMemory', fn: translateWithMyMemory }
  ];
  
  for (const service of services) {
    try {
      console.log(`🔄 Trying ${service.name} Translate...`);
      const result = await service.fn(message, sourceLang, targetLang);
      
      // Validate the translation
      if (isValidTranslation(result, message)) {
        console.log(`✅ ${service.name} success: "${result}"`);
        return result;
      } else {
        console.log(`⚠️ ${service.name} returned invalid translation`);
        continue;
      }
    } catch (error) {
      console.log(`⚠️ ${service.name} failed: ${error.message}`);
      continue;
    }
  }
  
  // Ultimate fallback
  console.log("❌ All translation services failed");
  
  if (sourceLang === 'hi' && targetLang === 'en') {
    return `[Translated from Hindi] ${message}`;
  } else if (sourceLang === 'en' && targetLang === 'hi') {
    return `[अंग्रेजी से अनुवादित] ${message}`;
  } else {
    return `[${sourceLang} → ${targetLang}] ${message}`;
  }
}

// Validate translation quality
function isValidTranslation(translation, original) {
  if (!translation || typeof translation !== 'string') return false;
  
  const transLower = translation.toLowerCase();
  const origLower = original.toLowerCase();
  
  // Don't accept same as input
  if (transLower === origLower) return false;
  
  // Filter inappropriate content
  const inappropriate = [
    'allah', 'god', 'jesus', 'pray', 'religion', 'muslim', 'christian',
    'hindu', 'allah', 'bible', 'quran', 'sex', 'fuck', 'shit', 'ass'
  ];
  
  if (inappropriate.some(word => transLower.includes(word))) {
    console.log(`🚫 Filtered inappropriate: ${translation}`);
    return false;
  }
  
  // Should be reasonable length
  if (translation.length < 1 || translation.length > 500) return false;
  
  return true;
}

// Enhanced common phrases dictionary
function getCommonTranslation(message, sourceLang, targetLang) {
  const lowerMessage = message.toLowerCase().trim();
  
  // English to Hindi dictionary
  if (sourceLang === 'en' && targetLang === 'hi') {
    const translations = {
      // Greetings
      "hello": "नमस्ते",
      "hi": "नमस्ते",
      "hey": "नमस्ते",
      "good morning": "शुभ प्रभात",
      "good afternoon": "शुभ अपराह्न",
      "good evening": "शुभ संध्या",
      "good night": "शुभ रात्रि",
      
      // Common questions
      "how are you": "आप कैसे हैं?",
      "how are you doing": "आप कैसे हैं?",
      "what's up": "क्या हाल है?",
      "what is your name": "आपका नाम क्या है?",
      "where are you from": "आप कहाँ से हैं?",
      "how old are you": "आपकी उम्र क्या है?",
      
      // Responses
      "i am fine": "मैं ठीक हूँ",
      "i'm good": "मैं ठीक हूँ",
      "i'm okay": "मैं ठीक हूँ",
      "thank you": "धन्यवाद",
      "thanks": "धन्यवाद",
      "you're welcome": "आपका स्वागत है",
      "sorry": "माफ़ कीजिए",
      "excuse me": "माफ़ कीजिए",
      "please": "कृपया",
      
      // Basic words
      "yes": "हाँ",
      "no": "नहीं",
      "okay": "ठीक है",
      "ok": "ठीक है",
      "maybe": "शायद",
      
      // Questions
      "what is this": "यह क्या है?",
      "what is that": "वह क्या है?",
      "who is this": "यह कौन है?",
      "where is it": "यह कहाँ है?",
      "when is it": "यह कब है?",
      "why is it": "यह क्यों है?",
      "how is it": "यह कैसा है?",
      
      // Time
      "what time is it": "क्या समय हुआ है?",
      "what is the time": "समय क्या है?",
      
      // Food
      "i am hungry": "मुझे भूख लगी है",
      "food": "खाना",
      "water": "पानी",
      
      // Help
      "help": "मदद",
      "i need help": "मुझे मदद चाहिए",
      "can you help me": "क्या आप मेरी मदद कर सकते हैं?",
      
      // Directions
      "where is the bathroom": "बाथरूम कहाँ है?",
      "where is the hotel": "होटल कहाँ है?",
      
      // Feelings
      "i love you": "मैं तुमसे प्यार करता हूँ",
      "i like you": "मुझे तुम पसंद हो",
      "i am happy": "मैं खुश हूँ",
      "i am sad": "मैं उदास हूँ",
      
      // Work/Study
      "what do you do": "आप क्या करते हैं?",
      "i am a student": "मैं एक छात्र हूँ",
      "i am working": "मैं काम कर रहा हूँ"
    };
    
    return translations[lowerMessage];
  }
  
  // Hindi to English dictionary
  if (sourceLang === 'hi' && targetLang === 'en') {
    const translations = {
      // Greetings
      "नमस्ते": "Hello",
      "नमस्कार": "Hello",
      "प्रणाम": "Greetings",
      "शुभ प्रभात": "Good morning",
      "शुभ संध्या": "Good evening",
      "शुभ रात्रि": "Good night",
      
      // Common phrases
      "आप कैसे हैं": "How are you?",
      "आप कैसे हो": "How are you?",
      "कैसे हो": "How are you?",
      "क्या हाल है": "What's up?",
      "आपका नाम क्या है": "What is your name?",
      "आप कहाँ से हैं": "Where are you from?",
      
      // Responses
      "मैं ठीक हूँ": "I am fine",
      "धन्यवाद": "Thank you",
      "शुक्रिया": "Thanks",
      "कृपया": "Please",
      "माफ़ कीजिए": "Sorry",
      "क्षमा कीजिए": "Excuse me",
      
      // Basic words
      "हाँ": "Yes",
      "नहीं": "No",
      "ठीक है": "Okay",
      "शायद": "Maybe",
      
      // Questions
      "यह क्या है": "What is this?",
      "वह क्या है": "What is that?",
      "यह कौन है": "Who is this?",
      "यह कहाँ है": "Where is it?",
      "यह कब है": "When is it?",
      "यह क्यों है": "Why is it?",
      
      // Common Hindi phrases
      "का हाल है": "How are you?",
      "क्या कर रहे हो": "What are you doing?",
      "खाना खा लिया": "Have you eaten?",
      "कहाँ जा रहे हो": "Where are you going?",
      "क्या समय हुआ है": "What time is it?",
      "मुझे मदद चाहिए": "I need help",
      "पानी दीजिए": "Please give me water",
      "यह कितने का है": "How much is this?",
      "बाथरूम कहाँ है": "Where is the bathroom?"
    };
    
    // Try exact match
    if (translations[message.trim()]) {
      return translations[message.trim()];
    }
    
    // Try with spaces normalized
    const normalized = message.trim().replace(/\s+/g, ' ');
    return translations[normalized];
  }
  
  return null;
}

/* =======================
   SOCKET CONNECTION
   ======================= */
io.on("connection", (socket) => {
  console.log("\n" + "=".repeat(60));
  console.log("🟢 NEW USER CONNECTED:", socket.id);
  console.log("=".repeat(60));

  socket.emit("connected", {
    message: "Connected to LinguaBridge translation server",
    timestamp: new Date().toISOString()
  });

  socket.on("sendMessage", async ({ message, sourceLang, targetLang }) => {
    console.log("\n📨 TRANSLATION REQUEST FROM:", socket.id);
    console.log("Message:", message);
    console.log("Languages:", sourceLang, "→", targetLang);

    try {
      if (!message || message.trim().length === 0) {
        throw new Error("Message cannot be empty");
      }

      if (!sourceLang || !targetLang) {
        throw new Error("Languages must be specified");
      }

      const normalizedSourceLang = normalizeLang(sourceLang);
      const normalizedTargetLang = normalizeLang(targetLang);
      
      console.log("Normalized:", normalizedSourceLang, "→", normalizedTargetLang);

      if (normalizedSourceLang === normalizedTargetLang) {
        throw new Error("Source and target languages cannot be the same");
      }

      const translatedText = await translateText(
        message.trim(),
        normalizedSourceLang,
        normalizedTargetLang
      );

      console.log("✅ TRANSLATION SUCCESS");
      console.log("Original:", message);
      console.log("Translated:", translatedText);
      console.log("=".repeat(60));

      socket.emit("receiveMessage", {
        original: message,
        translated: translatedText,
        sourceLang: normalizedSourceLang,
        targetLang: normalizedTargetLang,
        timestamp: new Date().toISOString(),
        success: true
      });

    } catch (error) {
      console.error("❌ TRANSLATION FAILED:", error.message);
      console.log("=".repeat(60));

      const normalizedSourceLang = normalizeLang(sourceLang);
      const normalizedTargetLang = normalizeLang(targetLang);
      
      const fallbackTranslation = getCommonTranslation(message, normalizedSourceLang, normalizedTargetLang) || 
        `[${normalizedSourceLang} → ${normalizedTargetLang}] ${message}`;
      
      socket.emit("receiveMessage", {
        original: message,
        translated: fallbackTranslation,
        sourceLang: normalizedSourceLang,
        targetLang: normalizedTargetLang,
        timestamp: new Date().toISOString(),
        isFallback: true,
        success: false
      });
    }
  });

  socket.on("disconnect", (reason) => {
    console.log("\n🔴 USER DISCONNECTED:", socket.id, "Reason:", reason);
    console.log("=".repeat(60));
  });
});

/* =======================
   SERVER START
   ======================= */
const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                    LINGUABRIDGE SERVER                   ║
║                     v2.0 - ENHANCED                      ║
╚══════════════════════════════════════════════════════════╝
  
🚀 Server running on port ${PORT}
🌐 WebSocket server ready
📡 CORS enabled for all origins

🔧 TRANSLATION SERVICES:
   • Google Translate (Primary)
   • Bing Translator (Fallback)
   • MyMemory (Filtered - Last Resort)
   • Common Phrases Dictionary (Verified)

⚡ FEATURES:
   • Strict content filtering
   • Language normalization
   • Quality validation
   • Multiple fallbacks
   • Real-time logging

📊 Ready to translate!
`);
});