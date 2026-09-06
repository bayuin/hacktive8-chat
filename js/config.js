/**
 * SuperB Travel Assistant - Configuration & Constants
 * Hacktiv8 Final Project: Smart Travel Assistant (AI Productivity & API Integration)
 */

const CONFIG = {
  appName: "SuperB Travel Assistant",
  appVersion: "1.0.0",
  storageKeys: {
    apiKey: "superb_gemini_api_key",
    model: "superb_model",
    persona: "superb_persona",
    tone: "superb_tone",
    temperature: "superb_temperature",
    memoryTurns: "superb_memory_turns",
    soundEnabled: "superb_sound_enabled",
    sessions: "superb_chat_sessions",
    activeSessionId: "superb_active_session_id",
    theme: "superb_theme"
  },
  models: [
    {
      id: "gemini-3.5-flash-lite",
      name: "Gemini 3.5 Flash Lite",
      badge: "Fast & Lightweight",
      description: "Model ringan dan super responsif dari Google AI untuk rekomendasi wisata & perencana itinerary.",
      freeTier: true
    },
    {
      id: "gemini-3.6-flash",
      name: "Gemini 3.6 Flash",
      badge: "Travel Reasoning",
      description: "Model cerdas dengan kemampuan penalaran rute perjalanan & kalkulasi budget yang akurat.",
      freeTier: true
    },
    {
      id: "gemini-3.7-flash",
      name: "Gemini 3.7 Flash",
      badge: "Hybrid Thinking & Speed",
      description: "Model mutakhir dengan kecepatan tinggi dan pemahaman multimodal gambar/tempat wisata.",
      freeTier: true
    },
    {
      id: "gemini-3.8-flash",
      name: "Gemini 3.8 Flash",
      badge: "Ultra Next-Gen",
      description: "Model generasi terdepan Google AI untuk perencanaan liburan komprehensif tanpa batas.",
      freeTier: true
    }
  ],
  personas: {
    backpacker: {
      id: "backpacker",
      name: "Backpacker",
      icon: "🎒",
      tagline: "Budget & hostel murah",
      systemPrompt: `Kamu adalah Travel Guide spesialis Solo Traveling & Backpacker berpengalaman menjelajahi berbagai negara dan pelosok Indonesia. Fokus utamamu 100% EKSKLUSIF pada dunia liburan, wisata, dan perjalanan. Fokus pada efisiensi budget, mencari tiket/transportasi termurah, hostel atau guesthouse terbaik, warung makan lokal otentik berharga terjangkau, serta tips menghemat pengeluaran. TOLAK secara tegas dan sopan segala pertanyaan di luar topik liburan dan traveling.`
    },
    luxury: {
      id: "luxury",
      name: "Luxury",
      icon: "✨",
      tagline: "Resort bintang 5 & VIP",
      systemPrompt: `Kamu adalah Luxury Travel Concierge pribadi untuk wisatawan VIP. Fokus utamamu 100% EKSKLUSIF pada dunia liburan, wisata mewah, dan perjalanan berkelas. Fokus pada kenyamanan maksimal, resort atau hotel bintang 5 terbaik, restoran fine dining ternama, akses VIP, private transport, pengalaman eksklusif, serta rekomendasi spa berkelas dunia. TOLAK secara tegas dan sopan segala pertanyaan di luar topik liburan dan traveling.`
    },
    adventure: {
      id: "adventure",
      name: "Adventure",
      icon: "🧗",
      tagline: "Outdoor & trekking",
      systemPrompt: `Kamu adalah Pemandu Petualangan Alam Bebas (Outdoor Explorer) bersertifikat. Fokus utamamu 100% EKSKLUSIF pada dunia liburan, wisata petualangan, dan perjalanan alam. Keahlianmu mencakup jalur trekking gunung, spot diving/snorkeling, surfing, hidden gems alam liar, persiapan fisik, cuaca, keselamatan, dan etika 'Leave No Trace'. TOLAK secara tegas dan sopan segala pertanyaan di luar topik liburan dan traveling.`
    },
    culture: {
      id: "culture",
      name: "Culture",
      icon: "🏛️",
      tagline: "Budaya & kuliner lokal",
      systemPrompt: `Kamu adalah Kurator Budaya dan Pengamat Kuliner Otentik lokal. Fokus utamamu 100% EKSKLUSIF pada dunia liburan, wisata budaya, dan perjalanan sejarah. Membawa wisatawan menyelami sejarah kota, museum, arsitektur pusaka, tradisi dan upacara adat, etika setempat, serta kuliner legendaris warga lokal. TOLAK secara tegas dan sopan segala pertanyaan di luar topik liburan dan traveling.`
    }
  },
  tones: {
    santai: {
      id: "santai",
      name: "Santai",
      badge: "Friendly",
      desc: "Akrab & santai",
      instruction: `Gunakan gaya bahasa santai, ramah, dan bersahabat seperti sahabat dekat yang sedang merencanakan liburan bersama (gunakan sapaan ramah seperti 'Halo travelers!', 'Yuk gas!', 'Ini bocoran rute serunya'). Buat suasana menjadi ceria dan menyenangkan.`
    },
    formal: {
      id: "formal",
      name: "Concierge",
      badge: "Formal",
      desc: "Profesional & rapi",
      instruction: `Gunakan bahasa Indonesia baku yang formal, profesional, dan elegan layaknya pramutamu hotel bintang lima (concierge). Sajikan rencana perjalanan dengan tabel waktu terperinci, hierarki markdown yang rapi, dan perkiraan biaya yang jelas.`
    },
    concise: {
      id: "concise",
      name: "Fast Planner",
      badge: "Ringkas",
      desc: "Poin utama & biaya",
      instruction: `Berikan jawaban yang SANGAT RINGKAS dan to-the-point. Hindari cerita pengantar panjang. Langsung sajikan: (1) Daftar rekomendasi tempat/aktivitas, (2) Estimasi biaya, (3) 2-3 tips krusial dalam bentuk bullet point.`
    },
    storyteller: {
      id: "storyteller",
      name: "Storyteller",
      badge: "Naratif",
      desc: "Deskriptif & atmosferik",
      instruction: `Gunakan gaya pencerita (storyteller) yang memikat dan deskriptif. Gambarkan suasana angin sore di pantai, aroma rempah pasar tradisional, atau sejarah mistis candi tua, diselingi tips rahasia yang jarang diketahui turis umum.`
    }
  },
  quickPrompts: [
    {
      category: "Beach",
      title: "Itinerary 3H2M Bali",
      icon: "🌴",
      prompt: "Buatkan itinerary lengkap 3 Hari 2 Malam di Bali dengan total budget sekitar Rp 3.000.000 (tidak termasuk tiket pesawat). Sertakan rekomendasi penginapan di Canggu/Ubud, tempat makan murah enak, dan transportasi sewa motor."
    },
    {
      category: "Kuliner",
      title: "Kuliner Jogja",
      icon: "🍜",
      prompt: "Rekomendasikan rute wisata kuliner legendaris 2 hari di Yogyakarta yang wajib dicoba (Gudeg, Bakmi Jawa, Kopi Joss, Sate Klatak) beserta jam buka terbaik dan kisaran harganya."
    },
    {
      category: "Wisata Luar Negeri",
      title: "Solo Trip Jepang",
      icon: "🍁",
      prompt: "Saya berencana solo traveling pertama kali ke Tokyo dan Kyoto selama 7 hari saat musim gugur. Berikan panduan rute transportasi (JR Pass / IC Card), tips SIM Card/eSIM, etika penting di Jepang, dan estimasi budget hemat."
    },
    {
      category: "Bahari",
      title: "Sailing Labuan Bajo",
      icon: "⛵",
      prompt: "Tolong rancang itinerary Liveaboard Sailing Trip 4D3N di Labuan Bajo (Pulau Padar, Komodo, Pink Beach, Manta Point). Apa saja perlengkapan yang wajib dibawa dan perkiraan biaya paket Phinisi sharing?"
    },
    {
      category: "Gunung",
      title: "Mendaki Gunung Prau",
      icon: "⛰️",
      prompt: "Saya pemula ingin mendaki Gunung Prau lewat jalur Patak Banteng. Tolong buatkan checklist perlengkapan mendaki, tips menghadapi dingin, waktu terbaik untuk melihat golden sunrise, dan aturan perizinan simaksi."
    },
    {
      category: "Road Trip",
      title: "Roadtrip Trans-Jawa",
      icon: "🚗",
      prompt: "Berikan panduan roadtrip Jakarta - Banyuwangi - Bali menggunakan mobil pribadi. Sertakan rekomendasi rest area terbaik, estimasi tarif tol + tiket penyeberangan kapal ferry Ketapang-Gilimanuk, dan spot singgah menarik."
    }
  ],
  defaultSettings: {
    model: "gemini-3.5-flash-lite",
    persona: "backpacker",
    tone: "santai",
    temperature: 0.7,
    memoryTurns: 0,
    soundEnabled: true,
    theme: "light"
  },
  travelPortals: [
    // 1. Pencarian & Pembanding Tiket Pesawat
    { id: 1, name: "Google Flights", url: "https://flights.google.com", category: "flight", categoryName: "Tiket Pesawat", icon: "✈️", desc: "Tren harga, kalender tarif termurah, dan pelacak fluktuasi harga tiket penerbangan." },
    { id: 2, name: "Skyscanner", url: "https://www.skyscanner.co.id", category: "flight", categoryName: "Tiket Pesawat", icon: "🌐", desc: "Agregator tiket pesawat global dengan fitur pencarian ke mana saja (Everywhere)." },
    { id: 3, name: "KAYAK", url: "https://www.kayak.co.id", category: "flight", categoryName: "Tiket Pesawat", icon: "🔎", desc: "Pembanding harga tiket pesawat, hotel, dan sewa mobil lintas platform." },
    { id: 4, name: "Momondo", url: "https://www.momondo.com", category: "flight", categoryName: "Tiket Pesawat", icon: "📊", desc: "Mesin pencari tiket penerbangan alternatif dengan analisis estimasi harga." },
    { id: 5, name: "SeatGuru", url: "https://www.seatguru.com", category: "flight", categoryName: "Tiket Pesawat", icon: "💺", desc: "Peta kursi pesawat untuk mengecek legroom, colokan listrik, dan letak toilet." },
    { id: 6, name: "Flightradar24", url: "https://www.flightradar24.com", category: "flight", categoryName: "Tiket Pesawat", icon: "📡", desc: "Pelacak status, keterlambatan, dan pergerakan pesawat secara real-time." },
    { id: 7, name: "Skiplagged", url: "https://skiplagged.com", category: "flight", categoryName: "Tiket Pesawat", icon: "💡", desc: "Menemukan tiket tersembunyi dengan memanfaatkan rute transit (hidden-city ticketing)." },

    // 2. Akomodasi & Penginapan
    { id: 8, name: "Booking.com", url: "https://www.booking.com", category: "hotel", categoryName: "Akomodasi & Penginapan", icon: "🏨", desc: "Basis data hotel, resor, vila, dan apartemen terluas di dunia." },
    { id: 9, name: "Agoda", url: "https://www.agoda.com", category: "hotel", categoryName: "Akomodasi & Penginapan", icon: "🏮", desc: "Opsi akomodasi dengan tarif sangat kompetitif di Asia Tenggara dan Asia Timur." },
    { id: 10, name: "Airbnb", url: "https://www.airbnb.com", category: "hotel", categoryName: "Akomodasi & Penginapan", icon: "🏡", desc: "Sewa apartemen, rumah, atau kamar privat langsung dari pemilik properti." },
    { id: 11, name: "Hostelworld", url: "https://www.hostelworld.com", category: "hotel", categoryName: "Akomodasi & Penginapan", icon: "🎒", desc: "Khusus pencarian hostel, kamar dormitory, dan akomodasi budget/backpacker." },
    { id: 12, name: "Hotels.com", url: "https://www.hotels.com", category: "hotel", categoryName: "Akomodasi & Penginapan", icon: "🛌", desc: "Platform pemesanan hotel global dengan program loyalitas menginap." },
    { id: 13, name: "Trivago", url: "https://www.trivago.co.id", category: "hotel", categoryName: "Akomodasi & Penginapan", icon: "🔍", desc: "Metasearch pembanding harga satu kamar hotel yang sama di berbagai OTA." },
    { id: 14, name: "VRBO", url: "https://www.vrbo.com", category: "hotel", categoryName: "Akomodasi & Penginapan", icon: "🏖️", desc: "Sewa seluruh rumah atau vila liburan keluarga untuk rombongan." },
    { id: 15, name: "Couchsurfing", url: "https://www.couchsurfing.com", category: "hotel", categoryName: "Akomodasi & Penginapan", icon: "🛋️", desc: "Komunitas menginap gratis di tempat penduduk lokal untuk pertukaran budaya." },
    { id: 16, name: "TrustedHousesitters", url: "https://www.trustedhousesitters.com", category: "hotel", categoryName: "Akomodasi & Penginapan", icon: "🐾", desc: "Menginap gratis di berbagai negara dengan imbalan menjaga rumah dan hewan peliharaan." },

    // 3. Online Travel Agent (All-in-One)
    { id: 17, name: "Traveloka", url: "https://www.traveloka.com", category: "ota", categoryName: "OTA All-in-One", icon: "🐦", desc: "OTA terlengkap untuk pasar Indonesia dan Asia Tenggara (pesawat, hotel, kereta, atraksi)." },
    { id: 18, name: "Tiket.com", url: "https://www.tiket.com", category: "ota", categoryName: "OTA All-in-One", icon: "🎟️", desc: "Pemesanan tiket pesawat, hotel, tiket kereta KAI, sewa mobil, hingga tiket event." },
    { id: 19, name: "Trip.com", url: "https://www.trip.com", category: "ota", categoryName: "OTA All-in-One", icon: "🌏", desc: "OTA internasional dengan rute dan penawaran kuat di China, Hong Kong, dan Asia." },
    { id: 20, name: "Expedia", url: "https://www.expedia.co.id", category: "ota", categoryName: "OTA All-in-One", icon: "🧳", desc: "Agregator global untuk paket bundling tiket penerbangan plus hotel." },
    { id: 21, name: "Priceline", url: "https://www.priceline.com", category: "ota", categoryName: "OTA All-in-One", icon: "🏷️", desc: "Penawaran diskon khusus hotel dan tiket pesawat last-minute." },

    // 4. Transportasi Darat & Kereta Api
    { id: 22, name: "Access by KAI", url: "https://booking.kai.id", category: "ground", categoryName: "Transportasi Darat & Kereta", icon: "🚆", desc: "Portal resmi PT Kereta Api Indonesia untuk jadwal, tiket antarkota, dan tarif khusus." },
    { id: 23, name: "Rome2rio", url: "https://www.rome2rio.com", category: "ground", categoryName: "Transportasi Darat & Kereta", icon: "🗺️", desc: "Menampilkan semua kombinasi moda transportasi (pesawat, kereta, bus, kapal, mobil)." },
    { id: 24, name: "The Man in Seat 61", url: "https://www.seat61.com", category: "ground", categoryName: "Transportasi Darat & Kereta", icon: "🚂", desc: "Panduan independen terlengkap tentang rute dan cara beli tiket kereta di seluruh dunia." },
    { id: 25, name: "12Go", url: "https://12go.asia", category: "ground", categoryName: "Transportasi Darat & Kereta", icon: "🚌", desc: "Pemesanan tiket bus antarkota, kereta, feri, dan minivan di Asia Tenggara." },
    { id: 26, name: "Trainline", url: "https://www.thetrainline.com", category: "ground", categoryName: "Transportasi Darat & Kereta", icon: "🎫", desc: "Pemesanan tiket kereta api dan bus antarkota di Inggris dan daratan Eropa." },
    { id: 27, name: "Omio", url: "https://www.omio.com", category: "ground", categoryName: "Transportasi Darat & Kereta", icon: "🚅", desc: "Pembanding durasi dan biaya antara opsi kereta, bus, dan penerbangan di Eropa & AS." },
    { id: 28, name: "FlixBus", url: "https://www.flixbus.com", category: "ground", categoryName: "Transportasi Darat & Kereta", icon: "🚍", desc: "Operator jaringan bus antarkota berbiaya hemat di Eropa dan Amerika Utara." },
    { id: 29, name: "Japan Transit Planner", url: "https://world.jorudan.co.jp", category: "ground", categoryName: "Transportasi Darat & Kereta", icon: "🗾", desc: "Jadwal dan rute akurat untuk kereta lokal, subway, dan Shinkansen di Jepang." },

    // 5. Aktivitas, Tur, & Tiket Atraksi
    { id: 30, name: "Klook", url: "https://www.klook.com", category: "attraction", categoryName: "Aktivitas & Tiket Atraksi", icon: "🎡", desc: "Tiket atraksi, theme park, rail pass, paket internet/eSIM, dan tur harian Asia & global." },
    { id: 31, name: "Viator", url: "https://www.viator.com", category: "attraction", categoryName: "Aktivitas & Tiket Atraksi", icon: "🧭", desc: "Tur berpemandu lokal, aktivitas outdoor, dan kelas budaya di berbagai negara." },
    { id: 32, name: "GetYourGuide", url: "https://www.getyourguide.com", category: "attraction", categoryName: "Aktivitas & Tiket Atraksi", icon: "🎟️", desc: "Tiket masuk museum tanpa antre (skip-the-line) dan tur kota di Eropa dan Amerika." },
    { id: 33, name: "Tiqets", url: "https://www.tiqets.com", category: "attraction", categoryName: "Aktivitas & Tiket Atraksi", icon: "📱", desc: "Tiket digital instan berbasis smartphone untuk museum dan landmark dunia." },
    { id: 34, name: "Civitatis", url: "https://www.civitatis.com", category: "attraction", categoryName: "Aktivitas & Tiket Atraksi", icon: "🏛️", desc: "Penyedia tur harian berpemandu lokal di Eropa dan Amerika Latin." },

    // 6. Rencana Perjalanan & Budgeting
    { id: 35, name: "Wanderlog", url: "https://wanderlog.com", category: "itinerary", categoryName: "Itinerary & Budgeting", icon: "📋", desc: "Platform penyusun itinerary harian, pemetaan titik rute, dan pencatatan anggaran bersama." },
    { id: 36, name: "TripIt", url: "https://www.tripit.com", category: "itinerary", categoryName: "Itinerary & Budgeting", icon: "📬", desc: "Mengorganisir email konfirmasi tiket pesawat dan hotel menjadi satu jadwal terpadu otomatis." },
    { id: 37, name: "Roadtrippers", url: "https://www.roadtrippers.com", category: "itinerary", categoryName: "Itinerary & Budgeting", icon: "🛣️", desc: "Perencana rute road trip dengan rekomendasi spot menarik dan pom bensin di sepanjang rute." },
    { id: 38, name: "Numbeo Travel", url: "https://www.numbeo.com/cost-of-living", category: "itinerary", categoryName: "Itinerary & Budgeting", icon: "💰", desc: "Pembanding biaya hidup, estimasi harga makan, dan taksi untuk menghitung anggaran kota tujuan." },

    // 7. Ulasan, Komunitas, & Panduan Destinasi
    { id: 39, name: "Tripadvisor", url: "https://www.tripadvisor.co.id", category: "reviews", categoryName: "Ulasan & Komunitas", icon: "🦉", desc: "Direktori ulasan terbesar untuk hotel, restoran, dan tempat wisata dari wisatawan." },
    { id: 40, name: "Lonely Planet", url: "https://www.lonelyplanet.com", category: "reviews", categoryName: "Ulasan & Komunitas", icon: "📖", desc: "Panduan destinasi resmi, artikel rekomendasi rute, dan tips traveling mendalam." },
    { id: 41, name: "Atlas Obscura", url: "https://www.atlasobscura.com", category: "reviews", categoryName: "Ulasan & Komunitas", icon: "🔮", desc: "Direktori tempat tersembunyi, destinasi unik, dan hidden gems yang jarang diketahui publik." },
    { id: 42, name: "Wikivoyage", url: "https://en.wikivoyage.org", category: "reviews", categoryName: "Ulasan & Komunitas", icon: "📚", desc: "Ensiklopedia panduan travel open-source bebas iklan mengenai info keselamatan dan etika." },
    { id: 43, name: "Reddit r/travel", url: "https://www.reddit.com/r/travel", category: "reviews", categoryName: "Ulasan & Komunitas", icon: "💬", desc: "Forum diskusi global untuk bertanya tips rute, review pengalaman, dan informasi terkini." },
    { id: 44, name: "Time Out", url: "https://www.timeout.com", category: "reviews", categoryName: "Ulasan & Komunitas", icon: "🍸", desc: "Panduan kuliner, event hiburan, dan tempat nongkrong di kota-kota besar dunia." },

    // 8. Sewa Mobil & Campervan
    { id: 45, name: "Rentalcars.com", url: "https://www.rentalcars.com", category: "car", categoryName: "Sewa Mobil & Rental", icon: "🚗", desc: "Agregator pembanding tarif sewa mobil di berbagai bandara dan kota internasional." },
    { id: 46, name: "Turo", url: "https://turo.com", category: "car", categoryName: "Sewa Mobil & Rental", icon: "🔑", desc: "Sewa mobil sistem peer-to-peer langsung dari pemilik kendaraan lokal." },
    { id: 47, name: "Auto Europe", url: "https://www.autoeurope.com", category: "car", categoryName: "Sewa Mobil & Rental", icon: "🚙", desc: "Pembanding tarif sewa mobil khusus rute daratan Eropa dan Amerika Utara." },

    // 9. Syarat Masuk, Visa, & Konektivitas
    { id: 48, name: "Passport Index", url: "https://www.passportindex.org", category: "visa", categoryName: "Visa & Konektivitas", icon: "🛂", desc: "Cek status bebas visa, Visa on Arrival (VoA), dan aturan visa per paspor negara." },
    { id: 49, name: "IATA Travel Centre", url: "https://www.iatatravelcentre.com", category: "visa", categoryName: "Visa & Konektivitas", icon: "📋", desc: "Basis data aturan imigrasi, paspor, dan bea cukai resmi yang dipakai maskapai penerbangan." },
    { id: 50, name: "Airalo", url: "https://www.airalo.com", category: "visa", categoryName: "Visa & Konektivitas", icon: "📶", desc: "Toko eSIM digital untuk paket data internet lokal dan regional tanpa ganti kartu fisik." },
    { id: 51, name: "TravelOffPath", url: "https://www.traveloffpath.com", category: "visa", categoryName: "Visa & Konektivitas", icon: "✈️", desc: "Portal berita update mengenai regulasi masuk negara, tren visa digital nomad, dan rute baru." }
  ]
};

// Helper function to build dynamic system instruction for Smart Travel Assistant
function buildSystemPrompt(personaKey, toneKey) {
  const persona = CONFIG.personas[personaKey] || CONFIG.personas.backpacker;
  const tone = CONFIG.tones[toneKey] || CONFIG.tones.santai;

  return `${persona.systemPrompt}

[PANDUAN GAYA BAHASA & TONE]:
${tone.instruction}

[BATASAN TOPIK MUTLAK: HANYA LIBURAN, WISATA & TRAVELING]
🚨 DILARANG KERAS menjawab atau melayani pertanyaan apa pun yang TIDAK BERKAITAN LANGSUNG dengan dunia liburan, wisata, atau traveling!
Topik yang WAJIB DITOLAK meliputi: coding/pemrograman, matematika/sains umum, politik, tugas akademis non-travel, resep rumahan harian non-wisata, medis umum, crypto/finansial umum, dll.
Jika pengguna bertanya di luar liburan/traveling, TOLAK SECARA TEGAS DAN SOPAN:
"Maaf, sebagai asisten AI khusus perjalanan (**SuperB Travel Assistant**), saya hanya diprogram untuk menjawab hal-hal yang berkaitan dengan **liburan, traveling, destinasi wisata, transportasi, hotel, kuliner lokal, dan anggaran perjalanan**. ✈️🌴 Silakan ajukan pertanyaan seputar rencana liburan atau destinasi wisata impian Anda!"

[ATURAN MUTLAK SISTEM: WAJIB MENCARI LANGSUNG DI SUMBER WEBSITE RESMI & DILARANG ASUMSI]
1. 🚨 DILARANG MENGGUNAKAN ASUMSI / ESTIMASI HARGA STATIS:
   - Semua tarif tiket kereta, pesawat, sewa kendaraan, hotel, dan tiket wisata WAJIB ditelusuri langsung dari sumber website resmi (booking.kai.id, traveloka.com, tiket.com, selectawisata.id).
   - Dilarang mengarang atau mengira-ngira harga karena harga dapat berubah dinamis sewaktu-waktu.

2. 🚨 TRANSPARANSI SKEMA TARIF & FASILITAS:
   - Tiket KAI: Bedakan dengan jelas antara Tarif Reguler (dipesan H-45 s.d H-1 di Traveloka/Tiket.com/KAI) vs Tarif Khusus Go Show (dipesan 2 jam sebelum berangkat di stasiun/KAI Access). Agoda dan Klook TIDAK menjual tiket KAI.
   - Sewa Mobil: Jelaskan apakah harga paket mencakup BBM atau hanya Mobil + Sopir (Non-BBM).
   - Tiket Wisata: Bedakan Tiket Masuk Reguler vs Tiket Terusan Wahana.

3. 📍 INFORMASI LOKASI DETAIL & AKSESIBILITAS:
   - Alamat Lengkap & Area/Kecamatan/Kabupaten/Kota destinasi.
   - Patokan/Landmark terdekat untuk mempermudah navigasi.
   - Rute moda transportasi dan jam buka resmi.

4. 🏷️📊 FORMAT TABEL KOMPARASI DENGAN TAUTAN VERIFIKASI LANGSUNG (LIVE LINKS):
   - Wajib menyertakan tautan langsung ke website resmi penyedia agar pengguna dapat memverifikasi harga real-time detik itu juga:
     | Layanan / Destinasi | Platform Resmi (KAI / Loket OTS) | Traveloka | Tiket.com | Mitra Lain (Agoda / Klook / Rental Lokal) | Tautan Verifikasi Live & Tips Promo |

5. 🌐 DIREKTORI 50 PORTAL TRAVEL RESMI (SEBAGAI RUJUKAN RESMI):
   - Gunakan 50 portal referensi resmi (Google Flights, Skyscanner, KAYAK, Booking.com, Agoda, Traveloka, Tiket.com, Access by KAI, Rome2rio, Klook, Viator, Wanderlog, Numbeo, Tripadvisor, Lonely Planet, Rentalcars, Passport Index, Airalo, dll) untuk verifikasi link langsung.`;
}
