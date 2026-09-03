const formatDate = (value, fallback = "--") => {
  if (!value) return fallback;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return `${String(parsed.getDate()).padStart(2, "0")}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${parsed.getFullYear()}`;
};
window.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    document
      .querySelectorAll('select[name="paymentMode"]')
      .forEach((select) => {
        select.value = "Cash";
      });
    const form = document.getElementById("donationForm");
    if (form) {
      const fields = [
        "flatNumber",
        "donorName",
        "mobile",
        "amount",
        "paymentMode",
      ]
        .map((name) => form.querySelector(`[name="${name}"]`))
        .filter(Boolean);
      const button = form.querySelector("button");
      fields.forEach((field) => form.insertBefore(field, button));
    }
  }, 0);
});
function renderExpenseTable(items, path) {
  const container = document.getElementById("expenseAdminList");
  const query = document.getElementById("expenseSearch")?.value.toLowerCase() || "";
  const filtered = items.filter(item => `${item.name} ${item.paymentMode}`.toLowerCase().includes(query));
  const pageSize = getPageSize("expense"); const page = pageState.expense; const visible = pageSize === "all" ? filtered : filtered.slice(page * pageSize, (page + 1) * pageSize);
  container.innerHTML = `<div class="expense-table-wrap"><table class="expense-table"><thead><tr><th>Expense name</th><th>Amount</th><th>Payment mode</th><th>Expense date</th><th>Bill</th><th>Action</th></tr></thead><tbody>${visible.map((item) => `<tr><td>${item.name || "--"}</td><td><strong>${money(item.amount)}</strong></td><td>${item.paymentMode || "--"}</td><td>${formatDate(item.date)}</td><td>${item.billFilename ? `<button data-bill-view="${item._id}" title="View bill" aria-label="View bill">📄</button> <button data-bill-replace="${item._id}" title="Replace bill" aria-label="Replace bill">✎</button>` : "--"}</td><td><button class="admin-icon-btn" data-edit-record="expense:${item._id}" title="Edit expense" aria-label="Edit expense">✎</button> <button class="admin-icon-btn delete-btn" data-delete="${path}/${item._id}" title="Delete expense" aria-label="Delete expense">🗑</button></td></tr>`).join("") || '<tr><td colspan="6" class="muted">Nothing here yet.</td></tr>'}</tbody></table></div>`;
  renderPagination("expensePagination", filtered.length, pageSize, page, next => { pageState.expense = next; renderExpenseTable(items, path); });
}
const defaultExpenseList = renderList;
renderList = (id, items, label, path) =>
  id === "expenseAdminList"
    ? renderExpenseTable(items, path)
    : defaultExpenseList(id, items, label, path);
window.addEventListener("DOMContentLoaded", () => {
  const modes =
    '<option value="">Select payment mode</option><option value="Cash">Cash</option><option value="UPI">UPI</option><option value="Bank transfer">Bank transfer</option><option value="Cheque">Cheque</option>';
  const donationForm = document.getElementById("donationForm");
  const donationMode =
    donationForm && donationForm.querySelector('[name="paymentMode"]');
  if (donationMode) {
    donationMode.innerHTML = modes;
    donationMode.setAttribute("aria-label", "Select payment mode");
    donationMode.title = "Select payment mode";
  }
  const expenseForm = document.getElementById("expenseForm");
  const amount = expenseForm && expenseForm.querySelector('[name="amount"]');
  if (amount && !expenseForm.querySelector('[name="paymentMode"]')) {
    const select = document.createElement("select");
    select.name = "paymentMode";
    select.className = amount.className;
    select.innerHTML = modes;
    select.setAttribute("aria-label", "Select payment mode");
    select.title = "Select payment mode";
    expenseForm.insertBefore(select, amount);
  }
});
const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const donationPopupObserver = new MutationObserver(async () => {
  const modal = document.getElementById("adminFinanceModal");
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
    `<p class="finance-record-count">Showing 1-${data.donations.length} of ${data.donations.length} donations</p><div class="donation-popup-wrap admin-finance-donation-wrap"><table class="donation-popup-table admin-finance-donation-table"><colgroup><col class="col-flat"><col class="col-name"><col class="col-mobile"><col class="col-amount"><col class="col-mode"><col class="col-actions"></colgroup><thead><tr><th>Flat Number</th><th>Donor Name</th><th>Mobile Number</th><th>Amount</th><th>Payment Mode</th><th>Actions</th></tr></thead><tbody>${data.donations.map((item) => `<tr><td>${escapeHtml(item.flatNumber || "--")}</td><td>${escapeHtml(item.donorName || "--")}</td><td>${escapeHtml(item.mobile || "--")}</td><td class="amount-nowrap"><strong>${money(item.amount)}</strong></td><td>${escapeHtml(item.paymentMode || "--")}</td><td class="actions-cell"><div class="admin-actions"><button class="admin-icon-btn" type="button" data-edit-donation="${item._id}" title="Edit donation" aria-label="Edit donation">✎</button>${item.receiptNumber ? `<button class="receipt-action" type="button" data-view-receipt="${escapeHtml(item.receiptNumber)}" title="View Receipt" aria-label="View Receipt">👁</button><button class="receipt-action" type="button" data-download-receipt="${escapeHtml(item.receiptNumber)}" title="Download Receipt" aria-label="Download Receipt">⬇</button>` : ""}</div></td></tr>`).join("") || '<tr><td colspan="6">No donations recorded yet.</td></tr>'}</tbody></table></div>`;
});
donationPopupObserver.observe(document.body, {
  subtree: true,
  attributes: true,
  attributeFilter: ["class"],
});
document.addEventListener("click", async (event) => {
  const card = event.target.closest("#adminStats .stat-card");
  if (!card) return;
  const response = await fetch("/api/public");
  if (!response.ok) return;
  const data = await response.json();
  const label = card.querySelector(".label").textContent;
  const title =
    label === "Donations"
      ? "Donation details"
      : label === "Expenses"
        ? "Expense details"
        : "Balance details";
  let content = "";
  if (label === "Donations")
    content = data.donations.length
      ? data.donations
          .map(
            (item) =>
              `<div class="finance-detail"><span>${item.flatNumber || "--"} · ${item.donorName}<small>${item.mobile || "--"} · ${item.paymentMode || "--"} · ${formatDate(item.createdAt || item.date)}</small></span><strong>${money(item.amount)}</strong></div>`,
          )
          .join("")
      : '<p class="muted">No donations recorded yet.</p>';
  if (label === "Expenses")
    content = adminExpenses.length
      ? `<div class="expense-popup-table-wrap"><table class="expense-popup-table"><thead><tr><th>Expense name</th><th>Amount</th><th>Payment mode</th><th>Expense date</th><th>Bill</th><th>Action</th></tr></thead><tbody>${adminExpenses.map(item => `<tr><td>${item.name || "--"}</td><td><strong>${money(item.amount)}</strong></td><td>${item.paymentMode || "--"}</td><td>${item.date ? new Date(item.date).toLocaleDateString("en-IN") : "--"}</td><td>${item.billFilename ? `<button data-bill-view="${item._id}" title="View bill" aria-label="View bill">📄</button>` : "--"}</td><td><button class="admin-icon-btn" data-edit-record="expense:${item._id}" title="Edit expense" aria-label="Edit expense">✎</button> <button class="admin-icon-btn delete-btn" data-delete="/expenses/${item._id}" title="Delete expense" aria-label="Delete expense">🗑</button></td></tr>`).join("")}</tbody></table></div>`
      : '<p class="muted">No expenses recorded yet.</p>';
  if (label === "Balance")
    content = `<div class="balance-breakdown"><div><span>Total donations</span><strong>${money(data.stats.totalDonations)}</strong></div><div><span>Total expenditure</span><strong>${money(data.stats.totalExpenses)}</strong></div><div class="balance-result"><span>Current balance</span><strong>${money(data.stats.balance)}</strong></div></div>`;
  let modal = document.getElementById("adminFinanceModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "adminFinanceModal";
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
window.addEventListener("DOMContentLoaded", () => {
  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? "Good morning, admin."
      : hour < 17
        ? "Good afternoon, admin."
        : "Good evening, admin.";
  const heading = document.querySelector(".admin-body main h1");
  if (heading) heading.textContent = greeting;
  const venue = document.querySelector('#eventForm [name="venue"]');
  if (venue) {
    venue.value = "Between Sirius & Samyukta";
    venue.placeholder = "Between Sirius & Samyukta";
  }
});
function updateAdminNav() {
  const current = window.location.hash || "#dashboard";
  document.querySelectorAll(".admin-nav-links a").forEach((link) => {
    link.classList.toggle("active", link.getAttribute("href") === current);
  });
}
window.addEventListener("hashchange", updateAdminNav);
window.addEventListener("DOMContentLoaded", updateAdminNav);
const adminMenuToggle = document.getElementById("adminMenuToggle");
const adminNavLinks = document.getElementById("adminNavLinks");
adminMenuToggle?.addEventListener("click", () => {
  const isOpen = adminNavLinks.classList.toggle("is-open");
  adminMenuToggle.setAttribute("aria-expanded", String(isOpen));
  adminMenuToggle.setAttribute("aria-label", isOpen ? "Close admin navigation" : "Open admin navigation");
});
adminNavLinks?.addEventListener("click", (event) => {
  if (!event.target.closest("a")) return;
  adminNavLinks.classList.remove("is-open");
  adminMenuToggle?.setAttribute("aria-expanded", "false");
  adminMenuToggle?.setAttribute("aria-label", "Open admin navigation");
});
const defaultRenderList = renderList;
renderList = (id, items, label, path) =>
  id === "donationAdminList"
    ? renderDonationTable(items, path)
    : defaultRenderList(id, items, label, path);
const memberRenderList = renderList;
renderList = (id, items, label, path) =>
  id === "memberAdminList"
    ? renderMemberTable(items, path)
    : memberRenderList(id, items, label, path);
function renderMemberTable(items, path) {
  const container = document.getElementById("memberAdminList");
  container.innerHTML = `<div class="member-table-wrap"><table class="member-table"><thead><tr><th>Name</th><th>Designation</th><th>Mobile number</th><th>Action</th></tr></thead><tbody>${items.map((item) => `<tr><td>${item.name || "--"}</td><td>${item.designation || "--"}</td><td>${item.mobile || "--"}</td><td><button class="admin-icon-btn" data-edit-record="member:${item._id}" title="Edit member" aria-label="Edit member">✎</button> <button class="admin-icon-btn delete-btn" data-delete="${path}/${item._id}" title="Delete member" aria-label="Delete member">🗑</button></td></tr>`).join("") || '<tr><td colspan="4" class="muted">Nothing here yet.</td></tr>'}</tbody></table></div>`;
}
const eventRenderList = renderList;
renderList = (id, items, label, path) =>
  id === "eventAdminList"
    ? renderEventTable(items, path)
    : eventRenderList(id, items, label, path);
function renderEventTable(items, path) {
  const container = document.getElementById("eventAdminList");
  container.innerHTML = `<div class="member-table-wrap"><table class="member-table event-table"><thead><tr><th>Event name</th><th>Date</th><th>Time</th><th>Venue</th><th>Action</th></tr></thead><tbody>${items.map((item) => `<tr><td>${item.name || "--"}</td><td>${formatDate(item.date)}</td><td>${item.time || "--"}</td><td>${item.venue || "Between Sirius & Samyukta"}</td><td><button class="admin-icon-btn" data-edit-record="event:${item._id}" title="Edit event" aria-label="Edit event">✎</button> <button class="admin-icon-btn delete-btn" data-delete="${path}/${item._id}" title="Delete event" aria-label="Delete event">🗑</button></td></tr>`).join("") || '<tr><td colspan="5" class="muted">Nothing here yet.</td></tr>'}</tbody></table></div>`;
}
function renderDonationTable(items, path) {
  const container = document.getElementById("donationAdminList");
  const query = document.getElementById("adminDonorSearch")?.value.toLowerCase() || "";
  const mode = document.getElementById("adminPaymentFilter")?.value || "";
  const filtered = items.filter(item => `${item.flatNumber} ${item.donorName} ${item.mobile} ${item.amount} ${item.paymentMode}`.toLowerCase().includes(query) && (!mode || item.paymentMode === mode));
  const pageSize = getPageSize("donors"); const page = pageState.donors; const visible = pageSize === "all" ? filtered : filtered.slice(page * pageSize, (page + 1) * pageSize);
  container.innerHTML = `<div class="donation-table-wrap"><table class="donation-table"><colgroup><col class="col-flat"><col class="col-name"><col class="col-mobile"><col class="col-amount"><col class="col-mode"><col class="col-date"><col class="col-actions"></colgroup><thead><tr><th>Flat Number</th><th>Donor Name</th><th>Mobile Number</th><th>Amount</th><th>Payment Mode</th><th>Date</th><th>Actions</th></tr></thead><tbody>${visible.map((item) => `<tr><td>${item.flatNumber || "--"}</td><td>${item.donorName || "--"}</td><td>${item.mobile || "--"}</td><td class="amount-nowrap"><strong>${money(item.amount)}</strong></td><td>${item.paymentMode || "--"}</td><td class="date-nowrap">${formatDate(item.createdAt || item.date)}</td><td class="actions-cell"><div class="admin-actions"><button class="admin-icon-btn" type="button" data-edit-donation="${item._id}" title="Edit donation" aria-label="Edit donation">✎</button>${item.receiptNumber ? `<button class="receipt-action" type="button" data-view-receipt="${escapeHtml(item.receiptNumber)}">👁 View Receipt</button> <button class="receipt-action" type="button" data-download-receipt="${escapeHtml(item.receiptNumber)}">⬇ Download Receipt</button>` : "--"}<button class="admin-icon-btn delete-btn" type="button" data-delete="${path}/${item._id}" title="Delete donation" aria-label="Delete donation">🗑</button></div></td></tr>`).join("") || '<tr><td colspan="7" class="muted">No matching donors.</td></tr>'}</tbody></table></div>`;
  renderPagination("adminDonorPagination", filtered.length, pageSize, page, next => { pageState.donors = next; renderDonationTable(items, path); });
}

const pageState = { donors: 0, expense: 0 };
const pageSizeState = { donors: 10, expense: 10 };
document.getElementById("adminDonorRows")?.addEventListener("change", event => { pageSizeState.donors = event.target.value === "all" ? "all" : Number(event.target.value); pageState.donors = 0; renderDonationTable(adminDonations, "/donations"); });
function getPageSize(key) { return pageSizeState[key]; }
function renderPagination(id, total, size, page, onPage) { const panel = document.getElementById(id); if (!panel) return; const all = size === "all"; const first = total ? (all ? 1 : page * size + 1) : 0; const last = total ? (all ? total : Math.min((page + 1) * size, total)) : 0; const pages = all ? 1 : Math.max(1, Math.ceil(total / size)); panel.innerHTML = `<span>Showing ${first}-${last} of ${total} ${id.includes("Donor") ? "donors" : "expenses"}</span><button type="button" data-page="prev" ${page === 0 || all ? "disabled" : ""}>Previous</button>${Array.from({ length: Math.min(pages, 7) }, (_, index) => `<button type="button" data-page="${index}" class="${index === page ? "active" : ""}">${index + 1}</button>`).join("")}<button type="button" data-page="next" ${page >= pages - 1 || all ? "disabled" : ""}>Next</button>`; panel.querySelectorAll("button[data-page]").forEach(button => button.onclick = () => { const target = button.dataset.page === "prev" ? page - 1 : button.dataset.page === "next" ? page + 1 : Number(button.dataset.page); onPage(target); }); }

function showReceiptModal(receiptNumber) {
  let modal = document.getElementById("receiptPreviewModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "receiptPreviewModal";
    modal.className = "receipt-preview-modal";
    modal.innerHTML =
      '<div class="receipt-preview-panel"><div class="receipt-preview-header"><strong>Receipt Preview</strong><span class="receipt-preview-number">' +
      receiptNumber +
      '</span><button type="button" class="receipt-close" data-close-receipt="true" aria-label="Close">×</button></div><div class="receipt-preview-box"><div id="receipt-display" style="background:white;padding:20px;max-height:600px;overflow-y:auto;font-family:Segoe UI,sans-serif"></div></div><div class="receipt-preview-footer"><button type="button" class="btn btn-dark-red" data-download-receipt="' +
      receiptNumber +
      '">Download JPG</button></div></div>';
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal || e.target.closest("[data-close-receipt]")) {
        modal.classList.remove("is-open");
      }
    });
  }
  const display = modal.querySelector("#receipt-display");
  display.innerHTML = "<p>Loading...</p>";
  modal.classList.add("is-open");

  const image = document.createElement("img");
  image.alt = "Donation receipt " + receiptNumber;
  image.style.cssText = "display:block;width:100%;height:auto";
  image.src =
    "/api/receipts/" +
    encodeURIComponent(receiptNumber) +
    "/image.svg?refresh=" +
    Date.now();
  image.onerror = () => {
    if (image.dataset.fallback) {
      display.innerHTML =
        '<p style="color:red">Unable to load receipt. Please try again.</p>';
      return;
    }
    image.dataset.fallback = "true";
    image.src = "/api/receipts/" + encodeURIComponent(receiptNumber) + "/image";
  };
  display.replaceChildren(image);
}
async function downloadReceiptImage(receiptNumber) {
  try {
    const donation = adminDonations.find((item) => item.receiptNumber === receiptNumber) || {};
    const safePart = (value, fallback) => String(value || fallback).trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || fallback;
    const downloadName = `${safePart(donation.flatNumber, "Receipt")}_${safePart(donation.donorName, receiptNumber)}.jpg`;
    let response = await fetch(
      "/api/receipts/" + encodeURIComponent(receiptNumber) + "/image.svg",
    );
    if (!response.ok)
      response = await fetch(
        "/api/receipts/" + encodeURIComponent(receiptNumber) + "/image",
      );
    if (!response.ok)
      throw new Error(
        response.status === 404
          ? "Receipt not found"
          : "Receipt service unavailable",
      );
    const svg = await response.text();
    const sourceUrl = URL.createObjectURL(
      new Blob([svg], { type: "image/svg+xml" }),
    );
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1500;
      canvas.height = 2100;
      canvas
        .getContext("2d")
        .drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (jpg) => {
          if (!jpg) {
            alert("Unable to create receipt image. Please try again.");
            return;
          }
          const link = document.createElement("a");
          link.href = URL.createObjectURL(jpg);
          link.download = downloadName;
          link.click();
          URL.revokeObjectURL(sourceUrl);
        },
        "image/jpeg",
        0.92,
      );
    };
    image.onerror = () => {
      URL.revokeObjectURL(sourceUrl);
      alert("Unable to create receipt image. Please try again.");
    };
    image.src = sourceUrl;
  } catch (e) {
    alert("Download failed: " + e.message);
    console.error(e);
  }
}
document.addEventListener("click", async (event) => {
  if (event.target.closest("[data-view-receipt]")) {
    const viewButton = event.target.closest("[data-view-receipt]");
    event.preventDefault();
    showReceiptModal(viewButton.dataset.viewReceipt);
    return;
  }
  const downloadButton = event.target.closest("[data-download-receipt]");
  if (downloadButton) {
    event.preventDefault();
    downloadReceiptImage(downloadButton.dataset.downloadReceipt);
    return;
  }
  if (event.target.closest("[data-report]")) {
    const button = event.target.closest("[data-report]");
    if (!button) return;
    const response = await api("/reports/" + button.dataset.report);
    if (!response.ok) {
      alert("Report download failed");
      return;
    }
    const blob = await response.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = button.dataset.report.replace("/", "-");
    link.click();
    URL.revokeObjectURL(link.href);
  }
});
const submitForm = async (form, endpoint) => {
  const response = await api(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formData(form)),
  });
  if (!response.ok) {
    alert((await response.json()).message || "Could not save");
    return null;
  }
  const saved = await response.json();
  form.reset();
  loadAdmin();
  return saved;
};
document.addEventListener("submit", async (event) => {
  if (event.target.id !== "donationForm") return;
  event.preventDefault();
  const saved = await submitForm(event.target, "/donations");
  if (!saved) return;
  let actions = document.getElementById("donationReceiptActions");
  if (!actions) {
    actions = document.createElement("div");
    actions.id = "donationReceiptActions";
    actions.className = "receipt-actions";
    event.target.parentElement.appendChild(actions);
  }
  const phone = (saved.mobile || "").replace(/\D/g, "");
  const whatsapp = phone
    ? `https://wa.me/${phone.length === 10 ? "91" : ""}${phone}?text=${encodeURIComponent(`Thank you for your donation to SD Colony Ganesh Utsav Committee. Receipt: ${saved.receiptNumber}.`)}`
    : "";
  actions.innerHTML = `<strong>Receipt ${saved.receiptNumber} generated</strong><button class="btn btn-sm btn-dark-red" type="button" data-download-receipt="${saved.receiptNumber}">Download image</button>${whatsapp ? `<a class="btn btn-sm btn-success" href="${whatsapp}" target="_blank" rel="noopener">Send on WhatsApp</a>` : '<span class="muted">Enter a mobile number to share on WhatsApp.</span>'}`;
  actions.classList.remove("d-none");
});
window.addEventListener("DOMContentLoaded", () => {
  document.title = "Admin · SD Colony Ganesh Utsav Committee";
  const timeInput = document.querySelector('#eventForm input[name="time"]');
  if (timeInput) {
    const select = document.createElement("select");
    select.name = "time";
    select.className = timeInput.className;
    select.required = false;
    select.innerHTML =
      '<option value="">Select hourly time</option>' +
      Array.from({ length: 24 }, (_, hour) => {
        const start = hour % 12 || 12;
        const end = (hour + 1) % 12 || 12;
        const startPeriod = hour < 12 ? "AM" : "PM";
        const endPeriod = hour + 1 < 12 ? "AM" : "PM";
        return `<option value="${start}:00 ${startPeriod} - ${end}:00 ${endPeriod}">${start}:00 ${startPeriod} - ${end}:00 ${endPeriod}</option>`;
      }).join("");
    timeInput.replaceWith(select);
  }
  const donationForm = document.getElementById("donationForm");
  const donorRows = document.getElementById("adminDonorRows");
  if (donorRows) donorRows.value = "10";
  const donorName =
    donationForm && donationForm.querySelector('[name="donorName"]');
  if (donorName && !donationForm.querySelector('[name="flatNumber"]')) {
    const flat = document.createElement("input");
    flat.name = "flatNumber";
    flat.className = donorName.className;
    flat.placeholder = "Flat number";
    flat.required = true;
    donationForm.insertBefore(flat, donorName);
  }
});
const token = localStorage.getItem("ganeshToken");
const api = (path, options = {}) =>
  fetch("/api" + path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${localStorage.getItem("ganeshToken")}`,
    },
  });
const money = (v) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v || 0);
const formData = (form) => Object.fromEntries(new FormData(form));
function showDashboard() {
  document.getElementById("loginView").classList.add("d-none");
  document.getElementById("dashboardView").classList.remove("d-none");
  loadAdmin();
}
if (token) showDashboard();
document.getElementById("logout").addEventListener("click", () => {
  localStorage.removeItem("ganeshToken");
  location.reload();
});

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete]");
  if (!button) return;
  event.preventDefault();
  if (!window.confirm("Delete this record permanently?")) return;
  button.disabled = true;
  try {
    const response = await api(button.dataset.delete, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || "Delete failed");
    }
    await loadAdmin();
  } catch (error) {
    button.disabled = false;
    alert(error.message);
  }
});

// Login handler
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("loginError");
  errorEl.classList.add("d-none");

  const username = document.querySelector('[name="username"]').value.trim();
  const password = document.querySelector('[name="password"]').value;

  if (!username || !password) {
    errorEl.textContent = "Please enter both username and password";
    errorEl.classList.remove("d-none");
    return;
  }

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      errorEl.textContent =
        data.message || "Login failed. Invalid credentials.";
      errorEl.classList.remove("d-none");
      console.error("Login error:", response.status, data);
      return;
    }

    // Success
    localStorage.setItem("ganeshToken", data.token);
    console.log("Login successful");
    showDashboard();
  } catch (err) {
    errorEl.textContent = "Network error: " + err.message;
    errorEl.classList.remove("d-none");
    console.error("Login exception:", err);
  }
});

async function loadAdmin() {
  const r = await api("/public");
  if (!r.ok) return;
  const d = await r.json();
  adminDonations = d.donations;
  adminMembers = d.members;
  adminEvents = d.events;
  const expenseResponse = await api("/expenses");
  adminExpenses = expenseResponse.ok ? await expenseResponse.json() : d.expenses;
  document.getElementById("adminStats").innerHTML = [
    ["Donations", d.stats.totalDonations],
    ["Expenses", d.stats.totalExpenses],
    ["Balance", d.stats.balance],
    ["Bills uploaded", d.stats.billsUploaded || 0],
  ]
    .map(
      ([a, b]) =>
        `<div class="col-sm-6 col-lg-3"><div class="stat-card"><span class="label">${a}</span><strong>${money(b)}</strong></div></div>`,
    )
    .join("");
  renderList(
    "donationAdminList",
    d.donations,
    (x) => `${x.donorName} · ${money(x.amount)}`,
    "/donations",
  );
  renderList(
    "expenseAdminList",
    adminExpenses,
    (x) => `${x.name} · ${money(x.amount)}`,
    "/expenses",
  );
  renderList(
    "memberAdminList",
    d.members,
    (x) => `${x.name} · ${x.designation || ""}`,
    "/members",
  );
  renderList(
    "eventAdminList",
    d.events,
    (x) => `${x.name} · ${x.venue || ""}`,
    "/events",
  );
  renderGalleryAdmin(d.gallery);
  document.getElementById("lastUpdated").textContent =
    `Last Updated: ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}
let adminDonations = [];
let adminExpenses = [];
let adminMembers = [];
let adminEvents = [];
const editRecordFields = { expense: ["name", "amount", "paymentMode", "date"], member: ["name", "designation", "mobile"], event: ["name", "date", "time", "venue"] };
document.addEventListener("click", event => {
  const button = event.target.closest("[data-edit-record]");
  if (!button) return;
  const [type, id] = button.dataset.editRecord.split(":");
  const records = type === "expense" ? adminExpenses : type === "member" ? adminMembers : adminEvents;
  const item = records.find(record => record._id === id);
  if (!item) return;
  const requiredFields = { expense: ["name", "amount", "paymentMode", "date"], member: ["name"], event: ["name"] };
  const fieldLabels = { name: "Name", designation: "Designation", mobile: "Mobile Number", amount: "Amount", paymentMode: "Payment Mode", date: "Date", time: "Time", venue: "Venue" };
  const values = editRecordFields[type].map(name => { const required = requiredFields[type].includes(name) ? " required" : ""; const value = escapeHtml(name === "date" ? String(item[name] || "").slice(0, 10) : String(item[name] || "")); const label = `${fieldLabels[name]}${required ? " *" : ""}`; if (name === "paymentMode") return `<label class="edit-field"><span>${label}</span><select name="${name}"${required}><option value="">Payment Mode</option>${["Cash", "UPI", "Bank transfer", "Cheque"].map(mode => `<option${mode === item[name] ? " selected" : ""}>${mode}</option>`).join("")}</select></label>`; if (name === "time") return `<label class="edit-field"><span>${label}</span><select name="${name}"${required}><option value="">Select hourly time</option>${Array.from({ length: 24 }, (_, hour) => { const start = hour % 12 || 12; const end = (hour + 1) % 12 || 12; const startPeriod = hour < 12 ? "AM" : "PM"; const endPeriod = hour + 1 < 12 ? "AM" : "PM"; const option = `${start}:00 ${startPeriod} - ${end}:00 ${endPeriod}`; return `<option value="${option}"${option === item[name] ? " selected" : ""}>${option}</option>`; }).join("")}</select></label>`; return `<label class="edit-field"><span>${label}</span><input name="${name}" type="${name === "date" ? "date" : name === "amount" ? "number" : "text"}" placeholder="${label}" value="${value}"${required}></label>`; }).join("");
  const modal = document.createElement("div");
  modal.className = "finance-modal is-open";
  modal.innerHTML = `<div class="finance-modal-panel donor-modal-panel" role="dialog" aria-modal="true"><button class="finance-close" type="button" aria-label="Close">×</button><p class="eyebrow">Edit record</p><h3>Edit ${type}</h3><form class="donor-modal-form">${values}<div class="donor-modal-actions"><button class="btn btn-saffron" type="submit">Save changes</button><button class="btn btn-link" type="button" data-close-edit>Cancel</button></div></form></div>`;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.addEventListener("click", click => { if (click.target === modal || click.target.closest(".finance-close, [data-close-edit]")) close(); });
  modal.querySelector("form").addEventListener("submit", async submit => { submit.preventDefault(); const response = await api(`/${type}s/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData(submit.target)) }); if (!response.ok) { alert((await response.json().catch(() => ({}))).message || "Could not update record"); return; } close(); loadAdmin(); });
});
document.addEventListener("input", event => { if (event.target.id === "adminDonorSearch") { pageState.donors = 0; renderDonationTable(adminDonations, "/donations"); } if (event.target.id === "expenseSearch") { pageState.expense = 0; renderExpenseTable(adminExpenses, "/expenses"); } });
document.addEventListener("change", event => { if (event.target.id === "adminPaymentFilter") { pageState.donors = 0; renderDonationTable(adminDonations, "/donations"); } });
const donorModal = document.getElementById("donorModal");
const donorModalForm = document.getElementById("donorModalForm");
let editingDonationId = null;
function resetDonorModal() { editingDonationId = null; donorModalForm.reset(); donorModalForm.querySelector("[name=date]").value = new Date().toISOString().slice(0, 10); document.getElementById("donorModalTitle").textContent = "Add Donor"; donorModalForm.querySelector('[type="submit"]').textContent = "Save Donor"; }
function closeDonorModal() { donorModal.classList.remove("is-open"); donorModal.setAttribute("aria-hidden", "true"); resetDonorModal(); }
document.getElementById("showDonorForm")?.addEventListener("click", () => { donorModal.classList.add("is-open"); donorModal.setAttribute("aria-hidden", "false"); resetDonorModal(); donorModalForm.querySelector("[name=flatNumber]").focus(); });
document.getElementById("closeDonorModal")?.addEventListener("click", closeDonorModal);
document.getElementById("cancelDonor")?.addEventListener("click", closeDonorModal);
donorModal?.addEventListener("click", event => { if (event.target === donorModal) closeDonorModal(); });
async function saveDonor(keepOpen) { const endpoint = editingDonationId ? `/donations/${editingDonationId}` : "/donations"; const response = await api(endpoint, { method: editingDonationId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(donorModalForm))) }); if (!response.ok) { alert((await response.json().catch(() => ({}))).message || "Could not save donor"); return; } await loadAdmin(); if (!keepOpen || editingDonationId) closeDonorModal(); else resetDonorModal(); }
donorModalForm?.addEventListener("submit", event => { event.preventDefault(); saveDonor(false); });
document.getElementById("saveAddMore")?.addEventListener("click", () => { if (donorModalForm.reportValidity()) saveDonor(true); });
document.addEventListener("click", event => { const button = event.target.closest("[data-edit-donation]"); if (!button) return; const donation = adminDonations.find(item => item._id === button.dataset.editDonation); if (!donation) return; editingDonationId = donation._id; donorModalForm.reset(); Object.entries({ flatNumber: donation.flatNumber, donorName: donation.donorName, mobile: donation.mobile, amount: donation.amount, paymentMode: donation.paymentMode, date: String(donation.date || donation.createdAt || "").slice(0, 10) }).forEach(([name, value]) => { const field = donorModalForm.querySelector(`[name="${name}"]`); if (field) field.value = value || ""; }); document.getElementById("donorModalTitle").textContent = "Edit Donor"; donorModalForm.querySelector('[type="submit"]').textContent = "Update Donor"; donorModal.classList.add("is-open"); donorModal.setAttribute("aria-hidden", "false"); donorModalForm.querySelector("[name=flatNumber]").focus(); });
function renderGalleryAdmin(items) {
  document.getElementById("galleryAdminList").innerHTML = items.map((item) => `<div class="gallery-admin-row"><img src="${item.path}" alt=""><div><strong>${item.originalName || "Image"}</strong><time>${item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-IN") : ""}</time></div><div class="admin-actions"><button class="admin-icon-btn" type="button" data-gallery-replace="${item._id}" title="Edit image" aria-label="Edit image">✎</button><button class="admin-icon-btn delete-btn" type="button" data-delete="/gallery/${item._id}" title="Delete image" aria-label="Delete image">🗑</button></div></div>`).join("") || '<div class="admin-row muted">Nothing here yet.</div>';
}
function renderList(id, items, label, path) {
  const header =
    id === "donationAdminList"
      ? '<div class="donation-columns"><span>Flat number</span><span>Donor name</span><span>Mobile number</span><span>Amount</span><span>Payment mode</span><span>Time</span><span>Actions</span></div>'
      : "";
  document.getElementById(id).innerHTML =
    header +
    (items
      .map(
        (x) =>
          `<div class="admin-row ${id === "donationAdminList" ? "donation-row" : ""}"><span>${id === "donationAdminList" ? x.flatNumber || "--" : label(x)}</span>${id === "donationAdminList" ? `<span>${x.donorName || "--"}</span><span>${x.mobile || "--"}</span><strong>${money(x.amount)}</strong><span>${x.paymentMode || "--"}</span><span>${new Date(x.createdAt || x.date).toLocaleString("en-IN")}</span>` : ""}<span class="admin-actions">${id === "donationAdminList" && x.receiptNumber ? `<button data-receipt-image="${x.receiptNumber}">Receipt image</button>` : ""}<button data-delete="${path}/${x._id}">Delete</button></span></div>`,
      )
      .join("") || '<div class="admin-row muted">Nothing here yet.</div>');
}
async function submitAdmin(form, endpoint) {
  const r = await api(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formData(form)),
  });
  if (!r.ok) {
    alert((await r.json()).message || "Could not save");
    return;
  }
  form.reset();
  loadAdmin();
}
document.getElementById("expenseForm").addEventListener("submit", (e) => {
  e.preventDefault();
  api("/expenses", { method: "POST", body: new FormData(e.target) }).then(async response => { if (!response.ok) { alert((await response.json().catch(() => ({}))).message || "Could not save expense"); return; } e.target.reset(); loadAdmin(); });
});
document.getElementById("memberForm").addEventListener("submit", (e) => {
  e.preventDefault();
  submitAdmin(e.target, "/members");
});
document.getElementById("eventForm").addEventListener("submit", (e) => {
  e.preventDefault();
  submitAdmin(e.target, "/events");
});
document.getElementById("galleryForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const r = await api("/gallery", {
    method: "POST",
    body: new FormData(e.target),
  });
  if (!r.ok) alert("Upload failed");
  e.target.reset();
  loadAdmin();
});
document.getElementById("passwordForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.getElementById("passwordMessage");
  const response = await api("/auth/password", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formData(event.target)),
  });
  message.textContent = response.ok ? "Password updated successfully." : ((await response.json().catch(() => ({}))).message || "Could not update password.");
  message.className = response.ok ? "text-success" : "text-danger";
  if (response.ok) event.target.reset();
});
document.querySelectorAll("[data-toggle-password]").forEach((button) => {
  button.addEventListener("click", () => {
    const input = button.parentElement.querySelector("input");
    input.type = input.type === "password" ? "text" : "password";
    button.textContent = input.type === "password" ? "Show" : "Hide";
  });
});
document.addEventListener("click", async (event) => {
  const bill = event.target.closest("[data-bill-view]");
  if (bill) { const item = adminExpenses.find(expense => String(expense._id) === bill.dataset.billView); if (!item) return; const modal = document.createElement("div"); modal.className = "bill-preview-modal"; modal.innerHTML = `<div class="bill-preview-panel"><button type="button" class="bill-preview-close">✕</button><strong>Bill Preview</strong><a class="bill-download" download="${item.billOriginalName || "bill"}">↓ Download bill</a><div class="bill-preview-loading">Loading bill...</div></div>`; document.body.appendChild(modal); modal.addEventListener("click", close => { if (close.target === modal || close.target.closest(".bill-preview-close")) modal.remove(); }); const response = await api(`/expenses/${item._id}/bill`); if (!response.ok) return; const blobUrl = URL.createObjectURL(await response.blob()); modal.querySelector(".bill-download").href = blobUrl; modal.querySelector(".bill-preview-loading").outerHTML = item.billMimeType === "application/pdf" ? `<iframe src="${blobUrl}" title="Bill preview"></iframe>` : `<img src="${blobUrl}" alt="Bill preview">`; return; }
  const replaceBill = event.target.closest("[data-bill-replace]");
  if (replaceBill) { const input = document.createElement("input"); input.type = "file"; input.accept = ".pdf,.jpg,.jpeg,.png"; input.onchange = async () => { if (!input.files[0]) return; const form = new FormData(); form.append("bill", input.files[0]); await api(`/expenses/${replaceBill.dataset.billReplace}/bill`, { method: "POST", body: form }); loadAdmin(); }; input.click(); return; }
  const replace = event.target.closest("[data-gallery-replace]");
  if (replace) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => { if (!input.files[0]) return; const form = new FormData(); form.append("image", input.files[0]); await api(`/gallery/${replace.dataset.galleryReplace}/replace`, { method: "POST", body: form }); loadAdmin(); };
    input.click();
  }
});
