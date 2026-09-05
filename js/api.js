/**
 * WanderWise AI - Travel API Service & Interactive Mock Engine
 * Connects to Google Gemini API (v1beta) and provides high-fidelity Travel Itinerary Mock Engine
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
   * Check Express Server status and API Key configuration
   */
  async checkServerHealth() {
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn("Express server healthcheck error:", e);
    }
    return { status: "offline", hasApiKey: false };
  }

  /**
   * Send chat request to Express REST API (@google/genai) or fallback Mock
   */
  async generateResponse({
    messages,
    persona = "backpacker",
    tone = "santai",
    temperature = 0.7,
    memoryTurns = 8,
    onChunk = () => {}
  }) {
    const startTime = Date.now();
    this.abortController = new AbortController();

    const shouldUseMock = this.currentModel === "mock-demo";

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
      // 1. Prioritaskan panggilan ke Express REST API backend (@google/genai)
      return await this.callBackendAPI({
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
        throw new Error("Penyusunan itinerary dihentikan oleh pengguna.");
      }
      console.warn("Express / Gemini API call failed, falling back to Interactive Mock Engine:", err);
      const fallbackNotice = `> ⚠️ **Catatan Sistem**: Panggilan Gemini API mengalami kendala (${err.message || 'Koneksi/Kunci API'}). Beralih otomatis ke **Interactive Travel Demo Engine**.\n\n`;
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
   * Panggilan ke Express REST API Endpoint: POST /api/chat
   */
  async callBackendAPI({
    messages,
    persona,
    tone,
    temperature,
    memoryTurns,
    startTime,
    onChunk,
    signal
  }) {
    const valid = messages.filter(m => m && m.content && m.content.trim().length > 0);
    let recentMessages = memoryTurns > 0 ? valid.slice(-memoryTurns) : valid;

    while (recentMessages.length > 0 && (recentMessages[recentMessages.length - 1].role === "assistant" || recentMessages[recentMessages.length - 1].role === "model")) {
      recentMessages.pop();
    }

    const payload = {
      messages: recentMessages.map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        content: m.content.trim()
      })),
      persona,
      tone,
      temperature: Number(temperature),
      model: this.currentModel
    };

    const headers = {
      "Content-Type": "application/json"
    };

    if (this.hasApiKey()) {
      headers["x-gemini-api-key"] = this.apiKey;
    }

    const response = await fetch("/api/chat", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      const errMsg = errorJson.error || errorJson.hint || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errMsg);
    }

    const result = await response.json();
    const fullText = result.text || "";

    // Berikan efek streaming visual agar nyaman dibaca
    let accumulated = "";
    const chunkSize = Math.max(8, Math.floor(fullText.length / 28));

    for (let i = 0; i < fullText.length; i += chunkSize) {
      if (signal && signal.aborted) {
        throw new Error("Penyusunan itinerary dihentikan oleh pengguna.");
      }
      const chunk = fullText.slice(i, i + chunkSize);
      accumulated += chunk;
      onChunk(chunk, accumulated);
      await new Promise(resolve => setTimeout(resolve, 16));
    }

    return {
      text: fullText,
      latencyMs: result.latencyMs || (Date.now() - startTime),
      tokens: result.tokens || Math.ceil(fullText.length / 4),
      model: result.model || this.currentModel
    };
  }

  formatGeminiContents(messages, memoryTurns) {
    // 1. Filter out empty or placeholder messages
    const valid = messages.filter(m => m && m.content && m.content.trim().length > 0);

    // 2. Slice according to memoryTurns limit
    let recentMessages = memoryTurns > 0 ? valid.slice(-memoryTurns) : valid;

    // 3. Ensure the payload ends with a 'user' turn (Gemini API strictly disallows requests ending with 'model')
    while (recentMessages.length > 0 && (recentMessages[recentMessages.length - 1].role === "assistant" || recentMessages[recentMessages.length - 1].role === "model")) {
      recentMessages.pop();
    }

    // 4. Map to Gemini format
    return recentMessages.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content.trim() }]
    }));
  }

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

    let modelToUse = this.currentModel;
    let endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:streamGenerateContent?alt=sse&key=${this.apiKey}`;

    const requestBody = {
      contents,
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      generationConfig: {
        temperature: Number(temperature),
        topP: 0.95,
        maxOutputTokens: 3500
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
      ]
    };

    let response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal
    });

    // If model endpoint returned error (e.g. 404 not found or 400 deprecated), try alternate models
    if (!response.ok && (response.status === 404 || response.status === 400)) {
      const fallbackModels = ["gemini-3.5-flash-lite", "gemini-2.0-flash", "gemini-1.5-flash"];
      for (const fallback of fallbackModels) {
        if (modelToUse === fallback) continue;
        console.warn(`Model ${modelToUse} returned ${response.status}, attempting fallback to ${fallback}...`);
        const altEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${fallback}:streamGenerateContent?alt=sse&key=${this.apiKey}`;
        const altRes = await fetch(altEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal
        });
        if (altRes.ok) {
          response = altRes;
          modelToUse = fallback;
          break;
        }
      }
    }

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
      buffer = lines.pop();

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
          } catch (e) {}
        }
      }
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

  async generateMockResponse({
    messages,
    persona,
    tone,
    temperature,
    startTime,
    onChunk,
    signal
  }) {
    const userMessages = messages.filter(m => m && m.role === "user" && m.content && m.content.trim().length > 0);
    const lastMessage = userMessages.length > 0 ? userMessages[userMessages.length - 1].content : (messages[messages.length - 1]?.content || "");
    const mockContent = this.createMockReply(lastMessage, persona, tone, temperature);

    let accumulated = "";
    const chunkSize = Math.max(10, Math.floor(mockContent.length / 32));

    for (let i = 0; i < mockContent.length; i += chunkSize) {
      if (signal && signal.aborted) {
        throw new Error("Penyusunan itinerary dihentikan oleh pengguna.");
      }

      const chunk = mockContent.slice(i, i + chunkSize);
      accumulated += chunk;
      onChunk(chunk, accumulated);

      const delay = Math.floor(Math.random() * 25) + 15;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const latencyMs = Date.now() - startTime;
    const estTokens = Math.ceil((lastMessage.length + mockContent.length) / 3.8);

    return {
      text: mockContent,
      latencyMs,
      tokens: estTokens,
      model: "Interactive Demo (Travel AI Engine)"
    };
  }

  createMockReply(prompt, personaKey, toneKey, temperature = 0.7) {
    const lower = prompt.toLowerCase();
    const persona = CONFIG.personas[personaKey] || CONFIG.personas.backpacker;

    let greeting = "";
    let closing = "";

    if (toneKey === "santai") {
      greeting = `Halo travelers! Siap liburan seru nih bareng **${persona.name}**! Yuk kita rancang perjalanan tak terlupakan:`;
      closing = `\n\nTips santai: Jangan lupa bawa sunscreen dan powerbank ya sob. Kalau ada yang mau diganti atau disesuaikan rutenya, tinggal bilang aja! 🌴🎒`;
    } else if (toneKey === "formal") {
      greeting = `Selamat datang di layanan konsultasi perjalanan **WanderWise Travel Concierge**. Berdasarkan preferensi Anda, berikut kami susun perencanaan perjalanan komprehensif dari sudut pandang **${persona.name}**:`;
      closing = `\n\nDemikian rancangan perjalanan yang kami rekomendasikan. Tim concierge kami siap melakukan kustomisasi jadwal sesuai kebutuhan eksklusif Anda.`;
    } else if (toneKey === "concise") {
      greeting = `⚡ **Rangkuman Cepat Rencana Perjalanan:**`;
      closing = ``;
    } else if (toneKey === "storyteller") {
      greeting = `Tutup matamu sejenak dan bayangkan aroma angin laut yang hangat serta gemerisik daun kelapa yang menyambut langkahmu... Mari kita mulai kisah petualangan ini bersama **${persona.name}**:`;
      closing = `\n\nSetiap langkah perjalanan adalah cerita baru yang menunggumu untuk ditulis. Selamat menjelajah dunia yang indah ini! 🌅`;
    }

    // 1. Bali 3D2N Itinerary
    if (lower.includes("bali") || (lower.includes("3") && lower.includes("hari") && lower.includes("malam"))) {
      if (toneKey === "concise") {
        return `${greeting}
**Destinasi:** Bali Selatan & Ubud (3 Hari 2 Malam)  
**Estimasi Total Budget:** Rp 2.850.000 / orang

### Jadwal Singkat:
- **Hari 1 (Kedatangan & Sunset):** Pantai Melasti → GWK Cultural Park → Sunset Seafood Dinner di Jimbaran.
- **Hari 2 (Pesona Ubud):** Tegalalang Rice Terrace → Campuhan Ridge Walk → Monkey Forest → Pasar Seni Ubud.
- **Hari 3 (Water Activity & Oleh-oleh):** Pantai Pandawa / Tanjung Benoa → Belanja di Krisna Oleh-Oleh → Bandara Ngurah Rai.

### Rincian Biaya Cepat:
- Penginapan (2 malam di guesthouse/hotel): Rp 900.000
- Sewa Motor + Bensin (3 hari): Rp 270.000
- Makan & Minum (3 hari): Rp 750.000
- Tiket Masuk Wisata: Rp 430.000
- Cadangan / Parkir: Rp 500.000`;
      }

      return `${greeting}

## 🌴 Itinerary 3 Hari 2 Malam: Eksplorasi Bali Indah & Hemat

Berikut rancangan rencana perjalanan yang dirancang khusus untuk kenyamanan dan efisiensi waktu perjalanan Anda:

---

### 📅 Jadwal Perjalanan Harian

#### Hari 1: Sunset & Kehangatan Bali Selatan
* **10:00 - 12:00**: Mendarat di Bandara I Gusti Ngurah Rai, ambil sewa motor/kendaraan dan check-in penginapan di area Kuta/Seminyak.
* **13:00 - 15:30**: Menikmati panorama tebing kapur spektakuler di **Pantai Melasti** (Ungasan).
* **16:30 - 18:30**: Menyaksikan golden sunset memukau di atas tebing **Pura Uluwatu** sambil menikmati pertunjukan Tari Kecak.
* **19:30 - 21:00**: Makan malam seafood segar di tepi pasir pantai **Teluk Jimbaran**.

#### Hari 2: Kesejukan Alam & Seni Tradisional Ubud
* **07:30 - 09:00**: Sarapan lokal dan perjalanan menuju Ubud.
* **09:30 - 11:30**: Berfoto dan jalan pagi di undakan sawah hijau **Tegalalang Rice Terrace**.
* **12:00 - 13:30**: Santap siang Nasi Ayam Kedewatan Ibu Mangku yang legendaris.
* **14:00 - 16:00**: Berjalan santai menikmati udara asri di **Bukit Campuhan (Campuhan Ridge Walk)**.
* **16:30 - 18:00**: Mengunjungi **Sacred Monkey Forest Sanctuary** dan belanja suvenir di Pasar Seni Ubud.
* **19:30**: Kembali ke hotel dan istirahat.

#### Hari 3: Pantai Pasir Putih & Suvenir Khas Bali
* **08:30 - 11:00**: Santai dan berenang di **Pantai Pandawa** atau mencoba watersport di Tanjung Benoa.
* **12:00 - 14:00**: Berburu oleh-oleh khas (Pia Legong, Kacang Disco, Kemeja Pantai) di **Krisna Oleh-Oleh**.
* **14:30**: Menuju bandara untuk penerbangan kembali ke kota asal.

---

### 💰 Estimasi Rincian Anggaran (Budget Breakdown)

| Kategori | Deskripsi | Estimasi Biaya (IDR) |
| :--- | :--- | :--- |
| **Akomodasi** | Guesthouse / Hotel Estetik 2 Malam | Rp 900.000 |
| **Transportasi** | Sewa Motor Nmax/Vario (3 Hari) + Bensin | Rp 270.000 |
| **Konsumsi** | Makan lokal, kafe kelapa, & Jimbaran seafood | Rp 850.000 |
| **Tiket Wisata** | Tiket Melasti, Uluwatu + Tari Kecak, Monkey Forest | Rp 480.000 |
| **Oleh-oleh & Tak Terduga** | Pie Susu, kopi kintamani, dana darurat | Rp 450.000 |
| **TOTAL ESTIMASI** | **Pengeluaran per orang** | **± Rp 2.950.000** |

---

### 🎒 Tips & Rekomendasi Penting:
1. **Etika Pura**: Kenakan kain sarung dan selendang saat memasuki area suci Pura Uluwatu (disediakan di loket tiket).
2. **Hindari Kemacetan**: Jalur Canggu dan Sunset Road kerap padat pada pukul 17:00 - 19:00, prioritaskan penggunaan sepeda motor untuk mobilitas lincah.
${closing}`;
    }

    // 2. Yogyakarta Culinary & Heritage
    if (lower.includes("jogja") || lower.includes("yogyakarta") || lower.includes("gudeg") || lower.includes("kuliner")) {
      return `${greeting}

## 🍜 Panduan Wisata Kuliner Legendaris & Pusaka Yogyakarta (2 Hari)

Yogyakarta bukan sekadar kota, melainkan denyut kehangatan rasa dan sejarah yang abadi:

---

### 🗺️ Rute Kuliner Harian

#### Hari 1: Denyut Tradisi Mataram
* **06:30 - 08:30 | Sarapan Legendaris**: **Lupis & Cenil Mbah Satinem** (Jl. Bumijo). Lupis kenyal bersiram kuah gula aren kental yang pernah masuk liputan Netflix Street Food. *Buka mulai 06:00, ambil nomor antrean!*
* **10:00 - 12:00 | Pusaka Budaya**: Menjelajahi keindahan arsitektur air **Taman Sari** dan **Keraton Ngayogyakarta Hadiningrat**.
* **12:30 - 14:00 | Makan Siang Otentik**: **Gudeg Yu Djum Wijilan 167**. Nikmati gudeg kering manis gurih dengan krecek pedas dan telur bebek bacem.
* **16:00 - 18:00 | Sore Tenang**: Menikmati kopi rempah dan pisang goreng di bantaran sawah **Kopi Klotok Pakem**.
* **20:00 - 22:00 | Malam Hangat**: **Kopi Joss Angkringan Lik Man** dekat Stasiun Tugu. Sensasi kopi tubruk yang dicemplungi arang membara menyala!

#### Hari 2: Eksplorasi Rasa Selatan & Malam Romantis
* **08:00 - 10:00 | Sarapan Gurih**: **Soto Bathok Mbah Katro** di dekat Candi Sambisari. Disajikan dalam tempurung kelapa dengan tempe mendoan hangat.
* **13:00 - 15:00 | Heritage Jalanan**: Menikmati es dawet ngudi rasa Pasar Beringharjo dan hunting batik tulis.
* **18:00 - 20:00 | Santap Malam Spektakuler**: **Sate Klatak Pak Pong** di Imogiri. Daging kambing muda empuk dipanggang menggunakan jeruji besi sepeda dengan kuah gulai gurih melimpah.
* **20:30 - 22:30**: **Bakmi Jawa Mbah Gito** Kotagede. Menikmati bakmi godhog di bangunan kayu jati bernuansa pedesaan Jawa.

---

### 💡 Tips Warga Lokal (Insider Tips):
1. **Pecel & Angkringan**: Tanyakan harga menu terlebih dahulu bila jajan di tenda sekitar Malioboro untuk menghindari getok harga.
2. **Waktu Terbaik**: Datanglah ke Kopi Klotok sebelum jam 16:00 untuk menghindari kehabisan sayur lodeh dan telur krispi andalan.
${closing}`;
    }

    // 3. Japan Solo Travel
    if (lower.includes("jepang") || lower.includes("japan") || lower.includes("tokyo") || lower.includes("kyoto")) {
      return `${greeting}

## 🍁 Panduan Lengkap Solo Traveling ke Jepang (Tokyo - Kyoto - Osaka)

Menjelajahi Negeri Sakura seorang diri saat musim gugur (autumn foliage) adalah pengalaman yang sangat aman, efisien, dan memesona.

---

### 🚅 1. Navigasi Transportasi
* **IC Card Digital (Suica / Pasmo / ICOCA)**: Tambahkan kartu Suica ke Apple Wallet / Google Wallet di smartphone Anda. Sangat praktis untuk subway, kereta komuter, bus, bahkan belanja di kombini (7-Eleven/Lawson).
* **Shinkansen (Peluru Cepat)**: Tiket Shinkansen Tokaido (Tokyo ke Kyoto ~2 jam 15 menit) dapat dipesan langsung via aplikasi *SmartEX* untuk mendapatkan diskon early bird.
* **Aplikasi Wajib**: Download aplikasi **Japan Travel by NAVITIME** atau **Google Maps** yang sangat akurat menunjukkan platform kereta, gerbong transfer, dan tarif.

---

### 📶 2. Konektivitas & Internet
* **eSIM / Pocket WiFi**: Beli eSIM (misal: Airalo, Ubigi, atau Klook) sebelum keberangkatan. Pastikan kuota minimal 2GB/hari atau unlimited agar lancar navigasi GPS.

---

### 🏮 3. Rekomendasi Rute Autumn Foliage
1. **Tokyo**: Meiji Jingu Gaien (Icho Namiki / Ginkgo Avenue berdaun kuning keemasan), Shinjuku Gyoen, Shibuya Sky saat senja.
2. **Kyoto**: Kuil Tofukuji (lautan daun momiji merah), Kiyomizu-dera, Arashiyama Bamboo Grove, dan Fushimi Inari Taisha di pagi hari (pukul 07:00 bebas kerumunan).
3. **Osaka**: Dotonbori street food (Takoyaki & Okonomiyaki) dan Osaka Castle Park.

---

### 🤝 4. Etika Krusial di Jepang
* **Dilarang Menelepon di Kereta**: Kereta di Jepang sangat hening; ubah ponsel ke mode senyap (*manner mode*).
* **Sampah Pribadi**: Jarang sekali tempat sampah umum di jalanan. Siapkan kantong plastik kecil di tas untuk membawa sampah Anda kembali ke hotel.
* **Tidak Ada Budaya Tip**: Jangan meninggalkan uang tip di restoran, hal tersebut dianggap tidak sopan karena pelayanan prima sudah merupakan standar kewajiban mereka.
${closing}`;
    }

    // 4. Labuan Bajo Sailing Trip
    if (lower.includes("bajo") || lower.includes("labuan") || lower.includes("komodo") || lower.includes("sailing")) {
      return `${greeting}

## ⛵ Panduan Sailing Trip Liveaboard 4D3N di Labuan Bajo & Taman Nasional Komodo

Merasakan sensasi tidur di atas kapal pinisi phinisi mengarungi laut flores bertabur bintang:

---

### 🗺️ Rute & Destinasi Utama
* **Pulau Kelor**: Trekking pemanasan dengan panorama laut gradasi toska.
* **Pulau Padar**: Ikonik dengan 3 teluk berpasir berbeda (putih, merah muda, hitam). Trekking 800 anak tangga saat subuh untuk sunrise magis!
* **Pink Beach**: Snorkeling bersama terumbu karang warna-warni di atas pasir merah muda alami.
* **Pulau Komodo / Rinca**: Trekking bersama Ranger TN Komodo mengamati habitat asli satwa purba Komodo Dragon.
* **Manta Point**: Berenang bebas (snorkeling) berdampingan dengan Manta Ray raksasa.
* **Pulau Kalong**: Menonton jutaan kelelawar buah raksasa terbang melintasi langit senja saat sunset.

---

### 🎒 Checklist Wajib Bawa:
- [x] Sandal/Sepatu trekking dengan grip kuat (jalur Padar licin berkerikil).
- [x] Dry bag tahan air (10L - 15L) untuk melindungi gadget di dinghy boat.
- [x] Reef-safe sunscreen (bebas bahan kimia Oxybenzone untuk melindungi terumbu karang).
- [x] Obat anti-mabuk laut (diminum 30 menit sebelum berlayar).
- [x] Kacamata hitam & topi bertepi lebar.

---

### 💰 Estimasi Biaya Phinisi Sharing:
* **Paket Open Trip Phinisi Standard**: Rp 2.500.000 - Rp 3.500.000 / orang (termasuk makan 3x sehari di kapal, alat snorkel, kabin AC).
* **Tiket Masuk TN Komodo**: ± Rp 250.000 - Rp 350.000 (WNI) / Rp 500.000+ (WNA).
${closing}`;
    }

    // 5. Gunung Prau Hiking
    if (lower.includes("prau") || lower.includes("gunung") || lower.includes("hiking") || lower.includes("trekking")) {
      return `${greeting}

## ⛰️ Panduan Pendakian Gunung Prau (2.565 MDPL) via Jalur Patak Banteng

Gunung Prau di Dataran Tinggi Dieng terkenal sebagai salah satu gunung dengan panorama *Golden Sunrise* terbaik di Asia Tenggara.

---

### ⏱️ Estimasi Waktu & Jalur
* **Basecamp ke Pos 1**: 20 menit (bisa naik ojek hemat waktu).
* **Pos 1 ke Pos 2**: 30 menit (jalur tanah dan undakan batu).
* **Pos 2 ke Pos 3**: 45 menit (mulai menanjak terjal, akar pohon).
* **Pos 3 ke Sunrise Camp (Puncak)**: 45 menit (tanjakan curam 'patahan').
* *Total durasi naik pendakian santai: 2.5 s/d 3.5 jam.*

---

### ❄️ Suhu Udara & Pakaian
Suhu di puncak Gunung Prau pada malam hari berkisar **5°C s/d 10°C** (bahkan bisa mencapai 0°C dengan embun es / bun upas di bulan Juli-Agustus).
* **Gunakan Sistem Layering**:
  1. Base layer: Thermal baselayer / pakaian dry-fit (jangan katun biasa).
  2. Mid layer: Jaket fleece / sweater wol hangat.
  3. Outer layer: Jaket windproof / waterproof tebal berpenutup kepala.
  4. Wajib: Sarung tangan hangat, kupluk, dan kaus kaki cadangan.

---

### 📝 Perizinan & Tiket Simaksi:
* Tiket simaksi resmi: Rp 30.000 / orang.
* Siapkan fotokopi KTP / identitas diri.
* Wajib membawa turun kembali seluruh sampah logistik pendakian!
${closing}`;
    }

    // 6. Generic Travel Query
    return `${greeting}

Terima kasih atas pertanyaannya! Berdasarkan pengaturan parameter asisten saat ini:
- **Spesialisasi**: ${persona.name} (${persona.tagline})
- **Gaya Bahasa**: ${CONFIG.tones[toneKey]?.name || toneKey}
- **Tingkat Kreativitas**: ${temperature}

Berikut rekomendasi dan panduan perjalanan terbaik untuk Anda:

### 🌟 Rekomendasi Utama:
1. **Waktu Terbaik Berkunjung**: Pilih musim peralihan (*shoulder season*) untuk menikmati cuaca cerah dengan keramaian turis yang lebih minim dan harga penginapan bersahabat.
2. **Akomodasi Strategis**: Pilih penginapan yang dekat dengan akses transportasi publik atau stasiun utama agar mobilitas hemat waktu.
3. **Eksplorasi Rasa Lokal**: Selalu luangkan satu waktu makan untuk mencoba kuliner khas pasar tradisional atau warung legendaris warga lokal.

\`\`\`markdown
Contoh Format Rencana Harian:
- Pagi (08:00 - 11:00) : Eksplorasi spot alam & fotografi
- Siang (12:00 - 14:00): Wisata kuliner khas daerah
- Sore (16:00 - 18:30): Menikmati matahari terbenam (sunset point)
- Malam (19:30 - selesai): Wisata belanja malam / relaksasi
\`\`\`

Beri tahu saya destinasi yang ingin Anda tuju, durasi hari liburan, serta perkiraan budget, dan saya akan buatkan itinerary kustom secara instan!
${closing}`;
  }
}

const aiService = new AIService();
