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
      "https://language-translator-chat-app-ui.onrender.com" // frontend URL
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
   ROUTES (FOR BROWSER)
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
      // Validation
      if (!message || !sourceLang || !targetLang) {
        throw new Error("Missing required fields");
      }

      if (sourceLang === targetLang) {
        throw new Error("Source and target languages cannot be the same");
      }

      // MyMemory API
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
        message
      )}&langpair=${sourceLang}|${targetLang}`;

      console.log("🌐 Calling translation API:", url);

      const response = await fetch(url);
      const data = await response.json();

      console.log("✅ API response received");

      let translatedText = null;

      // Smart match selection
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
          console.log("📝 Using match:", translatedText);
        }
      }

      // Fallback
      if (!translatedText && data?.responseData?.translatedText) {
        translatedText = data.responseData.translatedText;
        console.log("📝 Using responseData:", translatedText);
      }

      if (!translatedText) {
        throw new Error("Translation not found in API response");
      }

      translatedText = translatedText
        .trim()
        .replace(/\[\w+\]\s*/g, "");

      socket.emit("receiveMessage", {
        original: message,
        translated: translatedText,
        sourceLang,
        targetLang
      });

      console.log("✅ Translation sent successfully");
    } catch (error) {
      console.error("❌ Translation error:", error.message);

      socket.emit("translation_error", {
        error: error.message,
        message
      });

      socket.emit("receiveMessage", {
        original: message,
        translated: `[${targetLang.toUpperCase()} Translation] ${message}`,
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
