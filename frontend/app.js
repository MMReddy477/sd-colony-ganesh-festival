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
  modal.querySelector(".finance-content").innerHTML =
    `<div class="donation-popup-wrap"><table class="donation-popup-table"><thead><tr><th>Flat number</th><th>Donor name</th><th>Amount</th><th>Payment mode</th><th>Receipt</th></tr></thead><tbody>${data.donations.map((item) => `<tr><td>${item.flatNumber || "--"}</td><td>${item.donorName || "--"}</td><td><strong>${money(item.amount)}</strong></td><td>${item.paymentMode || "--"}</td><td>${item.receiptNumber ? `<button class="receipt-action" type="button" data-public-receipt="${item.receiptNumber}">👁 View</button>` : "--"}</td></tr>`).join("") || '<tr><td colspan="5">No donations recorded yet.</td></tr>'}</tbody></table></div>`;
});
publicDonationTableObserver.observe(document.body, {
  subtree: true,
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
  modal.querySelector(".finance-content").innerHTML =
    `<div class="expense-popup-wrap"><table class="expense-popup-table"><thead><tr><th>Expense name</th><th>Amount</th><th>Payment mode</th><th>Time</th></tr></thead><tbody>${data.expenses.map((item) => `<tr><td>${item.name || "--"}</td><td><strong>${money(item.amount)}</strong></td><td>${item.paymentMode || "--"}</td><td>${formatDonorDate(item.createdAt || item.date)}</td></tr>`).join("") || '<tr><td colspan="4">No expenditure recorded yet.</td></tr>'}</tbody></table></div>`;
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
const formatDate = (value, fallback = "--") => {
  if (!value) return fallback;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return `${String(parsed.getDate()).padStart(2, "0")}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${parsed.getFullYear()}`;
};
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
  const response = await fetch("/api/public");
  if (!response.ok) return;
  const data = await response.json();
  document.title = data.committeeName;
  document.getElementById("heroDonations").textContent = money(
    data.stats.totalDonations,
  );
  document.getElementById("stats").innerHTML = [
    ["Total donations", data.stats.totalDonations],
    ["Total expenditure", data.stats.totalExpenses],
    ["Current balance", data.stats.balance],
  ]
    .map(
      ([label, value]) =>
        `<div class="col-md-4"><div class="stat-card"><span class="label">${label}</span><strong>${money(value)}</strong></div></div>`,
    )
    .join("");
  document.getElementById("eventsList").innerHTML = data.events.length
    ? data.events
        .map(
          (e) =>
            `<div class="col-md-4"><article class="event-card"><div class="event-date">${date(e.date)} · ${e.time || "Time TBA"}</div><h3 class="mt-3">${e.name}</h3><p>${e.description || "Join the community for an evening of devotion and celebration."}</p><small>${e.venue || "Community Hall"}</small></article></div>`,
        )
        .join("")
    : "<p>No events announced yet.</p>";
  document.getElementById("membersList").innerHTML =
    data.members
      .map(
        (m) =>
          `<div class="col-sm-6 col-lg-3"><article class="member-card"><p class="eyebrow">${m.designation || "Committee member"}</p><h3>${m.name}</h3><p>${m.mobile || "Available through the committee desk"}</p></article></div>`,
      )
      .join("") || "<p>Committee details coming soon.</p>";
  renderGallery(data.gallery.length ? data.gallery : [{ title: "Ganesh Utsav memories", caption: "", path: "/Ganesh%20Idol.jpg" }]);
  renderPublicDonors(data.donations);
}
loadPortal();
let publicDonorRows = [];
let publicDonorPage = 0;
let publicDonorPageSize = 25;
function renderPublicDonors(items) {
  publicDonorRows = items;
  const query = document.getElementById("publicDonorSearch")?.value.toLowerCase() || "";
  const mode = document.getElementById("publicPaymentFilter")?.value || "";
  const filtered = items.filter(item => `${item.flatNumber} ${item.donorName} ${item.amount} ${item.paymentMode} ${item.receiptNumber}`.toLowerCase().includes(query) && (!mode || item.paymentMode === mode));
  const size = publicDonorPageSize; const visible = size === "all" ? filtered : filtered.slice(publicDonorPage * size, (publicDonorPage + 1) * size);
  const safe = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  document.querySelector("#donationsList").closest("table").querySelector("thead tr").innerHTML = "<th>Flat Number</th><th>Donor Name</th><th>Amount</th><th>Payment Mode</th><th>Receipt</th>";
  document.getElementById("donationsList").innerHTML = visible.map(d => `<tr><td data-label="Flat Number">${safe(d.flatNumber || "--")}</td><td data-label="Donor Name">${safe(d.donorName || "--")}</td><td data-label="Amount" class="amount-positive">${money(d.amount)}</td><td data-label="Payment Mode"><span class="payment-badge payment-${(d.paymentMode || "cash").toLowerCase().replace(/\s+/g, "-")}">${safe(d.paymentMode || "Cash")}</span></td><td data-label="Receipt">${d.receiptNumber ? `<button class="receipt-action" type="button" data-public-receipt="${safe(d.receiptNumber)}">👁 View</button>` : "--"}</td></tr>`).join("") || '<tr><td colspan="5" class="donor-empty">🐘 No supporters found.<br><small>Try another name or flat number.</small></td></tr>';
  const total = filtered.length; const first = total ? (size === "all" ? 1 : publicDonorPage * size + 1) : 0; const last = total ? (size === "all" ? total : Math.min((publicDonorPage + 1) * size, total)) : 0; const pages = size === "all" ? 1 : Math.max(1, Math.ceil(total / size));
  const panel = document.getElementById("publicDonorPagination");
  panel.innerHTML = `<span>Showing ${first}-${last} of ${total} Supporters</span><button type="button" data-public-page="prev" ${publicDonorPage === 0 || size === "all" ? "disabled" : ""}>Previous</button>${Array.from({ length: Math.min(pages, 7) }, (_, index) => `<button type="button" data-public-page="${index}" class="${index === publicDonorPage ? "active" : ""}">${index + 1}</button>`).join("")}<button type="button" data-public-page="next" ${publicDonorPage >= pages - 1 || size === "all" ? "disabled" : ""}>Next</button>`;
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
  viewer.setAttribute("aria-hidden", "true");
}
function setSlideshow(playing) { slideshowPlaying = playing; clearInterval(slideshowTimer); const button = document.getElementById("galleryViewerPause"); if (button) button.textContent = playing ? "⏸ Pause" : "▶ Play"; if (playing) slideshowTimer = setInterval(() => openGallery(galleryIndex + 1), 4000); }
document.addEventListener("click", (event) => {
  const tile = event.target.closest("[data-gallery-index]");
  if (tile) openGallery(Number(tile.dataset.galleryIndex));
  if (event.target.closest(".gallery-viewer-close")) closeGallery();
  if (event.target.closest(".gallery-viewer-prev")) openGallery(galleryIndex - 1);
  if (event.target.closest(".gallery-viewer-next")) openGallery(galleryIndex + 1);
  if (event.target === document.getElementById("galleryViewer")) closeGallery();
});
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
document.addEventListener("DOMContentLoaded", () => {
  const venue = document.querySelector('#eventForm [name="venue"]');
  if (venue && !venue.value) venue.value = "Between Sirius & Samyukta";
  fetch("/api/public")
    .then((response) => response.json())
    .then((data) => {
      const list = document.getElementById("eventsList");
      if (!list) return;
      list.innerHTML = `<div class="member-table-wrap"><table class="member-table event-table"><thead><tr><th>Event name</th><th>Date</th><th>Time</th><th>Venue</th></tr></thead><tbody>${data.events.map((item) => `<tr><td>${item.name || "--"}</td><td>${item.date ? date(item.date) : "--"}</td><td>${item.time || "--"}</td><td>${item.venue || "Between Sirius & Samyukta"}</td></tr>`).join("") || '<tr><td colspan="4">No events announced yet.</td></tr>'}</tbody></table></div>`;
    });
});
document.addEventListener("click", async (event) => {
  const card = event.target.closest(".stat-card");
  if (!card) return;
  const response = await fetch("/api/public");
  const data = await response.json();
  const label = card.querySelector(".label").textContent;
  const title =
    label === "Total donations"
      ? "Donation details"
      : label === "Total expenditure"
        ? "Expenditure details"
        : "Balance details";
  let content = "";
  if (label === "Total donations")
    content = data.donations.length
      ? data.donations
          .map(
            (item) =>
              `<div class="finance-detail"><span>${item.donorName}<small>${date(item.date)} · ${item.paymentMode || "Cash"}</small></span><strong>${money(item.amount)}</strong></div>`,
          )
          .join("")
      : '<p class="muted">No donations recorded yet.</p>';
  if (label === "Total expenditure")
    content = data.expenses.length
      ? `<div class="expense-popup-wrap"><table class="expense-popup-table"><thead><tr><th>Expense Name</th><th>Amount</th><th>Payment Mode</th><th>Expense Date</th></tr></thead><tbody>${data.expenses.map(item => `<tr><td>${item.name || "--"}</td><td class="amount-positive">${money(item.amount)}</td><td>${item.paymentMode || "--"}</td><td>${formatDonorDate(item.date)}</td></tr>`).join("")}</tbody></table></div>`
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
  modal.querySelector(".finance-content").innerHTML = content;
  modal.classList.add("is-open");
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
    modal.innerHTML = `<div class="receipt-preview-panel" role="dialog" aria-modal="true" aria-label="Receipt preview"><div class="receipt-preview-header"><strong>Receipt Preview</strong><span class="receipt-preview-number"></span><button type="button" class="receipt-close" aria-label="Close receipt preview">×</button></div><div class="receipt-preview-box"><img class="receipt-preview-image" alt="Donation receipt"></div></div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", event => { if (event.target === modal || event.target.closest(".receipt-close")) modal.classList.remove("is-open"); });
  }
  modal.querySelector(".receipt-preview-number").textContent = receiptNumber;
  modal.querySelector(".receipt-preview-image").src = "/api/receipts/" + encodeURIComponent(receiptNumber) + "/image.svg?refresh=" + Date.now();
  modal.querySelector(".receipt-preview-image").alt = "Donation receipt " + receiptNumber;
  modal.classList.add("is-open");
}
document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-public-receipt]");
  if (!button || !button.dataset.publicReceipt) return;
  event.preventDefault();
  showPublicReceiptPreview(button.dataset.publicReceipt);
  return;
  try {
    const response = await fetch(
      "/api/receipts/" +
        encodeURIComponent(button.dataset.publicReceipt) +
        "/image.svg",
    );
    if (!response.ok) throw new Error("Receipt unavailable");
    const sourceUrl = URL.createObjectURL(
      new Blob([await response.text()], { type: "image/svg+xml" }),
    );
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 2121;
      canvas.height = 1500;
      canvas
        .getContext("2d")
        .drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (jpg) => {
          if (!jpg) {
            alert("Unable to create receipt image");
            button.disabled = false;
            return;
          }
          const link = document.createElement("a");
          link.href = URL.createObjectURL(jpg);
          link.download = button.dataset.publicReceipt + ".jpg";
          link.click();
          setTimeout(() => {
            URL.revokeObjectURL(link.href);
            URL.revokeObjectURL(sourceUrl);
            button.disabled = false;
          }, 1000);
        },
        "image/jpeg",
        0.92,
      );
    };
    image.onerror = () => {
      URL.revokeObjectURL(sourceUrl);
      button.disabled = false;
      alert("Unable to create receipt image");
    };
    image.src = sourceUrl;
  } catch (error) {
    button.disabled = false;
    alert(error.message);
  }
});
