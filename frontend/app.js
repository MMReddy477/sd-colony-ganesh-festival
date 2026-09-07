const publicDonationTableObserver = new MutationObserver(async () => {
  const modal = document.getElementById("financeModal");
  if (
    !modal ||
    !modal.classList.contains("is-open") ||
    modal.querySelector(".donation-popup-table")
  )
    return;
  if (modal.querySelector("h3")?.textContent !== "Donation details") return;
  const response = await fetch("/api/public");
  if (!response.ok) return;
  const data = await response.json();
  const donations = [...data.donations].sort(sortByPlotNumber);
  const pageSize = 10;
  let page = 0;
  const renderDonations = () => {
    const query = modal.querySelector("[data-public-donation-search]")?.value.trim().toLowerCase() || "";
    const filtered = donations.filter(item => String(item.donorName || "").toLowerCase().includes(query));
    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    page = Math.min(page, pageCount - 1);
    const visible = filtered.slice(page * pageSize, (page + 1) * pageSize);
    const first = filtered.length ? page * pageSize + 1 : 0;
    const last = Math.min((page + 1) * pageSize, filtered.length);
    modal.querySelector(".finance-content").innerHTML = `<div class="public-donation-tools"><label for="publicDonationSearch">Search donor name<input id="publicDonationSearch" data-public-donation-search type="search" placeholder="Search by name" value="${escapeHtml(query)}"></label><span>Showing ${first}-${last} of ${filtered.length} donations</span></div><div class="donation-popup-wrap"><table class="donation-popup-table"><thead><tr><th>Plot No.</th><th>Donor Name</th><th>Amount</th><th>Payment Mode</th><th>Actions</th></tr></thead><tbody>${visible.map((item) => `<tr><td>${normalizePlotNumber(item.flatNumber) || "--"}</td><td>${item.donorName || "--"}</td><td><strong>${money(item.amount)}</strong></td><td>${item.paymentMode || "--"}</td><td>${item.receiptNumber ? `<button class="receipt-action" type="button" data-public-receipt="${item.receiptNumber}" title="View receipt" aria-label="View receipt">👁</button>` : "--"}</td></tr>`).join("") || '<tr><td colspan="5" class="donor-empty">No donations found.</td></tr>'}</tbody></table></div><div class="public-donation-pagination"><button type="button" data-public-donation-page="prev" aria-label="Previous page" title="Previous page" ${page === 0 ? "disabled" : ""}>‹</button><span>Page ${page + 1} of ${pageCount}</span><button type="button" data-public-donation-page="next" aria-label="Next page" title="Next page" ${page >= pageCount - 1 ? "disabled" : ""}>›</button></div>`;
    modal.querySelector("[data-public-donation-search]")?.addEventListener("input", () => { page = 0; renderDonations(); });
    modal.querySelectorAll("[data-public-donation-page]").forEach(button => button.addEventListener("click", () => { page += button.dataset.publicDonationPage === "next" ? 1 : -1; renderDonations(); }));
  };
  renderDonations();
});

publicDonationTableObserver.observe(document.body, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ["class"],
});
const publicExpenseTableObserver = new MutationObserver(async () => {
  const modal = document.getElementById("financeModal");
  if (
    !modal ||
    !modal.classList.contains("is-open") ||
    modal.querySelector(".expense-popup-table")
  )
    return;
  if (modal.querySelector("h3")?.textContent !== "Expenditure details") return;
  const response = await fetch("/api/public");
  if (!response.ok) return;
  const data = await response.json();
  const expenses = [...data.expenses];
  let page = 0;
  const renderExpenses = () => {
    const pageSize = 10;
    const pages = Math.max(1, Math.ceil(expenses.length / pageSize));
    page = Math.min(page, pages - 1);
    const visible = expenses.slice(page * pageSize, (page + 1) * pageSize);
    modal.querySelector(".finance-content").innerHTML = `<div class="finance-record-count">Showing ${expenses.length ? page * pageSize + 1 : 0}-${Math.min((page + 1) * pageSize, expenses.length)} of ${expenses.length} expenses</div><div class="expense-popup-wrap"><table class="expense-popup-table"><thead><tr><th>Expense name</th><th>Amount</th><th>Payment mode</th><th>Expense date</th><th>Time</th></tr></thead><tbody>${visible.map(item => `<tr><td>${item.name || "--"}</td><td><strong>${money(item.amount)}</strong></td><td>${item.paymentMode || "--"}</td><td>${formatExpenseDate(item.date)}</td><td>${formatExpenseTime(item.createdAt)}</td></tr>`).join("") || '<tr><td colspan="5">No expenditure recorded yet.</td></tr>'}</tbody></table></div><div class="public-donation-pagination expense-pagination"><button type="button" data-expense-page="prev" aria-label="Previous page" title="Previous page" ${page === 0 ? "disabled" : ""}>‹</button><span>Page ${page + 1} of ${pages}</span><button type="button" data-expense-page="next" aria-label="Next page" title="Next page" ${page >= pages - 1 ? "disabled" : ""}>›</button></div>`;
    modal.querySelectorAll("[data-expense-page]").forEach(button => button.addEventListener("click", () => { page += button.dataset.expensePage === "next" ? 1 : -1; renderExpenses(); }));
  };
  renderExpenses();
});
publicExpenseTableObserver.observe(document.body, {
  subtree: true,
  attributes: true,
  attributeFilter: ["class"],
});
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("downloadSelected")?.addEventListener("click", () => downloadGallery(getSelectedGallery()));
  document.getElementById("downloadAll")?.addEventListener("click", () => downloadGallery(galleryImages));
  document.getElementById("gallerySelectAll")?.addEventListener("change", (event) => {
    document.querySelectorAll(".gallery-select").forEach((input) => { input.checked = event.target.checked; });
    updateGallerySelection();
  });
  document.getElementById("startSlideshow")?.addEventListener("click", () => { openGallery(0); setSlideshow(true); });
  document.getElementById("galleryViewerPause")?.addEventListener("click", () => setSlideshow(!slideshowPlaying));
});
const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
const escapeHtml = value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const formatDate = (value, fallback = "--") => {
  if (!value) return fallback;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}-${new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleString("en-IN", { month: "short" })}-${String(match[1]).slice(-2)}`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return `${String(parsed.getDate()).padStart(2, "0")}-${parsed.toLocaleString("en-IN", { month: "short" })}-${String(parsed.getFullYear()).slice(-2)}`;
};
const formatExpenseDate = value => {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return formatDate(value);
  return formatDate(parsed);
};
const formatExpenseTime = value => value ? new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "--";
const normalizePlotNumber = value => { const raw = String(value ?? "").trim().replace(/\s+/g, "-").replace(/-+/g, "-"); const plotMatch = raw.match(/^plot(?:-?no\.?)?-?(\d+)$/i); if (plotMatch) return `PlotNo-${plotMatch[1]}`; const siriusMatch = raw.match(/^(sirius|sirus)[_-]?(\d+)$/i); if (siriusMatch) return `Sirius_${siriusMatch[2]}`; const samyuktaMatch = raw.match(/^(samyukta)-?(\d+)$/i); return samyuktaMatch ? `Samyukta-${samyuktaMatch[2]}` : raw; };
const alphanumericSort = (a, b) => { const aparts = String(a).split(/(\d+)/); const bparts = String(b).split(/(\d+)/); for (let i = 0; i < Math.min(aparts.length, bparts.length); i++) { const isNum = /^\d+$/.test(aparts[i]); if (isNum) { const diff = Number(aparts[i]) - Number(bparts[i]); if (diff) return diff; } else { if (aparts[i] !== bparts[i]) return aparts[i].localeCompare(bparts[i]); } } return aparts.length - bparts.length; };
const sortByPlotNumber = (left, right) => { const parse = value => { const normalized = normalizePlotNumber(value); const cleanMatch = normalized.match(/^PlotNo-(\d+)$/); if (cleanMatch) return [0, Number(cleanMatch[1]), '']; const samyuktaMatch = normalized.match(/^Samyukta-(\d+)$/); if (samyuktaMatch) return [3, Number(samyuktaMatch[1]), '']; const siriusMatch = normalized.match(/^Sirius_(\d+)$/); if (siriusMatch) return [4, Number(siriusMatch[1]), '']; const rawValue = String(value || '').trim().toLowerCase(); if (rawValue.includes('plot') || rawValue.match(/^plotno/i)) return [1, 0, normalized]; return [2, 0, normalized]; }; const a = parse(left.flatNumber); const b = parse(right.flatNumber); if (a[0] !== b[0]) return a[0] - b[0]; if (a[0] === 0 || a[0] === 3 || a[0] === 4) return a[1] - b[1]; if (a[0] === 1) return alphanumericSort(a[2], b[2]); return a[2].localeCompare(b[2]); };
const sortSpecialContributions = (left, right) => { const parse = value => { const raw = String(value ?? '').trim().replace(/[\s_-]+/g, '').toLowerCase(); const sirius = raw.match(/^(?:sirius|sirus)(\d+)$/); if (sirius) return [0, Number(sirius[1])]; const samyukta = raw.match(/^samyukta(\d+)$/); if (samyukta) return [1, Number(samyukta[1])]; return [2, 0]; }; const a = parse(left.flatNumber); const b = parse(right.flatNumber); return a[0] - b[0] || a[1] - b[1] || sortByPlotNumber(left, right); };
const date = (value) =>
  formatDate(value, "Date to be announced");
const publicMenuToggle = document.getElementById("publicMenuToggle");
const publicMenu = document.getElementById("nav");
publicMenuToggle?.addEventListener("click", () => {
  const isOpen = publicMenu.classList.toggle("is-open");
  publicMenuToggle.setAttribute("aria-expanded", String(isOpen));
  publicMenuToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
});
document
  .querySelectorAll("#nav .nav-link, #nav .navbar-brand, #nav .mobile-admin-item a")
  .forEach((link) =>
    link.addEventListener("click", () => {
      const nav = document.getElementById("nav");
      nav.classList.remove("is-open");
      publicMenuToggle?.setAttribute("aria-expanded", "false");
      publicMenuToggle?.setAttribute("aria-label", "Open navigation");
      if (nav.classList.contains("show") && window.bootstrap)
        window.bootstrap.Collapse.getOrCreateInstance(nav).hide();
    }),
  );
const publicNavLinks = [...document.querySelectorAll("#nav .nav-link")];
const publicSections = publicNavLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);
const updatePublicNav = (id) => publicNavLinks.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === `#${id}`));
if (window.IntersectionObserver) {
  const publicNavObserver = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visible) updatePublicNav(visible.target.id);
  }, { rootMargin: "-92px 0px -55% 0px", threshold: [0.1, 0.35, 0.6] });
  publicSections.forEach((section) => publicNavObserver.observe(section));
}
window.addEventListener("hashchange", () => updatePublicNav(window.location.hash.slice(1) || "home"));
updatePublicNav(window.location.hash.slice(1) || "home");
setTimeout(() => {
  const contactDetails = document.querySelector(".contact-details");
  if (!contactDetails) return;
  const name = contactDetails.querySelector("strong");
  if (name) name.textContent = "SD Colony Ganesh Utsav Committee";
  contactDetails.innerHTML =
    "<strong>SD Colony Ganesh Utsav Committee</strong><span>📍 Between Sirius & Samyukta, Main Street</span><span>🕒 Daily: 8:00 AM - 11:00 PM</span><span>📞 Ph: 8555958559 | 9676344244</span>";
}, 0);
setTimeout(() => {
  const contactBand = document.querySelector(".contact-band");
  if (!contactBand) return;
  const eyebrow = contactBand.querySelector(".eyebrow");
  const heading = contactBand.querySelector("h2");
  if (eyebrow) eyebrow.textContent = "One community.";
  if (heading) heading.innerHTML = "<em>One celebration.</em>";
  let message = contactBand.querySelector(".contact-message");
  if (!message) {
    message = document.createElement("p");
    message.className = "contact-message";
    heading?.after(message);
  }
  message.textContent =
    "Building a brighter Ganesh Utsav together, with transparent giving, joyful traditions, and room for every family.";
}, 0);
async function loadPortal() {
  const response = await fetch("/api/public", { cache: "no-store" });
  if (!response.ok) return;
  const data = await response.json();
  const contact = data.contact || {};
  const contactDetails = document.querySelector(".contact-details");
  if (contactDetails) { const lines = contactDetails.querySelectorAll("span"); if (lines[0]) lines[0].textContent = `📧 ${contact.contactEmail || "hello@ganeshutsav.org"} · 📞 ${contact.phone1 || "8555958559"}${contact.phone2 ? ` | ${contact.phone2}` : ""}`; }
  const upiPanel = document.getElementById("upiPaymentPanel");
  if (upiPanel) { upiPanel.hidden = false; upiPanel.innerHTML = `<div><p class="eyebrow">Digital offering</p><h3>Pay by PhonePe</h3><p>Scan this QR code to make a contribution${contact.upiId ? ` or use <strong>UPI ID: ${contact.upiId}</strong>` : ""}.</p></div><img src="/phonepe-qr.jpeg" alt="PhonePe payment QR code for Suryodaya Colony Welfare Association">`; }
  document.title = data.committeeName;
  document.getElementById("heroDonations").textContent = money(
    data.stats.totalDonations,
  );
  const contributionTotal = type => type === "Laddu Auction 2025" && data.stats.ladduAuctionTotal != null ? data.stats.ladduAuctionTotal : data.donations.filter(item => item.contributionType === type && item.status !== "Yet to receive").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  document.getElementById("stats").innerHTML = [
    ["Total donations", data.stats.totalDonations],
    ["Total expenditure", data.stats.totalExpenses],
    ["Current balance", data.stats.balance],
    ["Laddu Auction 2025", contributionTotal("Laddu Auction 2025")],
    ["Ganesh Idol Sponsor 2026", contributionTotal("Ganesh Idol Sponsor")],
  ]
    .map(
      ([label, value]) =>
        `<div class="col-md-4"><div class="stat-card${label === "Current balance" ? " balance-stat" : ""}${label === "Laddu Auction 2025" || label === "Ganesh Idol Sponsor 2026" ? " contribution-stat-card" : ""}"${label === "Laddu Auction 2025" ? " data-contribution-type=\"Laddu Auction 2025\" role=\"button\" tabindex=\"0\" aria-label=\"View Laddu Auction 2025 contributions\"" : label === "Ganesh Idol Sponsor 2026" ? " data-contribution-type=\"Ganesh Idol Sponsor\" role=\"button\" tabindex=\"0\" aria-label=\"View Ganesh Idol Sponsor 2026 contributions\"" : ""}><span class="label">${label}</span><strong>${money(value)}</strong></div></div>`,
    )
    .join("");
  document.getElementById("eventsList").innerHTML = data.events.length
    ? `<div class="member-table-wrap public-events-table-wrap"><table class="member-table event-table public-events-table"><thead><tr><th>Devotee Name</th><th>Contact Number</th><th>Pooja Type</th><th>Preferred Date</th><th>Preferred Time</th><th>Venue / Location</th><th>Request Status</th><th>Actions</th></tr></thead><tbody>${data.events.map(e => { const status = e.status || "Pending"; return `<tr><td><strong>${e.name || "--"}</strong></td><td>${e.mobile || "--"}</td><td>Ganesh Pooja</td><td>${e.date ? date(e.date) : "--"}</td><td>${e.time || "--"}</td><td>${e.venue || "Between Sirius & Samyukta"}</td><td><span class="ritual-status ritual-status-${status.toLowerCase()}">${status}</span></td><td><span class="ritual-public-action" aria-label="Pooja request details">👁</span></td></tr>`; }).join("")}</tbody></table></div>`
    : "<p>No events announced yet.</p>";
  document.getElementById("membersList").innerHTML =
    data.members
      .map(
        (m) =>
          `<div class="col-sm-6 col-lg-3"><article class="member-card"><p class="eyebrow">${m.designation || "Committee member"}</p><h3>${m.name}</h3><p>${m.mobile || "Available through the committee desk"}</p></article></div>`,
      )
      .join("") || "<p>Committee details coming soon.</p>";
  renderGallery(data.gallery.length ? data.gallery : [{ title: "Ganesh Utsav memories", caption: "", path: "/GaneshIdol_detail.jpeg" }]);
  renderPublicDonors(data.donations);
}
loadPortal();
setInterval(loadPortal, 15000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) loadPortal(); });
window.addEventListener("focus", loadPortal);
window.addEventListener("pageshow", (event) => { if (event.persisted) loadPortal(); });
let publicDonorRows = [];
let publicDonorPage = 0;
let publicDonorPageSize = 10;
function renderPublicDonors(items) {
  publicDonorRows = [...items].sort(sortByPlotNumber);
  const query = document.getElementById("publicDonorSearch")?.value.toLowerCase() || "";
  const mode = document.getElementById("publicPaymentFilter")?.value || "";
  const filtered = publicDonorRows.filter(item => `${item.flatNumber} ${item.donorName} ${item.amount} ${item.paymentMode} ${item.receiptNumber} ${item.contributionType} ${item.itemName}`.toLowerCase().includes(query) && (!mode || item.paymentMode === mode));
  const size = publicDonorPageSize; const visible = size === "all" ? filtered : filtered.slice(publicDonorPage * size, (publicDonorPage + 1) * size);
  const safe = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  document.querySelector("#donationsList").closest("table").querySelector("thead tr").innerHTML = "<th>Plot No.</th><th>Donor Name</th><th>Contribution Type</th><th>Amount</th><th>Date</th><th>Payment Mode</th><th>Actions</th>";
  document.getElementById("donationsList").innerHTML = visible.map(d => `<tr><td data-label="Plot No.">${safe(normalizePlotNumber(d.flatNumber) || "--")}</td><td data-label="Donor Name">${safe(d.donorName || "--")}</td><td data-label="Contribution Type">${safe(d.contributionType || "Regular Donation")}</td><td data-label="Amount" class="amount-positive">${money(d.amount)}</td><td data-label="Date">${formatDate(d.date || d.createdAt)}</td><td data-label="Payment Mode"><span class="payment-badge payment-${(d.paymentMode || "cash").toLowerCase().replace(/\s+/g, "-")}">${safe(d.paymentMode || "Cash")}</span></td><td data-label="Receipt">${d.receiptNumber ? `<span class="public-receipt-actions"><button class="receipt-action" type="button" data-public-receipt="${safe(d.receiptNumber)}" title="View receipt" aria-label="View receipt">&#128065;</button><button class="receipt-action public-receipt-row-download" type="button" data-public-download="${safe(d.receiptNumber)}" title="Download receipt" aria-label="Download receipt">&#11123;</button></span>` : "--"}</td></tr>`).join("") || '<tr><td colspan="7" class="donor-empty">🐘 No supporters found.<br><small>Try another name or plot number.</small></td></tr>';
  const total = filtered.length; const first = total ? (size === "all" ? 1 : publicDonorPage * size + 1) : 0; const last = total ? (size === "all" ? total : Math.min((publicDonorPage + 1) * size, total)) : 0; const pages = size === "all" ? 1 : Math.max(1, Math.ceil(total / size));
  const panel = document.getElementById("publicDonorPagination");
  panel.innerHTML = `<span>Showing ${first}-${last} of ${total} Supporters</span><button type="button" data-public-page="prev" aria-label="Previous page" title="Previous page" ${publicDonorPage === 0 || size === "all" ? "disabled" : ""}>‹</button>${Array.from({ length: Math.min(pages, 7) }, (_, index) => `<button type="button" data-public-page="${index}" class="${index === publicDonorPage ? "active" : ""}">${index + 1}</button>`).join("")}<button type="button" data-public-page="next" aria-label="Next page" title="Next page" ${publicDonorPage >= pages - 1 || size === "all" ? "disabled" : ""}>›</button>`;
}
function formatDonorDate(value) { return value ? `${formatDate(value)} ${new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : "--"; }
document.addEventListener("input", event => { if (event.target.id === "publicDonorSearch") { publicDonorPage = 0; renderPublicDonors(publicDonorRows); } });
document.addEventListener("change", event => { if (event.target.id === "publicRowsPerPage") { publicDonorPageSize = event.target.value === "all" ? "all" : Number(event.target.value); publicDonorPage = 0; renderPublicDonors(publicDonorRows); } });
document.addEventListener("change", event => { if (event.target.id === "publicPaymentFilter") { publicDonorPage = 0; renderPublicDonors(publicDonorRows); } });
document.addEventListener("click", event => { const button = event.target.closest("[data-public-page]"); if (!button) return; const value = button.dataset.publicPage; publicDonorPage += value === "prev" ? -1 : value === "next" ? 1 : Number(value) - publicDonorPage; renderPublicDonors(publicDonorRows); });
let galleryImages = [];
let galleryIndex = 0;
let slideshowTimer;
let slideshowPlaying = false;
function renderGallery(images) {
  galleryImages = images;
  const list = document.getElementById("galleryList");
  if (!list) return;
  document.getElementById("galleryTotal").textContent = `Total images: ${images.length}`;
  list.innerHTML = images.map((image, index) => `<figure class="gallery-card"><button class="gallery-item" type="button" data-gallery-index="${index}"><img src="${image.path}" alt="${image.title || "Ganesh Utsav memory"}" loading="lazy"><span class="gallery-check"><input class="gallery-select" type="checkbox" data-gallery-select="${index}" aria-label="Select image ${index + 1}"></span></button></figure>`).join("");
  list.querySelectorAll(".gallery-select").forEach((input) => input.addEventListener("click", (event) => event.stopPropagation()));
  list.querySelectorAll(".gallery-select").forEach((input) => input.addEventListener("change", updateGallerySelection));
  updateGallerySelection();
}
function getSelectedGallery() { return [...document.querySelectorAll(".gallery-select:checked")].map((input) => galleryImages[Number(input.dataset.gallerySelect)]); }
function updateGallerySelection() { const selected = getSelectedGallery().length; document.getElementById("gallerySelectedCount").textContent = `Selected: ${selected}`; const all = document.getElementById("gallerySelectAll"); if (all) all.checked = selected > 0 && selected === galleryImages.length; }
function downloadGallery(images) { images.forEach((image, index) => setTimeout(() => { const link = document.createElement("a"); link.href = image.path; link.download = image.originalName || `${(image.title || "ganesh-memory").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.jpg`; link.click(); }, index * 300)); }
function openGallery(index) {
  galleryIndex = (index + galleryImages.length) % galleryImages.length;
  const image = galleryImages[galleryIndex];
  const viewer = document.getElementById("galleryViewer");
  document.getElementById("galleryViewerImage").src = image.path;
  document.getElementById("galleryViewerImage").alt = image.title || "Ganesh Utsav memory";
  document.getElementById("galleryViewerCounter").textContent = `Image ${galleryIndex + 1} of ${galleryImages.length}`;
  document.getElementById("galleryViewerTitle").textContent = image.title || "Ganesh Utsav memory";
  document.getElementById("galleryViewerCaption").textContent = image.caption || "";
  const download = document.getElementById("galleryViewerDownload");
  download.href = image.path;
  download.download = image.originalName || `${(image.title || "ganesh-memory").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.jpg`;
  viewer.classList.add("is-open");
  viewer.setAttribute("aria-hidden", "false");
}
function closeGallery() {
  setSlideshow(false);
  const viewer = document.getElementById("galleryViewer");
  viewer.classList.remove("is-open");
  viewer.classList.remove("hero-image-viewer");
  viewer.setAttribute("aria-hidden", "true");
}
function setSlideshow(playing) { slideshowPlaying = playing; clearInterval(slideshowTimer); const button = document.getElementById("galleryViewerPause"); if (button) button.textContent = playing ? "⏸ Pause" : "▶ Play"; if (playing) slideshowTimer = setInterval(() => openGallery(galleryIndex + 1), 4000); }
document.addEventListener("click", (event) => {
  const heroImage = event.target.closest("[data-hero-image]");
  if (heroImage) {
    const viewer = document.getElementById("galleryViewer");
    document.getElementById("galleryViewerImage").src = heroImage.dataset.heroImage;
    document.getElementById("galleryViewerImage").alt = "Ganesh Utsav festival schedule";
    document.getElementById("galleryViewerCounter").textContent = "Festival schedule";
    document.getElementById("galleryViewerTitle").textContent = "Ganesh Utsav 2026 schedule";
    document.getElementById("galleryViewerCaption").textContent = "Tap Download to save the schedule image.";
    const download = document.getElementById("galleryViewerDownload");
    download.href = heroImage.dataset.heroImage;
    download.download = "ganesh-utsav-2026-schedule.jpeg";
    viewer.classList.add("is-open");
    viewer.setAttribute("aria-hidden", "false");
    viewer.classList.add("hero-image-viewer");
    return;
  }
  const tile = event.target.closest("[data-gallery-index]");
  if (tile) openGallery(Number(tile.dataset.galleryIndex));
  if (event.target.closest(".gallery-viewer-close")) closeGallery();
  if (event.target.closest(".gallery-viewer-prev")) openGallery(galleryIndex - 1);
  if (event.target.closest(".gallery-viewer-next")) openGallery(galleryIndex + 1);
  if (event.target === document.getElementById("galleryViewer")) closeGallery();
});
document.querySelector("[data-hero-image]")?.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } });
document.addEventListener("keydown", (event) => {
  const viewer = document.getElementById("galleryViewer");
  if (!viewer.classList.contains("is-open")) return;
  if (event.key === "Escape") closeGallery();
  if (event.key === "ArrowLeft") openGallery(galleryIndex - 1);
  if (event.key === "ArrowRight") openGallery(galleryIndex + 1);
  if (event.key === " ") { event.preventDefault(); setSlideshow(!slideshowPlaying); }
  if (event.key.toLowerCase() === "d") document.getElementById("galleryViewerDownload").click();
});
let galleryTouchStart = 0;
document.getElementById("galleryViewer")?.addEventListener("touchstart", (event) => { galleryTouchStart = event.changedTouches[0].screenX; }, { passive: true });
document.getElementById("galleryViewer")?.addEventListener("touchend", (event) => { const distance = event.changedTouches[0].screenX - galleryTouchStart; if (Math.abs(distance) > 50) openGallery(galleryIndex + (distance < 0 ? 1 : -1)); }, { passive: true });
let galleryLastTap = 0;
document.getElementById("galleryViewerImage")?.addEventListener("touchend", () => { const now = Date.now(); if (now - galleryLastTap < 300) document.getElementById("galleryViewerImage").classList.toggle("is-zoomed"); galleryLastTap = now; });
document.querySelector(".contact-details strong").textContent =
  "SD Colony Ganesh Utsav Committee";
const contactDetails = document.querySelector(".contact-details");
if (contactDetails) {
  const contactLines = contactDetails.querySelectorAll("span");
  if (contactLines[0])
    contactLines[0].textContent = "hello@ganeshutsav.org · +91 8555958559";
  if (contactLines[1])
    contactLines[1].textContent =
      "Community Hall, Main Street · Open daily 9AM–11PM";
}
document.addEventListener("DOMContentLoaded", () => {
  fetch("/api/public")
    .then((response) => response.json())
    .then((data) => {
      const list = document.getElementById("membersList");
      if (!list) return;
      list.innerHTML = `<div class="member-table-wrap"><table class="member-table"><thead><tr><th>Name</th><th>Designation</th><th>Mobile number</th></tr></thead><tbody>${data.members.map((item) => `<tr><td>${item.name || "--"}</td><td>${item.designation || "--"}</td><td>${item.mobile || "--"}</td></tr>`).join("") || '<tr><td colspan="3">Committee details coming soon.</td></tr>'}</tbody></table></div>`;
    });
});
document.addEventListener("click", async (event) => {
  const card = event.target.closest(".stat-card");
  if (!card) return;
  const response = await fetch("/api/public");
  const data = await response.json();
  const label = card.querySelector(".label").textContent;
  const contributionType = card.dataset.contributionType;
  const isAuction = contributionType === "Laddu Auction 2025";
  let content = "";
  if (contributionType) {
    const donations = data.donations.filter(item => item.contributionType === contributionType).sort(sortSpecialContributions);
    const rows = donations.map(item => `<tr><td>${escapeHtml(normalizePlotNumber(item.flatNumber) || "--")}</td><td>${escapeHtml(item.donorName || "--")}</td><td>${escapeHtml(isAuction ? (item.itemName || item.contributionType || "--") : (item.contributionType || "Ganesh Idol Sponsor"))}</td><td class="amount-positive">${money(item.amount)}</td><td>${formatDate(item.date || item.createdAt)}</td><td>${escapeHtml(item.paymentMode || "Cash")}</td><td>${item.receiptNumber ? `<span class="public-receipt-actions"><button class="receipt-action" type="button" data-public-receipt="${escapeHtml(item.receiptNumber)}" title="View receipt" aria-label="View receipt">&#128065;</button><button class="receipt-action public-receipt-row-download" type="button" data-public-download="${escapeHtml(item.receiptNumber)}" title="Download receipt" aria-label="Download receipt">&#11123;</button></span>` : "--"}</td></tr>`).join("");
    const columns = "<th>Plot No.</th><th>Donor Name</th><th>Contribution Type</th><th>Amount</th><th>Date</th><th>Payment Mode</th><th>Actions</th>";
    content = `<div class="category-popup-wrap"><table class="donation-popup-table"><thead><tr>${columns}</tr></thead><tbody>${rows || `<tr><td colspan="${isAuction ? 7 : 6}" class="donor-empty">No ${escapeHtml(label.toLowerCase())} records yet.</td></tr>`}</tbody></table></div>`;
  }
  const title =
    contributionType
      ? label
      : label === "Total donations"
      ? "Donation details"
      : label === "Total expenditure"
        ? "Expenditure details"
        : "Balance details";
  if (label === "Total donations") {
    const regularDonations = data.donations.filter(item => !['Laddu Auction 2025', 'Ganesh Idol Sponsor'].includes(item.contributionType));
    content = regularDonations.length
      ? regularDonations
          .map(
            (item) =>
              `<div class="finance-detail"><span>${item.donorName}<small>${date(item.date)} · ${item.paymentMode || "Cash"}</small></span><strong>${money(item.amount)}</strong></div>`,
          )
          .join("")
      : '<p class="muted">No donations recorded yet.</p>';
  }
  if (label === "Total expenditure")
    content = data.expenses.length
      ? `<div class="expense-popup-wrap"><table class="expense-popup-table"><thead><tr><th>Expense name</th><th>Amount</th><th>Payment mode</th><th>Expense date</th><th>Time</th></tr></thead><tbody>${data.expenses.map(item => `<tr><td>${item.name || "--"}</td><td class="amount-positive">${money(item.amount)}</td><td>${item.paymentMode || "--"}</td><td>${formatExpenseDate(item.date)}</td><td>${formatExpenseTime(item.createdAt)}</td></tr>`).join("")}</tbody></table></div>`
      : '<p class="muted">No expenditure recorded yet.</p>';
  if (label === "Current balance")
    content = `<div class="balance-breakdown"><div><span>Total donations</span><strong>${money(data.stats.totalDonations)}</strong></div><div><span>Total expenditure</span><strong>${money(data.stats.totalExpenses)}</strong></div><div class="balance-result"><span>Final balance</span><strong>${money(data.stats.balance)}</strong></div></div>`;
  let modal = document.getElementById("financeModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "financeModal";
    modal.className = "finance-modal";
    modal.innerHTML =
      '<div class="finance-modal-panel" role="dialog" aria-modal="true"><button class="finance-close" type="button" aria-label="Close">×</button><p class="eyebrow">Live finance record</p><h3></h3><div class="finance-content"></div></div>';
    document.body.appendChild(modal);
    modal.addEventListener("click", (item) => {
      if (item.target === modal || item.target.closest(".finance-close"))
        modal.classList.remove("is-open");
    });
  }
  modal.querySelector("h3").textContent = title;
  const financeContent = modal.querySelector(".finance-content");
  financeContent.classList.toggle("category-finance-content", Boolean(contributionType));
  financeContent.closest(".finance-modal-panel")?.classList.toggle("category-finance-panel", Boolean(contributionType));
  financeContent.innerHTML = content;
  if (label === "Total expenditure") {
    const expenses = data.expenses;
    let expensePage = 0;
    const renderExpenses = () => {
      const pageSize = 10;
      const pages = Math.max(1, Math.ceil(expenses.length / pageSize));
      expensePage = Math.min(expensePage, pages - 1);
      const visible = expenses.slice(expensePage * pageSize, (expensePage + 1) * pageSize);
      modal.querySelector(".finance-content").innerHTML = `<div class="finance-record-count">Showing ${expenses.length ? expensePage * pageSize + 1 : 0}-${Math.min((expensePage + 1) * pageSize, expenses.length)} of ${expenses.length} expenses</div><div class="expense-popup-wrap"><table class="expense-popup-table"><thead><tr><th>Expense name</th><th>Amount</th><th>Payment mode</th><th>Expense date</th><th>Time</th></tr></thead><tbody>${visible.map(item => `<tr><td>${item.name || "--"}</td><td class="amount-positive">${money(item.amount)}</td><td>${item.paymentMode || "--"}</td><td>${formatExpenseDate(item.date)}</td><td>${formatExpenseTime(item.createdAt)}</td></tr>`).join("") || '<tr><td colspan="5">No expenditure recorded yet.</td></tr>'}</tbody></table></div><div class="public-donation-pagination expense-pagination"><button type="button" data-expense-page="prev" ${expensePage === 0 ? "disabled" : ""}>Previous</button><span>Page ${expensePage + 1} of ${pages}</span><button type="button" data-expense-page="next" ${expensePage >= pages - 1 ? "disabled" : ""}>Next</button></div>`;
      modal.querySelectorAll("[data-expense-page]").forEach(button => button.addEventListener("click", () => { expensePage += button.dataset.expensePage === "next" ? 1 : -1; renderExpenses(); }));
    };
    renderExpenses();
  }
  modal.classList.add("is-open");
});
document.addEventListener("keydown", event => {
  const card = event.target.closest?.(".contribution-stat-card");
  if (card && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    card.click();
  }
});
const teluguText = {
  gallery: "గ్యాలరీ",
  committee: "కమిటీ",
  events: "కార్యక్రమాలు",
  funds: "నిధులు",
  donations: "విరాళాలు",
  contact: "సంప్రదించండి",
  "Admin login": "అడ్మిన్ లాగిన్",
  "A decade of devotion · 2026": "భక్తి భావంతో ఒక దశాబ్దం · 2026",
  "One community.": "ఒక సమాజం.",
  "One celebration.": "ఒక వేడుక.",
  "Building a brighter Ganesh Utsav together, with transparent giving, joyful traditions, and room for every family.":
    "పారదర్శక విరాళాలు, ఆనందకరమైన సంప్రదాయాలతో ప్రతి కుటుంబానికి చోటు కల్పిస్తూ గణేష్ ఉత్సవాన్ని కలిసి వైభవంగా జరుపుకుందాం.",
  "Explore the celebration": "వేడుకను చూడండి",
  "Open books": "పారదర్శక లెక్కలు",
  "Every rupee has a story.": "ప్రతి రూపాయికీ ఒక కథ ఉంది.",
  "See how our community's generosity becomes shared celebration.":
    "మన సమాజం అందించే సహాయం ఎలా వేడుకగా మారుతుందో చూడండి.",
  "Mark your calendar": "మీ క్యాలెండర్‌లో గుర్తించండి",
  "This year's moments": "ఈ ఏడాది కార్యక్రమాలు",
  "All are welcome": "అందరికీ స్వాగతం",
  "The people behind the joy": "వేడుక వెనుక ఉన్న వ్యక్తులు",
  "Meet the committee": "కమిటీని కలవండి",
  "From last year's memories": "గత ఏడాది జ్ఞాపకాల నుంచి",
  "Download all ↧": "అన్నింటినీ డౌన్‌లోడ్ చేయండి ↧",
  "With gratitude": "కృతజ్ఞతలతో",
  "Our supporters": "మా సహాయకులు",
  "A public record of the generous people who make this possible.":
    "ఈ వేడుకను సాధ్యం చేస్తున్న దాతల వివరాలు.",
  "Come say hello": "మమ్మల్ని కలవండి",
  "Celebrate with us.": "మాతో కలిసి జరుపుకోండి.",
  "Daily: 8:00 AM - 11:00 PM": "ప్రతిరోజూ: ఉదయం 8:00 - రాత్రి 11:00",
  "Total donations": "మొత్తం విరాళాలు",
  "Total expenditure": "మొత్తం ఖర్చు",
  "Current balance": "ప్రస్తుత నిల్వ",
  "No events announced yet.": "కార్యక్రమాలు ఇంకా ప్రకటించలేదు.",
  "Committee details coming soon.":
    "కమిటీ వివరాలు త్వరలో అందుబాటులోకి వస్తాయి.",
  "No donations recorded yet.": "విరాళాల వివరాలు ఇంకా లేవు.",
  "Donation details": "విరాళాల వివరాలు",
  "Expenditure details": "ఖర్చుల వివరాలు",
  "Balance details": "నిల్వ వివరాలు",
  "Final balance": "చివరి నిల్వ",
  "Live finance record": "ప్రస్తుత ఆర్థిక వివరాలు",
};
const englishText = Object.fromEntries(
  Object.entries(teluguText).map(([english, telugu]) => [telugu, english]),
);
const translateText = (value) => {
  const language = localStorage.getItem("ganeshLanguage") || "en";
  return language === "te"
    ? teluguText[value] || value
    : englishText[value] || value;
};
const translateNode = (node) => {
  if (node.nodeType === Node.TEXT_NODE) {
    node.nodeValue = translateText(node.nodeValue.trim())
      ? node.nodeValue.replace(
          node.nodeValue.trim(),
          translateText(node.nodeValue.trim()),
        )
      : node.nodeValue;
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE || node.id === "languageSelect")
    return;
  node.childNodes.forEach(translateNode);
};
const applyLanguage = () => {
  const language = localStorage.getItem("ganeshLanguage") || "en";
  document.documentElement.lang = language === "te" ? "te" : "en";
  document.documentElement.classList.toggle("telugu-mode", language === "te");
  translateNode(document.body);
  const heroCopy = document.querySelector(".hero-copy");
  if (heroCopy) {
    const heading = heroCopy.querySelector("h1");
    const lead = heroCopy.querySelector(".lead");
    if (language === "te") {
      if (heading)
        heading.innerHTML =
          "🕉️🙏🐘 శ్రీ వరసిద్ధి వినాయకుని దివ్య ఆశీస్సులతో<br><em>ఎస్.డి కాలనీ గణేశ్ ఉత్సవాలకు సుస్వాగతం</em>🐘🙏🕉️";
      if (lead) lead.textContent = "భక్తి • ఐక్యత • సంప్రదాయం";
    } else {
      if (heading)
        heading.innerHTML =
          "SD COLONY GANESH UTSAV<br><em>COMMITTEE</em>";
      if (lead)
        lead.textContent = "Celebrating Faith • Unity • Tradition";
      const blessing = heroCopy.querySelector('.hero-blessing');
      if (blessing)
        blessing.textContent = "🙏 Together Under the Blessings of Lord Ganesha 🙏";
    }
  }
  const select = document.getElementById("languageSelect");
  if (select) select.value = language;
};
document.addEventListener("DOMContentLoaded", () => {
  const select = document.getElementById("languageSelect");
  if (!select) return;
  select.value = localStorage.getItem("ganeshLanguage") || "en";
  select.addEventListener("change", () => {
    localStorage.setItem("ganeshLanguage", select.value);
    location.reload();
  });
  applyLanguage();
  const dynamicSections = [
    "#stats",
    "#eventsList",
    "#membersList",
    "#galleryList",
    "#donationsList",
  ]
    .map((selector) => document.querySelector(selector))
    .filter(Boolean);
  dynamicSections.forEach((section) =>
    new MutationObserver(() => applyLanguage()).observe(section, {
      childList: true,
      subtree: true,
    }),
  );
});
const pageLoader = document.createElement("div");
pageLoader.className = "page-loader";
pageLoader.innerHTML =
  '<div class="page-loader-mark">ॐ</div><span>Loading...</span>';
document.body.appendChild(pageLoader);
const hidePageLoader = () => pageLoader.classList.add("is-hidden");
document.addEventListener("DOMContentLoaded", () =>
  setTimeout(hidePageLoader, 150),
);
setTimeout(hidePageLoader, 2000);
function showPublicReceiptPreview(receiptNumber) {
  let modal = document.getElementById("publicReceiptPreviewModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "publicReceiptPreviewModal";
    modal.className = "receipt-preview-modal";
    modal.innerHTML = `<div class="receipt-preview-panel" role="dialog" aria-modal="true" aria-label="Receipt preview"><div class="receipt-preview-header"><strong>Receipt Preview</strong><span class="receipt-preview-number"></span><button type="button" class="receipt-close" aria-label="Close receipt preview">×</button></div><div class="receipt-preview-box"><img class="receipt-preview-image" alt="Donation receipt"></div><div class="receipt-preview-footer"><button type="button" class="btn btn-dark-red public-receipt-download" data-download-public-receipt title="Download receipt">Download Receipt</button></div></div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", event => { if (event.target === modal || event.target.closest(".receipt-close")) modal.classList.remove("is-open"); });
  }
  modal.querySelector(".receipt-preview-number").textContent = receiptNumber;
  modal.querySelector(".receipt-preview-image").src = "/api/receipts/" + encodeURIComponent(receiptNumber) + "/image.svg?refresh=" + Date.now();
  modal.querySelector(".receipt-preview-image").alt = "Donation receipt " + receiptNumber;
  modal.querySelector("[data-download-public-receipt]").dataset.receiptNumber = receiptNumber;
  modal.classList.add("is-open");
}
function viewReceipt(receiptNumber) { showPublicReceiptPreview(receiptNumber); }
function downloadReceipt(receiptNumber, button) { return downloadPublicReceipt(receiptNumber, button); }
async function downloadPublicReceipt(receiptNumber, button) {
  const originalLabel = button.textContent;
  const resetButton = message => { button.disabled = false; button.textContent = originalLabel; if (message) alert(message); };
  button.disabled = true;
  button.textContent = "Preparing...";
  try {
    const response = await fetch("/api/receipts/" + encodeURIComponent(receiptNumber) + "/image.svg");
    if (!response.ok) throw new Error("Receipt unavailable");
    const sourceUrl = URL.createObjectURL(new Blob([await response.text()], { type: "image/svg+xml" }));
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1536;
      canvas.height = 2304;
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(jpg => {
        URL.revokeObjectURL(sourceUrl);
        if (!jpg) return resetButton("Unable to create receipt image");
        const donation = publicDonorRows.find(item => item.receiptNumber === receiptNumber) || {};
        const safePart = (value, fallback) => String(value || fallback).trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || fallback;
        const link = document.createElement("a");
        link.href = URL.createObjectURL(jpg);
        link.download = `${safePart(donation.flatNumber, "Receipt")}_${safePart(donation.donorName, receiptNumber)}.jpg`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        resetButton();
      }, "image/jpeg", 0.92);
    };
    image.onerror = () => { URL.revokeObjectURL(sourceUrl); resetButton("Unable to create receipt image"); };
    image.src = sourceUrl;
  } catch (error) {
    resetButton(error.message);
  }
}
document.addEventListener("click", event => {
  const rowDownload = event.target.closest("[data-public-download]");
  if (rowDownload) return downloadReceipt(rowDownload.dataset.publicDownload, rowDownload);
  const downloadButton = event.target.closest("[data-download-public-receipt]");
  if (downloadButton) return downloadPublicReceipt(downloadButton.dataset.receiptNumber, downloadButton);
  const viewButton = event.target.closest("[data-public-receipt]");
  if (!viewButton || !viewButton.dataset.publicReceipt) return;
  event.preventDefault();
  viewReceipt(viewButton.dataset.publicReceipt);
});
