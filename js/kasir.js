/**
 * ==============================================================
 * IGGO KULINER — TERMINAL KASIR ENGINE
 * Halaman Khusus Kasir Restoran untuk Input Stempel Transaksi
 * ==============================================================
 */

const KASIR_CONFIG = {
    SPREADSHEET_ID: "1Xe_lvitL8N7qhwQ1e0c7DQ4ErHnzWzGeImfHkyab7lc",
    SHEET_GID: "2034393288",
    DEFAULT_PIN_1: "1234",
    DEFAULT_PIN_2: "2005"
};

let currentKasirMember = null;
let currentCapCount = 0;
let transactionHistory = [];

window.addEventListener("DOMContentLoaded", () => {
    checkPinAuth();
    startClock();
});

// 1. PIN SECURITY CONTROLLER
function checkPinAuth() {
    const auth = sessionStorage.getItem("iggo_kasir_auth");
    const modal = document.getElementById("pinModal");
    if (auth === "true") {
        if (modal) modal.classList.add("hidden");
    } else {
        if (modal) modal.classList.remove("hidden");
        const pinInput = document.getElementById("inputPin");
        if (pinInput) pinInput.focus();
    }
}

function handlePinSubmit(e) {
    e.preventDefault();
    const pin = document.getElementById("inputPin").value.trim();
    if (pin === KASIR_CONFIG.DEFAULT_PIN_1 || pin === KASIR_CONFIG.DEFAULT_PIN_2) {
        sessionStorage.setItem("iggo_kasir_auth", "true");
        document.getElementById("pinModal").classList.add("hidden");
    } else {
        alert("PIN Kasir Salah! Gunakan PIN demo: 1234 atau 2005.");
        document.getElementById("inputPin").value = "";
    }
}

function lockTerminal() {
    sessionStorage.removeItem("iggo_kasir_auth");
    checkPinAuth();
}

function startClock() {
    setInterval(() => {
        const el = document.getElementById("kasirLiveClock");
        if (el) {
            const now = new Date();
            el.textContent = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " WIB";
        }
    }, 1000);
}

// 2. SEARCH MEMBER IN KASIR
function quickKasirSelect(id) {
    document.getElementById("kasirQuery").value = id;
    kasirSearchMember();
}

async function kasirSearchMember() {
    const input = document.getElementById("kasirQuery");
    const query = input ? input.value.trim().toLowerCase() : "";
    if (!query) {
        alert("Silakan masukkan ID Member atau No. HP terlebih dahulu.");
        return;
    }

    const loading = document.getElementById("kasirLoading");
    const result = document.getElementById("kasirResultPanel");
    if (loading) loading.classList.remove("hidden");
    if (result) result.classList.add("hidden");

    try {
        const url = `https://docs.google.com/spreadsheets/d/${KASIR_CONFIG.SPREADSHEET_ID}/gviz/tq?tqx=out:json&gid=${KASIR_CONFIG.SHEET_GID}&_t=${Date.now()}`;
        const res = await fetch(url, { cache: "no-store" });
        const text = await res.text();
        const jsonString = text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1);
        const data = JSON.parse(jsonString);

        let rows = (data && data.table && data.table.rows) ? data.table.rows : [];
        let colMap = { nama: 1, hp: 3, tanggal: 5, email: 6, idMember: 7, totalCap: 9 };

        if (data.table && data.table.cols) {
            data.table.cols.forEach((col, idx) => {
                if (!col || !col.label) return;
                const lbl = col.label.trim().toLowerCase();
                if (lbl.includes("id") && lbl.includes("member")) colMap.idMember = idx;
                else if (lbl.includes("nama")) colMap.nama = idx;
                else if (lbl.includes("hp") || lbl.includes("wa")) colMap.hp = idx;
                else if (lbl.includes("tanggal")) colMap.tanggal = idx;
                else if (lbl.includes("total cap") || lbl.includes("cap")) colMap.totalCap = idx;
            });
        }

        const numOnly = query.replace(/[^0-9]/g, "");
        let found = null;

        for (let r of rows) {
            if (!r.c) continue;
            const getVal = (idx) => {
                if (!r.c[idx]) return "";
                return (r.c[idx].f || String(r.c[idx].v || "")).trim();
            };

            const idMember = getVal(colMap.idMember);
            const nama = getVal(colMap.nama);
            const hp = getVal(colMap.hp);
            const tanggal = getVal(colMap.tanggal);

            let totalCap = 0;
            if (r.c[colMap.totalCap] && r.c[colMap.totalCap].v !== null) {
                totalCap = Number(r.c[colMap.totalCap].v) || 0;
            }

            const matchId = idMember && idMember.toLowerCase() === query;
            const matchHp = numOnly.length >= 8 && hp.replace(/[^0-9]/g, "").endsWith(numOnly.slice(-8));

            if (matchId || matchHp) {
                found = {
                    idMember: idMember || query.toUpperCase(),
                    nama: nama || "Member VIP",
                    hp: hp || "-",
                    tanggal: tanggal || "-",
                    totalCap: totalCap
                };
                break;
            }
        }

        if (loading) loading.classList.add("hidden");

        if (found) {
            currentKasirMember = found;
            let finalCap = found.totalCap;
            try {
                const apiRes = await fetch(`/api/stamps?id=${encodeURIComponent(found.idMember)}&_t=${Date.now()}`);
                const apiData = await apiRes.json();
                if (apiData && apiData.cap !== null && apiData.cap !== undefined) {
                    finalCap = Number(apiData.cap);
                } else {
                    const localSaved = localStorage.getItem("iggo_cap_override_" + found.idMember.toLowerCase());
                    if (localSaved !== null) finalCap = Number(localSaved);
                }
            } catch (e) {
                const localSaved = localStorage.getItem("iggo_cap_override_" + found.idMember.toLowerCase());
                if (localSaved !== null) finalCap = Number(localSaved);
            }
            currentCapCount = finalCap;
            renderKasirMember();
            if (result) result.classList.remove("hidden");
        } else {
            alert("Data Member tidak ditemukan.\nPastikan ID Member (misal: JNH-016) atau No. HP benar.");
        }
    } catch (err) {
        if (loading) loading.classList.add("hidden");
        console.error("Gagal membaca Google Sheets:", err);
        alert("Gagal membaca database Google Sheets. Pastikan koneksi internet aktif.");
    }
}

function renderKasirMember() {
    if (!currentKasirMember) return;
    const m = currentKasirMember;

    setKasirTxt("kasirMemberId", m.idMember);
    setKasirTxt("kasirNama", m.nama);
    setKasirTxt("kasirHp", m.hp);
    setKasirTxt("kasirTanggal", m.tanggal);
    setKasirTxt("kasirCapCount", currentCapCount);

    const statusEl = document.getElementById("kasirMilestoneStatus");
    if (statusEl) {
        if (currentCapCount >= 10) {
            statusEl.textContent = "👑 Cap 10: DISKON 50% SIAP DIKLAIM!";
            statusEl.className = "text-[10px] text-amber-900 font-extrabold block mt-1";
        } else if (currentCapCount >= 5) {
            statusEl.textContent = `🍹 Cap 5: FREE TEH AKTIF (Sisa ${10 - currentCapCount} cap)`;
            statusEl.className = "text-[10px] text-amber-800 font-bold block mt-1";
        } else {
            statusEl.textContent = `🎯 Sisa ${5 - currentCapCount} cap menuju Free Teh`;
            statusEl.className = "text-[10px] text-stone-600 font-medium block mt-1";
        }
    }

    // Render Grid 10 Stempel
    const grid = document.getElementById("kasirStampsGrid");
    if (grid) {
        grid.innerHTML = "";
        for (let i = 1; i <= 10; i++) {
            const isFilled = i <= currentCapCount;
            const slot = document.createElement("div");
            let base = "h-12 flex flex-col items-center justify-center rounded-xl text-xs font-bold transition-all ";

            if (isFilled) {
                if (i === 5) {
                    slot.className = base + "bg-amber-400 text-stone-900 border-2 border-yellow-500 shadow-sm font-extrabold";
                    slot.innerHTML = "<span>🍹</span><span class='text-[8px]'>Cap 5</span>";
                } else if (i === 10) {
                    slot.className = base + "bg-gradient-to-r from-yellow-400 to-amber-500 text-stone-900 border-2 border-yellow-600 shadow-md font-black";
                    slot.innerHTML = "<span>👑</span><span class='text-[8px]'>50%</span>";
                } else {
                    slot.className = base + "bg-iggo-maroon text-white border border-red-900 shadow-xs";
                    slot.innerHTML = "<span>🍤</span><span class='text-[8px]'>" + i + "</span>";
                }
            } else {
                slot.className = base + "bg-stone-100 text-stone-400 border border-dashed border-stone-300";
                slot.innerHTML = "<span>" + i + "</span>";
            }
            grid.appendChild(slot);
        }
    }
}

// 3. ACTION: TAMBAH 1 STEMPEL TRANSAKSI (SINKRON REAL-TIME DENGAN SERVER & HP)
async function kasirAddStamp() {
    if (!currentKasirMember) return;
    const memberId = currentKasirMember.idMember.toLowerCase();

    if (currentCapCount >= 10) {
        if (!confirm("Pelanggan ini sudah mencapai 10 cap (Maksimal). Apakah Anda ingin mereset siklus loyalty kartu ini?")) {
            return;
        }
        currentCapCount = 0;
        try {
            await fetch("/api/stamps", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: memberId, action: "set", value: 0 })
            });
        } catch (e) {}
    }

    currentCapCount++;

    // 1. Simpan Real-Time ke Server API (Sinkron langsung ke HP Pelanggan saat scan QR!)
    try {
        const res = await fetch("/api/stamps", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: memberId, action: "set", value: currentCapCount })
        });
        const data = await res.json();
        if (data && data.success) {
            currentCapCount = data.cap;
        }
    } catch (e) {
        console.warn("Gagal simpan ke server sync API:", e);
    }

    // 2. Simpan ke localStorage cadangan
    localStorage.setItem("iggo_cap_override_" + memberId, currentCapCount);

    renderKasirMember();

    // Catat ke log shift
    let rewardNotice = "-";
    if (currentCapCount === 5) {
        rewardNotice = "🍹 Klaim Free Es Teh Jumbo";
        showRewardCelebration("🍹", "Cap ke-5 Tercapai!", "Pelanggan berhak mendapatkan <strong>1 Porsi Gratis Es Teh Jumbo Segar</strong>!");
    } else if (currentCapCount === 10) {
        rewardNotice = "👑 Klaim DISKON 50% All Menu";
        showRewardCelebration("👑", "Cap ke-10 Tercapai (Hadiah Utama)!", "Pelanggan berhak mendapatkan <strong>Diskon 50% untuk Seluruh Menu</strong> transaksi ini!");
    }

    addTransactionToLog(currentKasirMember.idMember, currentKasirMember.nama, currentCapCount, rewardNotice);
}

async function kasirResetToSheet() {
    if (!currentKasirMember) return;
    const memberId = currentKasirMember.idMember.toLowerCase();
    if (confirm("Reset stempel member " + currentKasirMember.nama + " kembali ke data awal spreadsheet?")) {
        try {
            await fetch("/api/stamps", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: memberId, action: "reset" })
            });
        } catch (e) {}
        localStorage.removeItem("iggo_cap_override_" + memberId);
        currentCapCount = currentKasirMember.totalCap;
        renderKasirMember();
        alert("Data stempel berhasil di-reset ke nilai asli Google Sheets.");
    }
}

function addTransactionToLog(id, nama, cap, reward) {
    const time = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    transactionHistory.unshift({ time, id, nama, cap, reward });

    const tbody = document.getElementById("kasirLogTbody");
    const emptyNotice = document.getElementById("emptyLogNotice");
    if (emptyNotice) emptyNotice.remove();

    if (tbody) {
        const tr = document.createElement("tr");
        tr.className = "hover:bg-stone-50 transition";
        tr.innerHTML = `
            <td class="py-2.5 px-3 text-stone-500">${time}</td>
            <td class="py-2.5 px-3 font-bold text-iggo-maroon">${id}</td>
            <td class="py-2.5 px-3 font-sans font-semibold">${nama}</td>
            <td class="py-2.5 px-3"><span class="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded">${cap} / 10 Cap</span></td>
            <td class="py-2.5 px-3 font-sans text-xs font-semibold ${reward.includes("Free") ? "text-amber-700" : reward.includes("DISKON") ? "text-red-700 font-bold" : "text-stone-400"}">${reward}</td>
        `;
        tbody.prepend(tr);
    }

    const logCount = document.getElementById("logCount");
    if (logCount) logCount.textContent = transactionHistory.length + " Transaksi";
}

// 4. CELEBRATION MODAL
function showRewardCelebration(icon, title, desc) {
    const modal = document.getElementById("rewardModal");
    document.getElementById("rewardModalIcon").textContent = icon;
    document.getElementById("rewardModalTitle").textContent = title;
    document.getElementById("rewardModalDesc").innerHTML = desc;
    if (modal) modal.classList.remove("hidden");
}

function closeRewardModal() {
    const modal = document.getElementById("rewardModal");
    if (modal) modal.classList.add("hidden");
}

function setKasirTxt(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val !== undefined && val !== null ? val : "-";
}
