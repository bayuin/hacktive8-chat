const path = require('path');
const fs = require('fs');
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

// Setup Multer untuk upload file (gambar, dokumen, audio)
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 } // limit 10MB
});

// 3. Sajikan Frontend Static Files dari direktori utama Hacktiv8
const clientDir = path.join(__dirname, '..');
app.use(express.static(clientDir));

// System Prompts & Persona Guidelines untuk WanderWise AI
const PERSONA_PROMPTS = {
  backpacker: 'Kamu adalah WanderWise, asisten travel cerdas spesialis Backpacker & Hemat Budget. Berikan rekomendasi penginapan terjangkau (hostel/guesthouse), transportasi umum termurah, kuliner kaki lima autentik, serta tips menghemat pengeluaran tanpa mengurangi keseruan liburan.',
  luxury: 'Kamu adalah WanderWise, konsultan liburan mewah (Luxury & VIP Travel). Fokuskan pada resort bintang lima terbaik, fine dining kelas dunia, private tour eksklusif, fasilitas premium, serta pengalaman mewah kelas atas.',
  adventure: 'Kamu adalah WanderWise, pemandu wisata petualangan dan alam terbuka (Adventure & Outdoor). Rekomendasikan rute trekking, spot diving/surfing terbaik, perlengkapan outdoor penting, tips keselamatan ekstrem, dan spot hidden gems alam liar.',
  culture: 'Kamu adalah WanderWise, kurator wisata budaya dan warisan sejarah (Culture & Heritage). Jelaskan kisah sejarah mendalam di balik destinasi, etiket adat lokal yang harus dihormati, museum seni, dan festival tradisional khas daerah tersebut.'
};

const TONE_GUIDES = {
  santai: 'Gunakan gaya bahasa santai, hangat, akrab, dan bersahabat seperti mengobrol dengan sahabat seperjalanan.',
  formal: 'Gunakan gaya bahasa profesional, sopan, terstruktur rapi, dan informatif layaknya konsultan wisata berlisensi.',
  ringkas: 'Berikan jawaban to-the-point, ringkas, gunakan poin-poin singkat padat tanpa basa-basi yang panjang.',
  storyteller: 'Gunakan gaya narasi deskriptif yang memikat (storytelling), gambarkan suasana tempat, aroma, dan panorama secara imajinatif.'
};

// ==============================================================================
// REST API ENDPOINTS
// ==============================================================================

// Endpoint Status & Health Check
app.get('/api/health', (req, res) => {
  const hasApiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here');
  res.json({
    status: 'online',
    service: 'WanderWise AI REST API (Express + @google/genai)',
    hasApiKey: hasApiKey,
    defaultModel: process.env.DEFAULT_MODEL || 'gemini-2.0-flash',
    nodeVersion: process.version,
    timestamp: new Date().toISOString()
  });
});

// Endpoint Upload File (Multer Demo)
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Tidak ada file yang diunggah.' });
    }
    res.json({
      message: 'File berhasil diunggah via Multer',
      file: {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        path: req.file.path
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint Chat REST API dengan @google/genai SDK
app.post('/api/chat', async (req, res) => {
  const startTime = Date.now();
  try {
    const { messages, persona = 'backpacker', tone = 'santai', temperature = 0.7, model } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Parameter "messages" array wajib disertakan.' });
    }

    // Ambil API Key dari .env (prioritas utama) atau fallback dari client request header
    const apiKey = (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here')
      ? process.env.GEMINI_API_KEY
      : (req.headers['x-gemini-api-key'] || req.body.apiKey);

    if (!apiKey) {
      return res.status(401).json({
        error: 'API Key Gemini belum dikonfigurasi di file server/.env.',
        hint: 'Buka file server/.env dan isi variabel GEMINI_API_KEY=AIzaSy... lalu restart server.'
      });
    }

    // Inisialisasi @google/genai SDK
    const ai = new GoogleGenAI({ apiKey: apiKey });

    // Format instruksi sistem berdasarkan persona dan tone
    const personaInstruction = PERSONA_PROMPTS[persona] || PERSONA_PROMPTS.backpacker;
    const toneInstruction = TONE_GUIDES[tone] || TONE_GUIDES.santai;
    const systemInstruction = `${personaInstruction}\nPanduan Gaya Bahasa: ${toneInstruction}\nFormatkan output menggunakan Markdown terstruktur rapi dengan emoji perjalanan yang relevan.`;

    // Format riwayat chat untuk Gemini API
    // Pastikan tidak ada turn kosong dan urutan user-model konsisten
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

    // Tentukan model target (dukungan Flash 2.5 / 2.0 / 1.5)
    let targetModel = model || process.env.DEFAULT_MODEL || 'gemini-2.0-flash';
    if (targetModel.includes('2.5-flash-lite')) {
      targetModel = 'gemini-2.0-flash'; // Fallback aman jika model preview berubah
    }

    // Panggil Gemini API via @google/genai SDK
    const response = await ai.models.generateContent({
      model: targetModel,
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: Math.max(0.0, Math.min(2.0, parseFloat(temperature) || 0.7)),
      }
    });

    const responseText = response.text || (response.candidates && response.candidates[0]?.content?.parts?.[0]?.text) || 'Maaf, tidak ada respon yang diterima.';
    const latencyMs = Date.now() - startTime;
    const estimatedTokens = Math.ceil(responseText.length / 4);

    return res.json({
      success: true,
      text: responseText,
      model: targetModel,
      latencyMs: latencyMs,
      tokens: estimatedTokens
    });

  } catch (err) {
    const latencyMs = Date.now() - startTime;
    console.error('Gemini SDK Error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Terjadi kesalahan saat memproses permintaan AI.',
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
  console.log(`🚀 WanderWise AI Express Server berjalan!`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🔑 Gemini API Key: ${process.env.GEMINI_API_KEY ? 'Terpasang' : 'Belum diisi di server/.env'}`);
  console.log(`📦 Model Default: ${process.env.DEFAULT_MODEL || 'gemini-2.0-flash'}`);
  console.log(`=======================================================`);
});
