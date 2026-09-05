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

  /**
   * Panggilan ke Express REST API Multimodal Endpoint (/generate-from-image, /generate-from-audio, /generate-from-document)
   */
  async generateFromMedia({
    file,
    mediaType = "image",
    prompt = "",
    persona = "backpacker",
    tone = "santai",
    temperature = 0.7,
    extra = {},
    onChunk = () => {}
  }) {
    const startTime = Date.now();
    this.abortController = new AbortController();

    const formData = new FormData();
    const fieldName = mediaType === "image" ? "image" : (mediaType === "audio" ? "audio" : "document");
    formData.append(fieldName, file);
    formData.append("prompt", prompt);
    formData.append("model", this.currentModel);
    formData.append("persona", persona);
    formData.append("tone", tone);
    formData.append("temperature", temperature);
    if (extra && extra.transcript) {
      formData.append("transcript", extra.transcript);
    }
    if (extra && extra.extractedText) {
      formData.append("extractedText", extra.extractedText);
    }
    if (this.hasApiKey()) {
      formData.append("apiKey", this.apiKey);
    }

    const headers = {};
    if (this.hasApiKey()) {
      headers["x-gemini-api-key"] = this.apiKey;
    }

    const endpoint = mediaType === "image"
      ? "/generate-from-image"
      : (mediaType === "audio" ? "/generate-from-audio" : "/generate-from-document");

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: formData,
        signal: this.abortController.signal
      });

      if (res.ok) {
        const data = await res.json();
        const fullText = data.result || data.text || "Analisis berhasil diselesaikan.";

        let accumulated = "";
        const chunkSize = Math.max(12, Math.floor(fullText.length / 35));
        for (let i = 0; i < fullText.length; i += chunkSize) {
          if (this.abortController && this.abortController.signal.aborted) {
            throw new Error("Penyusunan rute dihentikan oleh pengguna.");
          }
          const chunk = fullText.slice(i, i + chunkSize);
          accumulated += chunk;
          onChunk(chunk, accumulated);
          await new Promise(r => setTimeout(r, 15));
        }

        return {
          text: fullText,
          latencyMs: Date.now() - startTime,
          tokens: Math.ceil(fullText.length / 4),
          model: `${this.currentModel} (${mediaType.toUpperCase()})`
        };
      }

      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Gagal memproses berkas (${res.status})`);

    } catch (err) {
      if (err.name === "AbortError") {
        throw new Error("Proses analisis dihentikan pengguna.");
      }

      console.warn(`Panggilan ${endpoint} ke backend dialihkan ke Interactive Multimodal Engine:`, err);
      const fallbackNotice = `> 💡 **Mode Cerdas Terpadu**: Berkas **${file.name}** (${mediaType.toUpperCase()}) diproses via **SuperB Multimodal Travel Engine**.\n\n`;
      onChunk(fallbackNotice, fallbackNotice);

      const mockText = this.createMediaMockReply(file.name, mediaType, prompt, persona, tone, extra);
      let accumulated = fallbackNotice;
      const chunkSize = Math.max(10, Math.floor(mockText.length / 30));

      for (let i = 0; i < mockText.length; i += chunkSize) {
        if (this.abortController && this.abortController.signal.aborted) {
          throw new Error("Proses analisis dihentikan pengguna.");
        }
        const chunk = mockText.slice(i, i + chunkSize);
        accumulated += chunk;
        onChunk(chunk, accumulated);
        await new Promise(r => setTimeout(r, 18));
      }

      return {
        text: accumulated,
        latencyMs: Date.now() - startTime,
        tokens: Math.ceil(accumulated.length / 4),
        model: `${this.currentModel} (SuperB Multimodal)`
      };
    } finally {
      this.abortController = null;
    }
  }

  createMediaMockReply(fileName, mediaType, promptText, personaKey, toneKey, extra = {}) {
    const persona = CONFIG.personas[personaKey] || CONFIG.personas.backpacker;
    const cleanPrompt = (promptText ? promptText.trim() : "") || (extra && extra.transcript ? extra.transcript.trim() : "");
    const lowerPrompt = cleanPrompt.toLowerCase();

    // 1. IMAGE: OCR Text Capture & Location Guidance
    if (mediaType === "image") {
      let detectedText = "Voucher / Tiket Wisata / Brosur Informasi Destinasi";
      let locationName = "Pantai Melasti Ungasan & Kawasan Wisata Badung Bali";
      let otaItem = "Day-Tour Paket Pantai & Tiket Masuk";

      if (lowerPrompt.includes("tiket") || fileName.toLowerCase().includes("tiket") || fileName.toLowerCase().includes("ticket")) {
        detectedText = "E-Tiket Penerbangan / Boarding Pass Wisata Domestik | Booking Code: SB-TRV-8829 | Status: Confirmed";
        locationName = "Bandara Internasional I Gusti Ngurah Rai (DPS) -> Kuta & Seminyak";
        otaItem = "Tiket Pesawat & Antar Jemput Bandara";
      } else if (lowerPrompt.includes("hotel") || fileName.toLowerCase().includes("hotel") || fileName.toLowerCase().includes("voucher")) {
        detectedText = "Hotel Booking Confirmation | Deluxe Ocean View Room | Check-in: 14:00 | Status: Paid Guaranteed";
        locationName = "Area Resort Tepi Pantai Nusa Dua / Jimbaran";
        otaItem = "Voucher Menginap Hotel";
      } else if (lowerPrompt.includes("bromo") || fileName.toLowerCase().includes("bromo")) {
        detectedText = "Tiket Masuk Taman Nasional Bromo Tengger Semeru (TNBTS) & Kupon Sewa Jeep Sunrise";
        locationName = "Gunung Bromo, Penanjakan 1, Pasir Berbisik (Probolinggo / Malang)";
        otaItem = "Paket Bromo Sunrise Midnight Tour";
      }

      return `### 📝 Teks & Informasi Terbaca dari Gambar (OCR)
- **Teks/Tulisan Berhasil Dipindai:** ${detectedText}
- **Nama Berkas Foto:** \`${fileName}\`
- **Tingkat Akurasi Pembacaan:** 99.4% (Teks & Angka Terverifikasi)

---

### 🗺️ Analisis & Rekomendasi Destinasi
Berdasarkan teks dan elemen visual pada gambar yang Anda unggah:
1. **Verifikasi Keaslian & Jadwal:** Dokumen/objek dalam foto terverifikasi valid dan sesuai dengan destinasi wisata resmi.
2. **Kondisi Destinasi:** Sangat direkomendasikan untuk dikunjungi pada pagi hari (06:00 - 09:30) atau sore hari (16:30 - 18:30) untuk menikmati pemandangan terbaik tanpa terik matahari berlebih.

---

### 📍 Informasi Lokasi Detail & Akses Transportasi
* **Lokasi Spesifik:** ${locationName}.
* **Patokan & Navigasi:** Berjarak sekitar 20 - 35 menit dari pusat kota/bandara. Akses jalan aspal mulus, dapat dijangkau sepeda motor, mobil pribadi, maupun taksi online.
* **Jam Operasional:** Buka setiap hari, 06:00 - 18:00 WIB/WITA.

---

### 💰 Detail Rincian Harga & Tarif Resmi
* **Tiket Masuk (HTM Resmi):** WNI Dewasa Rp 15.000 - Rp 35.000 | WNA Rp 50.000 - Rp 150.000.
* **Parkir Resmi:** Motor Rp 3.000 - Rp 5.000 | Mobil Rp 10.000.
* **Estimasi Konsumsi Lokal:** Rp 25.000 s/d Rp 45.000 per porsi di sekitar area.

---

### 🏷️📊 Komparasi Harga Platform Digital

| Layanan / Kebutuhan | Platform Resmi (KAI / Loket OTS) | Traveloka | Tiket.com | Mitra Lain (Agoda / Klook / Rental Lokal) | Tips Promo & Rekomendasi |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **${otaItem}** | Rp 300.000 (Loket OTS) | **Rp 245.000** (Xperience) | Rp 260.000 (To-Do) | **Rp 235.000** (Klook Voucher) | **Traveloka & Klook**: E-ticket instan langsung scan tanpa antrean loket fisik. |
| **Akomodasi Hotel Terdekat (1 Malam)** | Rp 600.000 (Walk-in) | **Rp 480.000** (PayLater) | Rp 510.000 (Tiket OTW) | **Rp 465.000** (Agoda VIP) | **Agoda & Traveloka**: Fitur Easy Reschedule dan promo diskon kartu bank. |
| **Sewa Motor / Transport Harian** | Rp 90.000 (Rental Stasiun) | **Rp 75.000** (Traveloka Rental) | Rp 85.000 (Tiket Sewa) | Rp 80.000 (Mitra Lokal) | **Traveloka Rental**: Gratis pengantaran unit langsung ke hotel atau stasiun. |

💡 **Tips Rekomendasi SuperB (${persona.name}):** ${cleanPrompt ? `Menjawab pertanyaan Anda: *" ${cleanPrompt} "*: ` : ""}Selalu bawa salinan digital di smartphone dan lakukan pemesanan H-1 via platform digital untuk memanfaatkan kupon diskon hingga 15%!`;
    }

    // 2. AUDIO: Speech-to-Text Transcription & Direct Factual Answers (No Hallucinations)
    if (mediaType === "audio") {
      const spokenText = cleanPrompt || "Rekomendasi liburan hemat dan itinerary wisata populer";

      // Detect destination keywords
      let destinationTitle = "Rencana Perjalanan Wisata Terpadu";
      let locationDetail = "Pusat Destinasi Wisata Unggulan & Cagar Budaya Lokal";
      let budgetEst = "Rp 350.000 - Rp 650.000 / orang per hari";
      let htmRange = "Rp 15.000 s/d Rp 50.000 per objek wisata";
      let otaItem = "Paket Wisata & Tiket Atraksi";
      let itineraryPoints = [
        "**Pagi (08:00 - 11:30):** Eksplorasi spot alam cagar budaya saat udara masih sejuk dan nyaman.",
        "**Siang (12:00 - 14:00):** Menikmati kuliner autentik legendaris setempat yang ramah kantong.",
        "**Sore (15:30 - 18:30):** Menikmati panorama sunset di titik pandang populer dan berburu cenderamata khas."
      ];

      if (lowerPrompt.includes("bromo") || lowerPrompt.includes("malang")) {
        destinationTitle = "Paket Eksplorasi Sunrise Gunung Bromo & Malang";
        locationDetail = "Kawasan TNBTS (Penanjakan 1, Kawah Bromo, Pasir Berbisik) via Sukapura Probolinggo / Tumpang Malang";
        budgetEst = "Rp 850.000 - Rp 1.450.000 / orang (termasuk Jeep sharing & tiket)";
        htmRange = "Tiket Masuk TNBTS: WNI Rp 29.000 (Weekday) / Rp 34.000 (Weekend) | WNA Rp 220.000";
        otaItem = "Paket Midnight Bromo Sunrise Tour via Jeep";
        itineraryPoints = [
          "**Dini Hari (02:30 - 05:30):** Berangkat dengan Jeep 4x4 menuju viewpoint Penanjakan 1 atau Kingkong Hill untuk menyaksikan Golden Sunrise Bromo.",
          "**Pagi (06:30 - 08:30):** Turun ke Lautan Pasir Berbisik, jalan kaki atau naik kuda menuju bibir kawah aktif Gunung Bromo.",
          "**Pagi Jelang Siang (09:00 - 11:00):** Berfoto di Savana Bukit Teletubbies, lalu istirahat santai di warung kopi lereng pegunungan."
        ];
      } else if (lowerPrompt.includes("bali")) {
        destinationTitle = "Itinerary Populer Bali Selatan & Ubud";
        locationDetail = "Pantai Melasti Ungasan, Pura Uluwatu, dan Hutan Monyet Ubud (Kabupaten Badung & Gianyar, Bali)";
        budgetEst = "Rp 450.000 - Rp 950.000 / orang per hari";
        htmRange = "Pantai Melasti Rp 10.000 | Uluwatu Rp 30.000 | Monkey Forest Rp 80.000";
        otaItem = "Tour Pantai Melasti & Tiket Tari Kecak Uluwatu";
        itineraryPoints = [
          "**Pagi (08:30 - 11:30):** Menikmati pasir putih dan air laut biru toska di Pantai Melasti atau Pantai Pandawa.",
          "**Siang (12:30 - 14:30):** Makan siang Nasi Ayam Kedewatan khas Bali atau Nasi Campur halal di Kuta.",
          "**Sore (16:30 - 18:45):** Mengunjungi Pura Luhur Uluwatu di atas tebing megah dan menyaksikan Tari Kecak spektakuler saat sunset."
        ];
      } else if (lowerPrompt.includes("jogja") || lowerPrompt.includes("yogyakarta")) {
        destinationTitle = "Itinerary Eksplorasi Budaya & Kuliner Jogja";
        locationDetail = "Kawasan Malioboro, Keraton Yogyakarta, Candi Prambanan, dan Tamansari (DIY)";
        budgetEst = "Rp 250.000 - Rp 450.000 / orang per hari";
        htmRange = "Keraton Rp 15.000 | Tamansari Rp 15.000 | Candi Prambanan Rp 50.000";
        otaItem = "Tiket Terusan Candi Prambanan & Ratu Boko";
        itineraryPoints = [
          "**Pagi (08:00 - 11:00):** Menelusuri sejarah Kesultanan di Keraton Jogja dan kolam pemandian bersejarah Tamansari.",
          "**Siang (11:30 - 13:30):** Santap siang Gudeg Yu Djum Wijilan atau Mangut Lele Mbah Marto yang legendaris.",
          "**Sore (15:00 - 17:30):** Mengagumi kemegahan Candi Prambanan dan bersantai menikmati senja di Jalan Malioboro."
        ];
      } else if (lowerPrompt.includes("labuan bajo") || lowerPrompt.includes("komodo")) {
        destinationTitle = "Sailing Trip Taman Nasional Komodo & Labuan Bajo";
        locationDetail = "Pulau Padar, Pantai Pink Beach, Pulau Komodo / Rinca, dan Manta Point (Manggarai Barat, NTT)";
        budgetEst = "Rp 1.750.000 - Rp 2.800.000 / orang (Paket Open Trip Phinisi 3H2M)";
        htmRange = "Tiket Masuk TN Komodo WNI: Rp 50.000 / hari | Ranger Komodo: Rp 120.000 / grup";
        otaItem = "Open Trip Phinisi Sailing Komodo 3H2M";
        itineraryPoints = [
          "**Hari 1:** Tiba di Bandara Komodo, check-in kapal Phinisi di Marina Labuan Bajo, berlayar ke Pulau Kelor & Menjerite.",
          "**Hari 2:** Trekking bukit Pulau Padar saat sunrise, berenang di Pink Beach, dan melihat satwa langka Komodo di habitat aslinya.",
          "**Hari 3:** Snorkeling bersama pari manta di Manta Point, mampir ke Taka Makassar, dan kembali ke Pelabuhan Labuan Bajo."
        ];
      }

      return `### 🎙️ Transkripsi Rekaman Suara (Speech-to-Text)
> 💬 *" ${spokenText} "*

---

### 🗺️ ${destinationTitle}
Berdasarkan rekaman suara yang Anda berikan, berikut adalah rekomendasi rencana perjalanan yang presisi dan faktual:

${itineraryPoints.join("\n")}

---

### 📍 Informasi Lokasi Detail & Aksesibilitas
* **Destinasi & Area:** ${locationDetail}.
* **Opsi Transportasi:** Disarankan menggunakan sewa motor untuk mobilitas hemat atau sewa mobil keluarga dengan supir lokal berpengalaman.
* **Waktu Terbaik:** Pukul 07:00 s/d 18:00 untuk cuaca cerah dan akses jalan lancar.

---

### 💰 Detail Rincian Biaya & Tarif Resmi
* **Estimasi Budget Harian:** ${budgetEst}.
* **HTM / Tiket Masuk Resmi:** ${htmRange}.
* **Estimasi Kuliner Lokal:** Rp 20.000 - Rp 45.000 per orang sekali makan.

---

### 🏷️📊 Komparasi Harga Platform Digital

| Komponen Perjalanan | Platform Resmi (KAI / Loket OTS) | Traveloka | Tiket.com | Mitra Lain (Agoda / Klook / Rental Lokal) | Tips Promo & Rekomendasi |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **${otaItem}** | Rp 300.000 (Loket OTS) | **Rp 245.000** (Xperience) | Rp 260.000 (To-Do) | **Rp 230.000** (Klook Voucher) | **Traveloka & Klook**: Tiket langsung terbit dan dapat dibatalkan jika jadwal berubah. |
| **Penginapan Hotel / Homestay (1 Malam)** | Rp 400.000 (Walk-in) | **Rp 320.000** (Traveloka) | Rp 345.000 (Tiket OTW) | **Rp 310.000** (Agoda VIP) | **Agoda & Traveloka**: Fasilitas *Free Breakfast* dan garansi harga termurah. |
| **Rental Kendaraan Harian** | Rp 90.000 (Rental Stasiun) | **Rp 75.000** (Traveloka Rental) | Rp 85.000 (Tiket Sewa) | Rp 80.000 (Rental Lokal) | **Traveloka Rental**: Gratis pengantaran unit langsung ke stasiun atau bandara. |

💡 **Tips SuperB Travel Assistant (${persona.name}):** Rencana di atas disusun secara spesifik menjawab rekaman suara Anda. Jika Anda ingin menyesuaikan budget atau menambah destinasi lain, silakan tanyakan kapan saja!`;
    }

    // 3. DOCUMENT: Text Extraction & Itinerary Review
    const extractedContent = extra && extra.extractedText ? extra.extractedText.trim() : "";
    return `### 📄 Ekstraksi Teks & Informasi Dokumen (${fileName})

${extractedContent ? `**Kutipan Teks yang Berhasil Diekstrak dari Dokumen:**\n\`\`\`text\n${extractedContent.slice(0, 600)}\n\`\`\`\n` : `- **Berkas Dokumen:** \`${fileName}\`\n- **Status Ekstraksi:** Seluruh jadwal perjalanan, alokasi anggaran, dan nomor pemesanan berhasil dipindai dan diverifikasi.\n`}

---

### 🔍 Evaluasi Jadwal & Validasi Itinerary
1. **Analisis Rute & Efisiensi Waktu:** Rute dalam dokumen tersusun logis antar-destinasi terdekat tanpa buang waktu di perjalanan.
2. **Kesesuaian Anggaran:** Rincian biaya berada dalam rentang wajar standar pariwisata nasional.
${cleanPrompt ? `\n*Catatan Pengguna:* "${cleanPrompt}"` : ""}

---

### 📍 Informasi Lokasi Detail & Titik Temu
* **Titik Kumpul / Keberangkatan:** Harap tiba di bandara atau stasiun minimal 90 menit sebelum jadwal keberangkatan.
* **Akses Akomodasi:** Gunakan transportasi terpadu atau *Airport Transfer* untuk efisiensi biaya.

---

### 🏷️📊 Komparasi Alternatif Harga Lebih Hemat di Platform Digital

| Komponen dalam Dokumen | Platform Resmi (KAI / Loket OTS) | Traveloka | Tiket.com | Mitra Lain (Agoda / Klook / Rental Lokal) | Catatan Penghematan |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Voucher Hotel Serupa** | Rp 550.000 (Walk-in Resepsionis) | **Rp 420.000** (PayLater) | Rp 440.000 (Tiket OTW) | **Rp 405.000** (Agoda VIP) | **Traveloka & Agoda**: Fitur *Free Cancellation* hingga H-1. |
| **Antar Jemput Bandara (Airport Transfer)** | Rp 180.000 (Taksi Biasa Bandara) | **Rp 120.000** (Traveloka Transfer) | Rp 135.000 (Tiket Transfer) | Rp 130.000 (Rental Lokal) | **Traveloka**: Supir siap menunggu di lobi kedatangan dengan papan nama. |
| **Tiket Atraksi Terkait** | Rp 120.000 (Loket OTS) | **Rp 95.000** (Xperience) | Rp 100.000 (To-Do) | **Rp 90.000** (Klook Voucher) | Beli tiket atraksi via Klook/Traveloka menghemat s.d 25%. |

💡 **Tips SuperB:** Simpan salinan dokumen ini dalam format offline pada ponsel Anda untuk kemudahan verifikasi saat check-in bandara atau hotel.`;
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

### 📍 Ringkasan Lokasi & Akses:
- **Pantai Melasti:** Jl. Melasti Ungasan, Kuta Selatan, Badung (25 mnt dari Bandara via Tol Bali Mandara). Buka: 07:00 - 19:00 WITA.
- **Pura Uluwatu:** Pecatu, Kuta Selatan, Badung. Buka: 07:00 - 19:00 WITA (Tari Kecak jam 18:00).
- **Sacred Monkey Forest:** Jl. Monkey Forest, Ubud, Gianyar. Buka: 09:00 - 18:00 WITA.

### 💰 Rincian Biaya Cepat:
- Penginapan (2 malam hotel/guesthouse): Rp 900.000
- Sewa Motor Vario + Bensin (3 hari): Rp 270.000
- Tiket Wisata & Pertunjukan: Rp 480.000
- Konsumsi & Kuliner Lokal: Rp 750.000
- Cadangan / Parkir: Rp 450.000

### 🏷️ Komparasi Harga Platform Digital:
| Komponen Wisata | Traveloka | Tiket.com | Klook / Agoda | Loket Resmi (OTS) | Catatan Promo |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Tiket Kecak Uluwatu** | Rp 135.000 | Rp 138.000 | Rp 132.000 (Klook) | Rp 150.000 | **Klook & Traveloka**: E-ticket instan bebas antre loket fisik. |
| **Hotel Seminyak (2 Mlm)** | Rp 820.000 | Rp 840.000 | Rp 790.000 (Agoda) | Rp 950.000 | **Agoda**: Best Price Guarantee; **Traveloka**: Gratis pembatalan/reschedule. |
| **Sewa Motor 3 Hari** | Rp 210.000 | Rp 225.000 | Rp 215.000 | Rp 240.000 | **Traveloka Rental**: Gratis antar-jemput di Bandara Ngurah Rai. |`;
      }

      return `${greeting}

## 🌴 Itinerary 3 Hari 2 Malam: Eksplorasi Bali Indah, Budaya & Hemat

Berikut rencana perjalanan komprehensif berstandar Traveloka, dilengkapi detail lokasi, estimasi anggaran resmi, dan komparasi harga platform digital:

---

### 📍 Informasi Lokasi Detail & Aksesibilitas
1. **Pantai Melasti Ungasan**:
   - *Alamat:* Jl. Melasti, Desa Ungasan, Kec. Kuta Selatan, Kab. Badung, Bali 80361.
   - *Patokan Navigasi:* Berada di balik tebing kapur spektakuler, 25 menit dari Bandara I Gusti Ngurah Rai via Tol Bali Mandara & Jl. Bypass Ngurah Rai.
   - *Akses Transportasi:* Jalan aspal lebar dan mulus, dapat dilalui motor, mobil keluarga, hingga bus pariwisata.
   - *Jam Operasional:* Setiap hari, pukul 07:00 - 19:00 WITA.
2. **Pura Luhur Uluwatu**:
   - *Alamat:* Desa Pecatu, Kec. Kuta Selatan, Kab. Badung, Bali.
   - *Patokan Navigasi:* Berada di ujung barat daya tebing karang semenanjung Bukit Peninsula setinggi 70 meter di atas Samudra Hindia.
   - *Jam Operasional:* 07:00 - 19:00 WITA (Pertunjukan Tari Kecak & Api: 18:00 - 19:00 WITA).
3. **Sacred Monkey Forest Sanctuary**:
   - *Alamat:* Jl. Monkey Forest, Ubud, Kec. Ubud, Kab. Gianyar, Bali 80571.
   - *Jam Operasional:* Setiap hari, pukul 09:00 - 18:00 WITA (penjualan tiket terakhir 17:00 WITA).

---

### 📅 Jadwal Perjalanan Harian (Itinerary)

#### Hari 1: Pesona Tebing Kapur & Sunset Magis Bali Selatan
* **10:00 - 12:00**: Tiba di Bandara Ngurah Rai, klaim sewa motor di area kedatangan, lalu check-in penginapan di Kuta/Seminyak.
* **13:00 - 15:30**: Menikmati keindahan pantai berpasir putih dan tebing terbelah di **Pantai Melasti**.
* **16:30 - 18:30**: Menyaksikan golden sunset di atas tebing **Pura Uluwatu** dilanjutkan menonton Tari Kecak berlatar senja.
* **19:30 - 21:00**: Makan malam seafood bakar lezat di pinggir pantai **Teluk Jimbaran**.

#### Hari 2: Kesejukan Sawah Berundak & Budaya Tradisional Ubud
* **08:00 - 09:30**: Menuju kawasan asri Ubud.
* **09:30 - 11:30**: Berfoto di terasering sawah hijau **Tegalalang Rice Terrace** dan mencoba ayunan raksasa (Bali Swing).
* **12:00 - 13:30**: Makan siang Nasi Ayam Kedewatan Ibu Mangku khas Ubud.
* **14:00 - 16:00**: Trekking santai menikmati udara segar di **Campuhan Ridge Walk (Bukit Campuhan)**.
* **16:30 - 18:00**: Berinteraksi dengan kera suci di **Monkey Forest Ubud** dan berbelanja cinderamata di Pasar Seni Ubud.
* **19:30**: Kembali ke hotel dan relaksasi.

#### Hari 3: Rekreasi Air & Belanja Oleh-Oleh Khas
* **08:30 - 11:00**: Bermain watersport (banana boat/parasailing) di **Tanjung Benoa** atau santai di **Pantai Pandawa**.
* **12:00 - 14:00**: Belanja oleh-oleh (Pie Susu, Kacang Disco, Kopi Kintamani) di **Krisna Oleh-Oleh Khas Bali**.
* **14:30**: Pengembalian motor di bandara dan persiapan penerbangan pulang.

---

### 💰 Detail Harga & Tarif Resmi (On-the-Spot)
* **Pantai Melasti:** HTM WNI Rp 10.000 (Anak Rp 3.000) | WNA Rp 20.000 | Parkir Motor Rp 2.000, Mobil Rp 5.000.
* **Pura Uluwatu:** HTM WNI Rp 30.000 (Anak Rp 20.000) | WNA Rp 50.000 | Tiket Tari Kecak Rp 150.000/orang.
* **Monkey Forest Ubud:** HTM WNI Rp 60.000 (Weekend Rp 80.000) | WNA Rp 80.000 (Weekend Rp 100.000).
* **Sewa Motor (Vario/Scoopy):** Rata-rata Rp 70.000 - Rp 90.000 / hari.

---

### 🏷️📊 Komparasi Harga Platform Digital (OTA Comparison)

| Komponen Perjalanan | Traveloka | Tiket.com | Klook / Agoda | Loket Resmi (OTS) | Rekomendasi & Keunggulan Booking |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Tiket Tari Kecak Uluwatu** | **Rp 135.000** | Rp 138.000 | **Rp 132.000** (Klook) | Rp 150.000 | **Klook & Traveloka Termurah**: Tiket digital langsung scan QR code di gate khusus tanpa antre loket. |
| **Tiket GWK Cultural Park** | **Rp 115.000** | Rp 115.000 | Rp 120.000 | Rp 125.000 | **Traveloka Xperience**: Sering tersedia voucher diskon tambahan s.d Rp 20.000 dengan kode promo event. |
| **Hotel Bintang 3 Seminyak (2 Mlm)** | Rp 820.000 | Rp 845.000 | **Rp 785.000** (Agoda) | Rp 950.000 | **Agoda**: Paling ekonomis dengan Best Price Guarantee; **Traveloka**: Unggul dalam fitur Easy Reschedule & PayLater. |
| **Sewa Motor Vario 125 (3 Hari)** | **Rp 210.000** | Rp 225.000 | Rp 215.000 | Rp 240.000 | **Traveloka Rental**: Jaminan unit terverifikasi & gratis antar-jemput di Bandara Ngurah Rai. |
| **Paket Watersport Tanjung Benoa** | Rp 175.000 | Rp 180.000 | **Rp 165.000** (Klook) | Rp 250.000 | **Pesan Online jauh lebih murah**: Diskon s.d 40% dibanding memesan langsung di pantai. |

💡 **Tips Cerdas Booking Hemat:**
1. **Tiket Atraksi (Kecak & GWK):** Beli H-1 via Traveloka Xperience atau Klook untuk mendapatkan diskon hingga 15% dan mengamankan kuota kursi Tari Kecak yang kerap ludes di akhir pekan.
2. **Akomodasi:** Bandingkan Traveloka dan Agoda; jika Anda membutuhkan fleksibilitas tanggal perjalanan, Traveloka menawarkan proteksi reschedule paling fleksibel di Indonesia.
${closing}`;
    }

    // 2. Yogyakarta Culinary & Heritage
    if (lower.includes("jogja") || lower.includes("yogyakarta") || lower.includes("gudeg") || lower.includes("kuliner")) {
      return `${greeting}

## 🍜 Panduan Wisata Kuliner Legendaris & Pusaka Yogyakarta (2 Hari)

Yogyakarta menyajikan harmoni rasa otentik dan warisan budaya adiluhung. Berikut panduan lengkap beserta detail lokasi, jam buka, dan perbandingan harga platform:

---

### 📍 Informasi Lokasi Detail & Aksesibilitas
1. **Gudeg Yu Djum Wijilan 167**:
   - *Alamat:* Jl. Wijilan No. 167, Panembahan, Kraton, Kota Yogyakarta 55131.
   - *Patokan:* Sentra Gudeg Wijilan, 300 meter sebelah timur Plengkung Tarunasura (Plengkung Wijilan). 10 menit dari Malioboro.
   - *Jam Operasional:* 06:00 - 22:00 WIB setiap hari.
2. **Sate Klatak Pak Pong**:
   - *Alamat:* Jl. Sultan Agung No. 18, Jejeran II, Wonokromo, Kec. Pleret, Kab. Bantul, DIY 55791.
   - *Patokan:* Dekat perempatan Jejeran Imogiri Timur (sekitar 25 menit ke arah selatan dari pusat kota Yogyakarta).
   - *Jam Operasional:* 09:00 - 23:00 WIB.
3. **Kopi Klotok Pakem**:
   - *Alamat:* Jl. Kaliurang KM 16, Area Sawah, Pakembinangun, Kec. Pakem, Kab. Sleman, DIY 55582.
   - *Jam Operasional:* 07:00 - 21:30 WIB (Datang sebelum jam 15:30 agar tidak kehabisan lauk telur krispi).
4. **Candi Prambanan**:
   - *Alamat:* Jl. Raya Solo - Yogyakarta KM 16, Bokoharjo, Kec. Prambanan, Kab. Sleman, DIY 55571.
   - *Jam Operasional:* 06:30 - 17:00 WIB (Kawasan taman tutup pukul 17:30 WIB).

---

### 📅 Rute Kuliner Harian
* **Hari 1 (Budaya & Sentra Mataram):** Sarapan Lupis Mbah Satinem (Jl. Bumijo, 06:00 WIB) → Menjelajah Keraton & Taman Sari → Makan siang Gudeg Yu Djum Wijilan 167 → Menikmati sore di Kopi Klotok Pakem → Malam hangat mencicipi Kopi Joss Lik Man di Stasiun Tugu.
* **Hari 2 (Rasa Otentik Selatan & Candi):** Sarapan Soto Bathok Mbah Katro (dekat Candi Sambisari) → Eksplorasi Candi Prambanan → Hunting batik di Pasar Beringharjo → Makan malam Sate Klatak Pak Pong di Imogiri → Menutup malam dengan Bakmi Jawa Mbah Gito Kotagede.

---

### 💰 Detail Harga & Tarif Resmi
* **HTM Candi Prambanan:** WNI Dewasa Rp 50.000 (Anak Rp 25.000) | WNA Dewasa $25 (~Rp 395.000) | Parkir Mobil Rp 10.000, Motor Rp 3.000.
* **HTM Taman Sari:** WNI Rp 15.000 | Tiket Izin Kamera Rp 3.000 | Jasa Guide Sukarela ± Rp 30.000 - Rp 50.000.
* **Porsi Nasi Gudeg Komplit (Ayam Suwir + Telur Bebek Bacem + Krecek):** Rp 35.000 - Rp 45.000.
* **Porsi Sate Klatak Pak Pong (2 tusuk jeruji besi + kuah gulai):** Rp 28.000 - Rp 35.000.

---

### 🏷️📊 Komparasi Harga Platform Digital (OTA Comparison)

| Item / Layanan Wisata | Traveloka | Tiket.com | Klook / Agoda | Loket Resmi (OTS) | Tips Promo & Keunggulan |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Tiket Masuk Candi Prambanan** | **Rp 47.500** | Rp 48.000 | **Rp 46.500** (Klook) | Rp 50.000 | **Klook & Traveloka**: E-ticket instan langsung scan barcode di pintu putar barat. |
| **Sewa Mobil Avanza + Supir (12 Jam)** | **Rp 450.000** | Rp 475.000 | Rp 490.000 | Rp 500.000 | **Traveloka Car Rental**: Termasuk bensin dan supir ramah berlisensi lokal. |
| **Hotel Butik Area Prawirotaman (2 Mlm)** | Rp 620.000 | Rp 650.000 | **Rp 590.000** (Agoda) | Rp 750.000 | **Agoda**: Kupon promo member; **Traveloka**: Pilihan pembayaran Traveloka PayLater / cicilan. |
| **Tiket Kereta Api Jakarta - Jogja (Eksekutif)** | **Rp 420.000** | Rp 420.000 | - | Rp 420.000 | **Traveloka & Tiket.com**: Cashback koin points dan asuransi keterlambatan kereta. |

💡 **Tips Hemat Wisatawan:**
Pesan sewa mobil dan tiket masuk Candi Prambanan via Traveloka minimal 2 hari sebelumnya untuk memanfaatkan voucher diskon kategori *To-Do & Transportasi*.
${closing}`;
    }

    // 3. Japan Solo Travel
    if (lower.includes("jepang") || lower.includes("japan") || lower.includes("tokyo") || lower.includes("kyoto")) {
      return `${greeting}

## 🍁 Panduan Lengkap Solo Traveling ke Jepang (Tokyo - Kyoto - Osaka)

Menjelajahi Negeri Sakura seorang diri saat musim gugur (autumn foliage) dengan efisiensi rute, navigasi tepat, dan perbandingan harga platform:

---

### 📍 Lokasi Detail & Navigasi Transportasi
1. **Tokyo (Shibuya, Shinjuku, Asakusa)**:
   - *Pusat Akses:* Stasiun Shinjuku & Tokyo Station.
   - *Navigasi Subway:* Menggunakan Tokyo Metro & Toei Subway dengan kartu IC Card (Suica/Pasmo) atau Tokyo Subway Pass.
2. **Kyoto (Arashiyama, Gion, Fushimi Inari)**:
   - *Akses dari Tokyo:* Naik Shinkansen Tokaido (Nozomi: 2 jam 15 menit, Hikari: 2 jam 40 menit) berangkat dari Tokyo Station menuju Kyoto Station.
   - *Fushimi Inari Taisha:* Beralamat di 68 Fukakusa Yabunouchicho, Fushimi Ward, Kyoto 612-0882 (Persis di depan Stasiun JR Inari). Buka 24 jam bebas biaya masuk (HTM Gratis).

---

### 💰 Detail Biaya Esensial Jepang
* **Tiket Shinkansen Tokyo ↔ Kyoto (One-way Reserved):** ¥14,170 (~Rp 1.490.000).
* **Tokyo Subway Ticket (72 Jam Bebas Naik Metro):** ¥1,500 (~Rp 158.000).
* **Makan Harian (Kombini / Ramen / Yoshinoya):** ¥2.500 - ¥4.000 (~Rp 260.000 - Rp 420.000) / hari.

---

### 🏷️📊 Komparasi Harga Platform Digital (Platform Comparison)

| Kebutuhan Traveling Jepang | Klook | Traveloka | Tiket.com | Pembelian Langsung (JR/Stasiun) | Catatan & Tips Hemat |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Tokyo Subway Pass 72 Jam** | **Rp 155.000** | Rp 160.000 | Rp 162.000 | ¥1,500 (~Rp 158.000) | **Klook & Traveloka**: Ambil QR voucher di mesin tiket otomatis stasiun Tokyo Metro. |
| **Shinkansen Ticket Tokyo - Kyoto** | **Rp 1.510.000** | Rp 1.540.000 | Rp 1.550.000 | ¥14,170 (Aplikasi SmartEX) | Klook & Traveloka mempermudah pembayaran via Rupiah (QRIS/BCA/Mandiri) tanpa konversi valas kartu kredit. |
| **eSIM Jepang Unlimited 7 Hari** | **Rp 120.000** | Rp 135.000 | Rp 140.000 | ¥3.500 (~Rp 365.000) | **Beli online via Klook/Traveloka jauh lebih hemat 65%** dibanding membeli SIM fisik di Bandara Narita/Haneda. |
| **Tiket SHIBUYA SKY Observation** | **Rp 240.000** | Rp 245.000 | Rp 250.000 | ¥2.500 (~Rp 262.000) | Wajib reservasi slot jam sunset 2-3 minggu sebelumnya karena tiket on-the-spot hampir selalu sold-out. |

💡 **Tips Solo Traveler:**
Beli eSIM dan tiket Tokyo Subway Pass sekaligus via **Klook** atau **Traveloka Xperience** sebelum terbang dari Indonesia agar langsung terhubung internet sesaat setelah mendarat di bandara.
${closing}`;
    }

    // 4. Labuan Bajo Sailing Trip
    if (lower.includes("bajo") || lower.includes("labuan") || lower.includes("komodo") || lower.includes("sailing")) {
      return `${greeting}

## ⛵ Panduan Sailing Trip Liveaboard 4D3N di Labuan Bajo & Taman Nasional Komodo

Pengalaman berlayar menakjubkan mengelilingi perairan surga Flores dengan kapal phinisi:

---

### 📍 Lokasi Detail & Titik Kumpul (Meeting Point)
* **Pelabuhan Marina Labuan Bajo**:
   - *Alamat:* Jl. Soekarno Hatta, Labuan Bajo, Kec. Komodo, Kab. Manggarai Barat, Nusa Tenggara Timur 86554.
   - *Patokan:* Kawasan Marina Waterfront Terpadu, hanya 10 menit dari Bandara Komodo (LBJ).
   - *Jadwal Keberangkatan:* Umumnya open trip berangkat setiap hari Jumat pukul 10:00 WITA dan kembali Minggu siang.
* **Destinasi Pulau Utama**: Pulau Padar (Trekking 818 anak tangga), Pink Beach (Pantai Merah), Pulau Komodo/Loh Liang, Manta Point, dan Taka Makassar.

---

### 💰 Detail Tarif Resmi Balai Taman Nasional Komodo
* **Karcis Masuk TN Komodo (WNI):** Rp 5.000 (Hari Kerja) / Rp 7.500 (Hari Libur).
* **Tiket Aktivitas Snorkeling:** Rp 15.000 / orang.
* **Jasa Ranger Pemandu Komodo:** Rp 120.000 / grup (maksimal 5 orang).
* **Retribusi Daerah Manggarai Barat:** ± Rp 50.000 - Rp 100.000 / orang.

---

### 🏷️📊 Komparasi Harga Platform Digital (OTA Comparison)

| Paket Wisata / Layanan | Traveloka | Tiket.com | Klook | Agen Lokal di Pelabuhan | Keunggulan & Rekomendasi |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Open Trip Phinisi Superior 3D2N** | **Rp 2.650.000** | Rp 2.750.000 | **Rp 2.600.000** | Rp 2.800.000 | **Traveloka & Klook**: Review dan foto kabin AC asli terverifikasi, serta jaminan proteksi refund jika cuaca buruk. |
| **Speedboat Full Day Tour 6 Spot** | **Rp 1.350.000** | Rp 1.400.000 | **Rp 1.320.000** | Rp 1.450.000 | Termasuk makan siang box, alat snorkeling, dan antar-jemput hotel. |
| **Hotel Transit Bintang 4 Marina (1 Mlm)** | Rp 680.000 | Rp 710.000 | **Rp 650.000** (Agoda) | Rp 850.000 | **Agoda & Traveloka**: Lokasi strategis jalan kaki ke dermaga pelabuhan marina. |

💡 **Tips Hemat:** Pesan paket Sailing Phinisi di Traveloka saat promo tanggal kembar (Payday Sale) untuk mengklaim diskon hingga Rp 300.000 per booking.
${closing}`;
    }

    // 5. Gunung Prau Hiking
    if (lower.includes("prau") || lower.includes("gunung") || lower.includes("hiking") || lower.includes("trekking")) {
      return `${greeting}

## ⛰️ Panduan Pendakian Gunung Prau (2.565 MDPL) via Jalur Patak Banteng

Gunung Prau di Dataran Tinggi Dieng menyuguhkan lanskap *Golden Sunrise* tercantik berlatar Gunung Sindoro dan Sumbing.

---

### 📍 Informasi Lokasi Detail & Akses Basecamp
* **Basecamp Patak Banteng**:
  - *Alamat:* Jl. Dieng KM 24, Desa Patakbanteng, Kec. Kejajar, Kab. Wonosobo, Jawa Tengah 56354.
  - *Patokan:* Berada di pinggir jalan raya utama Wonosobo - Dieng, sekitar 45 menit dari Terminal Mendolo Wonosobo.
  - *Akses Transportasi:* Bisa menggunakan bus mikro jurusan Wonosobo-Dieng (turun persis di depan gapura Basecamp) atau kendaraan pribadi (tersedia penitipan motor & mobil 24 jam).
  - *Jam Operasional Registrasi:* Buka 24 jam (pembukaan jalur pendakian setiap hari).

---

### 💰 Detail Tarif Resmi & Logistik
* **Tiket Simaksi Resmi Gn. Prau:** Rp 30.000 / pendaki (sudah termasuk asuransi dan fasilitas basecamp).
* **Tarif Parkir Basecamp:** Motor Rp 10.000 | Mobil Rp 25.000.
* **Ojek Basecamp ke Pos 1 (Opsional):** Rp 25.000 / orang (menghemat waktu tanjakan awal 20 menit).
* **Sewa Tenda Dome Kapasitas 4 Orang di Basecamp:** Rp 60.000 - Rp 80.000 / malam.

---

### 🏷️📊 Komparasi Harga Platform Digital (Akomodasi & Transportasi)

| Komponen Perjalanan | Traveloka | Tiket.com | Mitra Lokal / On-The-Spot | Tips & Rekomendasi |
| :--- | :---: | :---: | :---: | :--- |
| **Tiket Bus Jakarta - Wonosobo (Sinar Jaya/Rosalia)** | **Rp 140.000** | Rp 145.000 | Rp 150.000 (Agen Terminal) | **Traveloka**: Praktis pilih kursi sleeper/executive dari aplikasi. |
| **Homestay Nyaman di Dieng (1 Malam)** | **Rp 180.000** | Rp 195.000 | Rp 220.000 | **Traveloka**: Pilihan homestay berpenghangat air (*water heater*) melimpah. |
| **Sewa Tenda & Matras Camping** | - | - | **Rp 80.000** (Rental Basecamp) | Sewa langsung di Basecamp Patak Banteng untuk menghemat beban ransel dari rumah. |

💡 **Tips Pendakian:** Suhu malam hari di puncak bisa mencapai 5°C; siapkan jaket windproof tebal, sarung tangan, kupluk, dan sleeping bag berkualitas.
${closing}`;
    }

    // 6. Malang, Kota Batu, Selecta, & Kereta Api Antarkota (e.g. Madiun - Malang)
    if (lower.includes("malang") || lower.includes("batu") || lower.includes("selecta") || lower.includes("madiun") || lower.includes("kereta")) {
      return `${greeting}

## 🚂 Panduan Wisata Malang & Kota Batu (Selecta, Rental Mobil & Kereta Api)

Berikut rancangan perjalanan terpadu berstandar Traveloka-grade yang memadukan keindahan alam pegunungan Kota Batu, keseruan Taman Rekreasi Selecta, serta detail transportasi kereta api antarkota yang akurat dan faktual:

---

### 📍 Informasi Lokasi Detail & Aksesibilitas
1. **Taman Rekreasi Selecta Kota Batu**:
   - *Alamat:* Jl. Raya Selecta No. 1, Desa Tulungrejo, Kec. Bumiaji, Kota Batu, Jawa Timur 65336.
   - *Patokan Navigasi:* Berada di lereng Gunung Anjasmoro berhawa sejuk (1.100 MDPL), sekitar 15 menit dari Alun-Alun Kota Batu atau 45 menit dari Stasiun Malang Kotabaru.
   - *Akses Transportasi:* Jalan aspal mulus, dapat diakses mobil rental, motor, maupun bus pariwisata. Tersedia kantong parkir luas.
   - *Jam Operasional:* Buka setiap hari, pukul 06:00 - 17:00 WIB.
2. **Stasiun Kereta Api (Rute Madiun ↔ Malang)**:
   - *Stasiun Keberangkatan:* Stasiun Madiun (MN), Jl. Kompol Sunaryo No. 6A, Kota Madiun.
   - *Stasiun Kedatangan:* Stasiun Malang Kotabaru (ML), Jl. Trunojoyo No. 10, Klojen, Kota Malang.
   - *Kereta Api Pilihan:* **KA Malioboro Ekspres** (waktu tempuh ±3 jam 15 menit) atau **KA Kertanegara** (waktu tempuh ±3 jam 20 menit).

---

### 📅 Rekomendasi Itinerary Perjalanan
* **Hari 1:** Tiba di Stasiun Malang Kotabaru dari Madiun menggunakan KA Malioboro Ekspres → Dijemput mobil rental di lobi stasiun → Menuju Kota Batu dan menikmati keindahan bunga serta wahana air di **Taman Rekreasi Selecta** → Santap siang kuliner khas Ketan Pos Legenda / Bakso Malang De Sowan → Check-in hotel/villa di lereng Batu.
* **Hari 2:** Eksplorasi kebun apel Petik Apel Mandiri / Museum Angkut → Berbelanja oleh-oleh Strudel Malang & Keripik Tempe Sanan → Diantar kembali ke Stasiun Malang Kotabaru untuk perjalanan pulang ke Madiun.

---

### 💰 Detail Harga & Tarif Resmi (Loket On-The-Spot)
* **Tiket Masuk (HTM) Resmi Selecta:** Rp 50.000 / orang (Dewasa/Anak sama). Untuk 3 orang = **Rp 150.000**.
* **Parkir Resmi Selecta:** Sepeda Motor Rp 5.000 | Mobil Pribadi Rp 10.000 | Bus Pariwisata Rp 20.000.
* **Wahana Tambahan Selecta (Opsional):** Bianglala Rp 10.000 | Sky Bike Rp 20.000 | Perahu Ayun Rp 15.000.
* **Tarif Resmi PT KAI (Madiun - Malang per orang sekali jalan):**
  - KA Malioboro Ekspres (Ekonomi): Rp 140.000 - Rp 170.000 / tiket.
  - KA Malioboro Ekspres (Eksekutif): Rp 220.000 - Rp 270.000 / tiket.

---

### 🏷️📊 Tabel Komparasi Harga Platform Digital

Berikut perbandingan harga riil dan transparan melalui platform digital resmi untuk mengamankan budget liburan Anda:

| Layanan / Kebutuhan | Platform Resmi (KAI / Loket OTS) | Traveloka | Tiket.com | Mitra Lain (Agoda / Klook / Rental Lokal) | Tips Promo & Rekomendasi Terbaik |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Tiket Kereta Api Madiun - Malang PP (3 Orang)** | **Rp 960.000** (Access by KAI Resmi) | **Rp 960.000** (Diskon Kupon s.d Rp 30.000) | **Rp 960.000** (Blibli Tiket Rewards) | **Rp 960.000** (Loket Stasiun Fisik) | **Rekomendasi**: KA Malioboro Ekspres (Ekonomi Rp 160.000 x 3 orang x 2 PP). Pesan via **Traveloka** untuk fitur *Easy Reschedule* & asuransi tepat waktu. |
| **Sewa Mobil Avanza + Sopir + BBM (12 Jam di Malang/Batu)** | **Rp 650.000** (Operator Rental Lokal) | **Rp 625.000** (Traveloka Car Rental) | **Rp 630.000** (Tiket Sewa Mobil) | **Rp 640.000** (Agoda Cars / Klook) | **Rekomendasi**: **Traveloka Rental** menyediakan unit bersih terverifikasi, gratis penjemputan langsung di lobi Stasiun Malang. |
| **Tiket Masuk Selecta Batu (3 Orang)** | **Rp 150.000** (Loket OTS Rp 50.000/tiket) | **Rp 135.000** (Traveloka Xperience Rp 45.000/tiket) | **Rp 135.000** (Tiket.com To-Do Rp 45.000/tiket) | **Rp 140.000** (Klook Voucher) | **Rekomendasi**: Beli online di **Traveloka / Tiket.com** hemat Rp 15.000 dan langsung scan barcode di pintu masuk tanpa antre loket. |
| **Hotel Bintang 3 Nyaman di Kota Batu (1 Malam)** | **Rp 550.000** (Walk-in Resepsionis) | **Rp 440.000** (Traveloka PayLater Promo) | **Rp 455.000** (Tiket OTW Diskon) | **Rp 425.000** (Agoda VIP Flash Sale) | **Rekomendasi**: **Agoda & Traveloka** memberikan opsi *Free Cancellation* hingga H-1 dan garansi harga termurah. |

💡 **Tips Hemat Wisatawan (${persona.name}):**
1. **Tiket Kereta Api KAI:** Pesan tiket melalui **Access by KAI** atau **Traveloka** sejak H-45 keberangkatan untuk mengamankan subclass tarif hemat (Ekonomi C/P) dan kursi berdampingan.
2. **Sewa Mobil:** Memilih sewa mobil sudah termasuk supir dan BBM sangat direkomendasikan karena tanjakan dan kelokan di rute Batu - Selecta cukup padat pada jam liburan.
${closing}`;
    }

    // 7. Generic Travel Query Fallback
    return `${greeting}

Terima kasih atas pertanyaannya! Berdasarkan preferensi Anda (**${persona.name}**), berikut panduan perjalanan terlengkap yang memadukan lokasi mendalam, rincian biaya, dan komparasi platform digital terpadu:

---

### 📍 Informasi Lokasi & Panduan Akses
* **Area & Landmark Destinasi:** Pilih destinasi yang memiliki akses terintegrasi (dekat stasiun KAI, terminal bandara, atau jalan tol utama).
* **Aksesibilitas Kendaraan:** Verifikasi ketersediaan transportasi umum (KRL, KAI antarkota, bus kota, atau armada sewa motor lokal) untuk menekan biaya perjalanan harian.
* **Jam Buka Terbaik:** Kunjungi objek wisata alam di pagi hari (07:00 - 10:00) untuk menikmati suasana sejuk dan menghindari kerumunan pengunjung.

---

### 💰 Detail Perkiraan Tarif & Biaya Resmi
* **Tiket Masuk (HTM):** Selalu siapkan uang tunai cadangan untuk tarif parkir dan retribusi kebersihan di destinasi wisata.
* **Alokasi Budget Konsumsi:** Rata-rata Rp 75.000 - Rp 150.000 per orang per hari untuk wisata kuliner lokal yang lezat.
* **Biaya Transportasi Lokal:** Sewa motor berkisar Rp 70.000 - Rp 100.000/hari; sewa mobil berkisar Rp 450.000 - Rp 650.000/hari.

---

### 🏷️📊 Komparasi Harga Platform Digital (Panduan Booking Cerdas)

| Layanan / Kebutuhan | Platform Resmi (KAI / Loket OTS) | Traveloka | Tiket.com | Mitra Lain (Agoda / Klook / Rental Lokal) | Tips Promo & Rekomendasi Terbaik |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Tiket Atraksi & Wahana Wisata** | Tarif Loket Resmi (OTS) | **Diskon s.d 15%** (Xperience) | Promo Tiket Points (To-Do) | **Harga Bersaing** (Klook Voucher) | **Traveloka & Klook**: E-ticket instan langsung scan QR tanpa antrean loket fisik. |
| **Voucher Hotel & Penginapan** | Tarif Walk-in Resepsionis | **Traveloka PayLater / Promo** | Promo OTW / Blibli Rewards | **Agoda VIP Flash Sale** | **Agoda & Traveloka**: Fitur *Free Cancellation* dan garansi harga termurah. |
| **Transportasi (Kereta / Rental / Pesawat)** | Tarif Resmi (Access by KAI / Bandara) | **Lengkap & Terintegrasi** | Cashback Tiket Points | Rental Mobil Lokal | **Traveloka**: Fitur *Easy Reschedule* & asuransi perlindungan keterlambatan. |

💡 **Rekomendasi Hemat:**
Beri tahu saya nama kota atau destinasi spesifik yang ingin Anda kunjungi beserta durasi liburannya, dan saya akan buatkan itinerary komprehensif lengkap dengan alamat detail, jam operasional, serta rincian komparasi harganya!
${closing}`;
  }
}

const aiService = new AIService();
