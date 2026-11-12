// ================= SPLASH SCREEN CONTROLLER =================
function initSplashScreen() {
  const splash = document.getElementById('splash-screen');
  const video = document.getElementById('splash-video');
  if (!splash) return;

  let dismissed = false;
  const dismissSplash = () => {
    if (dismissed) return;
    dismissed = true;
    splash.classList.add('fade-out');
    setTimeout(() => {
      splash.style.display = 'none';
      if (video) video.pause();
    }, 650);
  };

  if (video) {
    video.addEventListener('ended', dismissSplash);
    video.addEventListener('error', dismissSplash);
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        setTimeout(dismissSplash, 1500);
      });
    }
  }

  // Maksimal 2.5 detik agar pengguna langsung dapat mengakses aplikasi
  setTimeout(dismissSplash, 2500);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSplashScreen);
} else {
  initSplashScreen();
}

// ================= PWA SERVICE WORKER REGISTRATION =================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/AKW/sw.js').catch(err => console.log('SW Fail', err));
  });
}

// Handle PWA Install Prompt (Agar tombol "Pasang App" berfungsi di HP)
let deferredPrompt;
const btnInstall = document.getElementById('btn-install-pwa');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (btnInstall) btnInstall.classList.remove('hidden');
});

if (btnInstall) {
  btnInstall.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        btnInstall.classList.add('hidden');
      }
      deferredPrompt = null;
    }
  });
}

// ================= DATA STORAGE (LOCALSTORAGE) =================
const KEY_WARGA = 'akw_warga_v2';
const KEY_TX = 'akw_tx_v2';

// Bersihkan data dummy versi lama dari localStorage pengguna jika ada
try {
  localStorage.removeItem('akw_warga_v1');
  localStorage.removeItem('akw_tx_v1');
} catch (e) {
  console.warn('Gagal membersihkan cache versi lama:', e);
}

// Inisialisasi data bersih (mulai dari 0 warga dan Rp 0 saldo)
let stateWarga = [];
try {
  const savedWarga = localStorage.getItem(KEY_WARGA);
  stateWarga = savedWarga ? JSON.parse(savedWarga) : [];
  if (!Array.isArray(stateWarga)) stateWarga = [];
} catch (e) {
  stateWarga = [];
}

let stateTx = [];
try {
  const savedTx = localStorage.getItem(KEY_TX);
  stateTx = savedTx ? JSON.parse(savedTx) : [];
  if (!Array.isArray(stateTx)) stateTx = [];
} catch (e) {
  stateTx = [];
}

// ================= NAVIGASI TAB =================
window.pindahTab = function(tabName, txType = null) {
  document.querySelectorAll('.tab-page').forEach(el => el.classList.add('hidden'));
  const target = document.getElementById(`tab-${tabName}`);
  if (target) target.classList.remove('hidden');

  // Nav highlights
  const tabs = ['dashboard', 'warga', 'transaksi', 'riwayat'];
  tabs.forEach(t => {
    const btn = document.getElementById(`nav-${t}`);
    if (btn) {
      if (t === tabName) {
        btn.classList.add('text-blue-600');
        btn.classList.remove('text-slate-400');
      } else {
        btn.classList.remove('text-blue-600');
        btn.classList.add('text-slate-400');
      }
    }
  });

  if (tabName === 'transaksi' && txType) {
    const radio = document.querySelector(`input[name="tx-tipe"][value="${txType}"]`);
    if (radio) radio.checked = true;
  }

  // Refresh isi tab
  if (tabName === 'dashboard') renderDashboard();
  if (tabName === 'warga') renderWarga();
  if (tabName === 'riwayat') renderRiwayat();
  if (tabName === 'transaksi') populateWargaOptions();
};

// ================= DASHBOARD =================
function renderDashboard() {
  const masuk = stateTx.filter(t => t.jenis === 'pemasukan').reduce((a, b) => a + Number(b.nominal), 0);
  const keluar = stateTx.filter(t => t.jenis === 'pengeluaran').reduce((a, b) => a + Number(b.nominal), 0);
  const saldo = masuk - keluar;

  document.getElementById('dash-total-saldo').textContent = 'Rp ' + saldo.toLocaleString('id-ID');
  document.getElementById('dash-masuk').textContent = '+ Rp ' + masuk.toLocaleString('id-ID');
  document.getElementById('dash-keluar').textContent = '- Rp ' + keluar.toLocaleString('id-ID');
  document.getElementById('dash-total-warga').textContent = stateWarga.length + ' Warga';

  // 5 transaksi terakhir
  const container = document.getElementById('dash-recent-list');
  const recents = [...stateTx].reverse().slice(0, 5);
  
  if (recents.length === 0) {
    container.innerHTML = '<p class="text-slate-400 text-center py-4">Belum ada transaksi</p>';
    return;
  }

  container.innerHTML = recents.map(t => `
    <div class="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
      <div>
        <p class="font-bold text-slate-800">${t.kategori}</p>
        <p class="text-[10px] text-slate-500">${t.tanggal} ${t.namaWarga ? '· ' + t.namaWarga : ''}</p>
      </div>
      <span class="font-extrabold ${t.jenis === 'pemasukan' ? 'text-emerald-600' : 'text-rose-600'}">
        ${t.jenis === 'pemasukan' ? '+' : '-'} Rp ${Number(t.nominal).toLocaleString('id-ID')}
      </span>
    </div>
  `).join('');
}

// ================= DATA WARGA =================
function renderWarga(filter = '') {
  const container = document.getElementById('list-warga-container');
  const badge = document.getElementById('badge-total-warga');
  if (badge) badge.textContent = `${stateWarga.length} warga`;

  const query = filter.toLowerCase().trim();
  const filtered = stateWarga.filter(w => 
    w.nama.toLowerCase().includes(query) || 
    w.alamat.toLowerCase().includes(query)
  );

  if (filtered.length === 0) {
    const pesan = stateWarga.length === 0 
      ? 'Belum ada data warga terdaftar. Silakan gunakan formulir di atas untuk menambah warga baru.' 
      : 'Warga tidak ditemukan.';
    if (container) container.innerHTML = `<p class="text-xs text-slate-400 text-center py-6">${pesan}</p>`;
    return;
  }

  if (container) {
    container.innerHTML = filtered.map((w, idx) => `
      <div class="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
        <div>
          <p class="font-bold text-slate-800 text-xs">${w.nama}</p>
          <p class="text-[11px] text-slate-500">📍 Blok ${w.alamat} ${w.hp ? '· 📞 ' + w.hp : ''}</p>
        </div>
        <button onclick="hapusWarga(${idx})" class="text-slate-300 hover:text-rose-500 text-sm p-1.5 transition">
          🗑️
        </button>
      </div>
    `).join('');
  }
}

document.getElementById('cari-warga')?.addEventListener('input', (e) => {
  renderWarga(e.target.value);
});

document.getElementById('form-tambah-warga')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const nama = document.getElementById('w-nama').value.trim();
  const alamat = document.getElementById('w-alamat').value.trim();
  const hp = document.getElementById('w-hp').value.trim();

  stateWarga.unshift({ nama, alamat, hp });
  localStorage.setItem(KEY_WARGA, JSON.stringify(stateWarga));
  e.target.reset();
  renderWarga();
  renderDashboard();
  populateWargaOptions();
  alert(`Warga ${nama} berhasil ditambahkan!`);
});

window.hapusWarga = function(idx) {
  if (confirm(`Hapus data ${stateWarga[idx].nama}?`)) {
    stateWarga.splice(idx, 1);
    localStorage.setItem(KEY_WARGA, JSON.stringify(stateWarga));
    renderWarga();
    renderDashboard();
    populateWargaOptions();
  }
};

// ================= TRANSAKSI =================
function populateWargaOptions() {
  const sel = document.getElementById('tx-warga-select');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Pilih Nama Warga (Opsional) --</option>' +
    stateWarga.map(w => `<option value="${w.nama}">${w.nama} (${w.alamat})</option>`).join('');
  
  const dateInput = document.getElementById('tx-date');
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().slice(0, 10);
  }
}

document.getElementById('form-transaksi')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const jenis = document.querySelector('input[name="tx-tipe"]:checked').value;
  const tanggal = document.getElementById('tx-date').value;
  const kategori = document.getElementById('tx-kategori').value;
  const namaWarga = document.getElementById('tx-warga-select').value;
  const nominal = Number(document.getElementById('tx-nominal').value);
  const note = document.getElementById('tx-note').value.trim();

  const baru = {
    id: Date.now(),
    tanggal,
    jenis,
    kategori,
    namaWarga,
    nominal,
    note
  };

  stateTx.push(baru);
  localStorage.setItem(KEY_TX, JSON.stringify(stateTx));
  e.target.reset();
  alert('Transaksi berhasil dicatat!');
  pindahTab('dashboard');
});

// ================= RIWAYAT =================
function renderRiwayat() {
  const container = document.getElementById('full-history-list');
  const reversed = [...stateTx].reverse();

  if (reversed.length === 0) {
    container.innerHTML = '<p class="text-xs text-slate-400 text-center py-6">Belum ada riwayat transaksi.</p>';
    return;
  }

  container.innerHTML = reversed.map(t => `
    <div class="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between text-xs">
      <div class="space-y-0.5">
        <div class="flex items-center gap-2">
          <span class="font-bold text-slate-800">${t.kategori}</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded ${t.jenis === 'pemasukan' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'} font-semibold">
            ${t.jenis}
          </span>
        </div>
        <p class="text-[11px] text-slate-500">${t.tanggal} ${t.namaWarga ? '· ' + t.namaWarga : ''}</p>
        ${t.note ? `<p class="text-[10px] text-slate-400 italic">${t.note}</p>` : ''}
      </div>
      <div class="text-right">
        <span class="font-black ${t.jenis === 'pemasukan' ? 'text-emerald-600' : 'text-rose-600'}">
          ${t.jenis === 'pemasukan' ? '+' : '-'} Rp ${Number(t.nominal).toLocaleString('id-ID')}
        </span>
      </div>
    </div>
  `).join('');
}

window.eksporDataJSON = function() {
  const data = {
    warga: stateWarga,
    transaksi: stateTx,
    exportDate: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup_akw_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
};

// Fungsi reset manual untuk mengembalikan data ke kondisi 0
window.resetSemuaData = function() {
  if (confirm('Apakah Anda yakin ingin mengosongkan seluruh data warga dan transaksi ke kondisi 0?')) {
    localStorage.removeItem(KEY_WARGA);
    localStorage.removeItem(KEY_TX);
    stateWarga = [];
    stateTx = [];
    renderDashboard();
    renderWarga();
    populateWargaOptions();
    renderRiwayat();
    alert('Seluruh data berhasil dibersihkan kembali ke kondisi 0!');
  }
};

// ================= INISIALISASI =================
renderDashboard();
renderWarga();
populateWargaOptions();
