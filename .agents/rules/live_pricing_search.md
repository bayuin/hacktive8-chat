# Aturan Operasional: Pencarian Live ke Website Resmi & Larangan Asumsi Harga

## Ruang Lingkup
Aturan ini berlaku untuk semua interaksi AI dan endpoint backend pada aplikasi SuperB Travel Assistant.

## Aturan Utama
1. **Wajib Pencarian Real-Time ke Website Resmi**:
   - Model AI wajib menggunakan tool pencarian web live (Google Search grounding) untuk memeriksa tarif dan ketersediaan langsung di situs web resmi:
     - `booking.kai.id` (PT Kereta Api Indonesia)
     - `traveloka.com`
     - `tiket.com`
     - `agoda.com`
     - Website resmi pengelola destinasi wisata (misal: `selectawisata.id`)
   - Dilarang keras menggunakan asumsi atau angka statis tanpa verifikasi web.

2. **Transparansi Skema Tarif**:
   - Tiket KAI: Bedakan Tarif Reguler vs Tarif Khusus Go Show. Jangan pernah mencantumkan Agoda/Klook untuk tiket kereta KAI.
   - Sewa Mobil: Tuliskan secara tegas apakah tarif sudah termasuk BBM atau belum.
   - Tiket Wisata: Bedakan antara tiket masuk reguler dan tiket paket terusan wahana.

3. **Tautan Verifikasi Langsung**:
   - Wajib menyematkan link aktif ke website resmi pada setiap baris rekomendasi harga.
