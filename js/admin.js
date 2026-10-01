/**
 * ==============================================================
 * IGGO KULINER — PORTAL ADMIN & CETAK KARTU ENGINE
 * Halaman Khusus Pemilik Resto untuk Cetak Kartu Member & CRM
 * ==============================================================
 */

const ADMIN_CONFIG = {
    SPREADSHEET_ID: "1Xe_lvitL8N7qhwQ1e0c7DQ4ErHnzWzGeImfHkyab7lc",
    SHEET_GID: "2034393288",
    SERVER_IP: "192.168.0.102"
};

let currentAdminMember = null;

window.addEventListener("DOMContentLoaded", () => {
    updateAdminHostIpDisplay();
    // Auto-load demo default JNH-016
    quickAdminSelect("JNH-016");
});

function getAdminServerOrigin() {
    if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1" && window.location.hostname !== "[::]") {
        return window.location.origin;
    }
    const savedIp = localStorage.getItem("iggo_server_ip") || ADMIN_CONFIG.SERVER_IP || "192.168.0.102";
    return `http://${savedIp}:3000`;
}

function updateAdminHostIpDisplay() {
    const el = document.getElementById("adminHostIp");
    if (el) {
        const savedIp = localStorage.getItem("iggo_server_ip") || ADMIN_CONFIG.SERVER_IP || "192.168.0.102";
        el.textContent = `${savedIp}:3000`;
    }
}

function adminChangeIp() {
    const current = localStorage.getItem("iggo_server_ip") || ADMIN_CONFIG.SERVER_IP || "192.168.0.102";
    const newIp = prompt("Masukkan Alamat IP Wi-Fi Komputer Anda (contoh: 192.168.0.102):", current);
    if (newIp && newIp.trim()) {
        localStorage.setItem("iggo_server_ip", newIp.trim());
        updateAdminHostIpDisplay();
        if (currentAdminMember) renderAdminCard(currentAdminMember);
        alert("Alamat IP Host QR berhasil diubah ke: " + newIp.trim() + ":3000\nQR Code kartu fisik otomatis diperbarui!");
    }
}

function quickAdminSelect(id) {
    document.getElementById("adminQuery").value = id;
    adminSearchMember();
}

async function adminSearchMember() {
    const input = document.getElementById("adminQuery");
    const query = input ? input.value.trim().toLowerCase() : "";
    if (!query) {
        alert("Silakan masukkan ID Member terlebih dahulu.");
        return;
    }

    const loading = document.getElementById("adminLoading");
    if (loading) loading.classList.remove("hidden");

    try {
        const url = `https://docs.google.com/spreadsheets/d/${ADMIN_CONFIG.SPREADSHEET_ID}/gviz/tq?tqx=out:json&gid=${ADMIN_CONFIG.SHEET_GID}&_t=${Date.now()}`;
        const res = await fetch(url, { cache: "no-store" });
        const text = await res.text();
        const jsonString = text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1);
        const data = JSON.parse(jsonString);

        let rows = (data && data.table && data.table.rows) ? data.table.rows : [];
        let colMap = { nama: 1, hp: 3, tanggal: 5, email: 6, idMember: 7 };

        if (data.table && data.table.cols) {
            data.table.cols.forEach((col, idx) => {
                if (!col || !col.label) return;
                const lbl = col.label.trim().toLowerCase();
                if (lbl.includes("id") && lbl.includes("member")) colMap.idMember = idx;
                else if (lbl.includes("nama")) colMap.nama = idx;
                else if (lbl.includes("hp") || lbl.includes("wa")) colMap.hp = idx;
                else if (lbl.includes("tanggal")) colMap.tanggal = idx;
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

            const matchId = idMember && idMember.toLowerCase() === query;
            const matchHp = numOnly.length >= 8 && hp.replace(/[^0-9]/g, "").endsWith(numOnly.slice(-8));

            if (matchId || matchHp) {
                found = {
                    idMember: idMember || query.toUpperCase(),
                    nama: nama || "Member VIP IGGO",
                    tanggal: tanggal || "15/05/2024"
                };
                break;
            }
        }

        if (loading) loading.classList.add("hidden");

        if (found) {
            currentAdminMember = found;
            renderAdminCard(found);
        } else {
            alert("Data Member tidak ditemukan di Google Sheets.");
        }
    } catch (err) {
        if (loading) loading.classList.add("hidden");
        console.error("Gagal load Google Sheets:", err);
        alert("Gagal membaca Google Sheets. Periksa koneksi internet.");
    }
}

function renderAdminCard(m) {
    // Sisi Depan
    setAdminTxt("printCardNama", m.nama);
    setAdminTxt("printCardId", m.idMember);
    setAdminTxt("printCardDate", "MEMBER SEJAK: " + m.tanggal);

    // Sisi Belakang
    setAdminTxt("printCardBackNama", m.nama);
    setAdminTxt("printCardBackId", "ID: " + m.idMember);

    // QR Code mengarah ke pass.html (Halaman Mobile VIP Pass Pelanggan!)
    const baseOrigin = getAdminServerOrigin();
    const targetUrl = `${baseOrigin}/pass.html?id=${encodeURIComponent(m.idMember)}`;

    // margin=8 & ecc=M untuk ketajaman scan kamera HP
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&margin=8&ecc=M&data=${encodeURIComponent(targetUrl)}`;
    const qrImg = document.getElementById("printCardQr");
    if (qrImg) qrImg.src = qrApiUrl;

    // Update Toolbar Link
    const linkEl = document.getElementById("adminQrLink");
    if (linkEl) linkEl.textContent = targetUrl;

    const testBtn = document.getElementById("adminTestPassBtn");
    if (testBtn) testBtn.href = targetUrl;
}

function adminCopyQrLink() {
    if (!currentAdminMember) return;
    const baseOrigin = getAdminServerOrigin();
    const targetUrl = `${baseOrigin}/pass.html?id=${encodeURIComponent(currentAdminMember.idMember)}`;
    navigator.clipboard.writeText(targetUrl).then(() => {
        alert("Tautan VIP Pass Pelanggan berhasil disalin ke clipboard:\n" + targetUrl);
    }).catch(() => {
        prompt("Salin tautan ini:", targetUrl);
    });
}

function adminDownloadFront() {
    const card = document.getElementById("memberCardFront");
    if (!card) return;
    html2canvas(card, { scale: 3, useCORS: true, backgroundColor: null }).then(canvas => {
        const link = document.createElement("a");
        link.download = `Kartu-Member-IGGO-Depan-${currentAdminMember ? currentAdminMember.idMember : "VIP"}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    });
}

function adminDownloadBack() {
    const card = document.getElementById("memberCardBack");
    if (!card) return;
    html2canvas(card, { scale: 3, useCORS: true, backgroundColor: null }).then(canvas => {
        const link = document.createElement("a");
        link.download = `Kartu-Member-IGGO-Belakang-${currentAdminMember ? currentAdminMember.idMember : "VIP"}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    });
}

function setAdminTxt(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val !== undefined && val !== null ? val : "-";
}
