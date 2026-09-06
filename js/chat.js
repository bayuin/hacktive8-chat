/**
 * SuperB Travel Assistant - Chat State & Itinerary Storage Manager
 * Handles multi-session travel itineraries, local storage persistence, and export to Markdown/JSON
 */

class ChatManager {
  constructor() {
    this.sessions = [];
    this.activeSessionId = null;
    this.init();
  }

  init() {
    try {
      const stored = localStorage.getItem(CONFIG.storageKeys.sessions) || localStorage.getItem("wanderwise_chat_sessions");
      if (stored) {
        const sanitized = stored.replace(/WanderWise AI/gi, "SuperB Travel Assistant").replace(/WanderWise/gi, "SuperB Travel");
        this.sessions = JSON.parse(sanitized);
        localStorage.setItem(CONFIG.storageKeys.sessions, sanitized);
        localStorage.removeItem("wanderwise_chat_sessions");
      }
    } catch (e) {
      console.warn("Gagal memuat rencana perjalanan dari localStorage:", e);
      this.sessions = [];
    }

    const lastActiveId = localStorage.getItem(CONFIG.storageKeys.activeSessionId) || localStorage.getItem("wanderwise_active_session_id");
    localStorage.removeItem("wanderwise_active_session_id");
    if (lastActiveId && this.sessions.some(s => s.id === lastActiveId)) {
      this.activeSessionId = lastActiveId;
    } else if (this.sessions.length > 0) {
      this.activeSessionId = this.sessions[0].id;
    } else {
      this.createNewSession("Rencana Perjalanan Baru");
    }
  }

  save() {
    try {
      localStorage.setItem(CONFIG.storageKeys.sessions, JSON.stringify(this.sessions));
      if (this.activeSessionId) {
        localStorage.setItem(CONFIG.storageKeys.activeSessionId, this.activeSessionId);
      }
    } catch (e) {
      console.error("Gagal menyimpan rencana perjalanan:", e);
    }
  }

  getActiveSession() {
    let session = this.sessions.find(s => s.id === this.activeSessionId);
    if (!session) {
      session = this.createNewSession("Rencana Perjalanan Baru");
    }
    return session;
  }

  createNewSession(title = "Rencana Perjalanan Baru") {
    const newSession = {
      id: "trip_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6),
      title: title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: []
    };

    this.sessions.unshift(newSession);
    this.activeSessionId = newSession.id;
    this.save();
    return newSession;
  }

  switchSession(id) {
    const target = this.sessions.find(s => s.id === id);
    if (target) {
      this.activeSessionId = target.id;
      this.save();
      return target;
    }
    return null;
  }

  deleteSession(id) {
    this.sessions = this.sessions.filter(s => s.id !== id);
    if (this.sessions.length === 0) {
      this.createNewSession("Rencana Perjalanan Baru");
    } else if (this.activeSessionId === id) {
      this.activeSessionId = this.sessions[0].id;
    }
    this.save();
    return this.getActiveSession();
  }

  renameSession(id, newTitle) {
    const session = this.sessions.find(s => s.id === id);
    if (session && newTitle.trim()) {
      session.title = newTitle.trim();
      session.updatedAt = Date.now();
      this.save();
    }
  }

  addMessage(role, content, meta = {}) {
    const session = this.getActiveSession();
    const msg = {
      id: "msg_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      role,
      content,
      timestamp: Date.now(),
      ...meta
    };

    session.messages.push(msg);
    session.updatedAt = Date.now();

    if (session.messages.length === 1 && role === "user") {
      const truncated = content.replace(/[#*`_]/g, "").trim().slice(0, 30);
      session.title = truncated ? (truncated + (content.length > 30 ? "..." : "")) : "Trip Impian";
    }

    this.save();
    return msg;
  }

  updateLastMessage(content, meta = {}) {
    const session = this.getActiveSession();
    if (session.messages.length > 0) {
      const lastMsg = session.messages[session.messages.length - 1];
      lastMsg.content = content;
      Object.assign(lastMsg, meta);
      session.updatedAt = Date.now();
      this.save();
      return lastMsg;
    }
    return null;
  }

  clearActiveSession() {
    const session = this.getActiveSession();
    session.messages = [];
    session.updatedAt = Date.now();
    this.save();
  }

  getRecentMessages(limit = 8) {
    const session = this.getActiveSession();
    if (!session || !session.messages) return [];
    if (limit <= 0) return session.messages;
    return session.messages.slice(-limit);
  }

  exportCurrentChat(format = "markdown") {
    const session = this.getActiveSession();
    const nowStr = new Date(session.createdAt).toLocaleString("id-ID");

    if (format === "json") {
      const exportData = {
        app: CONFIG.appName,
        version: CONFIG.appVersion,
        type: "travel-itinerary",
        exportedAt: new Date().toISOString(),
        session: session
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      this.downloadBlob(blob, `superb-itinerary-${session.title.toLowerCase().replace(/[^a-z0-9]/g, "-")}.json`);
      return;
    }

    // Default Markdown Itinerary Export
    let md = `# ✈️ Rencana Perjalanan: ${session.title}\n`;
    md += `*Disusun bersama ${CONFIG.appName} pada ${nowStr}*\n\n---\n\n`;

    session.messages.forEach(msg => {
      const time = new Date(msg.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
      if (msg.role === "user") {
        md += `### 👤 Permintaan Anda (${time})\n\n${msg.content}\n\n`;
      } else {
        const personaLabel = msg.persona ? ` - ${msg.persona}` : "";
        const modelLabel = msg.model ? ` (${msg.model})` : "";
        md += `### 🤖 ${CONFIG.appName}${personaLabel}${modelLabel} (${time})\n\n${msg.content}\n\n`;
        if (msg.latencyMs) {
          md += `> *Waktu Generate: ${msg.latencyMs}ms | Estimasi Token: ${msg.tokens || 'N/A'}*\n\n`;
        }
      }
      md += `---\n\n`;
    });

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
    this.downloadBlob(blob, `superb-itinerary-${session.title.toLowerCase().replace(/[^a-z0-9]/g, "-")}.md`);
  }

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

const chatManager = new ChatManager();
