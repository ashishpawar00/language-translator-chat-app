// ====== CONFIGURATION ======
const CONFIG = {
  SOCKET_URL: "https://language-translator-chat-app-api.onrender.com",
  SUPPORTED_LANGUAGES: {
    en: { name: "English", flag: "🇺🇸" },
    hi: { name: "Hindi", flag: "🇮🇳" },
    es: { name: "Spanish", flag: "🇪🇸" },
    fr: { name: "French", flag: "🇫🇷" },
    de: { name: "German", flag: "🇩🇪" },
    ja: { name: "Japanese", flag: "🇯🇵" },
    ko: { name: "Korean", flag: "🇰🇷" },
    zh: { name: "Chinese", flag: "🇨🇳" },
    ar: { name: "Arabic", flag: "🇸🇦" }
  }
};


// ====== STATE MANAGEMENT ======
let appState = {
  theme: localStorage.getItem('theme') || 'light',
  sourceLang: 'en',
  targetLang: 'hi',
  isConnected: false,
  isTranslating: false,
  messageCount: 0,
  socket: null,
  heroShown: localStorage.getItem('heroShown') || false
};

// ====== DOM ELEMENTS ======
const elements = {
  // Hero Intro
  heroIntro: document.getElementById('heroIntro'),
  startChatting: document.getElementById('startChatting'),
  
  // Theme & Header
  themeToggle: document.getElementById('themeToggle'),
  statusIndicator: document.getElementById('statusIndicator'),
  statusText: document.getElementById('statusText'),
  
  // Language Controls
  sourceLangOptions: document.querySelectorAll('.language-selector:first-child .flag-option'),
  targetLangOptions: document.querySelectorAll('.language-selector:last-child .flag-option'),
  swapLanguages: document.getElementById('swapLanguages'),
  sourceLangDisplay: document.getElementById('sourceLangDisplay'),
  targetLangDisplay: document.getElementById('targetLangDisplay'),
  translationHint: document.getElementById('translationHint'),
  
  // Chat
  messageInput: document.getElementById('messageInput'),
  sendButton: document.getElementById('sendButton'),
  clearButton: document.getElementById('clearButton'),
  clearChat: document.getElementById('clearChat'),
  chatMessages: document.getElementById('chatMessages'),
  chatBox: document.getElementById('chatBox'),
  messageCount: document.getElementById('messageCount'),
  typingIndicator: document.getElementById('typingIndicator'),
  charCount: document.getElementById('charCount'),
  
  // UI Components
  loadingOverlay: document.getElementById('loadingOverlay'),
  successToast: document.getElementById('successToast'),
  languageDisplay: document.getElementById('languageDisplay')
};

// ====== INITIALIZATION ======
function init() {
  // Show hero intro on first load
  if (!appState.heroShown) {
    elements.heroIntro.classList.remove('hidden');
    localStorage.setItem('heroShown', 'true');
  } else {
    elements.heroIntro.classList.add('hidden');
  }
  
  applyTheme();
  setupEventListeners();
  updateLanguageDisplay();
  updateMessageCount();
  setupSocketConnection();
  
  // Auto-focus input after hero intro
  setTimeout(() => {
    elements.messageInput.focus();
  }, 500);
}

// ====== HERO INTRO ======
function setupHeroIntro() {
  elements.startChatting.addEventListener('click', () => {
    elements.heroIntro.classList.add('hidden');
    elements.messageInput.focus();
  });
}

// ====== THEME MANAGEMENT ======
function applyTheme() {
  document.documentElement.setAttribute('data-theme', appState.theme);
  const icon = elements.themeToggle.querySelector('i');
  icon.className = appState.theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  localStorage.setItem('theme', appState.theme);
}

function toggleTheme() {
  appState.theme = appState.theme === 'light' ? 'dark' : 'light';
  applyTheme();
}

// ====== LANGUAGE MANAGEMENT ======
function setupLanguageSelection() {
  // Source language selection
  elements.sourceLangOptions.forEach(option => {
    option.addEventListener('click', () => {
      const lang = option.getAttribute('data-lang');
      
      if (lang === appState.targetLang) {
        showTranslationHint('Select different languages for translation');
        return;
      }
      
      appState.sourceLang = lang;
      updateLanguageSelectionUI();
      updateLanguageDisplay();
      showTranslationHint(`Now translating from ${CONFIG.SUPPORTED_LANGUAGES[lang].name}`);
    });
  });
  
  // Target language selection
  elements.targetLangOptions.forEach(option => {
    option.addEventListener('click', () => {
      const lang = option.getAttribute('data-lang');
      
      if (lang === appState.sourceLang) {
        showTranslationHint('Select different languages for translation');
        return;
      }
      
      appState.targetLang = lang;
      updateLanguageSelectionUI();
      updateLanguageDisplay();
      showTranslationHint(`Now translating to ${CONFIG.SUPPORTED_LANGUAGES[lang].name}`);
    });
  });
}

function updateLanguageSelectionUI() {
  // Update source language UI
  elements.sourceLangOptions.forEach(option => {
    const lang = option.getAttribute('data-lang');
    const checkIcon = option.querySelector('.fa-check');
    
    if (lang === appState.sourceLang) {
      option.classList.add('selected');
      if (checkIcon) checkIcon.style.opacity = '1';
    } else {
      option.classList.remove('selected');
      if (checkIcon) checkIcon.style.opacity = '0';
    }
  });
  
  // Update target language UI
  elements.targetLangOptions.forEach(option => {
    const lang = option.getAttribute('data-lang');
    const checkIcon = option.querySelector('.fa-check');
    
    if (lang === appState.targetLang) {
      option.classList.add('selected');
      if (checkIcon) checkIcon.style.opacity = '1';
    } else {
      option.classList.remove('selected');
      if (checkIcon) checkIcon.style.opacity = '0';
    }
  });
}

function updateLanguageDisplay() {
  const sourceLang = CONFIG.SUPPORTED_LANGUAGES[appState.sourceLang];
  const targetLang = CONFIG.SUPPORTED_LANGUAGES[appState.targetLang];
  
  elements.sourceLangDisplay.textContent = sourceLang.name;
  elements.targetLangDisplay.textContent = targetLang.name;
  elements.languageDisplay.textContent = `${sourceLang.name} → ${targetLang.name}`;
}

function swapLanguages() {
  // Swap languages
  const temp = appState.sourceLang;
  appState.sourceLang = appState.targetLang;
  appState.targetLang = temp;
  
  // Update UI
  updateLanguageSelectionUI();
  updateLanguageDisplay();
  
  // Show hint
  showTranslationHint('Languages swapped!');
  
  // Add visual feedback
  elements.swapLanguages.style.transform = 'rotate(180deg)';
  setTimeout(() => {
    elements.swapLanguages.style.transform = '';
  }, 300);
}

function showTranslationHint(message) {
  elements.translationHint.innerHTML = `<i class="fas fa-info-circle"></i> ${message}`;
  elements.translationHint.style.opacity = '1';
  
  setTimeout(() => {
    elements.translationHint.style.opacity = '0.9';
  }, 3000);
}

// ====== SOCKET.IO INTEGRATION ======
function setupSocketConnection() {
  try {
    console.log('Connecting to socket server at:', CONFIG.SOCKET_URL);
    appState.socket = io(CONFIG.SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });
    
    // Connection events
    appState.socket.on('connect', () => {
      console.log('✅ Connected to translation server');
      appState.isConnected = true;
      updateConnectionStatus('Connected to translation service', 'connected');
      showTranslationHint('Connected to translation service');
      
      setTimeout(() => {
        updateConnectionStatus('Ready to translate', 'connected');
      }, 2000);
    });
    
    appState.socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
      appState.isConnected = false;
      updateConnectionStatus('Connection failed', 'disconnected');
      showTranslationHint('Cannot connect to server. Please refresh.');
    });
    
    appState.socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected:', reason);
      appState.isConnected = false;
      updateConnectionStatus('Disconnected', 'disconnected');
    });
    
    // Listen for translated messages from server
    appState.socket.on('receiveMessage', (data) => {
      console.log('📨 Received translation:', data);
      hideTypingIndicator();
      addSystemMessage(data.original, data.translated);
      updateStatus('Translation complete');
      
      setTimeout(() => {
        updateStatus('Ready to translate');
      }, 2000);
    });
    
    // Custom error event
    appState.socket.on('translation_error', (error) => {
      console.error('Translation error:', error);
      hideTypingIndicator();
      showTranslationHint('Translation failed. Please try again.');
      addErrorMessage('Translation failed. Please try a different phrase.');
    });
    
  } catch (error) {
    console.error('❌ Socket setup error:', error);
    appState.isConnected = false;
    updateConnectionStatus('Offline mode', 'disconnected');
    showTranslationHint('Running in offline mode');
  }
}

function updateConnectionStatus(message, status) {
  elements.statusText.textContent = message;
  elements.statusIndicator.className = `status-indicator ${status}`;
}

// ====== MESSAGE HANDLING ======
function handleSendMessage() {
  const message = elements.messageInput.value.trim();
  
  // Validation
  if (!message) {
    showTranslationHint('Please enter a message to translate');
    return;
  }
  
  if (message.length > 500) {
    showTranslationHint('Message too long. Please limit to 500 characters.');
    return;
  }
  
  if (appState.sourceLang === appState.targetLang) {
    showTranslationHint('Please select different languages for translation');
    return;
  }
  
  // Add user message
  addUserMessage(message);
  
  // Show typing indicator
  showTypingIndicator();
  
  // Clear input
  elements.messageInput.value = '';
  updateCharCount();
  
  // Send to server via socket.io
  if (appState.socket && appState.isConnected) {
    console.log('📤 Sending message to server:', {
      message: message,
      sourceLang: appState.sourceLang,
      targetLang: appState.targetLang
    });
    
    // Send to real translation server
    appState.socket.emit('sendMessage', {
      message: message,
      sourceLang: appState.sourceLang,
      targetLang: appState.targetLang
    });
    
    // Set timeout for no response
    setTimeout(() => {
      if (appState.isTranslating) {
        hideTypingIndicator();
        showTranslationHint('Translation taking longer than expected...');
      }
    }, 10000);
    
  } else {
    // Fallback if server is offline
    console.warn('Server offline, using fallback');
    showTranslationHint('Server offline. Please start the backend server.');
    hideTypingIndicator();
    addErrorMessage('Cannot connect to translation server. Please make sure the backend server is running.');
  }
}

function addUserMessage(message) {
  const messageId = `user-${Date.now()}`;
  const li = document.createElement('li');
  
  li.innerHTML = `
    <div class="message-bubble user" id="${messageId}">
      <div class="message-header">
        <i class="fas fa-user"></i>
        <span>You</span>
        <span class="message-time">${getCurrentTime()}</span>
      </div>
      <div class="message-content">
        <div class="message-original">
          <strong>Original (${CONFIG.SUPPORTED_LANGUAGES[appState.sourceLang].name}):</strong> ${escapeHtml(message)}
        </div>
      </div>
      <div class="message-meta">
        <span class="message-label">Your message</span>
      </div>
    </div>
  `;
  
  elements.chatMessages.appendChild(li);
  scrollToBottom();
  updateMessageCount();
}

function addSystemMessage(original, translation) {
  const messageId = `system-${Date.now()}`;
  const li = document.createElement('li');
  
  li.innerHTML = `
    <div class="message-bubble system" id="${messageId}">
      <div class="message-header">
        <i class="fas fa-robot"></i>
        <span>LinguaBridge AI</span>
        <span class="message-time">${getCurrentTime()}</span>
      </div>
      <div class="message-content">
        <div class="message-original">
          <strong>Original (${CONFIG.SUPPORTED_LANGUAGES[appState.sourceLang].name}):</strong> ${escapeHtml(original)}
        </div>
        <div class="message-translation">
          <strong>Translated (${CONFIG.SUPPORTED_LANGUAGES[appState.targetLang].name}):</strong> ${escapeHtml(translation)}
        </div>
      </div>
      <div class="message-meta">
        <span class="message-label">AI Translation</span>
        <div class="message-actions">
          <button class="copy-button" onclick="copyToClipboard('${escapeHtml(translation.replace(/'/g, "\\'"))}')" aria-label="Copy translation">
            <i class="fas fa-copy"></i>
            <span>Copy</span>
          </button>
        </div>
      </div>
    </div>
  `;
  
  elements.chatMessages.appendChild(li);
  scrollToBottom();
  updateMessageCount();
}

function addErrorMessage(message) {
  const messageId = `error-${Date.now()}`;
  const li = document.createElement('li');
  
  li.innerHTML = `
    <div class="message-bubble error" id="${messageId}">
      <div class="message-content">
        <i class="fas fa-exclamation-circle"></i> ${escapeHtml(message)}
      </div>
      <div class="message-time">${getCurrentTime()}</div>
    </div>
  `;
  
  elements.chatMessages.appendChild(li);
  scrollToBottom();
  updateMessageCount();
}

// ====== UI CONTROLS ======
function showTypingIndicator() {
  appState.isTranslating = true;
  elements.typingIndicator.classList.add('active');
  elements.sendButton.disabled = true;
  elements.sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Translating...</span>';
}

function hideTypingIndicator() {
  appState.isTranslating = false;
  elements.typingIndicator.classList.remove('active');
  elements.sendButton.disabled = false;
  elements.sendButton.innerHTML = '<i class="fas fa-paper-plane"></i><span>Send</span>';
}

function updateCharCount() {
  const length = elements.messageInput.value.length;
  elements.charCount.textContent = length;
  
  // Change color based on length
  if (length > 450) {
    elements.charCount.style.color = 'var(--error-color)';
  } else if (length > 350) {
    elements.charCount.style.color = 'var(--warning-color)';
  } else {
    elements.charCount.style.color = '';
  }
}

function updateMessageCount() {
  const count = elements.chatMessages.children.length;
  appState.messageCount = count;
  elements.messageCount.textContent = `${count} ${count === 1 ? 'message' : 'messages'}`;
}

function clearChat() {
  if (appState.messageCount <= 1) return; // Don't clear welcome message
  
  if (confirm('Are you sure you want to clear all messages?')) {
    // Keep only welcome message
    const welcomeMsg = elements.chatMessages.querySelector('.welcome-message');
    elements.chatMessages.innerHTML = '';
    if (welcomeMsg) {
      elements.chatMessages.appendChild(welcomeMsg);
    }
    
    updateMessageCount();
    showToast('Chat cleared successfully');
  }
}

// ====== CLIPBOARD FUNCTIONALITY ======
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Translation copied to clipboard!');
  }).catch(err => {
    console.error('Failed to copy: ', err);
    showToast('Failed to copy translation');
  });
}

function showToast(message) {
  const toast = elements.successToast;
  const toastMessage = toast.querySelector('.toast-message');
  
  toastMessage.textContent = message;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// ====== UTILITY FUNCTIONS ======
function scrollToBottom() {
  requestAnimationFrame(() => {
    elements.chatBox.scrollTop = elements.chatBox.scrollHeight;
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML.replace(/'/g, "&#39;").replace(/"/g, "&quot;");
}

function getCurrentTime() {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function updateStatus(message) {
  // This function updates the status in translation hint
  showTranslationHint(message);
}

// ====== EVENT LISTENERS ======
function setupEventListeners() {
  // Hero intro
  elements.startChatting?.addEventListener('click', () => {
    elements.heroIntro.classList.add('hidden');
    elements.messageInput.focus();
  });
  
  // Theme toggle
  elements.themeToggle.addEventListener('click', toggleTheme);
  
  // Language selection
  setupLanguageSelection();
  
  // Language swap
  elements.swapLanguages.addEventListener('click', swapLanguages);
  
  // Send message
  elements.sendButton.addEventListener('click', handleSendMessage);
  
  // Clear input
  elements.clearButton.addEventListener('click', () => {
    elements.messageInput.value = '';
    elements.messageInput.focus();
    updateCharCount();
  });
  
  // Clear chat
  elements.clearChat.addEventListener('click', clearChat);
  
  // Input handling
  elements.messageInput.addEventListener('input', updateCharCount);
  
  elements.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });
  
  // Allow Shift+Enter for new line
  elements.messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
    }
  });
}

// ====== GLOBAL FUNCTIONS (accessible from HTML onclick) ======
window.copyToClipboard = copyToClipboard;

// ====== INITIALIZE APP ======
document.addEventListener('DOMContentLoaded', init);