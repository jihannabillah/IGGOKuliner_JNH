/**
 * ==============================================================
 * IGGO KULINER — CORE CRM & LOYALTY ENGINE
 * Iwan Goreng-Goreng (Since 2005)
 * ==============================================================
 * 
 * Features:
 * 1. Google Sheets GViz Real-time Database Reader
 * 2. Headless Google Form Registration Integration (No Login Required)
 * 3. Dynamic VIP Member Card Generator (HTML5 Canvas PNG Export)
 * 4. 10-Stamp Interactive Loyalty Visualizer with Milestone Rewards
 * 5. Robust QR Code & URL Routing (Auto-detects ?id=... and #portalCek?id=...)
 * 6. LocalStorage Caching for Instant Card Re-opening
 * 7. Interactive Cashier Simulation Mode for College Presentations
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
                // Tampilkan info kartu yang tersimpan sebelumnya
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
        nativeCont.classList.remove("hidden");
        gformCont.classList.add("hidden");
        btnNative.className = "bg-iggo-maroon text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-sm";
        btnGform.className = "bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold px-4 py-2 rounded-xl transition";
    } else {
        nativeCont.classList.add("hidden");
        gformCont.classList.remove("hidden");
        btnGform.className = "bg-iggo-maroon text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-sm";
        btnNative.className = "bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold px-4 py-2 rounded-xl transition";
    }
}

function toggleEmbedIframe() {
    const wrapper = document.getElementById("embedIframeWrapper");
    const btn = document.getElementById("btnToggleIframe");
    if (wrapper.classList.contains("hidden")) {
        wrapper.classList.remove("hidden");
        btn.textContent = "Sembunyikan Sematan Form";
    } else {
        wrapper.classList.add("hidden");
        btn.textContent = "Tampilkan Sematan Form di Sini";
    }
}

// ==============================================================
// 4. GOOGLE FORM SUBMISSION ENGINE (HEADLESS)
// ==============================================================
function submitMemberForm(event) {
    const btn = document.getElementById("btnSubmitReg");
    btn.disabled = true;
    btn.innerHTML = `<span class="inline-block animate-spin mr-2">⏳</span> Mengirim & Menerbitkan Kartu VIP...`;
    isFormSubmitted = true;
    // Form akan otomatis post ke hidden_iframe tanpa merefresh halaman
}

function onIframeFormResponse() {
    if (!isFormSubmitted) return;
    isFormSubmitted = false;

    const btn = document.getElementById("btnSubmitReg");
    btn.disabled = false;
    btn.innerHTML = `<span>✨</span> Buat Kartu Member VIP Sekarang (Otomatis)`;

    const nama = document.getElementById("regNama").value.trim();
    const alamat = document.getElementById("regAlamat").value.trim();
    const hp = document.getElementById("regHp").value.trim();
    const ig = document.getElementById("regIg").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const tgl = document.getElementById("regTanggal").value.trim();

    // Generate ID Member Baru Instan
    const randSuffix = Math.floor(100 + Math.random() * 900);
    const newMemberId = "IGGO-" + randSuffix;

    alert(`🎉 SELAMAT! Pendaftaran VIP Member IGGO Kuliner berhasil.\nID Member Anda: ${newMemberId}\n\nKartu Member Digital Anda sekarang langsung ditampilkan di bawah!`);

    // Langsung buat dan tampilkan kartu VIP Member di layar detik ini juga
    const newMember = {
        nama: nama,
        alamat: alamat,
        hp: hp,
        ig: ig || "-",
        tanggal: tgl,
        email: email,
        idMember: newMemberId,
        barcode: "",
        totalCap: 1 // Member baru otomatis mendapat 1 stempel selamat datang!
    };

    currentMemberData = newMember;
    simulatedStampCount = null;
    saveToLocalStorage(newMember);

    renderCard(newMember);
    document.getElementById("portalContent").classList.remove("hidden");
    document.getElementById("portalCek").scrollIntoView({ behavior: "smooth" });

    // Reset Form
    document.getElementById("formPendaftaran").reset();
    document.getElementById("regTanggal").value = new Date().toISOString().split("T")[0];
}

// ==============================================================
// 5. GOOGLE SHEETS GVIZ DATA FETCHER & SEARCH ENGINE
// ==============================================================
function quickTestSearch(id) {
    document.getElementById("queryInput").value = id;
    searchMember();
}

async function searchMember() {
    const query = document.getElementById("queryInput").value.trim().toLowerCase();
    if (!query) {
        alert("Silakan masukkan ID Member, No. HP, atau Email Anda terlebih dahulu.");
        return;
    }

    const loading = document.getElementById("loadingIndicator");
    const content = document.getElementById("portalContent");
    loading.classList.remove("hidden");
    content.classList.add("hidden");

    try {
        const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SPREADSHEET_ID}/gviz/tq?tqx=out:json&gid=${CONFIG.SHEET_GID}`;
        const res = await fetch(url);
        const text = await res.text();
        const jsonString = text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1);
        const data = JSON.parse(jsonString);
        const rows = data.table.rows;

        // Pemetaan kolom fleksibel terverifikasi
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

        if (data.table.cols && data.table.cols.length > 0) {
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

        loading.classList.add("hidden");

        if (found) {
            currentMemberData = found;
            simulatedStampCount = null;
            saveToLocalStorage(found);
            renderCard(found);
            content.classList.remove("hidden");
        } else {
            alert("Data Member tidak ditemukan.\nPastikan ID Member (misal: JNH-016), No. HP, atau Email Anda sudah terdaftar di Google Form.");
        }
    } catch (err) {
        loading.classList.add("hidden");
        console.error(err);
        alert("Gagal membaca database Google Sheets.\nPastikan izin berbagi spreadsheet telah diatur ke 'Anyone with the link' (Viewer).");
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
// 6. VIP MEMBER CARD RENDERER & 10 STAMPS VISUALIZER
// ==============================================================
function renderCard(m) {
    const effectiveCap = simulatedStampCount !== null ? simulatedStampCount : m.totalCap;

    // Render Data ke Wajah Kartu VIP
    document.getElementById("cardNama").textContent = m.nama;
    document.getElementById("cardId").textContent = m.idMember;
    document.getElementById("cardTanggal").textContent = "Member Sejak: " + m.tanggal;
    document.getElementById("cardStampCounter").textContent = `${effectiveCap} / 10 Cap`;

    // Render ke Biodata Detail
    document.getElementById("viewAlamat").textContent = m.alamat;
    document.getElementById("viewHp").textContent = m.hp;
    document.getElementById("viewIg").textContent = m.ig.startsWith("@") ? m.ig : (m.ig !== "-" ? "@" + m.ig : "-");
    document.getElementById("viewEmail").textContent = m.email;

    // Render 10 Slot Stempel Interaktif di dalam Kartu
    const grid = document.getElementById("cardStampsGrid");
    grid.innerHTML = "";

    for (let i = 1; i <= 10; i++) {
        const isFilled = i <= effectiveCap;
        const slot = document.createElement("div");
        let baseClass = "h-9 sm:h-10 flex flex-col items-center justify-center rounded-xl text-[10px] font-bold transition-all ";

        if (isFilled) {
            // Stempel Terisi
            if (i === 5) {
                slot.className = baseClass + "bg-gradient-to-br from-amber-400 to-yellow-600 text-iggo-dark shadow-sm border border-yellow-300 font-extrabold";
                slot.innerHTML = "<span>🍹 5</span>";
            } else if (i === 10) {
                slot.className = baseClass + "bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-500 text-iggo-dark shadow-md border-2 border-white animate-subtle font-black";
                slot.innerHTML = "<span>👑 10</span>";
            } else {
                slot.className = baseClass + "bg-gradient-to-br from-iggo-amber to-red-600 text-white shadow-sm border border-orange-300";
                slot.innerHTML = "<span>🍤</span>";
            }
        } else {
            // Slot Belum Terisi
            if (i === 5) {
                slot.className = baseClass + "bg-white/10 text-yellow-300 border border-dashed border-yellow-400/60";
                slot.innerHTML = "<span class='text-[8px] leading-tight text-center'>5<br><span class='text-[6px] text-yellow-200'>FREE TEH</span></span>";
            } else if (i === 10) {
                slot.className = baseClass + "bg-white/10 text-yellow-300 border border-dashed border-yellow-400/80";
                slot.innerHTML = "<span class='text-[8px] leading-tight text-center'>10<br><span class='text-[6px] text-yellow-200'>50% OFF</span></span>";
            } else {
                slot.className = baseClass + "bg-white/5 text-stone-400 border border-dashed border-white/20";
                slot.innerText = i;
            }
        }
        grid.appendChild(slot);
    }

    // Milestone Reward Banner Detail
    const banner = document.getElementById("rewardBanner");
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

    // QR Code URL Generator (Standar ?id=[ID_MEMBER]#portalCek)
    const targetUrl = window.location.origin + window.location.pathname + "?id=" + encodeURIComponent(m.idMember) + "#portalCek";
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(targetUrl)}`;
    document.getElementById("cardQrMini").src = qrApiUrl;
}

// ==============================================================
// 7. CARD EXPORT (HTML2CANVAS PNG DOWNLOADER)
// ==============================================================
async function downloadMemberCardImage() {
    if (!currentMemberData) return;
    const btn = document.getElementById("btnDownloadCard");
    const originalText = btn.innerHTML;
    btn.innerHTML = `<span class="inline-block animate-spin mr-2">⏳</span> Mengenerate Gambar Kartu...`;
    btn.disabled = true;

    try {
        const cardEl = document.getElementById("digitalVipCard");
        const canvas = await html2canvas(cardEl, {
            scale: 3, // Skala tinggi untuk kualitas ultra jernih (HD)
            useCORS: true,
            backgroundColor: null
        });

        const imgUrl = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.href = imgUrl;
        downloadLink.download = `Kartu-VIP-IGGO-${currentMemberData.idMember}-${currentMemberData.nama.replace(/\s+/g, '_')}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    } catch (err) {
        console.error(err);
        alert("Gagal mengunduh kartu sebagai gambar. Anda juga dapat mengambil screenshot kartu di layar HP Anda.");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
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
