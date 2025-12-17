const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors({
  origin: ["http://localhost", "http://127.0.0.1", "http://localhost:5500", "http://127.0.0.1:5500"],
  methods: ["GET", "POST"],
  credentials: true
}));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Test route
app.get("/", (req, res) => {
  res.send("🚀 LinguaBridge Translation Server is running!");
});

io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);
  
  // Send welcome message
  socket.emit("connected", { message: "Connected to translation server" });

  socket.on("sendMessage", async ({ message, sourceLang, targetLang }) => {
    console.log("📨 Received translation request:", { message, sourceLang, targetLang });
    
    try {
      // Validate input
      if (!message || !sourceLang || !targetLang) {
        throw new Error("Missing required fields");
      }

      if (sourceLang === targetLang) {
        throw new Error("Source and target languages cannot be the same");
      }

      // 🔹 MyMemory FREE Translation API (GET only)
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
        message
      )}&langpair=${sourceLang}|${targetLang}`;

      console.log("🌐 Calling translation API:", url);

      const response = await fetch(url);
      const data = await response.json();

      console.log("✅ API Response received");

      let translatedText = null;

      // ✅ 1. Smart selection from matches
      if (Array.isArray(data.matches)) {
        const goodMatch = data.matches.find(
          (m) =>
            typeof m.translation === "string" &&
            m.translation.trim().length > 0 &&
            m.translation.toLowerCase() !== "never" &&
            m.translation.toLowerCase() !== "no translation found"
        );

        if (goodMatch) {
          translatedText = goodMatch.translation;
          console.log("📝 Found match from matches array:", translatedText);
        }
      }

      // ✅ 2. Fallback to responseData
      if (!translatedText && data?.responseData?.translatedText) {
        translatedText = data.responseData.translatedText;
        console.log("📝 Using responseData:", translatedText);
      }

      if (!translatedText) {
        console.warn("⚠️ No translation found in API response:", data);
        throw new Error("Translation not found in API response");
      }

      // Clean up translation
      translatedText = translatedText.trim();
      
      // Remove [en] or other language tags if present
      translatedText = translatedText.replace(/\[\w+\]\s*/g, '');

      console.log("✅ Sending translation:", { original: message, translated: translatedText });

      // Send back to the client who requested it
      socket.emit("receiveMessage", {
        original: message,
        translated: translatedText,
        sourceLang: sourceLang,
        targetLang: targetLang
      });

    } catch (error) {
      console.error("❌ Translation error:", error.message);
      
      // Send error back to client
      socket.emit("translation_error", {
        error: error.message,
        message: message
      });
      
      // Also send a fallback message
      socket.emit("receiveMessage", {
        original: message,
        translated: `[${targetLang.toUpperCase()} Translation] ${message}`,
        sourceLang: sourceLang,
        targetLang: targetLang
      });
    }
  });

  socket.on("disconnect", (reason) => {
    console.log("🔴 User disconnected:", socket.id, "Reason:", reason);
  });
});

server.listen(3000, () => {
  console.log("🚀 Server running at http://localhost:3000");
  console.log("🌐 WebSocket server ready");
  console.log("📡 CORS enabled for all origins");
});