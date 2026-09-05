/**
 * WanderWise AI - Application Controller
 * Coordinates UI events, parameter switching, message streaming, audio, and state
 */

document.addEventListener("DOMContentLoaded", () => {
  const storedModel = localStorage.getItem(CONFIG.storageKeys.model);
  const isValidModel = CONFIG.models.some(m => m.id === storedModel);
  const currentModel = isValidModel ? storedModel : CONFIG.defaultSettings.model;
  localStorage.setItem(CONFIG.storageKeys.model, currentModel);

  // Application State
  const state = {
    persona: localStorage.getItem(CONFIG.storageKeys.persona) || CONFIG.defaultSettings.persona,
    tone: localStorage.getItem(CONFIG.storageKeys.tone) || CONFIG.defaultSettings.tone,
    temperature: parseFloat(localStorage.getItem(CONFIG.storageKeys.temperature)) || CONFIG.defaultSettings.temperature,
    memoryTurns: (localStorage.getItem(CONFIG.storageKeys.memoryTurns) === null || localStorage.getItem(CONFIG.storageKeys.memoryTurns) === "8")
      ? CONFIG.defaultSettings.memoryTurns
      : parseInt(localStorage.getItem(CONFIG.storageKeys.memoryTurns), 10),
    model: currentModel,
    soundEnabled: localStorage.getItem(CONFIG.storageKeys.soundEnabled) !== "false",
    theme: localStorage.getItem(CONFIG.storageKeys.theme) || CONFIG.defaultSettings.theme,
    isGenerating: false,
    isRecording: false,
    recordingCancelled: false,
    attachedFile: null
  };

  // Configure marked with highlight.js
  if (window.marked) {
    marked.setOptions({
      highlight: function (code, lang) {
        if (window.hljs) {
          const validLanguage = hljs.getLanguage(lang) ? lang : "plaintext";
          return hljs.highlight(code, { language: validLanguage }).value;
        }
        return code;
      },
      breaks: true,
      gfm: true
    });
  }

  // DOM Elements
  const DOM = {
    // Nav & Telemetry
    sidebarToggleBtn: document.getElementById("sidebarToggleBtn"),
    paramsToggleBtn: document.getElementById("paramsToggleBtn"),
    brandLogo: document.getElementById("brandLogo"),
    activeModelLabel: document.getElementById("activeModelLabel"),
    activePersonaPill: document.getElementById("activePersonaPill"),
    activeTonePill: document.getElementById("activeTonePill"),
    telemetryModel: document.getElementById("telemetryModel"),
    telemetryLatency: document.getElementById("telemetryLatency"),
    telemetryTokens: document.getElementById("telemetryTokens"),
    themeToggleBtn: document.getElementById("themeToggleBtn"),
    themeIconSun: document.getElementById("themeIconSun"),
    themeIconMoon: document.getElementById("themeIconMoon"),
    soundToggleBtn: document.getElementById("soundToggleBtn"),
    soundIconOn: document.getElementById("soundIconOn"),
    soundIconOff: document.getElementById("soundIconOff"),
    exportBtn: document.getElementById("exportBtn"),
    clearChatBtn: document.getElementById("clearChatBtn"),
    openSettingsBtn: document.getElementById("openSettingsBtn"),
    apiKeyBtnText: document.getElementById("apiKeyBtnText"),

    // Sidebar
    sidebar: document.getElementById("sidebar"),
    newChatBtn: document.getElementById("newChatBtn"),
    sessionsList: document.getElementById("sessionsList"),

    // Main Chat
    messagesContainer: document.getElementById("messagesContainer"),
    chatInput: document.getElementById("chatInput"),
    sendBtn: document.getElementById("sendBtn"),
    stopBtn: document.getElementById("stopBtn"),

    // Multimodal Attachment Elements (Foto, Rekam Suara Langsung, Dokumen)
    attachImageBtn: document.getElementById("attachImageBtn"),
    recordVoiceBtn: document.getElementById("recordVoiceBtn"),
    attachDocBtn: document.getElementById("attachDocBtn"),
    imageInput: document.getElementById("imageInput"),
    audioInput: document.getElementById("audioInput"),
    docInput: document.getElementById("docInput"),
    attachedFilePreview: document.getElementById("attachedFilePreview"),
    filePreviewIcon: document.getElementById("filePreviewIcon"),
    filePreviewName: document.getElementById("filePreviewName"),
    filePreviewMeta: document.getElementById("filePreviewMeta"),
    removeFileBtn: document.getElementById("removeFileBtn"),
    recordingBar: document.getElementById("recordingBar"),
    recordingTimer: document.getElementById("recordingTimer"),
    recordingTranscriptPreview: document.getElementById("recordingTranscriptPreview"),
    stopRecordBtn: document.getElementById("stopRecordBtn"),
    cancelRecordBtn: document.getElementById("cancelRecordBtn"),

    // Active Param Chips
    chipPersonaIcon: document.getElementById("chipPersonaIcon"),
    chipPersonaText: document.getElementById("chipPersonaText"),
    chipToneText: document.getElementById("chipToneText"),
    chipTempText: document.getElementById("chipTempText"),
    chipMemoryText: document.getElementById("chipMemoryText"),

    // Params Drawer
    paramsDrawer: document.getElementById("paramsDrawer"),
    closeParamsBtn: document.getElementById("closeParamsBtn"),
    personaGrid: document.getElementById("personaGrid"),
    toneGrid: document.getElementById("toneGrid"),
    tempSlider: document.getElementById("tempSlider"),
    tempValDisplay: document.getElementById("tempValDisplay"),
    modelSelect: document.getElementById("modelSelect"),
    memorySelect: document.getElementById("memorySelect"),
    activePersonaBadge: document.getElementById("activePersonaBadge"),
    activeToneBadge: document.getElementById("activeToneBadge"),

    // Modal & Toast
    settingsModal: document.getElementById("settingsModal"),
    closeSettingsBtn: document.getElementById("closeSettingsBtn"),
    cancelSettingsBtn: document.getElementById("cancelSettingsBtn"),
    saveSettingsBtn: document.getElementById("saveSettingsBtn"),
    apiKeyInput: document.getElementById("apiKeyInput"),
    toastContainer: document.getElementById("toastContainer")
  };

  // Initialize Theme
  applyTheme(state.theme);

  // Initialize Sound
  soundFx.setEnabled(state.soundEnabled);
  updateSoundUI();

  // Initialize AIService with current model
  aiService.setModel(state.model);
  updateApiKeyBadge();

  // Attach Event Listeners FIRST so user interactions and buttons are immediately responsive
  try {
    attachEventListeners();
  } catch (err) {
    console.error("Gagal memasang event listeners:", err);
  }

  // Render Parameters & Sessions safely
  try { renderPersonaOptions(); } catch (e) { console.error("renderPersonaOptions:", e); }
  try { renderToneOptions(); } catch (e) { console.error("renderToneOptions:", e); }
  try { renderModelSelect(); } catch (e) { console.error("renderModelSelect:", e); }
  try { renderMemorySelect(); } catch (e) { console.error("renderMemorySelect:", e); }
  try { renderSessions(); } catch (e) { console.error("renderSessions:", e); }
  try { renderMessages(); } catch (e) { console.error("renderMessages:", e); }
  try { updateHeaderAndChips(); } catch (e) { console.error("updateHeaderAndChips:", e); }

  // =========================================================================
  // Rendering Functions
  // =========================================================================

  function renderPersonaOptions() {
    DOM.personaGrid.innerHTML = "";
    Object.values(CONFIG.personas).forEach(persona => {
      const card = document.createElement("div");
      card.className = `persona-card ${state.persona === persona.id ? "active" : ""}`;
      card.dataset.personaId = persona.id;
      card.innerHTML = `
        <div class="persona-icon">${persona.icon}</div>
        <div class="persona-info">
          <div class="persona-name">${persona.name}</div>
          <div class="persona-tagline">${persona.tagline}</div>
        </div>
      `;

      card.addEventListener("click", () => {
        soundFx.playClick();
        state.persona = persona.id;
        localStorage.setItem(CONFIG.storageKeys.persona, persona.id);
        renderPersonaOptions();
        updateHeaderAndChips();
        showToast(`Persona: ${persona.name}`);
      });

      DOM.personaGrid.appendChild(card);
    });
  }

  function renderToneOptions() {
    DOM.toneGrid.innerHTML = "";
    Object.values(CONFIG.tones).forEach(tone => {
      const btn = document.createElement("button");
      btn.className = `tone-btn ${state.tone === tone.id ? "active" : ""}`;
      btn.dataset.toneId = tone.id;
      btn.innerHTML = `
        <span class="tone-name">${tone.name}</span>
        <span class="tone-desc">${tone.desc || tone.badge}</span>
      `;

      btn.addEventListener("click", () => {
        soundFx.playClick();
        state.tone = tone.id;
        localStorage.setItem(CONFIG.storageKeys.tone, tone.id);
        renderToneOptions();
        updateHeaderAndChips();
        showToast(`Tone: ${tone.name}`);
      });

      DOM.toneGrid.appendChild(btn);
    });
  }

  function renderModelSelect() {
    DOM.modelSelect.innerHTML = "";
    CONFIG.models.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = `${m.name} (${m.badge})`;
      if (m.id === state.model) opt.selected = true;
      DOM.modelSelect.appendChild(opt);
    });
  }

  function renderMemorySelect() {
    DOM.memorySelect.value = state.memoryTurns.toString();
  }

  function updateHeaderAndChips() {
    const persona = CONFIG.personas[state.persona] || CONFIG.personas.backpacker;
    const tone = CONFIG.tones[state.tone] || CONFIG.tones.santai;
    const model = CONFIG.models.find(m => m.id === state.model) || CONFIG.models[0];

    // Nav Pills
    DOM.activeModelLabel.textContent = model.name;
    DOM.activePersonaPill.textContent = `${persona.icon} ${persona.name.split(" ")[0]}`;
    DOM.activeTonePill.textContent = tone.name.split(" ")[0];

    // Badges in Drawer
    DOM.activePersonaBadge.textContent = persona.name;
    DOM.activeToneBadge.textContent = tone.name;
    DOM.tempValDisplay.textContent = state.temperature.toFixed(1);
    DOM.tempSlider.value = state.temperature;

    // Bottom Chips
    DOM.chipPersonaIcon.textContent = persona.icon;
    DOM.chipPersonaText.textContent = persona.name;
    DOM.chipToneText.textContent = tone.name;
    DOM.chipTempText.textContent = state.temperature.toFixed(1);
    DOM.chipMemoryText.textContent = state.memoryTurns === 0 ? "Full" : `${state.memoryTurns}P`;

    // Telemetry
    DOM.telemetryModel.textContent = state.model;
  }

  async function updateApiKeyBadge() {
    const health = await aiService.checkServerHealth();
    if (health.hasApiKey) {
      DOM.apiKeyBtnText.textContent = "API Key (.env)";
      DOM.openSettingsBtn.classList.remove("btn-secondary");
      DOM.openSettingsBtn.classList.add("btn-primary");
    } else if (aiService.hasApiKey()) {
      DOM.apiKeyBtnText.textContent = "API Key Active";
      DOM.openSettingsBtn.classList.remove("btn-secondary");
      DOM.openSettingsBtn.classList.add("btn-primary");
    } else {
      DOM.apiKeyBtnText.textContent = "Set API Key";
      DOM.openSettingsBtn.classList.remove("btn-primary");
      DOM.openSettingsBtn.classList.add("btn-secondary");
    }
  }

  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(CONFIG.storageKeys.theme, theme);

    if (DOM.themeIconSun && DOM.themeIconMoon) {
      if (theme === "light") {
        DOM.themeIconSun.style.display = "none";
        DOM.themeIconMoon.style.display = "block";
      } else {
        DOM.themeIconSun.style.display = "block";
        DOM.themeIconMoon.style.display = "none";
      }
    }
  }

  function updateSoundUI() {
    if (state.soundEnabled) {
      DOM.soundIconOn.style.display = "block";
      DOM.soundIconOff.style.display = "none";
      DOM.soundToggleBtn.classList.add("active");
    } else {
      DOM.soundIconOn.style.display = "none";
      DOM.soundIconOff.style.display = "block";
      DOM.soundToggleBtn.classList.remove("active");
    }
  }

  function renderSessions() {
    const activeSession = chatManager.getActiveSession();
    DOM.sessionsList.innerHTML = "";

    chatManager.sessions.forEach(session => {
      const item = document.createElement("div");
      item.className = `session-item ${session.id === activeSession.id ? "active" : ""}`;
      item.dataset.sessionId = session.id;

      item.innerHTML = `
        <div class="session-title-wrap">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span class="session-title" title="${session.title}">${escapeHTML(session.title)}</span>
        </div>
        <div class="session-actions">
          <button class="session-btn rename" title="Ganti Nama Rencana">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </button>
          <button class="session-btn delete" title="Hapus Rencana">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
          </button>
        </div>
      `;

      item.querySelector(".session-title-wrap").addEventListener("click", () => {
        if (state.isGenerating) return;
        soundFx.playClick();
        chatManager.switchSession(session.id);
        renderSessions();
        renderMessages();
      });

      item.querySelector(".session-btn.rename").addEventListener("click", (e) => {
        e.stopPropagation();
        const newTitle = prompt("Masukkan nama baru untuk rencana perjalanan ini:", session.title);
        if (newTitle && newTitle.trim()) {
          chatManager.renameSession(session.id, newTitle);
          renderSessions();
        }
      });

      item.querySelector(".session-btn.delete").addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm(`Hapus rencana "${session.title}"?`)) {
          soundFx.playClear();
          chatManager.deleteSession(session.id);
          renderSessions();
          renderMessages();
          showToast("Rencana perjalanan dihapus");
        }
      });

      DOM.sessionsList.appendChild(item);
    });
  }

  function renderMessages() {
    const session = chatManager.getActiveSession();
    DOM.messagesContainer.innerHTML = "";

    if (!session.messages || session.messages.length === 0) {
      renderWelcomeHero();
      return;
    }

    session.messages.forEach(msg => {
      appendMessageToDOM(msg, false);
    });

    scrollToBottom();
  }

  function renderWelcomeHero() {
    const hero = document.createElement("div");
    hero.className = "welcome-hero";
    hero.innerHTML = `
      <div class="hero-glow-logo">✈️</div>
      <h2 class="hero-title">SuperB <span>Travel Assistant</span></h2>
      <p class="hero-subtitle">
        Rancang liburan impian, estimasi budget, dan kurasi tempat terbaik dengan kendali parameter instan.
      </p>

      <div class="quick-prompts-grid" id="quickPromptsGrid">
        <!-- Quick prompt cards -->
      </div>
    `;

    const promptsGrid = hero.querySelector("#quickPromptsGrid");
    CONFIG.quickPrompts.forEach(p => {
      const card = document.createElement("div");
      card.className = "prompt-card";
      card.innerHTML = `
        <div class="prompt-header">
          <span>${p.icon}</span>
          <span>${p.category}</span>
        </div>
        <div class="prompt-title">${p.title}</div>
      `;

      card.addEventListener("click", () => {
        soundFx.playClick();
        DOM.chatInput.value = p.prompt;
        autoGrowTextarea();
        DOM.chatInput.focus();
      });

      promptsGrid.appendChild(card);
    });

    DOM.messagesContainer.appendChild(hero);
  }

  function appendMessageToDOM(msg, shouldScroll = true) {
    const hero = DOM.messagesContainer.querySelector(".welcome-hero");
    if (hero) hero.remove();

    const isUser = msg.role === "user";
    const row = document.createElement("div");
    row.className = `message-row ${isUser ? "user" : "assistant"}`;
    row.id = msg.id;

    const timeStr = new Date(msg.timestamp || Date.now()).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit"
    });

    const persona = CONFIG.personas[state.persona] || CONFIG.personas.backpacker;
    const avatarContent = isUser ? "👤" : (persona.icon || "✈️");

    let formattedContent = "";
    if (isUser) {
      formattedContent = `<p>${escapeHTML(msg.content).replace(/\n/g, "<br>")}</p>`;
    } else {
      formattedContent = formatMarkdown(msg.content);
    }

    let attachmentHTML = "";
    if (msg.attachment) {
      if (msg.attachment.type === "image" && msg.attachment.dataUrl) {
        attachmentHTML = `
          <div class="msg-attachment">
            <img src="${msg.attachment.dataUrl}" class="msg-attachment-img" alt="${escapeHTML(msg.attachment.name || 'Foto Destinasi')}">
          </div>
        `;
      } else if (msg.attachment.type === "audio" && msg.attachment.dataUrl) {
        attachmentHTML = `
          <div class="msg-attachment">
            <audio controls src="${msg.attachment.dataUrl}" class="msg-attachment-audio"></audio>
          </div>
        `;
      } else if (msg.attachment.type === "document") {
        attachmentHTML = `
          <div class="msg-attachment">
            <div class="msg-attachment-doc">
              <span style="font-size: 1.25rem;">📄</span>
              <span><b>${escapeHTML(msg.attachment.name || 'Dokumen')}</b> (${msg.attachment.sizeFormatted || "Dokumen"})</span>
            </div>
          </div>
        `;
      }
    }

    row.innerHTML = `
      <div class="avatar ${isUser ? "user" : "bot"}">${avatarContent}</div>
      <div class="message-bubble">
        <div class="message-meta">
          <span style="font-weight: 600;">${isUser ? "Anda" : CONFIG.appName}</span>
          ${!isUser && msg.persona ? `<span style="color: var(--accent-cyan);">• ${msg.persona}</span>` : ""}
          <span>${timeStr}</span>
        </div>
        <div class="message-content">
          ${attachmentHTML}
          ${formattedContent}
        </div>
        ${!isUser ? `
          <div class="message-footer">
            <button class="msg-action-btn copy-msg-btn" title="Salin seluruh isi rencana">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              <span>Salin Itinerary</span>
            </button>
            ${msg.latencyMs ? `<span style="font-size: 0.7rem; color: var(--text-muted); font-family: var(--font-mono);">${msg.latencyMs}ms</span>` : ""}
          </div>
        ` : ""}
      </div>
    `;

    const copyBtn = row.querySelector(".copy-msg-btn");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(msg.content);
        soundFx.playClick();
        showToast("Rencana perjalanan berhasil disalin!");
      });
    }

    enhanceCodeBlocks(row);

    DOM.messagesContainer.appendChild(row);

    if (shouldScroll) {
      scrollToBottom();
    }

    return row;
  }

  function formatMarkdown(content) {
    if (!content) return "";
    if (window.marked) {
      try {
        return marked.parse(content);
      } catch (e) {
        console.error("Markdown parse error:", e);
      }
    }
    return escapeHTML(content).replace(/\n/g, "<br>");
  }

  function enhanceCodeBlocks(container) {
    const preElements = container.querySelectorAll("pre");
    preElements.forEach(pre => {
      if (pre.parentElement.classList.contains("code-wrapper")) return;

      const codeElem = pre.querySelector("code");
      const rawText = codeElem ? codeElem.innerText : pre.innerText;

      let lang = "itinerary";
      if (codeElem && codeElem.className) {
        const match = codeElem.className.match(/language-([a-zA-Z0-9_\-]+)/);
        if (match) lang = match[1];
      }

      const wrapper = document.createElement("div");
      wrapper.className = "code-wrapper";

      const header = document.createElement("div");
      header.className = "code-header";
      header.innerHTML = `
        <span class="code-lang">${lang}</span>
        <button class="copy-code-btn" type="button">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
          <span>Copy Snippet</span>
        </button>
      `;

      header.querySelector(".copy-code-btn").addEventListener("click", function () {
        navigator.clipboard.writeText(rawText);
        soundFx.playClick();
        const btnSpan = this.querySelector("span");
        const prevText = btnSpan.textContent;
        btnSpan.textContent = "Tersalin! ✓";
        this.style.color = "var(--accent-emerald)";
        setTimeout(() => {
          btnSpan.textContent = prevText;
          this.style.color = "";
        }, 1500);
      });

      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(header);
      wrapper.appendChild(pre);
    });
  }

  // =========================================================================
  // Multimodal File Attachment & Live Voice Recording
  // =========================================================================

  let mediaRecorder = null;
  let audioChunks = [];
  let recordingInterval = null;
  let recordingSeconds = 0;
  let mediaStream = null;
  let speechRecognizer = null;
  let liveSpeechTranscript = "";

  function initSpeechRecognizer() {
    if (typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      try {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        speechRecognizer = new SpeechRec();
        speechRecognizer.lang = "id-ID";
        speechRecognizer.continuous = true;
        speechRecognizer.interimResults = true;

        speechRecognizer.onresult = (event) => {
          let full = "";
          for (let i = 0; i < event.results.length; ++i) {
            full += event.results[i][0].transcript + " ";
          }
          liveSpeechTranscript = full.trim();
          if (DOM.recordingTranscriptPreview) {
            DOM.recordingTranscriptPreview.textContent = liveSpeechTranscript ? `"${liveSpeechTranscript}"` : "(Bicara sekarang...)";
          }
        };

        speechRecognizer.onerror = (e) => {
          console.warn("Speech recognition error:", e.error);
        };
      } catch (err) {
        console.warn("Inisialisasi SpeechRecognition dilewati:", err);
      }
    }
  }

  async function startLiveVoiceRecording() {
    if (state.isRecording) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast("Browser tidak mendukung perekaman langsung. Membuka pemilih berkas...", "error");
      if (DOM.audioInput) DOM.audioInput.click();
      return;
    }

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      recordingSeconds = 0;
      liveSpeechTranscript = "";

      if (DOM.recordingTranscriptPreview) {
        DOM.recordingTranscriptPreview.textContent = "(Bicara sekarang...)";
      }

      if (!speechRecognizer) {
        initSpeechRecognizer();
      }
      if (speechRecognizer) {
        try { speechRecognizer.start(); } catch (e) {}
      }

      let mimeType = "audio/webm";
      if (typeof MediaRecorder !== "undefined") {
        if (!MediaRecorder.isTypeSupported("audio/webm")) {
          if (MediaRecorder.isTypeSupported("audio/ogg")) mimeType = "audio/ogg";
          else if (MediaRecorder.isTypeSupported("audio/mp4")) mimeType = "audio/mp4";
          else mimeType = "";
        }
      }

      mediaRecorder = mimeType ? new MediaRecorder(mediaStream, { mimeType }) : new MediaRecorder(mediaStream);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (state.recordingCancelled) {
          state.recordingCancelled = false;
          return;
        }

        const blobType = mediaRecorder.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunks, { type: blobType });
        const ext = blobType.includes("ogg") ? "ogg" : blobType.includes("mp4") ? "mp4" : "webm";
        const audioFile = new File([audioBlob], `rekaman-suara-${Date.now()}.${ext}`, { type: blobType });

        const finalTranscript = liveSpeechTranscript.trim();
        handleFileSelected(audioFile, "audio", { transcript: finalTranscript });
      };

      mediaRecorder.start(250);
      state.isRecording = true;
      state.recordingCancelled = false;

      if (DOM.recordingBar) DOM.recordingBar.style.display = "flex";
      if (DOM.recordVoiceBtn) DOM.recordVoiceBtn.classList.add("recording");
      if (DOM.recordingTimer) DOM.recordingTimer.textContent = "00:00";

      recordingInterval = setInterval(() => {
        recordingSeconds++;
        const mins = String(Math.floor(recordingSeconds / 60)).padStart(2, "0");
        const secs = String(recordingSeconds % 60).padStart(2, "0");
        if (DOM.recordingTimer) DOM.recordingTimer.textContent = `${mins}:${secs}`;
      }, 1000);

      soundFx.playClick();
      showToast("Sedang merekam suara... Silakan bicara!");
    } catch (err) {
      console.warn("Microphone access error:", err);
      showToast("Akses mikrofon tidak diizinkan. Membuka pemilih berkas...", "error");
      if (DOM.audioInput) DOM.audioInput.click();
    }
  }

  function stopLiveVoiceRecording() {
    if (!state.isRecording || !mediaRecorder) return;
    clearInterval(recordingInterval);
    recordingInterval = null;

    if (speechRecognizer) {
      try { speechRecognizer.stop(); } catch (e) {}
    }

    state.isRecording = false;
    if (DOM.recordingBar) DOM.recordingBar.style.display = "none";
    if (DOM.recordVoiceBtn) DOM.recordVoiceBtn.classList.remove("recording");

    if (mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
    }

    soundFx.playClick();
  }

  function cancelLiveVoiceRecording() {
    if (!state.isRecording) return;
    state.recordingCancelled = true;
    clearInterval(recordingInterval);
    recordingInterval = null;

    if (speechRecognizer) {
      try { speechRecognizer.stop(); } catch (e) {}
    }

    state.isRecording = false;
    audioChunks = [];
    liveSpeechTranscript = "";
    if (DOM.recordingBar) DOM.recordingBar.style.display = "none";
    if (DOM.recordVoiceBtn) DOM.recordVoiceBtn.classList.remove("recording");

    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
    }

    soundFx.playClear();
    showToast("Rekaman dibatalkan");
  }

  async function handleFileSelected(file, type, extra = {}) {
    if (!file) return;

    // Filter ketat sesuai tipe berkas
    if (type === "image") {
      const isImg = file.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(file.name);
      if (!isImg) {
        showToast("Harap pilih berkas gambar (JPG, PNG, WebP)", "error");
        return;
      }
    } else if (type === "document") {
      const isDoc = /\.(pdf|doc|docx|txt|csv|xls|xlsx)$/i.test(file.name) ||
                    file.type.includes("pdf") || file.type.includes("word") ||
                    file.type.includes("document") || file.type.includes("sheet") ||
                    file.type.includes("text") || file.type.includes("msword");
      if (!isDoc) {
        showToast("Harap pilih berkas dokumen (PDF, Word, TXT, Excel)", "error");
        return;
      }
    } else if (type === "audio") {
      const isAudio = file.type.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|webm|aac)$/i.test(file.name);
      if (!isAudio) {
        showToast("Harap gunakan rekaman suara atau berkas audio", "error");
        return;
      }
    }

    if (file.size > 25 * 1024 * 1024) {
      showToast("Ukuran berkas maksimal 25 MB", "error");
      return;
    }

    // Ekstraksi teks dokumen langsung di peramban jika berkas berbasis teks
    let extractedText = extra.extractedText || "";
    if (type === "document" && !extractedText && (file.type.startsWith("text/") || /\.(txt|csv|md|json)$/i.test(file.name))) {
      try {
        extractedText = await file.text();
      } catch (err) {
        console.warn("Gagal membaca teks berkas dokumen:", err);
      }
    }

    const sizeFormatted = formatFileSize(file.size);
    let icon = "📄";
    let metaText = `Dokumen • ${sizeFormatted}`;

    if (type === "image") {
      icon = "🖼️";
      metaText = `Foto Destinasi (OCR Aktif) • ${sizeFormatted}`;
    } else if (type === "audio") {
      icon = "🎙️";
      const transcriptSummary = extra.transcript ? ` • "${extra.transcript.slice(0, 30)}..."` : "";
      metaText = `Rekaman Suara (${sizeFormatted})${transcriptSummary}`;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      state.attachedFile = {
        file: file,
        type: type,
        name: file.name,
        size: file.size,
        sizeFormatted: sizeFormatted,
        dataUrl: e.target.result,
        transcript: extra.transcript || "",
        extractedText: extractedText
      };

      if (DOM.filePreviewIcon) DOM.filePreviewIcon.textContent = icon;
      if (DOM.filePreviewName) DOM.filePreviewName.textContent = file.name;
      if (DOM.filePreviewMeta) DOM.filePreviewMeta.textContent = metaText;
      if (DOM.attachedFilePreview) DOM.attachedFilePreview.style.display = "flex";

      if (DOM.attachImageBtn) DOM.attachImageBtn.classList.toggle("active", type === "image");
      if (DOM.recordVoiceBtn) DOM.recordVoiceBtn.classList.toggle("active", type === "audio");
      if (DOM.attachDocBtn) DOM.attachDocBtn.classList.toggle("active", type === "document");

      // Jika ada transkrip rekaman suara dan input masih kosong, tampilkan transkrip di input
      if (type === "audio" && extra.transcript && !DOM.chatInput.value.trim()) {
        DOM.chatInput.value = extra.transcript;
        autoGrowTextarea();
      }

      soundFx.playClick();
      showToast(`${file.name} siap dikirim!`);
      DOM.chatInput.focus();
    };

    reader.readAsDataURL(file);
  }

  function clearAttachedFile() {
    state.attachedFile = null;
    if (DOM.imageInput) DOM.imageInput.value = "";
    if (DOM.audioInput) DOM.audioInput.value = "";
    if (DOM.docInput) DOM.docInput.value = "";
    if (DOM.attachedFilePreview) DOM.attachedFilePreview.style.display = "none";
    if (DOM.attachImageBtn) DOM.attachImageBtn.classList.remove("active");
    if (DOM.recordVoiceBtn) DOM.recordVoiceBtn.classList.remove("active");
    if (DOM.attachDocBtn) DOM.attachDocBtn.classList.remove("active");
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  // =========================================================================
  // Send & Stream Message Logic
  // =========================================================================

  async function handleSendMessage() {
    const text = DOM.chatInput.value.trim();
    const hasAttachment = Boolean(state.attachedFile);
    if ((!text && !hasAttachment) || state.isGenerating) return;

    soundFx.playSent();

    const currentAttachment = state.attachedFile ? { ...state.attachedFile } : null;
    clearAttachedFile();

    const displayPrompt = text || (currentAttachment ? `Analisis berkas ${currentAttachment.name}` : "");
    const userMsg = chatManager.addMessage("user", displayPrompt, {
      attachment: currentAttachment
    });
    appendMessageToDOM(userMsg, true);

    // Capture conversation history ending with user message (Gemini API requires request to end with a user turn)
    const historyForAI = chatManager.getRecentMessages(state.memoryTurns);

    DOM.chatInput.value = "";
    autoGrowTextarea();
    renderSessions();

    const persona = CONFIG.personas[state.persona] || CONFIG.personas.backpacker;
    const botPlaceholder = chatManager.addMessage("assistant", "", {
      persona: persona.name,
      model: state.model
    });
    const botRow = appendMessageToDOM(botPlaceholder, true);
    const botContentElem = botRow.querySelector(".message-content");

    botContentElem.innerHTML = `
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;

    setGeneratingState(true);

    let accumulatedText = "";

    try {
      let responseData;

      if (currentAttachment) {
        // Panggil endpoint multimodal sesuai tipe berkas (/generate-from-image, /generate-from-audio, /generate-from-document)
        responseData = await aiService.generateFromMedia({
          file: currentAttachment.file,
          mediaType: currentAttachment.type,
          prompt: text || currentAttachment.transcript || "",
          persona: state.persona,
          tone: state.tone,
          temperature: state.temperature,
          extra: {
            transcript: currentAttachment.transcript,
            extractedText: currentAttachment.extractedText
          },
          onChunk: (chunk, acc) => {
            accumulatedText = acc;
            botContentElem.innerHTML = formatMarkdown(accumulatedText);
            enhanceCodeBlocks(botRow);
            scrollToBottom();
          }
        });
      } else {
        // Panggil endpoint percakapan standar (/api/chat)
        responseData = await aiService.generateResponse({
          messages: historyForAI,
          persona: state.persona,
          tone: state.tone,
          temperature: state.temperature,
          memoryTurns: state.memoryTurns,
          onChunk: (chunk, acc) => {
            accumulatedText = acc;
            botContentElem.innerHTML = formatMarkdown(accumulatedText);
            enhanceCodeBlocks(botRow);
            scrollToBottom();
          }
        });
      }

      soundFx.playReceived();

      chatManager.updateLastMessage(responseData.text, {
        latencyMs: responseData.latencyMs,
        tokens: responseData.tokens,
        model: responseData.model
      });

      DOM.telemetryLatency.textContent = `${responseData.latencyMs}ms`;
      DOM.telemetryTokens.textContent = `~${responseData.tokens}`;
      DOM.telemetryModel.textContent = responseData.model;

      botContentElem.innerHTML = formatMarkdown(responseData.text);
      enhanceCodeBlocks(botRow);

      const footer = botRow.querySelector(".message-footer");
      if (footer) {
        footer.innerHTML = `
          <button class="msg-action-btn copy-msg-btn" title="Salin seluruh isi rencana">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            <span>Salin Itinerary</span>
          </button>
          <span style="font-size: 0.7rem; color: var(--text-muted); font-family: var(--font-mono);">${responseData.latencyMs}ms</span>
        `;
        footer.querySelector(".copy-msg-btn").addEventListener("click", () => {
          navigator.clipboard.writeText(responseData.text);
          soundFx.playClick();
          showToast("Rencana perjalanan berhasil disalin!");
        });
      }

    } catch (err) {
      soundFx.playError();
      console.error("Travel Generation Error:", err);
      const errorMsg = `> ⚠️ **Terjadi Kendala**: ${err.message || "Gagal menyusun rencana perjalanan."}`;
      chatManager.updateLastMessage(errorMsg);
      botContentElem.innerHTML = formatMarkdown(errorMsg);
      showToast(err.message || "Terjadi kesalahan!", "error");
    } finally {
      setGeneratingState(false);
      DOM.chatInput.focus();
    }
  }

  function setGeneratingState(generating) {
    state.isGenerating = generating;
    if (generating) {
      DOM.sendBtn.style.display = "none";
      DOM.stopBtn.style.display = "flex";
      DOM.chatInput.disabled = true;
    } else {
      DOM.sendBtn.style.display = "flex";
      DOM.stopBtn.style.display = "none";
      DOM.chatInput.disabled = false;
    }
  }

  // =========================================================================
  // Event Listeners & Helpers
  // =========================================================================

  function attachEventListeners() {
    DOM.sendBtn.addEventListener("click", handleSendMessage);
    DOM.stopBtn.addEventListener("click", () => {
      aiService.abort();
      setGeneratingState(false);
      soundFx.playClear();
      showToast("Penyusunan rute dihentikan");
    });

    // Multimodal Attachment Button Listeners (Foto, Rekam Suara Langsung, Dokumen)
    if (DOM.attachImageBtn && DOM.imageInput) {
      DOM.attachImageBtn.addEventListener("click", () => DOM.imageInput.click());
      DOM.imageInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
          handleFileSelected(e.target.files[0], "image");
        }
      });
    }

    if (DOM.recordVoiceBtn) {
      DOM.recordVoiceBtn.addEventListener("click", () => {
        if (state.isRecording) {
          stopLiveVoiceRecording();
        } else {
          startLiveVoiceRecording();
        }
      });
    }

    if (DOM.stopRecordBtn) {
      DOM.stopRecordBtn.addEventListener("click", stopLiveVoiceRecording);
    }

    if (DOM.cancelRecordBtn) {
      DOM.cancelRecordBtn.addEventListener("click", cancelLiveVoiceRecording);
    }

    if (DOM.audioInput) {
      DOM.audioInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
          handleFileSelected(e.target.files[0], "audio");
        }
      });
    }

    if (DOM.attachDocBtn && DOM.docInput) {
      DOM.attachDocBtn.addEventListener("click", () => DOM.docInput.click());
      DOM.docInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
          handleFileSelected(e.target.files[0], "document");
        }
      });
    }

    if (DOM.removeFileBtn) {
      DOM.removeFileBtn.addEventListener("click", () => {
        clearAttachedFile();
        soundFx.playClear();
        showToast("Lampiran dibatalkan");
      });
    }

    DOM.chatInput.addEventListener("input", autoGrowTextarea);
    DOM.chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    });

    DOM.newChatBtn.addEventListener("click", () => {
      if (state.isGenerating) return;
      soundFx.playClear();
      chatManager.createNewSession("Rencana Perjalanan Baru");
      renderSessions();
      renderMessages();
      DOM.chatInput.focus();
      showToast("Sesi rencana liburan baru dimulai");
    });

    window.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        DOM.newChatBtn.click();
      }
    });

    DOM.clearChatBtn.addEventListener("click", () => {
      if (confirm("Bersihkan semua pesan dalam rencana perjalanan ini?")) {
        soundFx.playClear();
        chatManager.clearActiveSession();
        renderMessages();
        showToast("Rencana perjalanan telah dibersihkan");
      }
    });

    DOM.exportBtn.addEventListener("click", () => {
      soundFx.playClick();
      chatManager.exportCurrentChat("markdown");
      showToast("Itinerary diekspor ke format Markdown (.md)");
    });

    // Theme Toggle (Header Button)
    if (DOM.themeToggleBtn) {
      DOM.themeToggleBtn.addEventListener("click", () => {
        soundFx.playClick();
        const next = state.theme === "light" ? "dark" : "light";
        applyTheme(next);
        showToast(`Tema diubah: ${next === "light" ? "Light Mode ☀️" : "Dark Mode 🌙"}`);
      });
    }

    DOM.soundToggleBtn.addEventListener("click", () => {
      state.soundEnabled = !state.soundEnabled;
      soundFx.setEnabled(state.soundEnabled);
      localStorage.setItem(CONFIG.storageKeys.soundEnabled, state.soundEnabled.toString());
      updateSoundUI();
      if (state.soundEnabled) soundFx.playTone(600, "sine", 0.08);
      showToast(`Efek suara: ${state.soundEnabled ? "Aktif" : "Nonaktif"}`);
    });

    DOM.tempSlider.addEventListener("input", (e) => {
      state.temperature = parseFloat(e.target.value);
      localStorage.setItem(CONFIG.storageKeys.temperature, state.temperature);
      DOM.tempValDisplay.textContent = state.temperature.toFixed(1);
      updateHeaderAndChips();
    });

    DOM.modelSelect.addEventListener("change", (e) => {
      state.model = e.target.value;
      aiService.setModel(state.model);
      updateHeaderAndChips();
      showToast(`Model AI aktif: ${state.model}`);
    });

    DOM.memorySelect.addEventListener("change", (e) => {
      state.memoryTurns = parseInt(e.target.value);
      localStorage.setItem(CONFIG.storageKeys.memoryTurns, state.memoryTurns);
      updateHeaderAndChips();
      showToast(`Konteks preferensi diubah: ${state.memoryTurns === 0 ? "Full" : state.memoryTurns + " pesan"}`);
    });

    // Drawer & Sidebar Toggles (Desktop & Mobile)
    function toggleParamsDrawer(forceOpen = null) {
      soundFx.playClick();
      const isMobile = window.innerWidth <= 1024;
      if (isMobile) {
        if (forceOpen === false) {
          DOM.paramsDrawer.classList.remove("open");
        } else if (forceOpen === true) {
          DOM.paramsDrawer.classList.add("open");
        } else {
          DOM.paramsDrawer.classList.toggle("open");
        }
      } else {
        // Desktop: toggle .closed class
        if (forceOpen === false) {
          DOM.paramsDrawer.classList.add("closed");
        } else if (forceOpen === true) {
          DOM.paramsDrawer.classList.remove("closed");
        } else {
          DOM.paramsDrawer.classList.toggle("closed");
        }
      }
      
      const isClosed = DOM.paramsDrawer.classList.contains("closed") || 
        (isMobile && !DOM.paramsDrawer.classList.contains("open"));
      DOM.paramsToggleBtn.classList.toggle("active", !isClosed);
    }

    function toggleSidebar(forceOpen = null) {
      soundFx.playClick();
      const isMobile = window.innerWidth <= 768;
      if (isMobile) {
        if (forceOpen === false) {
          DOM.sidebar.classList.remove("open");
        } else if (forceOpen === true) {
          DOM.sidebar.classList.add("open");
        } else {
          DOM.sidebar.classList.toggle("open");
        }
      } else {
        // Desktop: toggle .closed class
        if (forceOpen === false) {
          DOM.sidebar.classList.add("closed");
        } else if (forceOpen === true) {
          DOM.sidebar.classList.remove("closed");
        } else {
          DOM.sidebar.classList.toggle("closed");
        }
      }
    }

    if (DOM.closeParamsBtn) {
      DOM.closeParamsBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleParamsDrawer(false); // ALWAYS CLOSE
      });
    }

    if (DOM.paramsToggleBtn) {
      DOM.paramsToggleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleParamsDrawer();
      });
    }

    if (DOM.sidebarToggleBtn) {
      DOM.sidebarToggleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleSidebar();
      });
    }

    if (DOM.openSettingsBtn) {
      DOM.openSettingsBtn.addEventListener("click", () => {
        if (DOM.apiKeyInput) DOM.apiKeyInput.value = aiService.apiKey;
        if (DOM.settingsModal) DOM.settingsModal.classList.add("open");
        if (DOM.apiKeyInput) DOM.apiKeyInput.focus();
      });
    }

    const closeModal = () => {
      if (DOM.settingsModal) DOM.settingsModal.classList.remove("open");
    };
    if (DOM.closeSettingsBtn) DOM.closeSettingsBtn.addEventListener("click", closeModal);
    if (DOM.cancelSettingsBtn) DOM.cancelSettingsBtn.addEventListener("click", closeModal);

    if (DOM.saveSettingsBtn) {
      DOM.saveSettingsBtn.addEventListener("click", () => {
        const key = DOM.apiKeyInput ? DOM.apiKeyInput.value.trim() : "";
        aiService.setApiKey(key);
        updateApiKeyBadge();
        closeModal();
        soundFx.playClick();
        showToast(key ? "API Key berhasil disimpan!" : "API Key dihapus (menggunakan mode Mock)");
      });
    }

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && DOM.settingsModal && DOM.settingsModal.classList.contains("open")) {
        closeModal();
      }
    });
  }

  function autoGrowTextarea() {
    DOM.chatInput.style.height = "auto";
    const newHeight = Math.min(DOM.chatInput.scrollHeight, 180);
    DOM.chatInput.style.height = `${newHeight}px`;
  }

  function scrollToBottom() {
    DOM.messagesContainer.scrollTop = DOM.messagesContainer.scrollHeight;
  }

  function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = "toast";
    const icon = type === "error" ? "⚠️" : "✈️";
    toast.innerHTML = `<span>${icon}</span><span>${escapeHTML(message)}</span>`;
    DOM.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(50px)";
      toast.style.transition = "all 0.25s ease";
      setTimeout(() => toast.remove(), 250);
    }, 2800);
  }

  function escapeHTML(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
});
