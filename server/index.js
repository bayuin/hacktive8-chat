const path = require('path');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const dotenv = require('dotenv');
const { GoogleGenAI } = require('@google/genai');

// 1. Muat environment variable dari file server/.env
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// 2. Setup Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup Multer dengan Memory Storage agar req.file.buffer tersedia untuk base64 encoding (sesuai modul Hacktiv8)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // limit 25MB (untuk audio/dokumen/gambar)
});

// 3. Sajikan Frontend Static Files dari direktori utama Hacktiv8
const clientDir = path.join(__dirname, '..');
app.use(express.static(clientDir));

// Standar Wajib Knowledge Base SuperB Travel Assistant: Aturan Mutlak Pencarian Langsung di Sumber Website & Data Faktual
const KNOWLEDGE_BASE_GUIDELINES = `
[ATURAN MUTLAK SISTEM: WAJIB MENCARI LANGSUNG DI SUMBER WEBSITE RESMI & DILARANG ASUMSI]
Sebagai asisten travel cerdas berstandar Traveloka-grade, kamu TERIKAT OLEH ATURAN SISTEM MUTLAK BERIKUT:

🚨 ATURAN 1: WAJIB CARI DATA TERBARU LANGSUNG KE WEBSITE SUMBER (DILARANG BERASUMSI!)
- Jangan pernah mengira-ngira, berasumsi, atau membuat angka perkiraan statis untuk harga tiket, transportasi, sewa kendaraan, atau HTM wisata!
- Kamu WAJIB menggunakan Google Search grounding tool yang aktif untuk menelusuri data tarif, jadwal, dan ketersediaan langsung dari website resmi penyedia layanan (booking.kai.id, traveloka.com, tiket.com, website resmi destinasi wisata).
- Karena harga dinamis dan dapat berubah sewaktu-waktu sesuai musim (peak/low season), selalu sampaikan bahwa data bersumber dari penelusuran live saat ini.

🚨 ATURAN 2: TRANSPARANSI PERBEDAAN SKENARIO TARIF (AGAR SESUAI PENGECEKAN PENGGUNA)
Jelaskan secara transparan mengapa harga di lapangan/aplikasi bisa bervariasi berdasarkan skenario pemesanan:
   A. TIKET KERETA API (PT KAI):
      - Platform Resmi: **Access by KAI (Resmi)** dan **Loket Stasiun Fisik (Go Show)**.
      - Online Travel Agent (OTA) Resmi: **Traveloka** dan **Tiket.com**.
      - ⚠️ PERINGATAN: **Agoda dan Klook TIDAK menjual tiket kereta api KAI di Indonesia!** Dilarang mencantumkan Agoda/Klook untuk tiket kereta api KAI.
      - Wajib jelaskan 2 Kategori Tarif KAI:
        1. **Tarif Reguler (Pemesanan Jauh Hari H-45 s.d H-1 di Traveloka, Tiket.com, Access by KAI):**
           - Contoh KA Malioboro Ekspres: Ekonomi Rp 160.000 - Rp 190.000 / tiket | Eksekutif Rp 230.000 - Rp 290.000 / tiket.
           - Perhitungan 3 Orang PP: 3 orang × Rp 160.000 × 2 (PP) = **Rp 960.000** (Ekonomi).
        2. **Tarif Khusus (Go Show Pembelian 2 Jam Sebelum Berangkat via Access by KAI / Loket Stasiun):**
           - Relasi Madiun - Malang: Ekonomi mulai Rp 95.000 - Rp 110.000 | Eksekutif Rp 140.000 - Rp 160.000 (hanya jika kursi sisa masih tersedia).
   
   B. SEWA MOBIL & TRANSPORTASI HARIAN (RINCIKAN KOMPONEN BBM):
      - Platform: **Traveloka Car Rental**, **Tiket.com Sewa Mobil**, **Agoda Cars / Klook**, dan **Operator Rental Lokal**.
      - ⚠️ PERHATIKAN: Paket dasar di aplikasi Traveloka/Tiket.com (Rp 375.000 - Rp 450.000) umumnya **HANYA Mobil + Sopir (BELUM TERMASUK BBM)**.
      - Paket **All-In (Mobil Avanza + Sopir + BBM 12 Jam)** di Malang/Batu berkisar **Rp 550.000 - Rp 650.000**. Wajib cantumkan keterangan apakah harga sudah termasuk BBM atau belum.
   
   C. TIKET WISATA & ATRAKSI (BEDAKAN REGULER VS TERUSAN):
      - Contoh: Taman Rekreasi Selecta Kota Batu:
        * **Tiket Masuk Reguler (Website Resmi selectawisata.id / Loket OTS):** Rp 50.000 / orang (termasuk taman bunga & kolam renang). Untuk 3 orang = **Rp 150.000**.
        * **Tiket Paket Terusan Wahana:** Rp 80.000 / orang. Untuk 3 orang = **Rp 240.000**.
        * **Traveloka Xperience & Tiket.com To-Do:** Sering tersedia promo voucher online Rp 45.000 - Rp 48.000 / tiket.
   
   D. AKOMODASI HOTEL & VILLA:
      - Platform: **Traveloka**, **Agoda**, **Tiket.com**, dan **Resepsionis Hotel**.

🚨 ATURAN 3: WAJIB CANTUMKAN TAUTAN LANGSUNG KE WEBSITE RESMI (LIVE LINKS)
Setiap baris komparasi WAJIB menyertakan tautan aktif agar pengguna dapat mengklik dan mengecek harga detik itu juga di portal resminya:
| Layanan / Kebutuhan | Platform Resmi (KAI / Loket OTS) | Traveloka | Tiket.com | Mitra Lain (Agoda / Klook / Rental Lokal) | Tautan Verifikasi Live & Tips |
- Access by KAI: [booking.kai.id](https://booking.kai.id)
- Traveloka: [traveloka.com/id-id/kereta-api](https://www.traveloka.com/id-id/kereta-api) atau [traveloka.com/id-id/rental-mobil](https://www.traveloka.com/id-id/rental-mobil)
- Tiket.com: [tiket.com/kereta-api](https://www.tiket.com/kereta-api) atau [tiket.com/sewa-mobil](https://www.tiket.com/sewa-mobil)
- Selecta Wisata: [selectawisata.id](https://selectawisata.id)`;

// System Prompts & Persona Guidelines untuk SuperB Travel Assistant
const PERSONA_PROMPTS = {
  backpacker: 'Kamu adalah SuperB, asisten travel cerdas spesialis Backpacker & Hemat Budget. Berikan rekomendasi penginapan terjangkau (hostel/guesthouse), transportasi umum termurah, kuliner kaki lima autentik, serta tips menghemat pengeluaran tanpa mengurangi keseruan liburan.',
  luxury: 'Kamu adalah SuperB, konsultan liburan mewah (Luxury & VIP Travel). Fokuskan pada resort bintang lima terbaik, fine dining kelas dunia, private tour eksklusif, fasilitas premium, serta pengalaman mewah kelas atas.',
  adventure: 'Kamu adalah SuperB, pemandu wisata petualangan dan alam terbuka (Adventure & Outdoor). Rekomendasikan rute trekking, spot diving/surfing terbaik, perlengkapan outdoor penting, tips keselamatan ekstrem, dan spot hidden gems alam liar.',
  culture: 'Kamu adalah SuperB, kurator wisata budaya dan warisan sejarah (Culture & Heritage). Jelaskan kisah sejarah mendalam di balik destinasi, etiket adat lokal yang harus dihormati, museum seni, dan festival tradisional khas daerah tersebut.'
};

const TONE_GUIDES = {
  santai: 'Gunakan gaya bahasa santai, hangat, akrab, dan bersahabat seperti mengobrol dengan sahabat seperjalanan.',
  formal: 'Gunakan gaya bahasa profesional, sopan, terstruktur rapi, dan informatif layaknya konsultan wisata berlisensi.',
  ringkas: 'Berikan jawaban to-the-point, ringkas, gunakan poin-poin singkat padat tanpa basa-basi yang panjang namun tetap sertakan tabel komparasi harga & lokasi.',
  storyteller: 'Gunakan gaya narasi deskriptif yang memikat (storytelling), gambarkan suasana tempat, aroma, dan panorama secara imajinatif.'
};

// Helper untuk inisialisasi GoogleGenAI SDK dengan API Key dari .env atau client header
function getGenAI(req) {
  const apiKey = (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here')
    ? process.env.GEMINI_API_KEY
    : (req.headers['x-gemini-api-key'] || req.body?.apiKey);

  if (!apiKey) {
    const err = new Error('API Key Gemini belum dikonfigurasi di file server/.env.');
    err.status = 401;
    err.hint = 'Buka file server/.env dan isi variabel GEMINI_API_KEY=AIzaSy... lalu restart server.';
    throw err;
  }
  return new GoogleGenAI({ apiKey });
}

// Helper eksekusi AI dengan dukungan LIVE GOOGLE SEARCH GROUNDING & multi-model fallback
async function generateContentWithFallback(ai, requestedModel, contents, config = {}) {
  let targetModel = requestedModel || process.env.DEFAULT_MODEL || 'gemini-2.0-flash';
  
  // Normalisasi penamaan model flash
  const candidateModels = [
    targetModel,
    'gemini-2.0-flash',
    'gemini-1.5-flash'
  ];

  let lastError = null;
  for (const modelName of candidateModels) {
    // 1. Coba eksekusi dengan LIVE GOOGLE SEARCH GROUNDING agar AI benar-benar mencari harga di website saat ini
    try {
      const configWithSearch = {
        ...config,
        tools: [{ googleSearch: {} }]
      };
      return await ai.models.generateContent({
        model: modelName,
        contents: contents,
        config: configWithSearch
      });
    } catch (searchToolErr) {
      console.warn(`Pencarian web search tools pada ${modelName} dialihkan ke generate standar:`, searchToolErr.message);
    }

    // 2. Fallback jika tools search tidak didukung di model/tier tertentu
    try {
      return await ai.models.generateContent({
        model: modelName,
        contents: contents,
        config: config
      });
    } catch (err) {
      lastError = err;
      const isModelIssue = err.message && (
        err.message.includes('not found') ||
        err.message.includes('not available') ||
        err.message.includes('404') ||
        err.message.includes('400')
      );
      if (isModelIssue) {
        console.warn(`Model ${modelName} belum tersedia di region/tier ini, mencoba fallback...`);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

// ==============================================================================
// REST API ENDPOINTS (Sesuai Struktur Materi Kursus Hacktiv8)
// ==============================================================================

// Endpoint Status & Health Check
app.get('/api/health', (req, res) => {
  const hasApiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here');
  res.json({
    status: 'online',
    service: 'SuperB Travel Assistant REST API (Express + @google/genai)',
    hasApiKey: hasApiKey,
    supportedModels: [
      'gemini-3.5-flash-lite',
      'gemini-3.6-flash',
      'gemini-3.7-flash',
      'gemini-3.8-flash'
    ],
    defaultModel: process.env.DEFAULT_MODEL || 'gemini-3.5-flash-lite',
    nodeVersion: process.version,
    timestamp: new Date().toISOString()
  });
});

// 1. Endpoint Teks: POST /generate-text (Sesuai Lampiran VSCode Baris 22)
const handleGenerateText = async (req, res) => {
  try {
    const { prompt, model } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Field "prompt" wajib disertakan.' });
    }

    const ai = getGenAI(req);
    const response = await generateContentWithFallback(ai, model, prompt, {
      systemInstruction: `Kamu adalah SuperB Travel Assistant, asisten travel cerdas Traveloka-grade.\n${KNOWLEDGE_BASE_GUIDELINES}`
    });
    res.status(200).json({ result: response.text });
  } catch (error) {
    console.error('Error generating text:', error);
    res.status(error.status || 500).json({
      error: error.message || 'An error occurred while generating text.'
    });
  }
};
app.post('/generate-text', handleGenerateText);
app.post('/api/generate-text', handleGenerateText);

// 2. Endpoint Gambar: POST /generate-from-image (Sesuai Lampiran VSCode Baris 42)
const handleGenerateFromImage = async (req, res) => {
  try {
    const { prompt, model } = req.body;
    if (!req.file) {
      return res.status(400).json({ error: 'File gambar (field "image") wajib diunggah.' });
    }

    // Mengubah buffer file ke base64
    const base64Image = req.file.buffer.toString('base64');
    const ai = getGenAI(req);

    const defaultImgPrompt = `Lakukan pembacaan dan ekstraksi seluruh teks/tulisan (OCR) dari gambar ini secara teliti dan akurat.
Tugas Anda:
1. 📝 TULISAN / TEKS TERDETEKSI (OCR): Tuliskan seluruh teks, nama tempat, maskapai, kode booking, nomor tiket, tanggal, harga, atau petunjuk yang tertera pada gambar secara detail.
2. 🗺️ ANALISIS & REKOMENDASI PERJALANAN: Jelaskan informasi dari teks tersebut dan berikan panduan perjalanan terkait.
3. 📍 INFORMASI LOKASI DETAIL & AKSES: Rincian lokasi, patokan, dan rute transportasi.
4. 💰 RINCIAN HARGA & TARIF RESMI: Estimasi tarif atau harga resmi terkait.
5. 🏷️📊 TABEL KOMPARASI PLATFORM DIGITAL: Bandingkan estimasi harga di Traveloka, Tiket.com, Agoda, Klook, dan Loket Resmi.`;

    const userPrompt = prompt ? `${defaultImgPrompt}\n\nCatatan Tambahan Pengguna: ${prompt}` : defaultImgPrompt;

    let mimeType = req.file.mimetype || 'image/jpeg';
    if (mimeType.includes(';')) mimeType = mimeType.split(';')[0].trim();

    const contents = [
      {
        role: 'user',
        parts: [
          { text: userPrompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image
            }
          }
        ]
      }
    ];

    const response = await generateContentWithFallback(ai, model, contents, {
      systemInstruction: `Kamu adalah SuperB Travel Assistant, asisten travel cerdas Traveloka-grade.\n${KNOWLEDGE_BASE_GUIDELINES}`
    });
    res.status(200).json({ result: response.text });
  } catch (error) {
    console.error('Error generating from image:', error);
    res.status(error.status || 500).json({
      error: error.message || 'An error occurred while generating from image.'
    });
  }
};
app.post('/generate-from-image', upload.single('image'), handleGenerateFromImage);
app.post('/api/generate-from-image', upload.single('image'), handleGenerateFromImage);

// 3. Endpoint Suara / Audio: POST /generate-from-audio (Sesuai Struktur Kursus)
const handleGenerateFromAudio = async (req, res) => {
  try {
    const { prompt, model } = req.body;
    if (!req.file) {
      return res.status(400).json({ error: 'File audio (field "audio") wajib diunggah.' });
    }

    const base64Audio = req.file.buffer.toString('base64');
    const ai = getGenAI(req);

    let audioMime = req.file.mimetype || 'audio/webm';
    if (audioMime.includes(';')) audioMime = audioMime.split(';')[0].trim();
    if (audioMime === 'audio/mp4' || audioMime === 'audio/m4a') audioMime = 'audio/mp4';

    const defaultAudioPrompt = `Transkripsikan rekaman audio suara ini secara teliti kata-per-kata terlebih dahulu (Speech-to-Text).
${prompt ? `Transkrip / Pertanyaan Pengguna yang Terdeteksi: "${prompt}"\n` : ''}
Tugas Anda:
1. 🎙️ TRANSKRIP REKAMAN SUARA: Tuliskan transkripsi persis apa yang diucapkan pengguna dalam rekaman audio ini.
2. 🗺️ JAWABAN FAKTUAL & JELAS: Jawab secara tepat, faktual, dan mendalam sesuai apa yang ditanyakan (dilarang berhalusinasi atau memberikan jawaban di luar konteks pertanyaan).
3. 📍 INFORMASI LOKASI DETAIL & AKSES: Rincian lokasi, patokan, dan opsi transportasi.
4. 💰 RINCIAN HARGA & ESTIMASI BUDGET: Detail harga tiket/HTM resmi dan penginapan.
5. 🏷️📊 TABEL KOMPARASI HARGA PLATFORM DIGITAL: Bandingkan harga di Traveloka, Tiket.com, Agoda, Klook, dan Loket Resmi.`;

    const contents = [
      {
        role: 'user',
        parts: [
          { text: defaultAudioPrompt },
          {
            inlineData: {
              mimeType: audioMime,
              data: base64Audio
            }
          }
        ]
      }
    ];

    const response = await generateContentWithFallback(ai, model, contents, {
      systemInstruction: `Kamu adalah SuperB Travel Assistant, asisten travel cerdas Traveloka-grade.\n${KNOWLEDGE_BASE_GUIDELINES}`
    });
    res.status(200).json({ result: response.text });
  } catch (error) {
    console.error('Error generating from audio:', error);
    res.status(error.status || 500).json({
      error: error.message || 'An error occurred while generating from audio.'
    });
  }
};
app.post('/generate-from-audio', upload.single('audio'), handleGenerateFromAudio);
app.post('/api/generate-from-audio', upload.single('audio'), handleGenerateFromAudio);

// 4. Endpoint Dokumen: POST /generate-from-document (Sesuai Struktur Kursus)
const handleGenerateFromDocument = async (req, res) => {
  try {
    const { prompt, model } = req.body;
    if (!req.file) {
      return res.status(400).json({ error: 'File dokumen (field "document") wajib diunggah.' });
    }

    const base64Doc = req.file.buffer.toString('base64');
    const ai = getGenAI(req);

    // Cek apakah file berupa teks langsung (txt, csv, md, json)
    let extractedDocText = '';
    const isTextDoc = (req.file.mimetype && req.file.mimetype.startsWith('text/')) ||
      /\.(txt|csv|md|json)$/i.test(req.file.originalname || '');
    if (isTextDoc) {
      try {
        extractedDocText = req.file.buffer.toString('utf-8');
      } catch (e) {
        console.warn('Gagal membaca teks dokumen UTF-8:', e);
      }
    }

    const defaultDocPrompt = `Ekstrak dan baca seluruh tulisan, jadwal, dan informasi dari berkas dokumen ini secara teliti (Document Text Capture).
${extractedDocText ? `\n--- ISI DOKUMEN YANG BERHASIL DIEKSTRAK ---\n${extractedDocText.slice(0, 8000)}\n--- AKHIR DOKUMEN ---\n` : ''}
${prompt ? `Catatan Tambahan Pengguna: "${prompt}"\n` : ''}
Tugas Anda:
1. 📄 RINGKASAN & TEKS TERBACA DARI DOKUMEN: Cantumkan informasi penting, nama destinasi, tanggal, jadwal perjalanan, nomor tiket, atau rincian budget yang tertulis dalam dokumen.
2. 🗺️ ANALISIS & EVALUASI ITINERARY: Evaluasi jadwal atau tiket perjalanan tersebut serta berikan saran optimasi rute.
3. 📍 INFORMASI LOKASI DETAIL: Rincian tempat-tempat yang tercantum dalam dokumen dan akses transportasinya.
4. 💰 RINCIAN BIAYA & KOMPARASI PLATFORM: Berikan tabel komparasi harga Traveloka, Tiket.com, dan Agoda untuk alternatif tiket atau hotel yang lebih hemat.`;

    let docMime = req.file.mimetype || 'application/pdf';
    if (docMime.includes(';')) docMime = docMime.split(';')[0].trim();

    const contents = [
      {
        role: 'user',
        parts: [
          { text: defaultDocPrompt },
          {
            inlineData: {
              mimeType: docMime,
              data: base64Doc
            }
          }
        ]
      }
    ];

    const response = await generateContentWithFallback(ai, model, contents, {
      systemInstruction: `Kamu adalah SuperB Travel Assistant, asisten travel cerdas Traveloka-grade.\n${KNOWLEDGE_BASE_GUIDELINES}`
    });
    res.status(200).json({ result: response.text });
  } catch (error) {
    console.error('Error generating from document:', error);
    res.status(error.status || 500).json({
      error: error.message || 'An error occurred while generating from document.'
    });
  }
};
app.post('/generate-from-document', upload.single('document'), handleGenerateFromDocument);
app.post('/api/generate-from-document', upload.single('document'), handleGenerateFromDocument);

// 5. Endpoint Chat Percakapan Multi-Turn: POST /api/chat (Untuk SuperB Travel UI)
app.post('/api/chat', async (req, res) => {
  const startTime = Date.now();
  try {
    const { messages, persona = 'backpacker', tone = 'santai', temperature = 0.7, model } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Parameter "messages" array wajib disertakan.' });
    }

    const ai = getGenAI(req);

    // Format instruksi sistem berdasarkan persona, tone, dan Knowledge Base standar Traveloka
    const personaInstruction = PERSONA_PROMPTS[persona] || PERSONA_PROMPTS.backpacker;
    const toneInstruction = TONE_GUIDES[tone] || TONE_GUIDES.santai;
    const systemInstruction = `${personaInstruction}\n\nPanduan Gaya Bahasa: ${toneInstruction}\n\n${KNOWLEDGE_BASE_GUIDELINES}\n\nFormatkan output menggunakan Markdown terstruktur rapi dengan emoji perjalanan yang relevan.`;

    // Format riwayat chat untuk Gemini API
    const contents = [];
    for (const msg of messages) {
      if (!msg.content || !msg.content.trim()) continue;
      const role = (msg.role === 'assistant' || msg.role === 'model') ? 'model' : 'user';
      contents.push({
        role: role,
        parts: [{ text: msg.content }]
      });
    }

    // Pastikan turn terakhir adalah 'user'
    if (contents.length > 0 && contents[contents.length - 1].role === 'model') {
      contents.pop();
    }

    if (contents.length === 0) {
      return res.status(400).json({ error: 'Pesan obrolan tidak boleh kosong.' });
    }

    const response = await generateContentWithFallback(
      ai,
      model,
      contents,
      {
        systemInstruction: systemInstruction,
        temperature: Math.max(0.0, Math.min(2.0, parseFloat(temperature) || 0.7)),
      }
    );

    let responseText = response.text || (response.candidates && response.candidates[0]?.content?.parts?.[0]?.text) || 'Maaf, tidak ada respon yang diterima.';

    // Lampirkan bukti verifikasi live web search grounding jika tersedia
    const grounding = response.candidates?.[0]?.groundingMetadata;
    if (grounding && grounding.groundingChunks && grounding.groundingChunks.length > 0) {
      const sources = grounding.groundingChunks
        .map(c => c.web ? `[${c.web.title || 'Portal Resmi'}](${c.web.uri})` : null)
        .filter(Boolean);
      if (sources.length > 0) {
        responseText += `\n\n> 🌐 **Terverifikasi Pencarian Web Real-Time (Live Sources):**\n> ${sources.slice(0, 4).join(' • ')}`;
      }
    }

    const latencyMs = Date.now() - startTime;
    const estimatedTokens = Math.ceil(responseText.length / 4);

    return res.json({
      success: true,
      text: responseText,
      model: model || 'gemini-3.5-flash-lite',
      latencyMs: latencyMs,
      tokens: estimatedTokens
    });

  } catch (err) {
    const latencyMs = Date.now() - startTime;
    console.error('Gemini SDK Error:', err);
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Terjadi kesalahan saat memproses permintaan AI.',
      hint: err.hint,
      latencyMs: latencyMs
    });
  }
});

// Fallback untuk route lain -> kirim index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 SuperB Travel Assistant Express Server berjalan!`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🔑 Gemini API Key: ${process.env.GEMINI_API_KEY ? 'Terpasang' : 'Belum diisi di server/.env'}`);
  console.log(`📦 Model Default: ${process.env.DEFAULT_MODEL || 'gemini-3.5-flash-lite'}`);
  console.log(`🎯 Endpoints: /generate-text, /generate-from-image, /generate-from-audio, /generate-from-document, /api/chat`);
  console.log(`=======================================================`);
});
