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
    origin: [
      "http://localhost",
      "http://127.0.0.1",
      "http://localhost:5500",
      "http://127.0.0.1:5500",
      "https://language-translator-chat-app-ui.onrender.com"
    ],
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
   LIBRETRANSLATE CONFIG
   ======================= */
const TRANSLATE_APIS = [
  "https://libretranslate.de/translate",
  "https://translate.astian.org/translate"
];

async function translateText(message, sourceLang, targetLang) {
  for (const api of TRANSLATE_APIS) {
    try {
      const response = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: message,
          source: sourceLang,
          target: targetLang,
          format: "text"
        })
      });

      const data = await response.json();
      if (data?.translatedText) {
        return data.translatedText;
      }
    } catch (err) {
      console.warn("⚠️ Translation API failed:", api);
    }
  }
  throw new Error("All translation services unavailable");
}

/* =======================
   SOCKET CONNECTION
   ======================= */
io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  socket.emit("connected", {
    message: "Connected to LinguaBridge translation server"
  });

  socket.on("sendMessage", async ({ message, sourceLang, targetLang }) => {
    console.log("📨 Received translation request:", {
      message,
      sourceLang,
      targetLang
    });

    try {
      if (!message || !sourceLang || !targetLang) {
        throw new Error("Missing required fields");
      }

      if (sourceLang === targetLang) {
        throw new Error("Source and target languages cannot be the same");
      }

      // Ensure short language codes
      const langMap = {
        "en-US": "en",
        "hi-IN": "hi"
      };

      sourceLang = langMap[sourceLang] || sourceLang;
      targetLang = langMap[targetLang] || targetLang;

      const translatedText = await translateText(
        message.trim(),
        sourceLang,
        targetLang
      );

      socket.emit("receiveMessage", {
        original: message,
        translated: translatedText,
        sourceLang,
        targetLang
      });

      console.log("✅ Translation sent:", translatedText);
    } catch (error) {
      console.error("❌ Translation error:", error.message);

      socket.emit("translation_error", {
        error: error.message,
        message
      });

      socket.emit("receiveMessage", {
        original: message,
        translated: "⚠️ Translation unavailable. Please try again.",
        sourceLang,
        targetLang
      });
    }
  });

  socket.on("disconnect", (reason) => {
    console.log("🔴 User disconnected:", socket.id, "Reason:", reason);
  });
});

/* =======================
   SERVER START (RENDER SAFE)
   ======================= */
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log("🌐 WebSocket server ready");
  console.log("📡 CORS enabled");
});
