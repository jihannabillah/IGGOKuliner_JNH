/**
 * ==============================================================
 * IGGO KULINER — CORE CRM & LOYALTY ENGINE
 * Iwan Goreng-Goreng (Since 2005)
 * ==============================================================
 * 
 * Features:
 * 1. Google Sheets GViz Real-time Database Reader with Error Isolation
 * 2. Headless Google Form Registration Integration (No Login Required)
 * 3. Modern Luxury VIP Member Card (Front & Back - Obsidian & Gold Style)
 * 4. Separate 10-Stamp Interactive Loyalty Card with Milestone Rewards
 * 5. Robust QR Code & URL Routing (Auto-detects ?id=... and #portalCek?id=...)
 * 6. LocalStorage Caching for Instant Card Re-opening
 * 7. Cashier Simulation Panel for Presentations
 */

// ==============================================================
// 1. GLOBAL CONFIGURATION & CONSTANTS
// ==============================================================
const CONFIG = {
    SPREADSHEET_ID: "1Xe_lvitL8N7qhwQ1e0c7DQ4ErHnzWzGeImfHkyab7lc",
    SHEET_GID: "2034393288",
    GOOGLE_FORM_VIEW_URL: "https://docs.google.com/forms/d/e/1FAIpQLSckXFMlNVy-K0sozoJkI-Chx5uKuJaAT0sIZFyDg96AlTF8dA/viewform",
    FORM_RESPONSE_URL: "https://docs.google.com/forms/d/e/1FAIpQLSckXFMlNVy-K0sozoJkI-Chx5uKuJaAT0sIZFyDg96AlTF8dA/formResponse",
    STORAGE_KEY: "iggo_crm_active_member"
};

// Application State
let currentMemberData = null;
let isFormSubmitted = false;
let simulatedStampCount = null;

// Safe DOM Setters (Mencegah runtime crash jika salah satu ID DOM absen)
function setElText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = (text !== undefined && text !== null) ? text : "-";
}

function setElSrc(id, src) {
    const el = document.getElementById(id);
    if (el) el.src = src || "";
}

// ==============================================================
// 2. INITIALIZATION & URL ROUTING
// ==============================================================
window.addEventListener("DOMContentLoaded", () => {
    initApp();
});

function initApp() {
    // Set default tanggal pendaftaran ke hari ini (YYYY-MM-DD)
    const today = new Date().toISOString().split("T")[0];
    const tglInput = document.getElementById("regTanggal");
    if (tglInput) tglInput.value = today;

    // Robust URL Query & Hash Parsing
    // Mendukung ?id=JNH-016 ATAU #portalCek?id=JNH-016 ATAU ?id=JNH-016#portalCek
    let queryId = "";
    const searchParams = new URLSearchParams(window.location.search);
    queryId = searchParams.get("id") || searchParams.get("wa") || searchParams.get("email");

    if (!queryId && window.location.hash.includes("?")) {
        const hashQuery = window.location.hash.substring(window.location.hash.indexOf("?") + 1);
        const hashParams = new URLSearchParams(hashQuery);
        queryId = hashParams.get("id") || hashParams.get("wa") || hashParams.get("email");
    }

    if (queryId) {
        document.getElementById("queryInput").value = queryId;
        const portal = document.getElementById("portalCek");
        if (portal) portal.scrollIntoView({ behavior: "smooth" });
        searchMember();
    } else {
        // Cek apakah ada kartu tersimpan di LocalStorage perangkat ini
        checkLocalStorageCache();
    }
}

// Cek LocalStorage untuk memuat kartu terakhir yang dibuka pengguna
function checkLocalStorageCache() {
    try {
        const cached = localStorage.getItem(CONFIG.STORAGE_KEY);
        if (cached) {
            const data = JSON.parse(cached);
            if (data && data.idMember) {
                document.getElementById("queryInput").value = data.idMember;
            }
        }
    } catch (e) {
        console.warn("LocalStorage tidak dapat diakses", e);
    }
}

// ==============================================================
// 3. TAB CONTROLLERS & FORM SWITCHERS
// ==============================================================
function switchFormTab(tab) {
    const nativeCont = document.getElementById("nativeFormContainer");
    const gformCont = document.getElementById("gformContainer");
    const btnNative = document.getElementById("tabBtnNative");
    const btnGform = document.getElementById("tabBtnGform");

    if (tab === "native") {
        if (nativeCont) nativeCont.classList.remove("hidden");
        if (gformCont) gformCont.classList.add("hidden");
        if (btnNative) btnNative.className = "bg-iggo-maroon text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-sm";
        if (btnGform) btnGform.className = "bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold px-4 py-2 rounded-xl transition";
    } else {
        if (nativeCont) nativeCont.classList.add("hidden");
        if (gformCont) gformCont.classList.remove("hidden");
        if (btnGform) btnGform.className = "bg-iggo-maroon text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-sm";
        if (btnNative) btnNative.className = "bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold px-4 py-2 rounded-xl transition";
    }
}

function toggleEmbedIframe() {
    const wrapper = document.getElementById("embedIframeWrapper");
    const btn = document.getElementById("btnToggleIframe");
    if (!wrapper || !btn) return;
    if (wrapper.classList.contains("hidden")) {
        wrapper.classList.remove("hidden");
        btn.textContent = "Sembunyikan Sematan Form";
    } else {
        wrapper.classList.add("hidden");
        btn.textContent = "Tampilkan Sematan Form di Sini";
    }
}

// ==============================================================
// 4. GOOGLE FORM SUBMISSION ENGINE (FETCH NO-CORS DIRECT)
// ==============================================================
async function submitMemberForm(event) {
    if (event) event.preventDefault();

    const btn = document.getElementById("btnSubmitReg");
    const origBtnHtml = btn ? btn.innerHTML : "";
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span class="inline-block animate-spin mr-2">⏳</span> Mengirim & Menerbitkan Kartu VIP...`;
    }

    const nama = document.getElementById("regNama") ? document.getElementById("regNama").value.trim() : "";
    const alamat = document.getElementById("regAlamat") ? document.getElementById("regAlamat").value.trim() : "";
    const hp = document.getElementById("regHp") ? document.getElementById("regHp").value.trim() : "";
    const ig = document.getElementById("regIg") ? document.getElementById("regIg").value.trim() : "";
    const email = document.getElementById("regEmail") ? document.getElementById("regEmail").value.trim() : "";
    const tgl = document.getElementById("regTanggal") ? document.getElementById("regTanggal").value.trim() : "";

    if (!nama || !alamat || !hp || !email || !tgl) {
        alert("Harap lengkapi semua bidang pendaftaran bertanda bintang (*).");
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origBtnHtml;
        }
        return false;
    }

    // Siapkan URLSearchParams untuk submission resmi Google Form
    const params = new URLSearchParams();
    params.append("entry.888845442", nama);
    params.append("entry.766062255", alamat);
    params.append("entry.1122809671", hp);
    params.append("entry.483052779", ig || "-");
    params.append("entry.1889733905", email);
    params.append("entry.143165978", tgl);

    const formUrl = "https://docs.google.com/forms/d/e/1FAIpQLSckXFMlNVy-K0sozoJkI-Chx5uKuJaAT0sIZFyDg96AlTF8dA/formResponse";

    try {
        await fetch(formUrl, {
            method: "POST",
            mode: "no-cors",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: params.toString()
        });
    } catch (e) {
        console.warn("Direct fetch notification:", e);
    }

    // Reset Form
    const regForm = document.getElementById("formPendaftaran");
    if (regForm) regForm.reset();
    const tglInput = document.getElementById("regTanggal");
    if (tglInput) tglInput.value = new Date().toISOString().split("T")[0];

    if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<span>✨</span> Buat Kartu Member VIP Sekarang (Otomatis)`;
    }

    alert(`🎉 Pendaftaran ${nama} berhasil dikirim ke Google Sheets!\nSistem sedang menyiapkan Kartu Member VIP resmi Anda...`);

    // Isi kolom pencarian kartu dengan No. HP pendaftar
    const queryInput = document.getElementById("queryInput");
    if (queryInput) queryInput.value = hp || email;

    // Scroll ke bagian kartu member
    const portalCek = document.getElementById("portalCek");
    if (portalCek) portalCek.scrollIntoView({ behavior: "smooth" });

    // Tunggu jeda agar formula Google Sheets membuat ID resmi (JNH-xxx)
    setTimeout(async () => {
        const ok = await searchMember(true);
        if (!ok) {
            setTimeout(async () => {
                await searchMember(false);
            }, 2500);
        }
    }, 2000);

    return false;
}

// Fallback jika iframe form response dipanggil
function onIframeFormResponse() {
    // Dipelihara untuk kompatibilitas jika iframe digunakan
}

// ==============================================================
// 5. GOOGLE SHEETS GVIZ DATA FETCHER & SEARCH ENGINE
// ==============================================================
function quickTestSearch(id) {
    const input = document.getElementById("queryInput");
    if (input) input.value = id;
    searchMember();
}

async function searchMember(silent = false) {
    const input = document.getElementById("queryInput");
    const query = input ? input.value.trim().toLowerCase() : "";
    if (!query) {
        if (!silent) alert("Silakan masukkan ID Member, No. HP, atau Email Anda terlebih dahulu.");
        return false;
    }

    const loading = document.getElementById("loadingIndicator");
    const content = document.getElementById("portalContent");
    if (loading) loading.classList.remove("hidden");
    if (content) content.classList.add("hidden");

    let rows = [];
    let colMap = {
        nama: 1,
        alamat: 2,
        hp: 3,
        ig: 4,
        tanggal: 5,
        email: 6,
        idMember: 7,
        barcode: 8,
        totalCap: 9
    };

    // LANGKAH 1: FETCH DATA SPREADSHEET (NO CACHE & TIMESTAMP BUSTING)
    try {
        const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SPREADSHEET_ID}/gviz/tq?tqx=out:json&gid=${CONFIG.SHEET_GID}&_t=${Date.now()}`;
        const res = await fetch(url, { cache: "no-store" });
        const text = await res.text();
        const jsonString = text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1);
        const data = JSON.parse(jsonString);
        rows = (data && data.table && data.table.rows) ? data.table.rows : [];

        if (data.table && data.table.cols && data.table.cols.length > 0) {
            data.table.cols.forEach((col, idx) => {
                if (!col || !col.label) return;
                const lbl = col.label.trim().toLowerCase();
                if (lbl.includes("id") && lbl.includes("member")) colMap.idMember = idx;
                else if (lbl.includes("nama")) colMap.nama = idx;
                else if (lbl.includes("alamat")) colMap.alamat = idx;
                else if (lbl.includes("instagram") || lbl.includes("ig")) colMap.ig = idx;
                else if (lbl.includes("email")) colMap.email = idx;
                else if (lbl.includes("tanggal")) colMap.tanggal = idx;
                else if (lbl.includes("hp") || lbl.includes("wa") || lbl.includes("telepon")) colMap.hp = idx;
                else if (lbl.includes("barcode") || lbl.includes("qr")) colMap.barcode = idx;
                else if (lbl.includes("total cap") || lbl.includes("cap")) colMap.totalCap = idx;
            });
        }
    } catch (networkErr) {
        if (loading) loading.classList.add("hidden");
        console.error("Gagal terhubung ke Google Sheets:", networkErr);
        alert("Gagal membaca database Google Sheets.\nPastikan koneksi internet aktif dan izin berbagi spreadsheet adalah 'Anyone with the link' (Viewer).");
        return;
    }

    if (loading) loading.classList.add("hidden");

    // LANGKAH 2: CARI DATA MEMBER
    let found = null;
    const numOnlyQuery = query.replace(/[^0-9]/g, "");

    for (let r of rows) {
        if (!r.c) continue;

        const getVal = (idx) => {
            if (!r.c[idx]) return "";
            return (r.c[idx].f || String(r.c[idx].v || "")).trim();
        };

        const nama = getVal(colMap.nama);
        const alamat = getVal(colMap.alamat);
        const hpRaw = getVal(colMap.hp);
        const hpNum = hpRaw.replace(/[^0-9]/g, "");
        const ig = getVal(colMap.ig);
        const tanggal = getVal(colMap.tanggal);
        const email = getVal(colMap.email);
        const idMember = getVal(colMap.idMember);
        const barcodeRaw = getVal(colMap.barcode);

        let totalCap = 0;
        if (r.c[colMap.totalCap] && r.c[colMap.totalCap].v !== null) {
            totalCap = Number(r.c[colMap.totalCap].v) || 0;
        }

        const matchId = idMember && idMember.toLowerCase() === query;
        const matchEmail = email && email.toLowerCase() === query;
        const matchHp = numOnlyQuery.length >= 8 && hpNum.endsWith(numOnlyQuery.slice(-8));

        if (matchId || matchEmail || matchHp) {
            found = {
                nama: nama || "-",
                alamat: alamat || "-",
                hp: hpRaw || "-",
                ig: ig || "-",
                tanggal: tanggal || "-",
                email: email || "-",
                idMember: idMember || "-",
                barcode: barcodeRaw,
                totalCap: totalCap
            };
            break;
        }
    }

    // LANGKAH 3: RENDER HASIL
    if (found) {
        currentMemberData = found;
        simulatedStampCount = null;
        saveToLocalStorage(found);
        try {
            renderCard(found);
            if (content) content.classList.remove("hidden");
        } catch (renderErr) {
            console.error("Kesalahan saat merender kartu:", renderErr);
        }
        return true;
    } else {
        if (!silent) {
            alert("Data Member tidak ditemukan.\nPastikan ID Member (misal: JNH-016), No. HP, atau Email Anda sudah terdaftar di Google Form.");
        }
        return false;
    }
}

function saveToLocalStorage(data) {
    try {
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn("Gagal menyimpan ke LocalStorage", e);
    }
}

// ==============================================================
// 6. RENDER DUA KARTU: KARTU MEMBER CETAK & LOYALTY CARD 10 CAP
// ==============================================================
function renderCard(m) {
    const effectiveCap = simulatedStampCount !== null ? simulatedStampCount : m.totalCap;

    // --- BAGIAN 1: KARTU MEMBER CETAK (MODERN LUXURY VIP CARD) ---
    // Depan
    setElText("printCardNama", m.nama);
    setElText("printCardId", m.idMember);
    setElText("printCardDate", "MEMBER SEJAK: " + m.tanggal);

    // Belakang
    setElText("printCardBackId", "ID: " + m.idMember);
    setElText("printCardBackNama", m.nama);

    // QR Code URL Generator (Standar ?id=[ID_MEMBER]#portalCek)
    const targetUrl = window.location.origin + window.location.pathname + "?id=" + encodeURIComponent(m.idMember) + "#portalCek";
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=3&data=${encodeURIComponent(targetUrl)}`;
    setElSrc("printCardQr", qrApiUrl);

    // --- BAGIAN 2: KARTU LOYALITAS (LOYALTY STAMP CARD - 10 CAP) ---
    setElText("loyaltyNama", m.nama);
    setElText("loyaltyId", m.idMember);
    setElText("loyaltyCountText", `${effectiveCap} / 10 Cap Terkumpul`);

    // Render 10 Slot Stempel Interaktif di Loyalty Card
    const grid = document.getElementById("loyaltyStampsGrid");
    if (grid) {
        grid.innerHTML = "";
        for (let i = 1; i <= 10; i++) {
            const isFilled = i <= effectiveCap;
            const slot = document.createElement("div");
            let baseClass = "h-12 sm:h-14 flex flex-col items-center justify-center rounded-2xl text-xs font-bold transition-all ";

            if (isFilled) {
                if (i === 5) {
                    slot.className = baseClass + "bg-gradient-to-br from-amber-400 to-yellow-600 text-iggo-dark shadow-md border-2 border-yellow-300 font-extrabold";
                    slot.innerHTML = "<span class='text-base'>🍹</span><span class='text-[9px]'>Cap 5 Free</span>";
                } else if (i === 10) {
                    slot.className = baseClass + "bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-500 text-iggo-dark shadow-lg border-2 border-white animate-subtle font-black";
                    slot.innerHTML = "<span class='text-base'>👑</span><span class='text-[9px]'>50% OFF</span>";
                } else {
                    slot.className = baseClass + "bg-gradient-to-br from-iggo-amber to-red-600 text-white shadow-sm border border-orange-300";
                    slot.innerHTML = "<span class='text-sm'>🍤</span><span class='text-[8px] opacity-80'>Cap " + i + "</span>";
                }
            } else {
                if (i === 5) {
                    slot.className = baseClass + "bg-white/10 text-yellow-300 border-2 border-dashed border-yellow-400/60";
                    slot.innerHTML = "<span class='text-xs'>5</span><span class='text-[8px] text-yellow-200'>FREE TEH</span>";
                } else if (i === 10) {
                    slot.className = baseClass + "bg-white/10 text-yellow-300 border-2 border-dashed border-yellow-400/80";
                    slot.innerHTML = "<span class='text-xs'>10</span><span class='text-[8px] text-yellow-200'>50% OFF</span>";
                } else {
                    slot.className = baseClass + "bg-white/5 text-stone-400 border border-dashed border-white/20";
                    slot.innerHTML = "<span class='text-xs'>" + i + "</span>";
                }
            }
            grid.appendChild(slot);
        }
    }

    // Milestone Reward Banner Detail
    const banner = document.getElementById("rewardBanner");
    if (banner) {
        const rem = 10 - effectiveCap;
        if (effectiveCap >= 10) {
            banner.className = "bg-gradient-to-r from-yellow-100 to-amber-100 border-2 border-yellow-400 rounded-2xl p-4 text-center text-xs text-amber-950 font-bold leading-relaxed shadow-md";
            banner.innerHTML = "👑 <strong>Luar Biasa! 10 Cap Lengkap Tercapai.</strong><br>Tunjukkan kartu ini ke kasir IGGO Kuliner sekarang untuk klaim <strong>Diskon 50% All Menu</strong> atau <strong>1 Porsi Menu Signature Spesial</strong>!";
        } else if (effectiveCap >= 5) {
            banner.className = "bg-gradient-to-r from-orange-50 to-amber-50 border border-amber-300 rounded-2xl p-4 text-center text-xs text-amber-900 font-medium leading-relaxed shadow-sm";
            banner.innerHTML = `🍹 <strong>Cap ke-5 Tercapai (Klaim Free Es Teh Jumbo)!</strong><br>Kumpulkan <strong>${rem} stempel lagi</strong> untuk membuka Hadiah Akbar <strong>Diskon 50%</strong> di Cap ke-10!`;
        } else {
            banner.className = "bg-gradient-to-r from-amber-50/70 to-orange-50/70 border border-amber-200 rounded-2xl p-4 text-center text-xs text-stone-700 font-medium leading-relaxed shadow-sm";
            banner.innerHTML = `✨ Kumpulkan <strong>${5 - effectiveCap} stempel lagi</strong> untuk menikmati <strong>Free Es Teh Jumbo Segar</strong> di Cap ke-5!`;
        }
    }

    // --- BAGIAN 3: BIODATA ANGGOTA LENGKAP ---
    setElText("viewAlamat", m.alamat);
    setElText("viewHp", m.hp);
    setElText("viewIg", m.ig.startsWith("@") ? m.ig : (m.ig !== "-" ? "@" + m.ig : "-"));
    setElText("viewEmail", m.email);
    setElText("viewTanggal", "Terdaftar: " + m.tanggal);
}

// ==============================================================
// 7. CETAK & UNDUH KARTU MEMBER (PRINT & HTML2CANVAS)
// ==============================================================
function printMemberCard() {
    window.print();
}

async function downloadCardFront() {
    if (!currentMemberData) return;
    const btn = document.getElementById("btnDownloadFront");
    const originalText = btn ? btn.innerHTML : "";
    if (btn) {
        btn.innerHTML = `<span class="inline-block animate-spin mr-1">⏳</span> Menyimpan...`;
        btn.disabled = true;
    }

    try {
        const cardEl = document.getElementById("memberCardFront");
        const canvas = await html2canvas(cardEl, {
            scale: 3,
            useCORS: true,
            backgroundColor: null
        });

        const imgUrl = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.href = imgUrl;
        downloadLink.download = `Kartu-VIP-Depan-${currentMemberData.idMember}-${currentMemberData.nama.replace(/\s+/g, '_')}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    } catch (err) {
        console.error(err);
        alert("Gagal mengunduh kartu. Anda juga dapat menggunakan tombol Cetak Kartu.");
    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
}

async function downloadCardBack() {
    if (!currentMemberData) return;
    const btn = document.getElementById("btnDownloadBack");
    const originalText = btn ? btn.innerHTML : "";
    if (btn) {
        btn.innerHTML = `<span class="inline-block animate-spin mr-1">⏳</span> Menyimpan...`;
        btn.disabled = true;
    }

    try {
        const cardEl = document.getElementById("memberCardBack");
        const canvas = await html2canvas(cardEl, {
            scale: 3,
            useCORS: true,
            backgroundColor: null
        });

        const imgUrl = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.href = imgUrl;
        downloadLink.download = `Kartu-VIP-Belakang-${currentMemberData.idMember}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    } catch (err) {
        console.error(err);
        alert("Gagal mengunduh sisi belakang kartu.");
    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
}

// ==============================================================
// 8. SOCIAL SHARING & CLIPBOARD
// ==============================================================
function shareToWhatsApp() {
    if (!currentMemberData) return;
    const targetUrl = window.location.origin + window.location.pathname + "?id=" + encodeURIComponent(currentMemberData.idMember) + "#portalCek";
    const msg = `Halo Kasir IGGO Kuliner! Saya pemegang Kartu VIP Member:\n\n*Nama:* ${currentMemberData.nama}\n*ID Member:* ${currentMemberData.idMember}\n*Cek Kartu:* ${targetUrl}\n\nSaya ingin memesan menu dan memproses stempel loyalty hari ini. Terima kasih!`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, "_blank");
}

function copyCardLink() {
    if (!currentMemberData) return;
    const targetUrl = window.location.origin + window.location.pathname + "?id=" + encodeURIComponent(currentMemberData.idMember) + "#portalCek";
    navigator.clipboard.writeText(targetUrl).then(() => {
        alert("✓ Tautan Kartu Member berhasil disalin ke clipboard:\n" + targetUrl);
    }).catch(() => {
        prompt("Salin tautan kartu ini:", targetUrl);
    });
}

// ==============================================================
// 9. CASHIER PRESENTATION SIMULATOR (UNTUK DOSEN/PENGUJI)
// ==============================================================
function demoAddStamp() {
    if (!currentMemberData) return;
    const currentCap = simulatedStampCount !== null ? simulatedStampCount : currentMemberData.totalCap;
    if (currentCap >= 10) {
        alert("Stempel sudah mencapai batas maksimal 10 Cap!");
        return;
    }
    simulatedStampCount = currentCap + 1;
    renderCard(currentMemberData);
}

function demoResetStamp() {
    if (!currentMemberData) return;
    simulatedStampCount = null;
    renderCard(currentMemberData);
}
