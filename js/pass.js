/**
 * ==============================================================
 * IGGO KULINER — MOBILE VIP PASS CLIENT ENGINE
 * Halaman Khusus Pelanggan Saat Scan QR Code Kartu Member
 * ==============================================================
 */

const PASS_CONFIG = {
    SPREADSHEET_ID: "1Xe_lvitL8N7qhwQ1e0c7DQ4ErHnzWzGeImfHkyab7lc",
    SHEET_GID: "2034393288",
    CACHE_KEY: "iggo_member_pass_cache_"
};

window.addEventListener("DOMContentLoaded", () => {
    loadMemberPass();
});

async function loadMemberPass() {
    const params = new URLSearchParams(window.location.search);
    let memberId = params.get("id") || params.get("wa") || params.get("email");

    if (!memberId && window.location.hash.includes("?")) {
        const hashQuery = window.location.hash.substring(window.location.hash.indexOf("?") + 1);
        const hashParams = new URLSearchParams(hashQuery);
        memberId = hashParams.get("id") || hashParams.get("wa") || hashParams.get("email");
    }

    if (!memberId) {
        showError();
        return;
    }

    memberId = memberId.trim();

    // 1. Tampilkan data dari cache lokal duluan (jika pernah dibuka) agar instan
    const cached = getCachedMember(memberId);
    if (cached) {
        renderPassData(cached);
    }

    // 2. Fetch live data dari database Google Sheets
    try {
        const liveMember = await fetchMemberFromSheets(memberId);
        if (liveMember) {
            // Sinkronisasi Real-Time dengan Server Kasir API
            try {
                const apiRes = await fetch(`/api/stamps?id=${encodeURIComponent(memberId)}&_t=${Date.now()}`);
                const apiData = await apiRes.json();
                if (apiData && apiData.cap !== null && apiData.cap !== undefined) {
                    liveMember.totalCap = Number(apiData.cap);
                }
            } catch (apiErr) {
                console.log("Kasir sync API offline, using sheets value:", apiErr);
            }

            saveCachedMember(memberId, liveMember);
            renderPassData(liveMember);
        } else if (!cached) {
            showError();
        }
    } catch (err) {
        console.warn("Gagal fetch live sheets, menggunakan cache lokal:", err);
        if (!cached) {
            showError();
        }
    }
}

async function fetchMemberFromSheets(queryId) {
    const qLower = queryId.toLowerCase();
    const numOnly = queryId.replace(/[^0-9]/g, "");

    const url = `https://docs.google.com/spreadsheets/d/${PASS_CONFIG.SPREADSHEET_ID}/gviz/tq?tqx=out:json&gid=${PASS_CONFIG.SHEET_GID}&_t=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();
    const jsonString = text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const data = JSON.parse(jsonString);

    if (!data || !data.table || !data.table.rows) return null;

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
            else if (lbl.includes("tanggal")) colMap.tanggal = idx;
            else if (lbl.includes("hp") || lbl.includes("wa")) colMap.hp = idx;
            else if (lbl.includes("email")) colMap.email = idx;
            else if (lbl.includes("total cap") || lbl.includes("cap")) colMap.totalCap = idx;
        });
    }

    for (let r of data.table.rows) {
        if (!r.c) continue;
        const getVal = (idx) => {
            if (!r.c[idx]) return "";
            return (r.c[idx].f || String(r.c[idx].v || "")).trim();
        };

        const idMember = getVal(colMap.idMember);
        const nama = getVal(colMap.nama);
        const alamat = getVal(colMap.alamat);
        const hp = getVal(colMap.hp);
        const hpNum = hp.replace(/[^0-9]/g, "");
        const email = getVal(colMap.email);
        const tanggal = getVal(colMap.tanggal);

        let totalCap = 0;
        if (r.c[colMap.totalCap] && r.c[colMap.totalCap].v !== null) {
            totalCap = Number(r.c[colMap.totalCap].v) || 0;
        }

        const matchId = idMember && idMember.toLowerCase() === qLower;
        const matchEmail = email && email.toLowerCase() === qLower;
        const matchHp = numOnly.length >= 8 && hpNum.endsWith(numOnly.slice(-8));

        if (matchId || matchEmail || matchHp) {
            return {
                idMember: idMember || queryId,
                nama: nama || "Member VIP IGGO",
                alamat: alamat || "-",
                hp: hp || "-",
                email: email || "-",
                tanggal: tanggal || "-",
                totalCap: totalCap
            };
        }
    }

    return null;
}

function renderPassData(m) {
    const loading = document.getElementById("passLoading");
    const content = document.getElementById("passContent");
    const notFound = document.getElementById("passNotFound");

    if (loading) loading.classList.add("hidden");
    if (notFound) notFound.classList.add("hidden");
    if (content) content.classList.remove("hidden");

    const cap = Number(m.totalCap) || 0;

    // 1. Data Member Header
    setTxt("passMemberId", m.idMember);
    setTxt("passNama", m.nama);
    setTxt("passCapCount", cap);

    // 2. Progress Bar & Milestone
    const percent = Math.min(100, Math.round((cap / 10) * 100));
    setTxt("passPercentText", percent + "%");
    const pBar = document.getElementById("passProgressBar");
    if (pBar) pBar.style.width = percent + "%";

    const milestoneEl = document.getElementById("passMilestoneText");
    if (milestoneEl) {
        if (cap >= 10) {
            milestoneEl.className = "bg-amber-400 text-stone-900 border-2 border-yellow-300 text-xs font-black p-3 rounded-xl text-center shadow-md";
            milestoneEl.innerHTML = "👑 <strong>Luar Biasa! 10 Cap Lengkap Tercapai.</strong><br>Klaim <strong>Diskon 50% Seluruh Menu</strong> saat transaksi di kasir hari ini!";
        } else if (cap >= 5) {
            const sisa = 10 - cap;
            milestoneEl.className = "bg-gradient-to-r from-amber-500/25 to-yellow-500/20 text-yellow-200 border border-yellow-300/40 text-xs font-medium p-3 rounded-xl text-center leading-snug";
            milestoneEl.innerHTML = `🍹 <strong>Cap ke-5 Tercapai: Free Es Teh Jumbo Aktif!</strong><br>Kumpulkan <strong>${sisa} stempel lagi</strong> untuk membuka Hadiah Akbar <strong>Diskon 50%</strong> di Cap 10!`;
        } else {
            const sisa = 5 - cap;
            milestoneEl.className = "bg-amber-400/15 border border-yellow-300/30 text-yellow-200 text-xs font-medium p-3 rounded-xl text-center leading-snug";
            milestoneEl.innerHTML = `✨ Kumpulkan <strong>${sisa} stempel lagi</strong> untuk menikmati <strong>Gratis Es Teh Jumbo</strong> di Cap ke-5!`;
        }
    }

    // 3. Render 10 Slot Grid
    const grid = document.getElementById("passStampsGrid");
    if (grid) {
        grid.innerHTML = "";
        for (let i = 1; i <= 10; i++) {
            const isFilled = i <= cap;
            const slot = document.createElement("div");
            let base = "h-14 flex flex-col items-center justify-center rounded-2xl text-xs font-bold transition-all ";

            if (isFilled) {
                if (i === 5) {
                    slot.className = base + "bg-gradient-to-br from-amber-400 to-yellow-600 text-stone-900 shadow-md border-2 border-yellow-300 font-extrabold";
                    slot.innerHTML = "<span class='text-base'>🍹</span><span class='text-[8px] font-black'>Cap 5 Free</span>";
                } else if (i === 10) {
                    slot.className = base + "bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-500 text-stone-900 shadow-lg border-2 border-white font-black animate-pulse";
                    slot.innerHTML = "<span class='text-base'>👑</span><span class='text-[8px] font-black'>50% OFF</span>";
                } else {
                    slot.className = base + "bg-gradient-to-br from-amber-500 to-red-600 text-white shadow-sm border border-orange-300";
                    slot.innerHTML = "<span class='text-base'>🍤</span><span class='text-[8px] opacity-90'>Cap " + i + "</span>";
                }
            } else {
                if (i === 5) {
                    slot.className = base + "bg-white/10 text-yellow-300 border-2 border-dashed border-yellow-400/60";
                    slot.innerHTML = "<span class='text-xs'>5</span><span class='text-[8px] text-yellow-200'>FREE TEH</span>";
                } else if (i === 10) {
                    slot.className = base + "bg-white/10 text-yellow-300 border-2 border-dashed border-yellow-400/80";
                    slot.innerHTML = "<span class='text-xs'>10</span><span class='text-[8px] text-yellow-200'>50% OFF</span>";
                } else {
                    slot.className = base + "bg-white/5 text-stone-500 border border-dashed border-white/15";
                    slot.innerHTML = "<span class='text-xs'>" + i + "</span>";
                }
            }
            grid.appendChild(slot);
        }
    }

    // 4. Digital Member Card
    setTxt("cardNamaText", m.nama);
    setTxt("cardIdText", m.idMember);
    setTxt("cardDateText", "MEMBER SEJAK: " + m.tanggal);
}

function showError() {
    const loading = document.getElementById("passLoading");
    const content = document.getElementById("passContent");
    const notFound = document.getElementById("passNotFound");

    if (loading) loading.classList.add("hidden");
    if (content) content.classList.add("hidden");
    if (notFound) notFound.classList.remove("hidden");
}

function setTxt(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val !== undefined && val !== null ? val : "-";
}

function getCachedMember(id) {
    try {
        const raw = localStorage.getItem(PASS_CONFIG.CACHE_KEY + id.toLowerCase());
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function saveCachedMember(id, data) {
    try {
        localStorage.setItem(PASS_CONFIG.CACHE_KEY + id.toLowerCase(), JSON.stringify(data));
    } catch (e) {}
}
