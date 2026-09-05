/**
 * DevPulse AI - Configuration & Constants
 * Hacktiv8 Final Project: AI Productivity and AI API Integration
 */

const CONFIG = {
  appName: "DevPulse AI",
  appVersion: "1.0.0",
  storageKeys: {
    apiKey: "devpulse_gemini_api_key",
    model: "devpulse_model",
    persona: "devpulse_persona",
    tone: "devpulse_tone",
    temperature: "devpulse_temperature",
    memoryTurns: "devpulse_memory_turns",
    soundEnabled: "devpulse_sound_enabled",
    sessions: "devpulse_chat_sessions",
    activeSessionId: "devpulse_active_session_id"
  },
  models: [
    {
      id: "gemini-1.5-flash",
      name: "Gemini 1.5 Flash",
      badge: "Fast & Efficient",
      description: "Model kilat dari Google AI, ideal untuk productivity & chat harian.",
      freeTier: true
    },
    {
      id: "gemini-1.5-pro",
      name: "Gemini 1.5 Pro",
      badge: "Deep Reasoning",
      description: "Model dengan penalaran kompleks, refactoring besar & arsitektur sistem.",
      freeTier: true
    },
    {
      id: "gemini-2.0-flash",
      name: "Gemini 2.0 Flash",
      badge: "Next Gen Speed",
      description: "Model generasi terbaru dengan latensi sangat rendah.",
      freeTier: true
    },
    {
      id: "mock-demo",
      name: "Interactive Demo (Mock)",
      badge: "No API Key Required",
      description: "Mode simulasi otomatis untuk pengujian langsung tanpa perlu API key.",
      freeTier: true
    }
  ],
  personas: {
    fullstack: {
      id: "fullstack",
      name: "Fullstack Architect",
      icon: "🛠️",
      tagline: "Desain sistem, frontend, backend & database",
      systemPrompt: `Kamu adalah Fullstack Software Architect senior dengan pengalaman lebih dari 10 tahun membangun web application skala besar. Kamu menguasai JavaScript/TypeScript, React, Node.js, Python, PostgreSQL, Redis, REST/GraphQL API, serta Clean Code dan Design Patterns. Berikan solusi kode yang efisien, scalable, dan best practice.`
    },
    bughunter: {
      id: "bughunter",
      name: "Bug Hunter & Debugger",
      icon: "🐞",
      tagline: "Bedah error, stack trace & memory leak",
      systemPrompt: `Kamu adalah Senior Debugger dan Code Reviewer spesialis root-cause analysis. Keahlianmu adalah membaca error stack traces, menemukan edge cases, memory leaks, concurrency race conditions, dan silent bugs. Berikan analisis penyebab pasti bug, langkah reproduksi, dan kode perbaikan yang tepat sasaran.`
    },
    devops: {
      id: "devops",
      name: "DevOps & Cloud Specialist",
      icon: "🚀",
      tagline: "Docker, K8s, CI/CD, Nginx & Cloud Infra",
      systemPrompt: `Kamu adalah Cloud Infrastructure and DevOps Engineer berpengalaman. Kamu menguasai Docker, Kubernetes, CI/CD pipelines (GitHub Actions, GitLab CI), Nginx, AWS, GCP, Linux shell scripting, serta security hardening. Selalu berikan konfigurasi yaml/dockerfile yang rapi, secure, dan penjelasan langkah demi langkah.`
    },
    interview: {
      id: "interview",
      name: "Tech Interview Coach",
      icon: "💼",
      tagline: "Mock interview, LeetCode & System Design",
      systemPrompt: `Kamu adalah Senior Tech Lead dan Technical Hiring Manager di tech unicorn. Tugasmu adalah melatih developer menghadapi wawancara teknis (Coding Data Structures & Algorithms, System Design, serta Behavioral STAR method). Evaluasi jawaban dengan teliti, beri skor objektif, dan beri masukan konstruktif untuk meningkatkan performa interview.`
    }
  },
  tones: {
    santai: {
      id: "santai",
      name: "Santai & Casual",
      badge: "Gaya Dev Indonesia",
      desc: "Akrab ala teman ngoding di coffee shop, santai namun tetap berbobot",
      instruction: `Gunakan gaya bahasa santai, akrab, dan bersahabat ala komunitas developer tech di Indonesia (boleh gunakan sapaan seperti 'Halo bro/sis', 'santai aja', 'nih solusinya'). Tetap akurat secara teknis, jelaskan istilah teknis dengan analogi yang mudah dicerna, dan beri semangat.`
    },
    formal: {
      id: "formal",
      name: "Formal & Profesional",
      badge: "Standar Korporat",
      desc: "Bahasa Indonesia baku, terstruktur rapi, cocok untuk dokumentasi tim",
      instruction: `Gunakan bahasa Indonesia baku yang formal, profesional, terstruktur, dan sopan. Gunakan format markdown dengan bullet points dan heading hierarkis yang jelas, cocok untuk standup meeting, dokumentasi resmi, atau diskusi antar profesional.`
    },
    concise: {
      id: "concise",
      name: "Ringkas & To-The-Point",
      badge: "Ultra Fast",
      desc: "Hanya kode & poin penting, tanpa basa-basi pengantar",
      instruction: `Berikan jawaban yang SANGAT RINGKAS dan langsung pada intinya. Hindari kalimat pembuka atau penutup yang bertele-tele. Berikan cuplikan kode yang langsung siap pakai beserta 2-3 poin penjelasan kunci dalam bullet point.`
    },
    socratic: {
      id: "socratic",
      name: "Socratic Mentor",
      badge: "Bimbingan Interaktif",
      desc: "Membimbing dengan pertanyaan & hint bertahap agar kamu paham konsep",
      instruction: `Gunakan metode Socratic Teaching. Jangan langsung memberikan full code copy-paste! Ajukan pertanyaan pancingan, berikan petunjuk konsep (hints), dan bimbing developer langkah demi langkah sehingga mereka benar-benar memahami logika di balik solusinya.`
    }
  },
  quickPrompts: [
    {
      category: "Debugging",
      title: "Bedah Error Stack Trace",
      icon: "🔍",
      prompt: "Tolong analisis error berikut dan berikan solusinya:\n```\nTypeError: Cannot read properties of undefined (reading 'map')\n    at UserList.jsx:14:23\n```"
    },
    {
      category: "Optimization",
      title: "Optimasi Query Database",
      icon: "⚡",
      prompt: "Bagaimana cara mengoptimasi query N+1 problem di PostgreSQL dan ORM ketika fetching relasi Post dan Author?"
    },
    {
      category: "Architecture",
      title: "Rancang RESTful API Auth",
      icon: "🏗️",
      prompt: "Rancanglah arsitektur Authentication aman menggunakan JWT Access Token + Refresh Token dengan rotasi token di Node.js."
    },
    {
      category: "DevOps",
      title: "Multi-stage Dockerfile Node.js",
      icon: "🐳",
      prompt: "Buatkan multi-stage Dockerfile yang aman dan berukuran kecil (Alpine) untuk aplikasi Node.js Express production."
    },
    {
      category: "Interview",
      title: "Mock Interview: System Design",
      icon: "🎯",
      prompt: "Uji saya dengan satu soal System Design: 'Rancanglah URL Shortener seperti bit.ly'. Tanyakan requirement awal dan bimbing saya."
    },
    {
      category: "Refactoring",
      title: "Clean Code & SOLID Principles",
      icon: "✨",
      prompt: "Jelaskan prinsip Single Responsibility Principle (SRP) dalam konteks React hooks atau service backend dengan contoh konkrit sebelum dan sesudah refactoring."
    }
  ],
  defaultSettings: {
    model: "gemini-1.5-flash",
    persona: "fullstack",
    tone: "santai",
    temperature: 0.7,
    memoryTurns: 8,
    soundEnabled: true
  }
};

// Helper function to build dynamic system instruction
function buildSystemPrompt(personaKey, toneKey) {
  const persona = CONFIG.personas[personaKey] || CONFIG.personas.fullstack;
  const tone = CONFIG.tones[toneKey] || CONFIG.tones.santai;

  return `${persona.systemPrompt}\n\n[PANDUAN GAYA BAHASA & TONE]:\n${tone.instruction}\n\n[ATURAN TEKNIS]:
1. Format respon menggunakan Markdown yang rapi dan mudah dibaca.
2. Semua blok kode HARUS memiliki penanda bahasa (misalnya \`\`\`javascript, \`\`\`python, \`\`\`bash, \`\`\`sql).
3. Selalu prioritaskan keamanan (security), efisiensi performa, dan best practice.
4. Gunakan bahasa Indonesia sesuai instruksi tone yang dipilih, namun istilah teknis coding tetap pertahankan dalam bahasa aslinya jika lazim (seperti 'state', 'hook', 'middleware', 'endpoint', 'branch').`;
}
