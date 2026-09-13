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
    modal.querySelector(".finance-content").innerHTML = `<div class="finance-record-count">Showing ${expenses.length ? page * pageSize + 1 : 0}-${Math.min((page + 1) * pageSize, expenses.length)} of ${expenses.length} expenses</div><div class="expense-popup-wrap"><table class="expense-popup-table"><thead><tr><th>Expense name</th><th>Total</th><th>Advance</th><th>Remaining</th><th>Status</th><th>Payment mode</th><th>Date</th><th>Time</th></tr></thead><tbody>${visible.map(item => `<tr><td>${item.name || "--"}</td><td><strong>${money(item.amount)}</strong></td><td>${money(item.advanceAmount ?? 0)}</td><td>${money(item.remainingAmount ?? 0)}</td><td>${item.status || "Due"}</td><td>${item.paymentMode || "--"}</td><td>${formatExpenseDate(item.date || item.createdAt)}</td><td>${formatExpenseTime(item.createdAt || item.time || item.date)}</td></tr>`).join("") || '<tr><td colspan="8">No expenditure recorded yet.</td></tr>'}</tbody></table></div><div class="public-donation-pagination expense-pagination"><button type="button" data-expense-page="prev" aria-label="Previous page" title="Previous page" ${page === 0 ? "disabled" : ""}>‹</button><span>Page ${page + 1} of ${pages}</span><button type="button" data-expense-page="next" aria-label="Next page" title="Next page" ${page >= pages - 1 ? "disabled" : ""}>›</button></div>`;
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
  const heroImage = document.querySelector("[data-hero-image]");
  heroImage?.addEventListener("mouseenter", playFestivalSong);
  heroImage?.addEventListener("touchstart", playFestivalSong, { passive: true });
  heroImage?.addEventListener("mouseleave", () => {
    if (!document.getElementById("galleryViewer")?.classList.contains("is-open")) stopFestivalSong();
  });
  document.getElementById("songMuteToggle")?.addEventListener("click", toggleFestivalSongMute);
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
const defaultPublicWelcomeMessage = "🙏 శ్రీ గణేశ చతుర్థి మహోత్సవములకు మీకు హృదయపూర్వక స్వాగతం - సూర్యోదయ కాలనీ 🙏 | 🙏 Heartfelt Welcome to Sri Ganesh Chaturthi Celebrations 2026 - Suryodaya Colony 🙏";
const defaultPublicEvent = {
  date: "2026-09-14",
  name: "Ganesh Idol installation",
  time: "8:00 AM - 9:00 AM",
  status: "Upcoming",
};
const escapedDefaultPublicEvent = () => "14-Sep-2026 - Ganesh Idol installation - 8:00 AM - 9:00 AM - Ganesh Pooja";
const normalizePlotNumber = value => { const raw = String(value ?? "").trim().replace(/\s+/g, "-").replace(/-+/g, "-"); const plotMatch = raw.match(/^plot(?:-?no\.?)?-?(\d+)$/i); if (plotMatch) return `PlotNo-${plotMatch[1]}`; const siriusMatch = raw.match(/^(sirius|sirus)[_-]?(\d+)$/i); if (siriusMatch) return `Sirius_${siriusMatch[2]}`; const samyuktaMatch = raw.match(/^(samyukta)-?(\d+)$/i); return samyuktaMatch ? `Samyukta-${samyuktaMatch[2]}` : raw; };
const alphanumericSort = (a, b) => { const aparts = String(a).split(/(\d+)/); const bparts = String(b).split(/(\d+)/); for (let i = 0; i < Math.min(aparts.length, bparts.length); i++) { const isNum = /^\d+$/.test(aparts[i]); if (isNum) { const diff = Number(aparts[i]) - Number(bparts[i]); if (diff) return diff; } else { if (aparts[i] !== bparts[i]) return aparts[i].localeCompare(bparts[i]); } } return aparts.length - bparts.length; };
const sortByPlotNumber = (left, right) => { const parse = value => { const normalized = normalizePlotNumber(value); const cleanMatch = normalized.match(/^PlotNo-(\d+)$/); if (cleanMatch) return [0, Number(cleanMatch[1]), '']; const samyuktaMatch = normalized.match(/^Samyukta-(\d+)$/); if (samyuktaMatch) return [3, Number(samyuktaMatch[1]), '']; const siriusMatch = normalized.match(/^Sirius_(\d+)$/); if (siriusMatch) return [4, Number(siriusMatch[1]), '']; const rawValue = String(value || '').trim().toLowerCase(); if (rawValue.includes('plot') || rawValue.match(/^plotno/i)) return [1, 0, normalized]; return [2, 0, normalized]; }; const a = parse(left.flatNumber); const b = parse(right.flatNumber); if (a[0] !== b[0]) return a[0] - b[0]; if (a[0] === 0 || a[0] === 3 || a[0] === 4) return a[1] - b[1]; if (a[0] === 1) return alphanumericSort(a[2], b[2]); return a[2].localeCompare(b[2]); };
const sortSpecialContributions = (left, right) => { const parse = value => { const raw = String(value ?? '').trim().replace(/[\s_-]+/g, '').toLowerCase(); const sirius = raw.match(/^(?:sirius|sirus)(\d+)$/); if (sirius) return [0, Number(sirius[1])]; const samyukta = raw.match(/^samyukta(\d+)$/); if (samyukta) return [1, Number(samyukta[1])]; return [2, 0]; }; const a = parse(left.flatNumber); const b = parse(right.flatNumber); return a[0] - b[0] || a[1] - b[1] || sortByPlotNumber(left, right); };
const date = (value) =>
  formatDate(value, "Date to be announced");
function renderPublicScrolls(contact, events) {
  const welcomeScroll = document.getElementById("welcomeScroll");
  const welcomeMarquee = document.getElementById("welcomeMarquee");
  const welcomeMessage = String(contact?.welcomeMessage || defaultPublicWelcomeMessage).trim();
  if (welcomeScroll && welcomeMarquee) {
    welcomeMarquee.textContent = welcomeMessage;
    welcomeScroll.hidden = !welcomeMessage;
  }
  const ritualScroll = document.getElementById("ritualScroll");
  const ritualMarquee = document.getElementById("ritualMarquee");
  const tickerDate = value => { const dateValue = new Date(value); return Number.isNaN(dateValue.getTime()) ? "Date to be announced" : `${String(dateValue.getDate()).padStart(2, "0")}-${dateValue.toLocaleString("en-IN", { month: "short" })}-${dateValue.getFullYear()}`; };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fallbackEvents = [defaultPublicEvent];
  const upcoming = (events && events.length ? events : fallbackEvents).filter(item => item.date && new Date(item.date) >= today && item.status !== "Completed");
  const ritualText = upcoming.length
    ? upcoming.map(item => `${tickerDate(item.date)} - ${item.name || "Devotee"} - ${item.time || "Time to be announced"} - Ganesh Pooja`).join("  |  ")
    : escapedDefaultPublicEvent();
  if (ritualScroll && ritualMarquee) {
    ritualMarquee.textContent = ritualText;
    ritualScroll.hidden = !ritualText;
  }
}
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
const initializePublicScrolls = () => {
  renderPublicScrolls({ welcomeMessage: defaultPublicWelcomeMessage }, [defaultPublicEvent]);
};
initializePublicScrolls();
document.addEventListener("DOMContentLoaded", initializePublicScrolls, { once: true });

function renderDonationModal(contact) {
  const details = document.getElementById("donationModalDetails");
  const qr = document.getElementById("donationModalQr");
  if (!details || !qr) return;
  const rows = [
    ["UPI ID", contact.upiId],
    ["Bank Name", contact.bankName],
    ["Account Name", contact.accountName],
    ["Account Number", contact.accountNumber],
    ["IFSC Code", contact.ifscCode],
  ].filter(([, value]) => value);
  details.innerHTML = rows.length
    ? rows.map(([label, value]) => `<div class="donation-detail-row"><strong>${label}:</strong><span>${escapeHtml(value)}</span><button class="donation-copy-btn" type="button" data-copy-donation="${escapeHtml(value)}" aria-label="Copy ${label}">📋</button></div>`).join("")
    : "<p>Donation details are not available right now.</p>";
  qr.src = contact.qrImagePath || contact.qrData || "/phonepe-qr.jpeg";
  qr.hidden = false;
}
function closeDonationModal() {
  const modal = document.getElementById("donationModal");
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("donation-modal-open");
}
function playFestivalSong() {
  const audio = document.getElementById("ganeshSong");
  if (!audio || audio.muted) return;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}
function stopFestivalSong() {
  const audio = document.getElementById("ganeshSong");
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
}
function toggleFestivalSongMute(event) {
  const audio = document.getElementById("ganeshSong");
  const toggle = event.currentTarget;
  if (!audio) return;
  audio.muted = !audio.muted;
  toggle.setAttribute("aria-pressed", String(audio.muted));
  toggle.setAttribute("aria-label", audio.muted ? "Unmute festival song" : "Mute festival song");
  toggle.textContent = audio.muted ? "🔇" : "🔊";
}
async function loadPortal() {
  const response = await fetch("/api/public", { cache: "no-store" }).catch(() => null);
  if (!response?.ok) {
    const stats = document.getElementById("stats");
    const events = document.getElementById("eventsList");
    const message = response?.status === 503 ? "Finance records are temporarily unavailable. Please check the database connection." : "Finance records could not be loaded. Please try again shortly.";
    if (stats) stats.innerHTML = `<p class="portal-data-error" role="alert">${message}</p>`;
    if (events) events.innerHTML = `<p class="portal-data-error" role="alert">${message}</p>`;
    return;
  }
  const data = await response.json();
  const contact = data.contact || {};
  renderDonationModal(contact);
  renderPublicScrolls(contact, data.events);
  const contactDetails = document.querySelector(".contact-details");
  if (contactDetails) { const lines = contactDetails.querySelectorAll("span"); if (lines[0]) lines[0].textContent = `📧 ${contact.contactEmail || "hello@ganeshutsav.org"} · 📞 ${contact.phone1 || "8555958559"}${contact.phone2 ? ` | ${contact.phone2}` : ""}`; }
  document.title = data.committeeName;
  document.getElementById("heroDonations").textContent = money(
    data.stats.totalDonations,
  );
  const contributionTotal = type => type === "Laddu Auction 2025" && data.stats.ladduAuctionTotal != null ? data.stats.ladduAuctionTotal : data.donations.filter(item => item.contributionType === type && item.status !== "Yet to receive").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const contributionRows = type => data.donations.filter(item => item.contributionType === type && item.status !== "Yet to receive").sort(sortSpecialContributions).slice(0, 2);
  const summaryRows = (type, emptyLabel) => contributionRows(type).map(item => { const plot = normalizePlotNumber(item.flatNumber); const donor = item.donorName || "--"; return `<tr><td>${escapeHtml(plot ? `${donor} (${plot})` : donor)}</td><td>${money(item.amount)}</td></tr>`; }).join("") || `<tr><td colspan="2" class="summary-empty">${emptyLabel}</td></tr>`;
  const sponsorshipDonations = data.donations.filter(item => ["Ganesh Idol Sponsor", "Laddu Sponsorship 2026"].includes(item.contributionType) && item.status !== "Yet to receive");
  const sponsorshipRows = [...sponsorshipDonations].sort(sortByPlotNumber).slice(0, 4);
  const sponsorshipTotal = sponsorshipDonations.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const generalDonationTotal = Number(data.stats.totalDonations || 0);
  const ladduAuctionTotal = Number(data.stats.ladduAuctionTotal || 0);
  const paidTotal = (data.expenses || []).reduce((sum, item) => {
    const amount = Number(item.amount || 0);
    const advance = Number(item.advanceAmount || 0);
    const status = item.status || "Due";
    return sum + (status === "Full Paid" ? amount : advance);
  }, 0);
  const remainingBookBalance = generalDonationTotal + ladduAuctionTotal - paidTotal;
  document.getElementById("stats").innerHTML = `
    <article class="summary-card donations-card">
      <h4>Total Donations</h4>
      <p class="collected"><strong>Collected Amount (General Donations + Laddu Auction 2025):</strong> <span class="collected-amount">${money(generalDonationTotal + ladduAuctionTotal)}</span></p>
      <table class="breakdown mini-table"><thead><tr><th>Category</th><th>Amount</th></tr></thead><tbody>
        <tr><td>General Donations</td><td>${money(generalDonationTotal)}</td></tr>
        <tr><td>Laddu Auction (Ganesh Utsav 2025)</td><td>${money(ladduAuctionTotal)}</td></tr>
      </tbody></table>
      <h5>Donor Details (from Laddu Auction)</h5>
      <table class="donors mini-table"><thead><tr><th>Name</th><th>Amount</th></tr></thead><tbody>${contributionRows("Laddu Auction 2025").map(item => {
        const plot = normalizePlotNumber(item.flatNumber);
        const donor = plot ? `${item.donorName || "--"} (${plot})` : item.donorName || "--";
        return `<tr><td>${escapeHtml(donor)}</td><td>${money(item.amount)}</td></tr>`;
      }).join("") || '<tr><td colspan="2" class="summary-empty">No auction records yet.</td></tr>'}</tbody></table>
      <button class="view-all" type="button" data-scroll-to-donations>View All</button>
    </article>
    <article class="balance-card stat-card balance-stat" role="button" tabindex="0" aria-label="View balance details">
      <h3>Remaining Balance</h3>
      <p class="formula">General Donations + Laddu Auction (Ganesh Utsav 2025) - Total Paid</p>
      <strong class="amount">${money(remainingBookBalance)}</strong>
      <span class="view-btn">View all</span>
    </article>
    <article class="summary-card stat-card contribution-stat-card sponsorship-summary-card" data-sponsorship-summary="true" role="button" tabindex="0" aria-label="View Ganesh Idol & Laddu Sponsorship 2026 contributions">
      <h4>Ganesh Idol &amp; Laddu Sponsorship 2026</h4>
      <strong class="total">${money(sponsorshipTotal)}</strong>
      <table class="mini-table sponsorship-summary-table"><thead><tr><th>Plot Number</th><th>Name</th><th>Contribution Type</th><th>Amount</th></tr></thead><tbody>${sponsorshipRows.map(item => `<tr><td>${escapeHtml(normalizePlotNumber(item.flatNumber) || "--")}</td><td>${escapeHtml(item.donorName || "--")}</td><td>${escapeHtml(item.contributionType === "Ganesh Idol Sponsor" ? "Ganesh Idol Sponsorship 2026" : item.itemName ? `Laddu Sponsorship 2026 - ${item.itemName}` : "Laddu Sponsorship 2026")}</td><td>${money(item.amount)}</td></tr>`).join("") || '<tr><td colspan="4" class="summary-empty">No sponsorship records yet.</td></tr>'}</tbody></table>
      <span class="view-btn">View all</span>
    </article>`;
  const publicEvents = data.events || [];
  const eventPageSize = 10;
  const eventPages = Math.max(1, Math.ceil(publicEvents.length / eventPageSize));
  publicEventsPage = Math.min(publicEventsPage, eventPages - 1);
  const visibleEvents = publicEvents.slice(publicEventsPage * eventPageSize, (publicEventsPage + 1) * eventPageSize);
  document.getElementById("eventsList").innerHTML = publicEvents.length
    ? `<div class="member-table-wrap public-events-table-wrap"><table class="member-table event-table public-events-table"><thead><tr><th>Devotee Name</th><th>Contact Number</th><th>Pooja Type</th><th>Preferred Date</th><th>Preferred Time</th><th>Venue / Location</th><th>Request Status</th><th>Actions</th></tr></thead><tbody>${visibleEvents.map(e => { const status = e.status || "Pending"; return `<tr><td><strong>${e.name || "--"}</strong></td><td>${e.mobile || "--"}</td><td>Ganesh Pooja</td><td>${e.date ? date(e.date) : "--"}</td><td>${e.time || "--"}</td><td>${e.venue || "Between Sirius & Samyukta"}</td><td><span class="ritual-status ritual-status-${status.toLowerCase()}">${status}</span></td><td><span class="ritual-public-action" aria-label="Pooja request details">👁</span></td></tr>`; }).join("")}</tbody></table></div>`
    : "<p>No events announced yet.</p>";
  renderPublicPager("publicEventsPagination", publicEvents.length, publicEventsPage, eventPageSize, page => { publicEventsPage = page; loadPortal(); });
  const publicExpenditureSummary = document.getElementById("publicExpenditureSummary");
  if (publicExpenditureSummary) {
    const expenseRows = data.expenses || [];
    const total = expenseRows.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const paid = expenseRows.reduce((sum, item) => {
      const status = item.status || "Due";
      const amount = Number(item.amount || 0);
      const advance = Number(item.advanceAmount || 0);
      return sum + (status === "Full Paid" ? amount : advance);
    }, 0);
    const due = expenseRows.reduce((sum, item) => {
      const status = item.status || "Due";
      const remaining = Number(item.remainingAmount || 0);
      return sum + (status === "Full Paid" ? 0 : remaining);
    }, 0);
    const expensePageSize = 10;
    const expenseQuery = document.getElementById("publicExpenseSearch")?.value.trim().toLowerCase() || "";
    const filteredExpenseRows = expenseRows
      .filter(item => String(item.name || "").toLowerCase().includes(expenseQuery))
      .sort((left, right) => Number((left.status || "Due") !== "Due") - Number((right.status || "Due") !== "Due"));
    publicExpensesPage = Math.min(publicExpensesPage, Math.max(0, Math.ceil(filteredExpenseRows.length / expensePageSize) - 1));
    const visibleExpenses = filteredExpenseRows.slice(publicExpensesPage * expensePageSize, (publicExpensesPage + 1) * expensePageSize);
    const rows = visibleExpenses.map(item => `
      <tr>
        <td>${escapeHtml(item.name || "--")}</td>
        <td data-total="${Number(item.amount || 0)}">${money(item.amount)}</td>
        <td data-paid="${(item.status || "Due") === "Full Paid" ? Number(item.amount || 0) : Number(item.advanceAmount || 0)}">${money((item.status || "Due") === "Full Paid" ? item.amount : item.advanceAmount)}</td>
        <td data-due="${(item.status || "Due") === "Full Paid" ? 0 : Number(item.remainingAmount || 0)}">${money((item.status || "Due") === "Full Paid" ? 0 : item.remainingAmount)}</td>
        <td><span class="public-expense-status ${((item.status || "Due")).toLowerCase().replace(/\s+/g, "-")}">${escapeHtml(item.status || "Due")}</span></td>
      </tr>
    `).join("") || '<tr><td colspan="5" class="donor-empty">No expenditure recorded yet.</td></tr>';
    publicExpenditureSummary.innerHTML = `
      <div class="public-expense-summary-shell">
        <div class="public-expense-summary-box">
          <h3>Where the Money Is Going</h3>
          <button class="estimated-results-button" type="button" data-estimated-results>Estimated Balance Summary [Click Me]</button>
        </div>
        <div class="public-expense-table-wrap">
          <table class="public-expense-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="publicExpenseTable">${rows}</tbody>
            <tfoot>
              <tr id="totalsRow" style="font-weight:bold; text-align:center;">
                <td style="text-align:right;">Grand Total</td>
                <td id="totalSumFooter">${money(total)}</td>
                <td id="paidSumFooter">${money(paid)}</td>
                <td id="dueSumFooter">${money(due)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `;
    const publicExpenseSummaryTotals = () => {
      const totalValue = total;
      const paidValue = paid;
      const dueValue = due;
      const totalFooterEl = document.getElementById("totalSumFooter");
      const paidFooterEl = document.getElementById("paidSumFooter");
      const dueFooterEl = document.getElementById("dueSumFooter");
      if (totalFooterEl) totalFooterEl.textContent = money(totalValue);
      if (paidFooterEl) paidFooterEl.textContent = money(paidValue);
      if (dueFooterEl) dueFooterEl.textContent = money(dueValue);
    };
    requestAnimationFrame(publicExpenseSummaryTotals);
    renderPublicPager("publicExpensePagination", filteredExpenseRows.length, publicExpensesPage, expensePageSize, page => { publicExpensesPage = page; loadPortal(); });
  }
  renderGallery(data.gallery.length ? data.gallery : [{ title: "Ganesh Utsav memories", caption: "", path: "/GaneshIdol_detail.jpeg" }]);
  renderPublicDonors(data.donations);
  renderPublicSponsorships(data.donations);
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
  document.querySelector("#donationsList").closest("table").querySelector("thead tr").innerHTML = "<th>Plot No.</th><th>Donor Name</th><th>Amount</th><th>Date</th><th>Payment Mode</th><th>Actions</th>";
  document.getElementById("donationsList").innerHTML = visible.map(d => `<tr><td data-label="Plot No.">${safe(normalizePlotNumber(d.flatNumber) || "--")}</td><td data-label="Donor Name">${safe(d.donorName || "--")}</td><td data-label="Amount" class="amount-positive">${money(d.amount)}</td><td data-label="Date">${formatDate(d.date || d.createdAt)}</td><td data-label="Payment Mode"><span class="payment-badge payment-${(d.paymentMode || "cash").toLowerCase().replace(/\s+/g, "-")}">${safe(d.paymentMode || "Cash")}</span></td><td data-label="Actions">${d.receiptNumber ? `<span class="public-receipt-actions"><button class="receipt-action" type="button" data-public-receipt="${safe(d.receiptNumber)}" title="View receipt" aria-label="View receipt">&#128065;</button><button class="receipt-action public-receipt-row-download" type="button" data-public-download="${safe(d.receiptNumber)}" title="Download receipt" aria-label="Download receipt">&#11123;</button></span>` : "--"}</td></tr>`).join("") || '<tr><td colspan="6" class="donor-empty">🐘 No supporters found.<br><small>Try another name or plot number.</small></td></tr>';
  const total = filtered.length; const first = total ? (size === "all" ? 1 : publicDonorPage * size + 1) : 0; const last = total ? (size === "all" ? total : Math.min((publicDonorPage + 1) * size, total)) : 0; const pages = size === "all" ? 1 : Math.max(1, Math.ceil(total / size));
  const panel = document.getElementById("publicDonorPagination");
  panel.innerHTML = `<span>Showing ${first}-${last} of ${total} Supporters</span><button type="button" data-public-page="prev" aria-label="Previous page" title="Previous page" ${publicDonorPage === 0 || size === "all" ? "disabled" : ""}>‹</button>${Array.from({ length: Math.min(pages, 7) }, (_, index) => `<button type="button" data-public-page="${index}" class="${index === publicDonorPage ? "active" : ""}">${index + 1}</button>`).join("")}<button type="button" data-public-page="next" aria-label="Next page" title="Next page" ${publicDonorPage >= pages - 1 || size === "all" ? "disabled" : ""}>›</button>`;
}
function renderPublicSponsorships(items) {
  const body = document.getElementById("publicSponsorshipsList");
  if (!body) return;
  const sponsorships = (Array.isArray(items) ? items : []).filter(item => {
    const type = String(item.contributionType || "").toLowerCase();
    return type === "ganesh idol sponsor" || type === "ganesh idol sponsorship 2026" || type === "laddu sponsorship 2026";
  });
  body.innerHTML = sponsorships.map(item => {
    const rawType = String(item.contributionType || "").toLowerCase();
    const contributionType = rawType.includes("ganesh idol") ? "Ganesh Idol Sponsorship 2026" : item.itemName ? `Laddu Sponsorship 2026 - ${item.itemName}` : "Laddu Sponsorship 2026";
    return `<tr><td data-label="Plot Number">${escapeHtml(normalizePlotNumber(item.flatNumber) || "--")}</td><td data-label="Name">${escapeHtml(item.donorName || "--")}</td><td data-label="Contribution Type">${escapeHtml(contributionType)}</td><td data-label="Amount" class="amount-positive">${money(item.amount)}</td></tr>`;
  }).join("") || '<tr><td colspan="4" class="donor-empty">No sponsorships recorded yet.</td></tr>';
}
function formatDonorDate(value) { return value ? `${formatDate(value)} ${new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : "--"; }
document.addEventListener("input", event => { if (event.target.id === "publicDonorSearch") { publicDonorPage = 0; renderPublicDonors(publicDonorRows); } if (event.target.id === "publicExpenseSearch") { publicExpensesPage = 0; loadPortal(); } });
document.addEventListener("change", event => { if (event.target.id === "publicRowsPerPage") { publicDonorPageSize = event.target.value === "all" ? "all" : Number(event.target.value); publicDonorPage = 0; renderPublicDonors(publicDonorRows); } });
document.addEventListener("change", event => { if (event.target.id === "publicPaymentFilter") { publicDonorPage = 0; renderPublicDonors(publicDonorRows); } });
document.addEventListener("click", event => { const button = event.target.closest("[data-public-page]"); if (!button) return; const value = button.dataset.publicPage; publicDonorPage += value === "prev" ? -1 : value === "next" ? 1 : Number(value) - publicDonorPage; renderPublicDonors(publicDonorRows); });
let publicEventsPage = 0;
let publicExpensesPage = 0;
let publicGalleryPage = 0;
function renderPublicPager(id, total, page, size, onPage) {
  const panel = document.getElementById(id);
  if (!panel) return;
  const pages = Math.max(1, Math.ceil(total / size));
  const first = total ? page * size + 1 : 0;
  const last = total ? Math.min((page + 1) * size, total) : 0;
  panel.innerHTML = `<span>Showing ${first}-${last} of ${total}</span><button type="button" data-public-pager="prev" aria-label="Previous page" ${page === 0 ? "disabled" : ""}>&lt;</button><strong aria-current="page">Page ${page + 1} of ${pages}</strong><button type="button" data-public-pager="next" aria-label="Next page" ${page >= pages - 1 ? "disabled" : ""}>&gt;</button>`;
  panel.querySelector('[data-public-pager="prev"]')?.addEventListener("click", () => onPage(page - 1));
  panel.querySelector('[data-public-pager="next"]')?.addEventListener("click", () => onPage(page + 1));
}
let galleryImages = [];
let galleryIndex = 0;
let slideshowTimer;
let slideshowPlaying = false;
const galleryFallbackPath = "/GaneshIdol_detail.jpeg";
function galleryMediaPath(image) {
  if (image?._id) return `/api/gallery/${encodeURIComponent(image._id)}/media`;
  const value = String(image?.path || image?.filename || "").trim().replace(/\\/g, "/");
  if (!value) return galleryFallbackPath;
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  const normalized = value.startsWith("/") ? value : `/${value.replace(/^\.\//, "")}`;
  return normalized.includes("?") ? normalized : `${normalized}?v=${Date.now()}`;
}
function setGalleryImageFallback(event) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied) return;
  image.dataset.fallbackApplied = "true";
  image.hidden = true;
  image.closest(".gallery-item")?.classList.add("gallery-media-missing");
}
function renderGallery(images) {
  galleryImages = images;
  const list = document.getElementById("galleryList");
  if (!list) return;
  const isVideo = image => image.mediaType?.startsWith("video/") || /\.(mp4|webm|ogg|mov)$/i.test(image.originalName || image.path || "");
  const isAudio = image => image.mediaType?.startsWith("audio/") || /\.(mp3|wav|m4a|ogg)$/i.test(image.originalName || image.path || "");
  document.getElementById("galleryTotal").textContent = `Total media: ${images.length}`;
  const galleryPageSize = 10;
  const galleryPages = Math.max(1, Math.ceil(images.length / galleryPageSize));
  publicGalleryPage = Math.min(publicGalleryPage, galleryPages - 1);
  const visibleImages = images.slice(publicGalleryPage * galleryPageSize, (publicGalleryPage + 1) * galleryPageSize);
  list.innerHTML = visibleImages.map((image, index) => {
    const galleryIndex = publicGalleryPage * galleryPageSize + index;
    const mediaPath = galleryMediaPath(image);
    const media = isVideo(image)
      ? `<video src="${mediaPath}" controls playsinline preload="metadata" aria-label="${image.title || "Ganesh Utsav video"}"></video>`
      : isAudio(image)
        ? `<audio src="${mediaPath}" controls preload="metadata" aria-label="${image.title || "Ganesh Utsav audio"}"></audio>`
        : `<img src="${mediaPath}" alt="${image.title || "Ganesh Utsav memory"}" loading="lazy">`;
    return `<figure class="gallery-card"><div class="gallery-item" data-gallery-index="${galleryIndex}" role="button" tabindex="0" aria-label="Open ${image.title || "gallery media"}">${media}<span class="gallery-check"><input class="gallery-select" type="checkbox" data-gallery-select="${galleryIndex}" aria-label="Select media ${galleryIndex + 1}"></span><button class="gallery-card-download" type="button" data-gallery-download="${galleryIndex}" aria-label="Download ${image.title || "gallery media"}" title="Download media">↓</button></div></figure>`;
  }).join("");
  list.querySelectorAll(".gallery-item > img").forEach((image) => image.addEventListener("error", setGalleryImageFallback));
  list.querySelectorAll(".gallery-item > video, .gallery-item > audio").forEach((media) => media.addEventListener("error", () => {
    media.hidden = true;
    media.closest(".gallery-item")?.classList.add("gallery-media-missing");
  }));
  list.querySelectorAll(".gallery-select").forEach((input) => input.addEventListener("click", (event) => event.stopPropagation()));
  list.querySelectorAll(".gallery-select").forEach((input) => input.addEventListener("change", updateGallerySelection));
  list.querySelectorAll("[data-gallery-download]").forEach((button) => button.addEventListener("click", (event) => { event.stopPropagation(); void downloadMedia(galleryImages[Number(button.dataset.galleryDownload)]); }));
  updateGallerySelection();
  renderPublicPager("publicGalleryPagination", images.length, publicGalleryPage, galleryPageSize, page => { publicGalleryPage = page; renderGallery(images); });
}
function getSelectedGallery() { return [...document.querySelectorAll(".gallery-select:checked")].map((input) => galleryImages[Number(input.dataset.gallerySelect)]); }
function updateGallerySelection() { const selected = getSelectedGallery().length; document.getElementById("gallerySelectedCount").textContent = `Selected: ${selected}`; const all = document.getElementById("gallerySelectAll"); if (all) all.checked = selected > 0 && selected === galleryImages.length; }
async function downloadMedia(image) {
  const mediaUrl = galleryMediaPath(image);
  const url = `${mediaUrl}${mediaUrl.includes("?") ? "&" : "?"}download=1`;
  const filename = image.originalName || `${(image.title || "ganesh-memory").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.jpg`;
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    const objectUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.target = "_blank";
    link.rel = "noopener";
    link.click();
  }
}
async function downloadGallery(images) {
  for (const [index, image] of images.entries()) {
    if (index) await new Promise((resolve) => setTimeout(resolve, 300));
    await downloadMedia(image);
  }
}
function openGallery(index) {
  galleryIndex = (index + galleryImages.length) % galleryImages.length;
  const image = galleryImages[galleryIndex];
  const viewer = document.getElementById("galleryViewer");
  const viewerImage = document.getElementById("galleryViewerImage");
  const existingVideo = document.getElementById("galleryViewerVideo");
  const existingAudio = document.getElementById("galleryViewerAudio");
  const isVideo = image.mediaType?.startsWith("video/") || /\.(mp4|webm|ogg|mov)$/i.test(image.originalName || image.path || "");
  const isAudio = image.mediaType?.startsWith("audio/") || /\.(mp3|wav|m4a|ogg)$/i.test(image.originalName || image.path || "");
  if (isVideo) {
    existingAudio?.remove();
    viewerImage.hidden = true;
    const viewerVideo = existingVideo || document.createElement("video");
    viewerVideo.id = "galleryViewerVideo";
    viewerVideo.controls = true;
    viewerVideo.playsInline = true;
    viewerVideo.autoplay = false;
    viewerVideo.preload = "metadata";
    viewerVideo.className = "gallery-viewer-video";
    viewerVideo.src = galleryMediaPath(image);
    if (!existingVideo) viewerImage.parentElement.insertBefore(viewerVideo, viewerImage);
  } else if (isAudio) {
    existingVideo?.remove();
    viewerImage.hidden = true;
    const viewerAudio = existingAudio || document.createElement("audio");
    viewerAudio.id = "galleryViewerAudio";
    viewerAudio.controls = true;
    viewerAudio.autoplay = false;
    viewerAudio.preload = "metadata";
    viewerAudio.className = "gallery-viewer-audio";
    viewerAudio.src = galleryMediaPath(image);
    if (!existingAudio) viewerImage.parentElement.insertBefore(viewerAudio, viewerImage);
  } else {
    existingVideo?.remove();
    existingAudio?.remove();
    viewerImage.hidden = false;
    viewerImage.src = galleryMediaPath(image);
    viewerImage.alt = image.title || "Ganesh Utsav memory";
  }
  document.getElementById("galleryViewerCounter").textContent = `Media ${galleryIndex + 1} of ${galleryImages.length}`;
  document.getElementById("galleryViewerTitle").textContent = image.title || "Ganesh Utsav memory";
  document.getElementById("galleryViewerCaption").textContent = image.caption || "";
  const download = document.getElementById("galleryViewerDownload");
  download.href = galleryMediaPath(image);
  download.download = image.originalName || `${(image.title || "ganesh-memory").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.jpg`;
  download.onclick = (event) => { event.preventDefault(); void downloadMedia(image); };
  viewer.classList.add("is-open");
  viewer.setAttribute("aria-hidden", "false");
}
function closeGallery() {
  setSlideshow(false);
  const viewer = document.getElementById("galleryViewer");
  const wasHeroViewer = viewer.classList.contains("hero-image-viewer");
  document.getElementById("galleryViewerVideo")?.remove();
  document.getElementById("galleryViewerAudio")?.remove();
  document.getElementById("galleryViewerImage").hidden = false;
  viewer.classList.remove("is-open");
  viewer.classList.remove("hero-image-viewer");
  viewer.setAttribute("aria-hidden", "true");
  if (wasHeroViewer) stopFestivalSong();
}
function setSlideshow(playing) { slideshowPlaying = playing; clearInterval(slideshowTimer); const button = document.getElementById("galleryViewerPause"); if (button) button.textContent = playing ? "⏸ Pause" : "▶ Play"; if (playing) slideshowTimer = setInterval(() => openGallery(galleryIndex + 1), 4000); }
document.addEventListener("click", (event) => {
  const donateButton = event.target.closest(".donate-now-btn");
  if (donateButton) {
    event.preventDefault();
    const modal = document.getElementById("donationModal");
    modal?.classList.add("is-open");
    modal?.setAttribute("aria-hidden", "false");
    document.body.classList.add("donation-modal-open");
    document.getElementById("donationModalBack")?.focus();
    return;
  }
  if (event.target.closest("#donationModalBack, #donationModalClose") || event.target === document.getElementById("donationModal")) {
    closeDonationModal();
    return;
  }
  const copyButton = event.target.closest("[data-copy-donation]");
  if (copyButton) {
    const value = copyButton.dataset.copyDonation || "";
    const fallbackCopy = () => {
      const input = document.createElement("textarea");
      input.value = value;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(value).catch(fallbackCopy);
    else fallbackCopy();
    copyButton.textContent = "✓";
    window.setTimeout(() => { copyButton.textContent = "📋"; }, 1200);
    return;
  }
  const heroImage = event.target.closest("[data-hero-image]");
  if (heroImage) {
    playFestivalSong();
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
  if (tile && !event.target.closest("video, audio") && !event.target.closest(".gallery-select")) openGallery(Number(tile.dataset.galleryIndex));
  if (event.target.closest(".gallery-viewer-close")) closeGallery();
  if (event.target.closest(".gallery-viewer-prev")) openGallery(galleryIndex - 1);
  if (event.target.closest(".gallery-viewer-next")) openGallery(galleryIndex + 1);
  if (event.target === document.getElementById("galleryViewer")) closeGallery();
});
document.querySelector("[data-hero-image]")?.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } });
document.addEventListener("keydown", (event) => { const tile = event.target.closest?.("[data-gallery-index]"); if (tile && !event.target.closest("video, audio, .gallery-select") && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); openGallery(Number(tile.dataset.galleryIndex)); } });
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.getElementById("donationModal")?.classList.contains("is-open")) {
    closeDonationModal();
    return;
  }
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
document.addEventListener("click", async (event) => {
  const estimatedButton = event.target.closest("[data-estimated-results]");
  if (estimatedButton) {
    const response = await fetch("/api/public", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    const expenses = data.expenses || [];
    const total = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const paid = expenses.reduce((sum, item) => sum + ((item.status || "Due") === "Full Paid" ? Number(item.amount || 0) : Number(item.advanceAmount || 0)), 0);
    const collected = Number(data.stats?.totalDonations || 0) + Number(data.stats?.ladduAuctionTotal || 0);
    const popup = document.createElement("div");
    popup.className = "finance-modal is-open estimated-results-popup";
    popup.innerHTML = `<div class="finance-modal-panel" role="dialog" aria-modal="true"><button class="finance-close" type="button" aria-label="Close">×</button><p class="eyebrow">Estimated results</p><h3>Ganesh Utsav Financial Summary</h3><div class="estimated-results-list"><p><strong>Total Expenditure:</strong> ${money(total)}</p><p><strong>Total Paid:</strong> ${money(paid)}</p><p><strong>Total Due:</strong> ${money(total - paid)}</p><p><strong>Collected Amount:</strong> ${money(collected)}</p><p><strong>Estimated Remaining Balance:</strong> ${money(collected - total)}</p></div><button class="estimated-results-back" type="button">Back</button></div>`;
    document.body.appendChild(popup);
    const close = () => popup.remove();
    popup.querySelector(".finance-close").onclick = close;
    popup.querySelector(".estimated-results-back").onclick = close;
    popup.onclick = closeEvent => { if (closeEvent.target === popup) close(); };
    return;
  }
  const card = event.target.closest(".stat-card");
  if (!card) return;
  const response = await fetch("/api/public");
  const data = await response.json();
  const label = card.querySelector(".label")?.textContent || card.querySelector("h3, h4")?.textContent || "";
  const contributionType = card.dataset.contributionType;
  const isSponsorshipSummary = card.dataset.sponsorshipSummary === "true";
  const isBalance = card.classList.contains("balance-stat");
  const isGeneralDonations = card.classList.contains("general-donations-card");
  const isAuction = contributionType === "Laddu Auction 2025";
  let content = "";
  if (contributionType) {
    const donations = data.donations.filter(item => item.contributionType === contributionType).sort(sortSpecialContributions);
    const rows = donations.map(item => `<tr><td>${escapeHtml(normalizePlotNumber(item.flatNumber) || "--")}</td><td>${escapeHtml(item.donorName || "--")}</td><td>${escapeHtml(isAuction ? (item.itemName || item.contributionType || "--") : (item.contributionType || "Ganesh Idol Sponsor"))}</td><td class="amount-positive">${money(item.amount)}</td><td>${formatDate(item.date || item.createdAt)}</td><td>${escapeHtml(item.paymentMode || "Cash")}</td><td>${item.receiptNumber ? `<span class="public-receipt-actions"><button class="receipt-action" type="button" data-public-receipt="${escapeHtml(item.receiptNumber)}" title="View receipt" aria-label="View receipt">&#128065;</button><button class="receipt-action public-receipt-row-download" type="button" data-public-download="${escapeHtml(item.receiptNumber)}" title="Download receipt" aria-label="Download receipt">&#11123;</button></span>` : "--"}</td></tr>`).join("");
    const columns = "<th>Plot No.</th><th>Donor Name</th><th>Contribution Type</th><th>Amount</th><th>Date</th><th>Payment Mode</th><th>Actions</th>";
    content = `<div class="category-popup-wrap"><table class="donation-popup-table"><thead><tr>${columns}</tr></thead><tbody>${rows || `<tr><td colspan="${isAuction ? 7 : 6}" class="donor-empty">No ${escapeHtml(label.toLowerCase())} records yet.</td></tr>`}</tbody></table></div>`;
  }
  if (isSponsorshipSummary) {
    const sponsorships = data.donations.filter(item => ["Ganesh Idol Sponsor", "Laddu Sponsorship 2026"].includes(item.contributionType)).sort(sortByPlotNumber);
    content = `<div class="category-popup-wrap"><table class="donation-popup-table sponsorship-summary-popup"><thead><tr><th>Plot Number</th><th>Name</th><th>Contribution Type</th><th>Amount</th></tr></thead><tbody>${sponsorships.map(item => `<tr><td>${escapeHtml(normalizePlotNumber(item.flatNumber) || "--")}</td><td>${escapeHtml(item.donorName || "--")}</td><td>${escapeHtml(item.contributionType === "Ganesh Idol Sponsor" ? "Ganesh Idol Sponsorship 2026" : item.itemName ? `Laddu Sponsorship 2026 - ${item.itemName}` : "Laddu Sponsorship 2026")}</td><td class="amount-positive">${money(item.amount)}</td></tr>`).join("") || '<tr><td colspan="4" class="donor-empty">No sponsorship records yet.</td></tr>'}</tbody></table></div>`;
  }
  const title =
    isSponsorshipSummary
      ? label
      : contributionType
      ? label
      : label === "Total donations" || isGeneralDonations
      ? "Donation details"
      : label === "Total expenditure"
        ? "Expenditure details"
        : "Balance details";
  if (label === "Total donations" || isGeneralDonations) {
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
  if (isBalance) {
    const collectedAmount = Number(data.stats?.totalDonations || 0) + Number(data.stats?.ladduAuctionTotal || 0);
    const totalPaid = (data.expenses || []).reduce((sum, item) => {
      const amount = Number(item.amount || 0);
      return sum + ((item.status || "Due") === "Full Paid" ? amount : Number(item.advanceAmount || 0));
    }, 0);
    content = `<div class="balance-breakdown"><div><span>Collected Amount</span><strong>${money(collectedAmount)}</strong></div><div><span>Total Paid</span><strong>${money(totalPaid)}</strong></div><div class="balance-result"><span>Final Balance</span><strong>${money(collectedAmount - totalPaid)}</strong></div></div>`;
  }
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
  if (isGeneralDonations) {
    const regularDonations = data.donations.filter(item => !["Laddu Auction 2025", "Ganesh Idol Sponsor"].includes(item.contributionType)).sort(sortByPlotNumber);
    let donationPage = 0;
    const renderGeneralDonations = () => {
      const query = financeContent.querySelector("[data-general-donation-search]")?.value.trim().toLowerCase() || "";
      const filtered = regularDonations.filter(item => `${item.donorName || ""} ${item.flatNumber || ""} ${item.amount || ""} ${item.paymentMode || ""}`.toLowerCase().includes(query));
      const pageSize = 10;
      const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
      donationPage = Math.min(donationPage, pages - 1);
      const visible = filtered.slice(donationPage * pageSize, (donationPage + 1) * pageSize);
      financeContent.innerHTML = `<div class="public-donation-tools"><label for="generalDonationSearch">Search donor<input id="generalDonationSearch" data-general-donation-search type="search" placeholder="Search by donor, plot or amount" value="${escapeHtml(query)}"></label><span>Showing ${filtered.length ? donationPage * pageSize + 1 : 0}-${Math.min((donationPage + 1) * pageSize, filtered.length)} of ${filtered.length} donations</span></div><div class="donation-popup-wrap"><table class="donation-popup-table"><thead><tr><th>Plot No.</th><th>Donor Name</th><th>Amount</th><th>Payment Mode</th><th>Actions</th></tr></thead><tbody>${visible.map(item => `<tr><td>${escapeHtml(normalizePlotNumber(item.flatNumber) || "--")}</td><td>${escapeHtml(item.donorName || "--")}</td><td><strong>${money(item.amount)}</strong></td><td>${escapeHtml(item.paymentMode || "Cash")}</td><td>${item.receiptNumber ? `<button class="receipt-action" type="button" data-public-receipt="${escapeHtml(item.receiptNumber)}" title="View receipt" aria-label="View receipt">👁</button>` : "--"}</td></tr>`).join("") || '<tr><td colspan="5" class="donor-empty">No donations found.</td></tr>'}</tbody></table></div><div class="public-donation-pagination"><button type="button" data-general-donation-page="prev" ${donationPage === 0 ? "disabled" : ""}>‹</button><span>Page ${donationPage + 1} of ${pages}</span><button type="button" data-general-donation-page="next" ${donationPage >= pages - 1 ? "disabled" : ""}>›</button></div>`;
      financeContent.querySelector("[data-general-donation-search]")?.addEventListener("input", () => { donationPage = 0; renderGeneralDonations(); });
      financeContent.querySelectorAll("[data-general-donation-page]").forEach(button => button.addEventListener("click", () => { donationPage += button.dataset.generalDonationPage === "next" ? 1 : -1; renderGeneralDonations(); }));
    };
    renderGeneralDonations();
  }
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
  const card = event.target.closest?.(".stat-card");
  if (card && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    card.click();
  }
});
document.addEventListener("click", event => {
  if (!event.target.closest("[data-scroll-to-donations]")) return;
  document.getElementById("donations")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    modal.innerHTML = `<div class="receipt-preview-panel" role="dialog" aria-modal="true" aria-label="Receipt preview"><div class="receipt-preview-header"><strong>Receipt Preview</strong><span class="receipt-preview-number"></span><button type="button" class="receipt-close" aria-label="Close receipt preview">×</button></div><div class="receipt-preview-box"><img class="receipt-preview-image" alt="Donation receipt"></div><div class="receipt-preview-footer"><button type="button" class="btn btn-dark-red public-receipt-download" data-download-public-receipt title="Download receipt"><span aria-hidden="true">&#11123;</span> Download Receipt</button></div></div>`;
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
