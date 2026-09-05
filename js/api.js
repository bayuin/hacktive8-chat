/**
 * DevPulse AI - API Integration Module
 * Connects to Google Gemini API (v1beta) and provides high-fidelity Mock Engine
 */

class AIService {
  constructor() {
    this.apiKey = localStorage.getItem(CONFIG.storageKeys.apiKey) || "";
    this.currentModel = localStorage.getItem(CONFIG.storageKeys.model) || CONFIG.defaultSettings.model;
    this.abortController = null;
  }

  setApiKey(key) {
    this.apiKey = (key || "").trim();
    if (this.apiKey) {
      localStorage.setItem(CONFIG.storageKeys.apiKey, this.apiKey);
    } else {
      localStorage.removeItem(CONFIG.storageKeys.apiKey);
    }
  }

  setModel(modelId) {
    this.currentModel = modelId;
    localStorage.setItem(CONFIG.storageKeys.model, modelId);
  }

  hasApiKey() {
    return Boolean(this.apiKey && this.apiKey.length > 10);
  }

  abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Send chat request to Gemini API or fallback Mock
   * @param {Object} options
   * @param {Array} options.messages - [{role: 'user'|'assistant', content: string}]
   * @param {string} options.persona - persona key
   * @param {string} options.tone - tone key
   * @param {number} options.temperature - float 0.0 - 1.0
   * @param {number} options.memoryTurns - integer max turns
   * @param {Function} options.onChunk - callback(chunkText, accumulatedText)
   * @returns {Promise<Object>} { text, latencyMs, tokens, model }
   */
  async generateResponse({
    messages,
    persona = "fullstack",
    tone = "santai",
    temperature = 0.7,
    memoryTurns = 8,
    onChunk = () => {}
  }) {
    const startTime = Date.now();
    this.abortController = new AbortController();

    // Decide whether to use real Gemini API or Mock Engine
    const shouldUseMock = this.currentModel === "mock-demo" || !this.hasApiKey();

    if (shouldUseMock) {
      return await this.generateMockResponse({
        messages,
        persona,
        tone,
        temperature,
        startTime,
        onChunk,
        signal: this.abortController.signal
      });
    }

    try {
      return await this.callGeminiAPI({
        messages,
        persona,
        tone,
        temperature,
        memoryTurns,
        startTime,
        onChunk,
        signal: this.abortController.signal
      });
    } catch (err) {
      if (err.name === "AbortError") {
        throw new Error("Generasi respon dihentikan oleh pengguna.");
      }
      console.warn("Gemini API call failed, falling back to Interactive Mock Engine:", err);
      // Fallback seamlessly to mock if API key quota exceeded / invalid
      const fallbackNotice = `> ⚠️ **Catatan Sistem**: Panggilan Gemini API mengalami kendala (${err.message || 'Network/Key error'}). Dialihkan ke **Interactive Simulation Mode**.\n\n`;
      onChunk(fallbackNotice, fallbackNotice);

      const mockRes = await this.generateMockResponse({
        messages,
        persona,
        tone,
        temperature,
        startTime,
        onChunk: (chunk, acc) => onChunk(chunk, fallbackNotice + acc),
        signal: this.abortController.signal
      });

      return {
        ...mockRes,
        text: fallbackNotice + mockRes.text,
        model: `${this.currentModel} (Fallback Mock)`
      };
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Format message history for Gemini API
   */
  formatGeminiContents(messages, memoryTurns) {
    // Slice according to memory depth
    const recentMessages = messages.slice(-memoryTurns);

    return recentMessages.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    }));
  }

  /**
   * Call real Google Gemini API
   */
  async callGeminiAPI({
    messages,
    persona,
    tone,
    temperature,
    memoryTurns,
    startTime,
    onChunk,
    signal
  }) {
    const systemPrompt = buildSystemPrompt(persona, tone);
    const contents = this.formatGeminiContents(messages, memoryTurns);

    // Endpoint for Gemini streamGenerateContent with SSE
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.currentModel}:streamGenerateContent?alt=sse&key=${this.apiKey}`;

    const requestBody = {
      contents,
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      generationConfig: {
        temperature: Number(temperature),
        topP: 0.95,
        maxOutputTokens: 3000
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
      ]
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      const errMsg = errorJson.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errMsg);
    }

    let fullText = "";
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep last incomplete line

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const textChunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
            if (textChunk) {
              fullText += textChunk;
              onChunk(textChunk, fullText);
            }
          } catch (e) {
            // ignore non-json SSE lines
          }
        }
      }
    }

    // Process leftover buffer if any
    if (buffer.startsWith("data: ")) {
      try {
        const parsed = JSON.parse(buffer.slice(6).trim());
        const textChunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (textChunk) {
          fullText += textChunk;
          onChunk(textChunk, fullText);
        }
      } catch (e) {}
    }

    const latencyMs = Date.now() - startTime;
    const estTokens = Math.ceil((JSON.stringify(contents).length + fullText.length) / 4);

    return {
      text: fullText,
      latencyMs,
      tokens: estTokens,
      model: this.currentModel
    };
  }

  /**
   * Realistic Interactive Mock Engine
   * Generates custom, tone-aligned, persona-aware developer solutions with simulated streaming
   */
  async generateMockResponse({
    messages,
    persona,
    tone,
    temperature,
    startTime,
    onChunk,
    signal
  }) {
    const lastMessage = messages[messages.length - 1]?.content || "";
    const mockContent = this.createMockReply(lastMessage, persona, tone);

    // Simulate realistic chunked streaming
    let accumulated = "";
    const chunkSize = Math.max(8, Math.floor(mockContent.length / 30));

    for (let i = 0; i < mockContent.length; i += chunkSize) {
      if (signal && signal.aborted) {
        throw new Error("Generasi respon dihentikan oleh pengguna.");
      }

      const chunk = mockContent.slice(i, i + chunkSize);
      accumulated += chunk;
      onChunk(chunk, accumulated);

      // Jitter delay between 15ms and 45ms for realistic typing simulation
      const delay = Math.floor(Math.random() * 30) + 15;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const latencyMs = Date.now() - startTime;
    const estTokens = Math.ceil((lastMessage.length + mockContent.length) / 3.8);

    return {
      text: mockContent,
      latencyMs,
      tokens: estTokens,
      model: "Interactive Demo (Mock AI Engine)"
    };
  }

  /**
   * Pattern-matching mock generator tailored to user prompt, persona, and tone
   */
  createMockReply(prompt, personaKey, toneKey) {
    const lower = prompt.toLowerCase();
    const persona = CONFIG.personas[personaKey] || CONFIG.personas.fullstack;

    // Greeting / Persona Salutation based on Tone
    let greeting = "";
    let closing = "";

    if (toneKey === "santai") {
      greeting = "Yo! Santai bre, masalah ini udah sering banget kejadian di dunia nyata. Mari kita bedah bareng!";
      closing = "\n\nCoba terapin solusi di atas, kalau masih ada yang error langsung lempar stack trace-nya ke sini lagi ya! 🚀";
    } else if (toneKey === "formal") {
      greeting = `Halo. Menanggapi pertanyaan Anda terkait arsitektur dan implementasi teknis, berikut adalah analisis komprehensif dari perspektif **${persona.name}**:`;
      closing = "\n\nDemikian rekomendasi teknis yang dapat diimplementasikan. Pastikan untuk melakukan automated unit testing sebelum rilis ke staging.";
    } else if (toneKey === "concise") {
      greeting = "⚡ **Solusi Langsung:**";
      closing = "";
    } else if (toneKey === "socratic") {
      greeting = `Halo! Menarik sekali masalah yang kamu hadapi. Sebagai mentor, mari kita telusuri logikanya bersama-sama agar kamu benar-benar paham akar masalahnya:`;
      closing = "\n\n🤔 **Pertanyaan Refleksi Untukmu:** Setelah melihat pola di atas, menurutmu di baris mana data tersebut berpotensi null saat pertama kali render?";
    }

    // 1. Error: Cannot read properties of undefined (reading 'map')
    if (lower.includes("map") && (lower.includes("undefined") || lower.includes("typeerror") || lower.includes("stack trace"))) {
      if (toneKey === "concise") {
        return `${greeting}
Gunakan **Optional Chaining** (\`?.\`) atau **Default Value** (\`[]\`).

\`\`\`jsx
// Solusi 1: Optional chaining + fallback
{users?.map(user => (
  <UserCard key={user.id} data={user} />
)) || <p>Tidak ada data pengguna.</p>}

// Solusi 2: Inisialisasi state default
const [users, setUsers] = useState([]); // JANGAN useState() tanpa default array!
\`\`\`
- **Penyebab**: Komponen me-render sebelum asynchronous API fetch selesai, sehingga \`users\` masih bernilai \`undefined\`.`;
      }

      return `${greeting}

### 🐞 Analisis Root Cause
Error \`TypeError: Cannot read properties of undefined (reading 'map')\` terjadi karena variabel yang ingin kamu iterate bernilai \`undefined\` saat proses render berjalan. Hal ini biasanya terjadi pada React/Vue ketika data dari REST API masih dalam proses fetching asynchronous.

### 🛠️ Solusi & Kode Rekomendasi

#### 1. Beri Default Value pada State
\`\`\`javascript
// ❌ Potensi Error:
const [userList, setUserList] = useState(); // Bernilai undefined!

// ✅ Best Practice:
const [userList, setUserList] = useState([]); // Inisialisasi array kosong
\`\`\`

#### 2. Gunakan Optional Chaining & Nullish Coalescing
\`\`\`jsx
export function UserListView({ users, isLoading }) {
  if (isLoading) {
    return <div className="loading-spinner">Sedang memuat data...</div>;
  }

  return (
    <div className="user-grid">
      {users?.length > 0 ? (
        users.map(user => (
          <div key={user.id} className="user-card">
            <h4>{user.name}</h4>
            <p>{user.email}</p>
          </div>
        ))
      ) : (
        <p className="empty-state">Data pengguna kosong.</p>
      )}
    </div>
  );
}
\`\`\`

#### 3. Defensive API Response Handler
\`\`\`typescript
async function fetchUsers(): Promise<User[]> {
  try {
    const res = await api.get('/api/users');
    // Selalu pastikan return array valid meskipun server return null
    return Array.isArray(res.data) ? res.data : [];
  } catch (error) {
    console.error('Gagal mengambil data user:', error);
    return [];
  }
}
\`\`\`
${closing}`;
    }

    // 2. Database N+1 Query
    if (lower.includes("n+1") || lower.includes("query") || lower.includes("database") || lower.includes("orm")) {
      return `${greeting}

### ⚡ Memahami N+1 Query Problem
N+1 query terjadi ketika aplikasi mengeksekusi 1 query untuk mengambil *N* data induk (misal 100 Post), lalu ORM menjalankan 1 query tambahan untuk setiap item secara individual untuk mengambil relasi (Author) di dalam loop. Total: **1 + 100 = 101 query!**

### 🚀 Cara Mengatasinya

#### A. Menggunakan Eager Loading (JOIN / Preload)
\`\`\`sql
-- ❌ N+1 Style (101 Query):
SELECT * FROM posts LIMIT 100;
-- Lalu ORM menjalankan 100x:
SELECT * FROM users WHERE id = ?;

-- ✅ Eager Loading (1 atau 2 Query via IN / JOIN):
SELECT p.*, u.name as author_name, u.email as author_email
FROM posts p
LEFT JOIN users u ON p.author_id = u.id
LIMIT 100;
\`\`\`

#### B. Contoh Implementasi di Prisma ORM & Node.js
\`\`\`typescript
// Menggunakan 'include' agar dieksekusi via JOIN / Batching
const postsWithAuthors = await prisma.post.findMany({
  take: 50,
  include: {
    author: {
      select: { id: true, name: true, avatarUrl: true }
    },
    tags: true
  }
});
\`\`\`

#### C. Gunakan Dataloader untuk GraphQL
Jika menggunakan GraphQL / Microservices, manfaatkan library \`dataloader\` untuk melakukan auto-batching dan per-request caching secara transparan.
${closing}`;
    }

    // 3. Docker & DevOps
    if (lower.includes("docker") || lower.includes("dockerfile") || lower.includes("container") || lower.includes("devops")) {
      return `${greeting}

### 🐳 Production Multi-Stage Dockerfile (Node.js Alpine)
Multi-stage build memisahkan proses kompilasi dependency dengan runtime container akhir, memangkas image size hingga **80%** dan membuang tool kompilasi untuk keamanan maksimal.

\`\`\`dockerfile
# ==========================================
# STAGE 1: Dependency & Build
# ==========================================
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependency specifications first (Docker cache optimization)
COPY package*.json ./
RUN npm ci --only=production && cp -R node_modules prod_node_modules
RUN npm ci

# Copy source code and build
COPY . .
RUN npm run build || true

# ==========================================
# STAGE 2: Production Minimal Runtime
# ==========================================
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Security: Jalankan sebagai non-root user
USER node

# Copy only production dependencies & build artifacts
COPY --chown=node:node --from=builder /app/prod_node_modules ./node_modules
COPY --chown=node:node --from=builder /app/package*.json ./
COPY --chown=node:node --from=builder /app/dist ./dist 2>/dev/null || true
COPY --chown=node:node --from=builder /app/src ./src 2>/dev/null || true

EXPOSE 3000

# Healthcheck probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "src/index.js"]
\`\`\`

### 💡 Keuntungan Best Practice Ini:
1. **Ukuran Image Sangat Kecil**: Hanya ~120MB dibandingkan ~1GB jika memakai image Node biasa.
2. **Keamanan (Security)**: Menjalankan container dengan user non-root (\`USER node\`).
3. **Build Caching**: Layer \`package.json\` di-cache selama dependencies tidak berubah.
${closing}`;
    }

    // 4. REST API Auth / JWT / Architecture
    if (lower.includes("auth") || lower.includes("jwt") || lower.includes("token") || lower.includes("arsitektur")) {
      return `${greeting}

### 🏗️ Arsitektur Dual-Token: Access Token + Refresh Token dengan Rotation
Kombinasi Access Token (masa hidup singkat, misal 15 menit) dan Refresh Token (masa hidup 7 hari) disimpan dengan aman untuk meminimalisir risiko credential leakage.

\`\`\`
[ Client ]
   │
   ├── (1) POST /auth/login ──────────> [ Auth Server ]
   │                                           │ (Verifikasi hash password)
   │ <─── 200 OK + JWT Access Token ───────────┤
   │      + Refresh Token (HttpOnly Cookie)    │
   │
   ├── (2) GET /api/v1/protected (Bearer JWT) ─> [ API Gateway / Service ]
   │                                           │ (Verifikasi tanda tangan token)
   │ <─── 200 Response Data ───────────────────┤
   │
   ├── (3) Access Token Expired (401)
   │
   └── (4) POST /auth/refresh ────────────────> [ Auth Server ]
          (Cookie HttpOnly otomatis terkirim)  │ (Rotasi refresh token baru)
       <── 200 OK + New Access Token ──────────┤
\`\`\`

#### Rekomendasi Keamanan Kunci:
1. **HttpOnly & Secure Cookie**: Simpan Refresh Token di Cookie dengan flag \`HttpOnly\`, \`Secure\`, dan \`SameSite=Strict\` untuk mencegah serangan XSS.
2. **In-Memory Access Token**: Simpan Access Token di memory aplikasi klien (bukan localStorage) agar tidak mudah diakses script injeksi pihak ketiga.
3. **Refresh Token Rotation**: Setiap kali refresh token digunakan, ganti dengan refresh token baru dan hanguskan yang lama.
${closing}`;
    }

    // 5. System Design / Interview
    if (lower.includes("interview") || lower.includes("shortener") || lower.includes("system design") || lower.includes("leet")) {
      return `${greeting}

### 🎯 System Design Mock: URL Shortener (e.g. TinyURL)

#### 1. Klarifikasi Kebutuhan (Requirements Gathering)
- **Fungsional**:
  - Memendekkan URL panjang menjadi link 7 karakter acak (contoh: \`dev.ly/x7K9p2\`).
  - Redirect link pendek ke URL asli dengan latensi di bawah 50ms (HTTP 301 vs 302).
  - Masa aktif link dapat diatur (opsional custom alias).
- **Non-Fungsional**:
  - Read-heavy system (Rasio Baca : Tulis = 100 : 1).
  - Ketersediaan tinggi (High Availability 99.99%).

#### 2. Estimasi Kapasitas
- 100 juta URL baru per bulan (~40 URL/detik ditulis).
- Read throughput: 4.000 request/detik.
- Storage 5 tahun: 6 miliar URL × 500 bytes = ~3 TeraByte.

#### 3. Skema URL Encoding: Mengapa Base62?
Menggunakan karakter \`[a-z, A-Z, 0-9]\` (total 62 kombinasi).
Dengan panjang 7 karakter:
$$62^7 \\approx 3.52 \\text{ triliun kombinasi unik!}$$

\`\`\`typescript
const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

function encodeIdToBase62(num: bigint): string {
  let str = "";
  while (num > 0n) {
    str = BASE62[Number(num % 62n)] + str;
    num = num / 62n;
  }
  return str.padStart(7, "0");
}
\`\`\`

#### 4. Arsitektur Komponen:
- **Distributed ID Generator** (Twitter Snowflake / Redis Increment) untuk ID integer unik.
- **Cache Layer (Redis)**: Menyimpan 20% URL paling sering dikunjungi (Pareto 80/20) untuk read latency ultra cepat < 5ms.
- **Database**: NoSQL Key-Value (DynamoDB / Cassandra) atau PostgreSQL ber-partition.
${closing}`;
    }

    // 6. Generic / Default Developer Assistance
    return `${greeting}

Terima kasih atas pertanyaannya! Berdasarkan konfigurasi parameter saat ini:
- **Persona**: ${persona.name} (${persona.tagline})
- **Gaya Bahasa**: ${CONFIG.tones[toneKey]?.name || toneKey}
- **Temperature**: ${temperature}

Berikut adalah panduan teknis yang relevan untuk pertanyaan Anda:

### 💡 Konsep & Pendekatan Utama
1. **Identifikasi Masalah**: Pecah masalah menjadi bagian modular terkecil.
2. **Penerapan Clean Code**: Terapkan pemisahan logika (separation of concerns), penamaan variabel yang deskriptif, serta error handling yang eksplisit.
3. **Efisiensi Algoritma**: Perhatikan kompleksitas waktu ($O(N)$) dan ruang memory ($O(1)$) untuk skalabilitas.

\`\`\`javascript
// Contoh implementasi modular & reusable
export async function executeTaskWithRetry(taskFn, maxRetries = 3, delayMs = 1000) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await taskFn();
    } catch (err) {
      lastError = err;
      console.warn(\`Percobaan ke-\${attempt} gagal: \${err.message}\`);
      if (attempt < maxRetries) {
        await new Promise(res => setTimeout(res, delayMs * attempt));
      }
    }
  }
  throw new Error(\`Gagal setelah \${maxRetries} percobaan: \${lastError.message}\`);
}
\`\`\`

Silakan tanyakan detail spesifik atau tempelkan potongan kode yang ingin kamu konsultasikan lebih lanjut!
${closing}`;
  }
}

const aiService = new AIService();
