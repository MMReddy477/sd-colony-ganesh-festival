const formatDate = (value, fallback = "--") => {
  if (!value) return fallback;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}-${new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleString("en-IN", { month: "short" })}-${String(match[1]).slice(-2)}`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return `${String(parsed.getDate()).padStart(2, "0")}-${parsed.toLocaleString("en-IN", { month: "short" })}-${String(parsed.getFullYear()).slice(-2)}`;
};
const formatDonationDate = (value, fallback = "--") => {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return `${String(parsed.getDate()).padStart(2, "0")}-${parsed.toLocaleString("en-IN", { month: "short" })}-${String(parsed.getFullYear()).slice(-2)}`;
};
const formatExpenseDate = item => {
  const date = item.date || item.createdAt;
  if (!date) return "--";
  const parsedDate = new Date(date);
  return Number.isNaN(parsedDate.getTime()) ? formatDate(date) : formatDate(parsedDate);
};
const formatExpenseTime = item => {
  if (item.time) return item.time;
  return item.createdAt ? new Date(item.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "--";
};
const calculateExpenseBalance = (amount, advanceAmount, status) => {
  const total = Number(amount || 0);
  const advance = Number(advanceAmount || 0);
  if (status === "Full Paid") return { advanceAmount: 0, remainingAmount: 0 };
  return { advanceAmount: advance, remainingAmount: Math.max(total - advance, 0) };
};
const syncExpenseBalanceFields = () => {
  const form = document.getElementById("expenseForm");
  if (!form || !form.elements.amount || !form.elements.advanceAmount || !form.elements.remainingAmount) return;

  const total = Number(form.elements.amount.value || 0);
  const status = form.elements.status?.value || "Due";
  const advanceValue = Number(form.elements.advanceAmount.value || 0);

  if (status === "Full Paid") {
    form.elements.advanceAmount.value = "0";
    form.elements.remainingAmount.value = "0";
    form.elements.advanceAmount.disabled = true;
    form.elements.remainingAmount.disabled = true;
    return;
  }

  form.elements.advanceAmount.disabled = false;
  form.elements.remainingAmount.disabled = true;

  const values = calculateExpenseBalance(total, advanceValue, status);
  form.elements.advanceAmount.value = String(values.advanceAmount);
  form.elements.remainingAmount.value = String(values.remainingAmount);

  if (Number(form.elements.advanceAmount.value || 0) >= total && total > 0) {
    form.elements.status.value = "Full Paid";
    form.elements.advanceAmount.value = "0";
    form.elements.remainingAmount.value = "0";
    form.elements.advanceAmount.disabled = true;
    form.elements.remainingAmount.disabled = true;
  }
};
const normalizePlotNumber = value => { const raw = String(value ?? "").trim().replace(/\s+/g, "-").replace(/-+/g, "-"); const plotMatch = raw.match(/^plot(?:-?no\.?)?-?(\d+)$/i); if (plotMatch) return `PlotNo-${plotMatch[1]}`; const siriusMatch = raw.match(/^(sirius|sirus)[_-]?(\d+)$/i); if (siriusMatch) return `Sirius_${siriusMatch[2]}`; const samyuktaMatch = raw.match(/^(samyukta)-?(\d+)$/i); return samyuktaMatch ? `Samyukta-${samyuktaMatch[2]}` : raw; };
const alphanumericSort = (a, b) => { const aparts = String(a).split(/(\d+)/); const bparts = String(b).split(/(\d+)/); for (let i = 0; i < Math.min(aparts.length, bparts.length); i++) { const isNum = /^\d+$/.test(aparts[i]); if (isNum) { const diff = Number(aparts[i]) - Number(bparts[i]); if (diff) return diff; } else { if (aparts[i] !== bparts[i]) return aparts[i].localeCompare(bparts[i]); } } return aparts.length - bparts.length; };
const sortByPlotNumber = (left, right) => { const parse = value => { const normalized = normalizePlotNumber(value); const cleanMatch = normalized.match(/^PlotNo-(\d+)$/); if (cleanMatch) return [0, Number(cleanMatch[1]), '']; const samyuktaMatch = normalized.match(/^Samyukta-(\d+)$/); if (samyuktaMatch) return [3, Number(samyuktaMatch[1]), '']; const siriusMatch = normalized.match(/^Sirius_(\d+)$/); if (siriusMatch) return [4, Number(siriusMatch[1]), '']; const rawValue = String(value || '').trim().toLowerCase(); if (rawValue.includes('plot') || rawValue.match(/^plotno/i)) return [1, 0, normalized]; return [2, 0, normalized]; }; const a = parse(left.flatNumber); const b = parse(right.flatNumber); if (a[0] !== b[0]) return a[0] - b[0]; if (a[0] === 0 || a[0] === 3 || a[0] === 4) return a[1] - b[1]; if (a[0] === 1) return alphanumericSort(a[2], b[2]); return a[2].localeCompare(b[2]); };
window.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    document
      .querySelectorAll('select[name="paymentMode"]')
      .forEach((select) => {
        if (!select.value) select.value = "Cash";
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
    const expenseForm = document.getElementById("expenseForm");
    if (expenseForm) {
      expenseForm.elements.status?.addEventListener("change", () => {
        if (expenseForm.elements.status.value === "Full Paid") {
          expenseForm.elements.advanceAmount.value = "0";
          expenseForm.elements.remainingAmount.value = "0";
          expenseForm.elements.advanceAmount.disabled = true;
          expenseForm.elements.remainingAmount.disabled = true;
          return;
        }
        expenseForm.elements.advanceAmount.disabled = false;
        expenseForm.elements.remainingAmount.disabled = true;
        syncExpenseBalanceFields();
      });
      expenseForm.elements.amount?.addEventListener("input", syncExpenseBalanceFields);
      expenseForm.elements.advanceAmount?.addEventListener("input", () => {
        const total = Number(expenseForm.elements.amount.value || 0);
        const advance = Number(expenseForm.elements.advanceAmount.value || 0);

        if (advance >= total && total > 0) {
          expenseForm.elements.advanceAmount.value = "0";
          expenseForm.elements.remainingAmount.value = "0";
          expenseForm.elements.status.value = "Full Paid";
          expenseForm.elements.advanceAmount.disabled = true;
          expenseForm.elements.remainingAmount.disabled = true;
          return;
        }

        expenseForm.elements.status.value = "Due";
        expenseForm.elements.advanceAmount.disabled = false;
        expenseForm.elements.remainingAmount.disabled = true;
        syncExpenseBalanceFields();
      });
      syncExpenseBalanceFields();
    }
    const addExpenseButton = document.getElementById("addExpenseButton");
    const expenseModal = document.getElementById("expenseModal");
    const closeExpenseModalBtn = document.getElementById("closeExpenseModal");
    const cancelExpenseModalBtn = document.getElementById("cancelExpenseModal");
    addExpenseButton?.addEventListener("click", () => {
      if (expenseModal) {
        expenseModal.style.display = "block";
        expenseModal.setAttribute("aria-hidden", "false");
      }
    });
    closeExpenseModalBtn?.addEventListener("click", () => {
      if (expenseModal) {
        expenseModal.style.display = "none";
        expenseModal.setAttribute("aria-hidden", "true");
      }
    });
    cancelExpenseModalBtn?.addEventListener("click", () => {
      if (expenseModal) {
        expenseModal.style.display = "none";
        expenseModal.setAttribute("aria-hidden", "true");
      }
    });
    expenseModal?.addEventListener("click", (event) => {
      if (event.target === expenseModal) {
        expenseModal.style.display = "none";
        expenseModal.setAttribute("aria-hidden", "true");
      }
    });
  }, 0);
});

function calculateExpenseTotals() {
  const totalAmount = adminExpenses.reduce((sum, item) => sum + Number(item.amount || item.total || 0), 0);
  const advanceAmount = adminExpenses.reduce((sum, item) => sum + Number(item.advanceAmount || 0), 0);
  const remainingAmount = adminExpenses.reduce((sum, item) => sum + Number(item.remainingAmount || 0), 0);
  const collectedAmount = adminDonations
    .filter(item => item.status !== "Yet to receive" && item.contributionType !== "Ganesh Idol Sponsor")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const estimatedBalance = collectedAmount - totalAmount;

  const table = document.querySelector("#expenseAdminList .expense-table");
  if (table) {
    let tfoot = table.querySelector("tfoot");
    if (!tfoot) {
      tfoot = document.createElement("tfoot");
      table.appendChild(tfoot);
    }
    tfoot.innerHTML = `
      <tr id="totalsRow" style="font-weight:bold;">
        <td style="text-align:right;">Grand Total</td>
        <td style="background-color:#d4edda;">${money(totalAmount)}</td>
        <td style="background-color:#cce5ff;">${money(advanceAmount)}</td>
        <td style="background-color:#fff3cd;">${money(remainingAmount)}</td>
        <td colspan="5"></td>
      </tr>
    `;
  }

  const totalExpenditureEl = document.getElementById("totalExpenditure");
  const totalPaidEl = document.getElementById("totalPaid");
  const totalDueEl = document.getElementById("totalDue");
  const collectedAmountEl = document.getElementById("collectedAmount");
  const estimatedBalanceEl = document.getElementById("estimatedBalance");

  if (totalExpenditureEl) totalExpenditureEl.textContent = money(totalAmount);
  if (totalPaidEl) totalPaidEl.textContent = money(advanceAmount);
  if (totalDueEl) totalDueEl.textContent = money(remainingAmount);
  if (collectedAmountEl) collectedAmountEl.textContent = money(collectedAmount);
  if (estimatedBalanceEl) estimatedBalanceEl.textContent = money(estimatedBalance);
}

function renderExpenseTable(items, path) {
  const container = document.getElementById("expenseAdminList");
  const query = document.getElementById("expenseSearch")?.value.toLowerCase() || "";
  const filtered = items.filter(item => `${item.name} ${item.paymentMode} ${item.status || ""} ${item.advanceAmount || ""} ${item.remainingAmount || ""}`.toLowerCase().includes(query));
  const pageSize = getPageSize("expense"); const page = pageState.expense; const visible = pageSize === "all" ? filtered : filtered.slice(page * pageSize, (page + 1) * pageSize);
  container.innerHTML = `<div class="expense-table-wrap"><table class="expense-table"><thead><tr><th>Expense name</th><th>Total</th><th>Advance</th><th>Remaining</th><th>Status</th><th>Payment mode</th><th>Date</th><th>Time</th><th>Actions</th></tr></thead><tbody>${visible.map((item) => `<tr><td>${item.name || "--"}</td><td><strong>${money(item.amount)}</strong></td><td>${money(item.advanceAmount || 0)}</td><td>${money(item.remainingAmount || 0)}</td><td>${item.status || "Due"}</td><td>${item.paymentMode || "--"}</td><td>${formatExpenseDate(item)}</td><td>${formatExpenseTime(item)}</td><td class="actions-cell"><div class="admin-actions donation-actions"><button class="admin-icon-btn edit-action" type="button" data-edit-expense="${item._id}" title="Edit expense" aria-label="Edit expense">✎</button><button class="admin-icon-btn delete-btn" type="button" data-delete="${path}/${item._id}" title="Delete expense" aria-label="Delete expense">🗑</button></div></td></tr>`).join("") || '<tr><td colspan="9" class="muted">Nothing here yet.</td></tr>'}</tbody></table></div>`;
  calculateExpenseTotals();
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
  const expenseDate = expenseForm?.querySelector('[name="date"]');
  if (expenseDate) {
    expenseDate.type = "date";
    expenseDate.addEventListener("click", () => {
      expenseDate.focus();
      if (typeof expenseDate.showPicker === "function") {
        try { expenseDate.showPicker(); } catch (_) {}
      }
    });
  }
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
  const adminTotalDonations = adminDonations.filter(item => item.status !== "Yet to receive" && item.contributionType !== "Ganesh Idol Sponsor").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const adminTotalExpenses = adminExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const donations = [...data.donations].sort(sortByPlotNumber);
  adminLiveDonations = donations;
  const pageSize = 10;
  let page = 0;
  const renderDonationPopup = () => {
    const content = modal.querySelector(".finance-content");
    const query = content.querySelector("[data-admin-donation-search]")?.value.trim().toLowerCase() || "";
    const filtered = donations.filter(item => String(item.donorName || "").toLowerCase().includes(query));
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    page = Math.min(page, pages - 1);
    const visible = filtered.slice(page * pageSize, (page + 1) * pageSize);
    const first = filtered.length ? page * pageSize + 1 : 0;
    const last = Math.min((page + 1) * pageSize, filtered.length);
    content.innerHTML = `<div class="admin-finance-tools"><label for="adminFinanceDonationSearch">Search donor name<input id="adminFinanceDonationSearch" data-admin-donation-search type="search" placeholder="Search by name" value="${escapeHtml(query)}"></label><span>Showing ${first}-${last} of ${filtered.length} donations</span></div><div class="donation-popup-wrap admin-finance-donation-wrap"><table class="donation-popup-table admin-finance-donation-table"><colgroup><col class="col-flat"><col class="col-name"><col class="col-amount"><col class="col-mode"><col class="col-actions"></colgroup><thead><tr><th>Plot No.</th><th>Donor Name</th><th>Amount</th><th>Payment Mode</th><th>Actions</th></tr></thead><tbody>${visible.map((item) => `<tr><td data-label="Plot No.">${escapeHtml(normalizePlotNumber(item.flatNumber) || "--")}</td><td data-label="Donor Name">${escapeHtml(item.donorName || "--")}</td><td data-label="Amount" class="amount-nowrap"><strong>${money(item.amount)}</strong></td><td data-label="Payment Mode">${escapeHtml(item.paymentMode || "--")}</td><td data-label="Actions" class="actions-cell">${item.receiptNumber ? `<button class="receipt-action" type="button" data-view-receipt="${escapeHtml(item.receiptNumber)}" title="View receipt" aria-label="View receipt">👁</button><button class="receipt-action" type="button" data-download-receipt="${escapeHtml(item.receiptNumber)}" title="Download receipt" aria-label="Download receipt">⬇</button>` : "--"} <button class="admin-icon-btn" type="button" data-edit-donation="${item._id}" title="Edit donation" aria-label="Edit donation">✎</button></td></tr>`).join("") || '<tr><td colspan="5" class="donor-empty">No donations found.</td></tr>'}</tbody></table></div><div class="admin-finance-pagination"><button type="button" data-admin-donation-page="prev" aria-label="Previous page" title="Previous page" ${page === 0 ? "disabled" : ""}>‹</button><span>Page ${page + 1} of ${pages}</span><button type="button" data-admin-donation-page="next" aria-label="Next page" title="Next page" ${page >= pages - 1 ? "disabled" : ""}>›</button></div>`;
    content.innerHTML = `<div class="admin-finance-tools"><label for="adminFinanceDonationSearch">Search donor name<input id="adminFinanceDonationSearch" data-admin-donation-search type="search" placeholder="Search by name" value="${escapeHtml(query)}"></label><span>Showing ${first}-${last} of ${filtered.length} donations</span></div><div class="donation-popup-wrap admin-finance-donation-wrap"><table class="donation-popup-table admin-finance-donation-table"><colgroup><col class="col-flat"><col class="col-name"><col class="col-amount"><col class="col-mode"><col class="col-actions"></colgroup><thead><tr><th>Plot No.</th><th>Donor Name</th><th>Amount</th><th>Payment Mode</th><th>Actions</th></tr></thead><tbody>${visible.map((item) => `<tr><td data-label="Plot No.">${escapeHtml(normalizePlotNumber(item.flatNumber) || "--")}</td><td data-label="Donor Name">${escapeHtml(item.donorName || "--")}</td><td data-label="Amount" class="amount-nowrap"><strong>${money(item.amount)}</strong></td><td data-label="Payment Mode">${escapeHtml(item.paymentMode || "--")}</td><td data-label="Actions" class="actions-cell"><button class="admin-icon-btn" type="button" data-edit-donation="${item._id}" title="Edit donation" aria-label="Edit donation">✎</button>${item.receiptNumber ? `<button class="receipt-action" type="button" data-view-receipt="${escapeHtml(item.receiptNumber)}" title="View receipt" aria-label="View receipt">👁</button>` : ""}<button class="admin-icon-btn delete-btn" type="button" data-delete="/donations/${item._id}" title="Delete donation" aria-label="Delete donation">🗑</button></td></tr>`).join("") || '<tr><td colspan="5" class="donor-empty">No donations found.</td></tr>'}</tbody></table></div><div class="admin-finance-pagination"><button type="button" data-admin-donation-page="prev" ${page === 0 ? "disabled" : ""}>Previous</button><span>Page ${page + 1} of ${pages}</span><button type="button" data-admin-donation-page="next" ${page >= pages - 1 ? "disabled" : ""}>Next</button></div>`;
    content.querySelector("[data-admin-donation-search]")?.addEventListener("input", () => { page = 0; renderDonationPopup(); });
    content.querySelectorAll("[data-admin-donation-page]").forEach(button => button.addEventListener("click", () => { page += button.dataset.adminDonationPage === "next" ? 1 : -1; renderDonationPopup(); }));
  };
  modal.querySelector(".finance-content").innerHTML = "";
  renderDonationPopup();
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
  if (label === "Donations") {
    content = adminDonations.length
      ? adminDonations
          .map(
            (item) =>
              `<div class="finance-detail"><span>${item.flatNumber || "--"} · ${item.donorName}<small>${item.mobile || "--"} · ${item.paymentMode || "--"} · ${formatDate(item.createdAt || item.date)}</small></span><strong>${money(item.amount)}</strong></div>`,
          )
          .join("")
        : '<p class="muted">No donations recorded yet.</p>';
      }
  if (label === "Expenses")
    content = adminExpenses.length
      ? `<div class="expense-popup-table-wrap"><table class="expense-popup-table"><thead><tr><th>Expense name</th><th>Amount</th><th>Payment mode</th><th>Expense date</th><th>Time</th></tr></thead><tbody>${adminExpenses.map(item => `<tr><td>${item.name || "--"}</td><td><strong>${money(item.amount)}</strong></td><td>${item.paymentMode || "--"}</td><td>${formatExpenseDate(item)}</td><td>${formatExpenseTime(item)}</td></tr>`).join("")}</tbody></table></div>`
      : '<p class="muted">No expenses recorded yet.</p>';
  if (label === "Balance")
    content = `<div class="balance-breakdown"><div><span>Total donations</span><strong>${money(adminTotalDonations)}</strong></div><div><span>Total expenditure</span><strong>${money(adminTotalExpenses)}</strong></div><div class="balance-result"><span>Current balance</span><strong>${money(adminTotalDonations - adminTotalExpenses)}</strong></div></div>`;
  let modal = document.getElementById("adminFinanceModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "adminFinanceModal";
    modal.className = "finance-modal";
    modal.innerHTML =
      '<div class="finance-modal-panel" role="dialog" aria-modal="true"><button class="finance-close" type="button" aria-label="Close">×</button><p class="eyebrow">Live finance record</p><h3></h3><div class="finance-content"></div></div>';
    document.body.appendChild(modal);
    modal.addEventListener("click", (item) => {
      if (item.target === modal || item.target.closest(".finance-close")) {
        modal.classList.remove("is-open");
        document.body.classList.remove("admin-finance-open");
      }
    });
  }
  modal.querySelector("h3").textContent = title;
  modal.querySelector(".finance-content").innerHTML = content;
  if (label === "Expenses") {
    let expensePage = 0;
    const renderExpenseDetails = () => {
      const pageSize = 10;
      const pages = Math.max(1, Math.ceil(adminExpenses.length / pageSize));
      expensePage = Math.min(expensePage, pages - 1);
      const visible = adminExpenses.slice(expensePage * pageSize, (expensePage + 1) * pageSize);
      modal.querySelector(".finance-content").innerHTML = `<div class="finance-record-count">Showing ${adminExpenses.length ? expensePage * pageSize + 1 : 0}-${Math.min((expensePage + 1) * pageSize, adminExpenses.length)} of ${adminExpenses.length} expenses</div><div class="expense-popup-table-wrap"><table class="expense-popup-table"><thead><tr><th>Expense name</th><th>Amount</th><th>Payment mode</th><th>Expense date</th><th>Time</th></tr></thead><tbody>${visible.map(item => `<tr><td>${item.name || "--"}</td><td><strong>${money(item.amount)}</strong></td><td>${item.paymentMode || "--"}</td><td>${formatExpenseDate(item)}</td><td>${formatExpenseTime(item)}</td></tr>`).join("") || '<tr><td colspan="5">No expenses recorded yet.</td></tr>'}</tbody></table></div><div class="admin-finance-pagination expense-pagination"><button type="button" data-admin-expense-page="prev" aria-label="Previous page" title="Previous page" ${expensePage === 0 ? "disabled" : ""}>‹</button><span>Page ${expensePage + 1} of ${pages}</span><button type="button" data-admin-expense-page="next" aria-label="Next page" title="Next page" ${expensePage >= pages - 1 ? "disabled" : ""}>›</button></div>`;
      modal.querySelectorAll("[data-admin-expense-page]").forEach(button => button.addEventListener("click", () => { expensePage += button.dataset.adminExpensePage === "next" ? 1 : -1; renderExpenseDetails(); }));
    };
    renderExpenseDetails();
  }
  modal.classList.add("is-open");
  document.body.classList.add("admin-finance-open");
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
const eventRenderList = renderList;
renderList = (id, items, label, path) =>
  id === "eventAdminList"
    ? renderEventTable(items, path)
    : eventRenderList(id, items, label, path);
function renderEventTable(items, path) {
  const container = document.getElementById("eventAdminList");
  container.innerHTML = `<div class="member-table-wrap event-admin-table-wrap"><table class="member-table event-table"><thead><tr><th>Devotee Name</th><th>Contact Number</th><th>Pooja Type</th><th>Preferred Date</th><th>Preferred Time</th><th>Venue / Location</th><th>Request Status</th><th>Actions</th></tr></thead><tbody>${items.map((item) => { const status = item.status || "Pending"; return `<tr><td>${item.name || "--"}</td><td>${item.mobile || "--"}</td><td>Ganesh Pooja</td><td>${formatDate(item.date)}</td><td>${item.time || "--"}</td><td>${item.venue || "Between Sirius & Samyukta"}</td><td><span class="ritual-status ritual-status-${status.toLowerCase()}">${status}</span></td><td><button class="admin-icon-btn" data-edit-record="event:${item._id}" title="Edit request" aria-label="Edit request">✎</button> <button class="admin-icon-btn" data-view-record="event:${item._id}" title="View request" aria-label="View request">👁</button> <button class="admin-icon-btn delete-btn" data-delete="${path}/${item._id}" title="Delete request" aria-label="Delete request">🗑</button></td></tr>`; }).join("") || '<tr><td colspan="8" class="muted">Nothing here yet.</td></tr>'}</tbody></table></div>`;
}
function renderDonationTable(items, path) {
  const container = document.getElementById("donationAdminList");
  const query = document.getElementById("adminDonorSearch")?.value.toLowerCase() || "";
  const mode = document.getElementById("adminPaymentFilter")?.value || "";
  const status = document.getElementById("adminStatusFilter")?.value ?? "";
  const contribution = document.getElementById("adminContributionFilter")?.value ?? "";
  const filtered = items.filter(item => { const type = item.contributionType || "Regular Donation"; const matchesContribution = contribution === "" || (contribution === "regular" ? !["Laddu Auction 2025", "Ganesh Idol Sponsor"].includes(type) : type === contribution); return `${item.flatNumber} ${item.donorName} ${item.mobile} ${item.amount} ${item.paymentMode} ${item.status} ${type} ${item.itemName}`.toLowerCase().includes(query) && (!mode || item.paymentMode === mode) && (!status || (item.status || "Received") === status) && matchesContribution; }).sort(sortByPlotNumber);
  const pageSize = getPageSize("donors"); const page = pageState.donors; const visible = pageSize === "all" ? filtered : filtered.slice(page * pageSize, (page + 1) * pageSize);
    container.innerHTML = `<div class="donation-table-wrap"><table class="donation-table"><colgroup><col class="col-flat"><col class="col-name"><col class="col-mobile"><col class="col-amount"><col class="col-status"><col class="col-date"><col class="col-mode"><col class="col-actions"></colgroup><thead><tr><th>Plot No.</th><th>Donor Name</th><th>Mobile Number</th><th>Amount</th><th>Status</th><th>Date</th><th>Payment Mode</th><th>Actions</th></tr></thead><tbody>${visible.map((item) => { const status = item.status || "Yet to receive"; const statusClass = status === "Received" ? "is-received" : "is-pending"; return `<tr><td data-label="Plot No.">${normalizePlotNumber(item.flatNumber) || "--"}</td><td data-label="Donor Name">${item.donorName || "--"}</td><td data-label="Mobile Number">${item.mobile || "--"}</td><td data-label="Amount" class="amount-nowrap amount-positive"><strong>${money(item.amount)}</strong></td><td data-label="Status"><span class="donation-status ${statusClass}">${status}</span></td><td data-label="Date">${formatDonationDate(item.date || item.createdAt)}</td><td data-label="Payment Mode">${item.paymentMode || "--"}</td><td data-label="Actions" class="actions-cell"><div class="admin-actions donation-actions"><button class="admin-icon-btn edit-action" type="button" data-edit-donation="${item._id}" title="Edit donation" aria-label="Edit donation">✎</button><button class="admin-icon-btn view-action" type="button" data-view-receipt="${escapeHtml(item.receiptNumber || "")}" title="View receipt" aria-label="View receipt" ${item.receiptNumber ? "" : "disabled"}>👁</button><button class="admin-icon-btn download-action" type="button" data-download-receipt="${escapeHtml(item.receiptNumber || "")}" title="Download receipt" aria-label="Download receipt" ${item.receiptNumber ? "" : "disabled"}>⬇</button><button class="admin-icon-btn delete-btn" type="button" data-delete="${path}/${item._id}" title="Delete donation" aria-label="Delete donation">🗑</button></div></td></tr>`; }).join("") || '<tr><td colspan="8" class="muted">No matching donors.</td></tr>'}</tbody></table></div>`;
  renderPagination("adminDonorPagination", filtered.length, pageSize, page, next => { pageState.donors = next; renderDonationTable(items, path); });
}

const pageState = { donors: 0, expense: 0 };
const pageSizeState = { donors: 10, expense: 10 };
document.getElementById("adminDonorRows")?.addEventListener("change", event => { pageSizeState.donors = event.target.value === "all" ? "all" : Number(event.target.value); pageState.donors = 0; renderDonationTable(adminDonations, "/donations"); });
document.getElementById("adminStatusFilter")?.addEventListener("change", () => { pageState.donors = 0; renderDonationTable(adminDonations, "/donations"); });
document.getElementById("adminContributionFilter")?.addEventListener("change", () => { pageState.donors = 0; renderDonationTable(adminDonations, "/donations"); });
function getPageSize(key) { return pageSizeState[key]; }
function renderPagination(id, total, size, page, onPage) { const panel = document.getElementById(id); if (!panel) return; const all = size === "all"; const first = total ? (all ? 1 : page * size + 1) : 0; const last = total ? (all ? total : Math.min((page + 1) * size, total)) : 0; const pages = all ? 1 : Math.max(1, Math.ceil(total / size)); const start = Math.max(0, Math.min(page - 2, pages - 5)); const end = Math.min(pages, Math.max(5, page + 3)); panel.innerHTML = `<span>Showing ${first}-${last} of ${total} ${id.includes("Donor") ? "donors" : "expenses"}</span><button type="button" data-page="prev" aria-label="Previous page" title="Previous page" ${page === 0 || all ? "disabled" : ""}>‹</button>${Array.from({ length: end - start }, (_, index) => { const number = start + index; return `<button type="button" data-page="${number}" class="${number === page ? "active" : ""}">${number + 1}</button>`; }).join("")}<button type="button" data-page="next" aria-label="Next page" title="Next page" ${page >= pages - 1 || all ? "disabled" : ""}>›</button>`; panel.querySelectorAll("button[data-page]").forEach(button => button.onclick = () => { const target = button.dataset.page === "prev" ? page - 1 : button.dataset.page === "next" ? page + 1 : Number(button.dataset.page); onPage(target); }); }

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
  const editExpenseButton = event.target.closest("[data-edit-expense]");
  if (editExpenseButton) {
    const expense = adminExpenses.find((item) => String(item._id) === String(editExpenseButton.dataset.editExpense));
    if (!expense) return;
    editingExpenseId = expense._id;
    const form = document.getElementById("expenseForm");
    const modal = document.getElementById("expenseModal");
    if (!form || !modal) return;
    const hiddenId = document.getElementById("expenseId");
    if (hiddenId) hiddenId.value = String(expense._id);
    form.elements.name.value = expense.name || "";
    form.elements.paymentMode.value = expense.paymentMode || "Cash";
    form.elements.amount.value = expense.amount || 0;
    form.elements.status.value = expense.status || "Due";
    form.elements.advanceAmount.value = expense.advanceAmount || 0;
    form.elements.remainingAmount.value = expense.remainingAmount || 0;
    form.elements.date.value = toLocalDateInput(expense.date || expense.createdAt || new Date());
    form.elements.time.value = expense.time || "";
    form.dataset.mode = "update";
    setExpenseFormMode(true);
    syncExpenseBalanceFields();
    modal.style.display = "block";
    modal.setAttribute("aria-hidden", "false");
    return;
  }

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
    const originalLabel = button.textContent.trim();
    button.disabled = true;
    button.textContent = "Preparing download...";
    try {
      const response = await api("/reports/" + button.dataset.report);
      if (!response.ok) throw new Error("Report download failed");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = button.dataset.report === "finance/xlsx"
        ? "SD_Colony_Ganesh_Utsav_2026_Details.xlsx"
        : button.dataset.report === "donations/xlsx"
          ? "Ganesh_Utsav_2026_Donation_Details.xlsx"
          : button.dataset.report === "expenses/xlsx"
            ? "Ganesh_Utsav_2026_Expenditure_Details.xlsx"
            : button.dataset.report.replace("/", "-");
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      window.setTimeout(() => { link.remove(); URL.revokeObjectURL(objectUrl); }, 1500);
    } catch (error) {
      alert(error.message || "Report download failed");
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
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
      '<option value="">Preferred time</option>' +
      Array.from({ length: 24 }, (_, hour) => {
        const start = hour % 12 || 12;
        const end = (hour + 1) % 12 || 12;
        const startPeriod = hour < 12 ? "AM" : "PM";
        const endPeriod = hour + 1 === 24 ? "AM" : hour + 1 < 12 ? "AM" : "PM";
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
    flat.placeholder = "Plot No.";
    flat.required = true;
    donationForm.insertBefore(flat, donorName);
  }
});
const token = localStorage.getItem("ganeshToken");
const api = async (path, options = {}) => {
  const response = await fetch("/api" + path, {
    ...options,
    cache: options.method && options.method !== "GET" ? options.cache : "no-store",
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${localStorage.getItem("ganeshToken")}`,
    },
  });
  if (response.status === 401 && !path.startsWith("/auth/login")) {
    localStorage.removeItem("ganeshToken");
    document.getElementById("dashboardView")?.classList.add("d-none");
    document.getElementById("loginView")?.classList.remove("d-none");
    document.getElementById("loginError").textContent = "Your session expired. Please log in again.";
    document.getElementById("loginError").classList.remove("d-none");
    document.getElementById("donorModal")?.classList.remove("is-open");
  }
  return response;
};
const showDeleteSuccess = (message) => { const modal = document.getElementById("deleteSuccessModal"); const text = document.getElementById("deleteSuccessMessage"); if (!modal || !text) return; text.textContent = message; modal.classList.add("is-open"); modal.setAttribute("aria-hidden", "false"); window.setTimeout(() => { modal.classList.remove("is-open"); modal.setAttribute("aria-hidden", "true"); }, 2200); };
const money = (v) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v || 0);
const toLocalDateInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMinutes = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offsetMinutes * 60000);
  return localDate.toISOString().slice(0, 10);
};
const showPopup = (message, color = "#d9f2d9") => {
  const popup = document.createElement("div");
  popup.textContent = message;
  popup.style.position = "fixed";
  popup.style.bottom = "20px";
  popup.style.right = "20px";
  popup.style.backgroundColor = color;
  popup.style.color = "#000";
  popup.style.padding = "10px 20px";
  popup.style.borderRadius = "8px";
  popup.style.boxShadow = "0 0 10px rgba(0,0,0,0.2)";
  popup.style.zIndex = "9999";
  popup.style.fontWeight = "600";
  document.body.appendChild(popup);
  window.setTimeout(() => popup.remove(), 2500);
};
const formData = (form) => Object.fromEntries(new FormData(form));
const setExpenseFormMode = (isEdit) => {
  const saveBtn = document.getElementById("saveBtn");
  const updateBtn = document.getElementById("updateBtn");
  if (saveBtn) saveBtn.style.display = isEdit ? "none" : "inline-block";
  if (updateBtn) updateBtn.style.display = isEdit ? "inline-block" : "none";
};
const resetExpenseForm = () => {
  const form = document.getElementById("expenseForm");
  if (!form) return;
  form.reset();
  form.dataset.mode = "save";
  const hiddenId = document.getElementById("expenseId");
  if (hiddenId) hiddenId.value = "";
  const dateInput = form.elements.date;
  if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().slice(0, 10);
  const statusSelect = form.elements.status;
  if (statusSelect && !statusSelect.value) statusSelect.value = "Due";
  setExpenseFormMode(false);
};
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
    showDeleteSuccess("Record deleted successfully.");
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
        data.message || data.error || (response.status === 503 ? "Database unavailable. Please check the server database connection." : "Login failed. Invalid credentials.");
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
  const donationResponse = await api("/donations");
  adminDonations = donationResponse.ok ? await donationResponse.json() : [];
  adminMembers = d.members;
  adminEvents = d.events;
  const contactForm = document.getElementById("contactForm");
  if (contactForm && d.contact) Object.entries(d.contact).forEach(([name, value]) => { const field = contactForm.querySelector(`[name="${name}"]`); if (field) field.value = value || ""; });
  const welcomeMessage = document.getElementById("welcomeMessage");
  if (welcomeMessage && d.contact?.welcomeMessage != null) welcomeMessage.value = d.contact.welcomeMessage;
  const expenseResponse = await api("/expenses");
  adminExpenses = expenseResponse.ok ? await expenseResponse.json() : d.expenses;
  const adminTotalDonations = adminDonations.filter(item => item.status !== "Yet to receive" && item.contributionType !== "Ganesh Idol Sponsor").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const adminTotalExpenses = adminExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  calculateExpenseTotals();
  document.getElementById("adminStats").innerHTML = [
    ["Donations", adminTotalDonations],
    ["Expenses", adminTotalExpenses],
    ["Balance", adminTotalDonations - adminTotalExpenses],
  ]
    .map(
      ([a, b]) =>
        `<div class="col-sm-6 col-lg-3"><div class="stat-card${a === "Balance" ? " balance-stat" : ""}"><span class="label">${a}</span><strong>${money(b)}</strong></div></div>`,
    )
    .join("");
  renderList(
    "donationAdminList",
    adminDonations,
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
let adminLiveDonations = [];
let adminExpenses = [];
let adminMembers = [];
let adminEvents = [];
let editingExpenseId = null;
const editRecordFields = { expense: ["name", "amount", "paymentMode", "date"], member: ["name", "designation", "mobile"], event: ["name", "mobile", "date", "time", "venue", "status"] };
document.addEventListener("click", event => {
  const button = event.target.closest("[data-edit-record]");
  if (!button) return;
  const [type, id] = button.dataset.editRecord.split(":");
  const records = type === "expense" ? adminExpenses : type === "member" ? adminMembers : adminEvents;
  const item = records.find(record => record._id === id);
  if (!item) return;
  const requiredFields = { expense: ["name", "amount", "paymentMode", "date"], member: ["name"], event: ["name"] };
  const fieldLabels = { name: "Devotee Name", designation: "Designation", mobile: "Contact Number", amount: "Amount", paymentMode: "Payment Mode", date: "Preferred Date", time: "Preferred Time", venue: "Venue / Location", status: "Request Status" };
  const values = editRecordFields[type].map(name => { const required = requiredFields[type].includes(name) ? " required" : ""; const value = escapeHtml(name === "date" ? String(item[name] || "").slice(0, 10) : String(item[name] || "")); const label = `${fieldLabels[name]}${required ? " *" : ""}`; if (name === "paymentMode" || name === "status") { const options = name === "status" ? ["Approved", "Pending", "Completed"] : ["Cash", "UPI", "Bank transfer", "Cheque"]; return `<label class="edit-field"><span>${label}</span><select name="${name}"${required}>${options.map(option => `<option${option === (item[name] || (name === "status" ? "Approved" : "")) ? " selected" : ""}>${option}</option>`).join("")}</select></label>`; } if (name === "time") return `<label class="edit-field"><span>${label}</span><select name="${name}"${required}><option value="">Preferred time</option>${Array.from({ length: 24 }, (_, hour) => { const start = hour % 12 || 12; const end = (hour + 1) % 12 || 12; const startPeriod = hour < 12 ? "AM" : "PM"; const endPeriod = hour + 1 === 24 ? "AM" : hour + 1 < 12 ? "AM" : "PM"; const option = `${start}:00 ${startPeriod} - ${end}:00 ${endPeriod}`; return `<option value="${option}"${option === item[name] ? " selected" : ""}>${option}</option>`; }).join("")}</select></label>`; return `<label class="edit-field"><span>${label}</span><input name="${name}" type="${name === "date" ? "date" : name === "amount" ? "number" : "text"}" placeholder="${label}" value="${value}"${required}></label>`; }).join("");
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
function updateContributionFields(form) {
  const type = form.querySelector('[name="contributionType"]')?.value || "Regular Donation";
  const isAuction = type === "Laddu Auction 2025";
  const isSponsor = type === "Ganesh Idol Sponsor";
  form.querySelectorAll(".contribution-extra").forEach(field => {
    const visible = field.classList.contains("contribution-auction") ? isAuction : isSponsor;
    field.hidden = !visible;
    field.disabled = !visible;
    field.required = visible && field.name !== "sponsorType";
    if (!visible) field.value = "";
  });
  const date = form.querySelector('[name="date"]');
  if ((isAuction || isSponsor) && date && !date.value) date.value = new Date().toISOString().slice(0, 10);
}
Array.from(document.querySelectorAll("form")).filter(form => form.querySelector('[name="contributionType"]')).forEach(form => {
  form.querySelector('[name="contributionType"]')?.addEventListener("change", () => updateContributionFields(form));
  updateContributionFields(form);
});
function resetDonorModal() { editingDonationId = null; donorModalForm.reset(); donorModalForm.querySelector("[name=date]").value = new Date().toISOString().slice(0, 10); donorModalForm.querySelector("[name=status]").value = "Received"; document.getElementById("donorModalTitle").textContent = "Add Donor"; document.getElementById("donorEditContext").textContent = ""; donorModalForm.querySelector('[type="submit"]').textContent = "Save Donor"; updateContributionFields(donorModalForm); }
function closeDonorModal() { donorModal.classList.remove("is-open"); donorModal.setAttribute("aria-hidden", "true"); resetDonorModal(); }
document.getElementById("showDonorForm")?.addEventListener("click", () => { donorModal.classList.add("is-open"); donorModal.setAttribute("aria-hidden", "false"); resetDonorModal(); donorModalForm.querySelector("[name=flatNumber]").focus(); });
document.getElementById("closeDonorModal")?.addEventListener("click", closeDonorModal);
document.getElementById("cancelDonor")?.addEventListener("click", closeDonorModal);
donorModal?.addEventListener("click", event => { if (event.target === donorModal) closeDonorModal(); });
function donorFormData() { const data = Object.fromEntries(new FormData(donorModalForm)); if (data.contributionType === "Regular Donation" && editingDonationId) { delete data.contributionType; delete data.itemName; delete data.winningBidAmount; delete data.sponsorshipAmount; delete data.sponsorType; } return data; }
async function saveDonor(keepOpen) { const endpoint = editingDonationId ? `/donations/${editingDonationId}` : "/donations"; const response = await api(endpoint, { method: editingDonationId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(donorFormData()) }); if (!response.ok) { alert((await response.json().catch(() => ({}))).message || "Could not save donor"); return; } await loadAdmin(); if (!keepOpen || editingDonationId) closeDonorModal(); else resetDonorModal(); }
donorModalForm?.addEventListener("submit", event => { event.preventDefault(); saveDonor(false); });
document.getElementById("saveAddMore")?.addEventListener("click", () => { if (donorModalForm.reportValidity()) saveDonor(true); });
document.addEventListener("click", event => { const button = event.target.closest("[data-edit-donation]"); if (!button) return; const donation = adminDonations.find(item => String(item._id) === String(button.dataset.editDonation)) || adminLiveDonations.find(item => String(item._id) === String(button.dataset.editDonation)); if (!donation || !donorModalForm) return; document.getElementById("adminFinanceModal")?.classList.remove("is-open"); editingDonationId = donation._id; donorModalForm.reset(); Object.entries({ flatNumber: donation.flatNumber, donorName: donation.donorName, mobile: donation.mobile, contributionType: donation.contributionType || "Regular Donation", itemName: donation.itemName, winningBidAmount: donation.winningBidAmount, sponsorshipAmount: donation.sponsorshipAmount, sponsorType: donation.sponsorType, amount: donation.amount, status: donation.status || (Number(donation.amount) > 0 ? "Received" : "Yet to receive"), paymentMode: donation.paymentMode, date: String(donation.date || donation.createdAt || "").slice(0, 10) }).forEach(([name, value]) => { const field = donorModalForm.querySelector(`[name="${name}"]`); if (field) field.value = value || ""; }); updateContributionFields(donorModalForm); document.getElementById("donorModalTitle").textContent = "Edit Donor"; document.getElementById("donorEditContext").textContent = `Editing ${donation.donorName || "Unnamed donor"} · ${donation.flatNumber || "No plot number"}`; donorModalForm.querySelector('[type="submit"]').textContent = "Update Donor"; donorModal.classList.add("is-open"); donorModal.setAttribute("aria-hidden", "false"); donorModalForm.querySelector("[name=flatNumber]").focus(); });
function renderGalleryAdmin(items) {
  const fallbackPath = "/GaneshIdol_detail.jpeg";
  const mediaPath = item => {
    const value = String(item.path || item.filename || "").trim().replace(/\\/g, "/");
    if (!value) return fallbackPath;
    const normalized = value.startsWith("/") ? value : `/${value.replace(/^\.\//, "")}`;
    return normalized.includes("?") ? normalized : `${normalized}?v=${Date.now()}`;
  };
  const list = document.getElementById("galleryAdminList");
  list.innerHTML = items.map((item) => { const isVideo = item.mediaType?.startsWith("video/") || /\.(mp4|webm|ogg|mov)$/i.test(item.originalName || item.path || ""); const media = isVideo ? `<video src="${mediaPath(item)}" controls preload="metadata" aria-label="${item.originalName || "Gallery video"}"></video>` : `<img src="${mediaPath(item)}" alt="${item.originalName || "Gallery image"}">`; return `<div class="gallery-admin-row"><div class="gallery-admin-media">${media}</div><div><strong>${item.originalName || (isVideo ? "Video" : "Image")}</strong><time>${item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-IN") : ""}</time></div><div class="admin-actions"><button class="admin-icon-btn" type="button" data-gallery-replace="${item._id}" title="Replace media" aria-label="Replace media">✎</button><button class="admin-icon-btn delete-btn" type="button" data-delete="/gallery/${item._id}" title="Delete media" aria-label="Delete media">🗑</button></div></div>`; }).join("") || '<div class="admin-row muted">Nothing here yet.</div>';
  list.querySelectorAll(".gallery-admin-media > img").forEach((image) => image.addEventListener("error", () => { image.onerror = null; image.src = fallbackPath; }));
}
function renderList(id, items, label, path) {
  const container = document.getElementById(id);
  if (!container) return;
  const header =
    id === "donationAdminList"
      ? '<div class="donation-columns"><span>Plot No.</span><span>Donor name</span><span>Mobile number</span><span>Amount</span><span>Payment mode</span><span>Time</span><span>Actions</span></div>'
      : "";
  container.innerHTML =
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
const expenseForm = document.getElementById("expenseForm");
if (expenseForm) {
  const saveBtn = document.getElementById("saveBtn");
  const updateBtn = document.getElementById("updateBtn");
  saveBtn?.addEventListener("click", () => {
    expenseForm.dataset.mode = "save";
    expenseForm.requestSubmit();
  });
  updateBtn?.addEventListener("click", () => {
    expenseForm.dataset.mode = "update";
    expenseForm.requestSubmit();
  });

  expenseForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const mode = e.target.dataset.mode || "save";
    const hiddenId = document.getElementById("expenseId");
    const dateValue = e.target.elements.date.value.trim();
    if (!dateValue) {
      e.target.elements.date.setCustomValidity("Please select an expense date.");
      e.target.elements.date.reportValidity();
      return;
    }
    e.target.elements.date.setCustomValidity("");

    const totalAmount = Number(e.target.elements.amount.value || 0);
    const status = e.target.elements.status.value || "Due";
    const advanceAmount = Number(e.target.elements.advanceAmount.value || 0);
    const values = calculateExpenseBalance(totalAmount, advanceAmount, status);
    const payload = new FormData(e.target);
    payload.set("date", toLocalDateInput(dateValue));
    payload.set("status", status);
    payload.set("advanceAmount", String(values.advanceAmount));
    payload.set("remainingAmount", String(values.remainingAmount));
    if (hiddenId && hiddenId.value) payload.set("expenseId", hiddenId.value);

    const isUpdate = mode === "update" && hiddenId && hiddenId.value;
    const endpoint = isUpdate ? `/expenses/${hiddenId.value}` : "/expenses";
    const method = isUpdate ? "PUT" : "POST";
    if (!isUpdate && mode === "update") {
      showPopup("Select an expense to update ⚠️", "#ffe5cc");
      return;
    }

    const response = await api(endpoint, {
      method,
      body: payload,
      headers: method === "PUT" ? {} : undefined,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      alert(data.message || "Could not save expense");
      return;
    }

    showPopup(mode === "update" ? "Updated successfully ✅" : "Saved successfully ✅", "#d9f2d9");
    e.target.reset();
    editingExpenseId = null;
    if (hiddenId) hiddenId.value = "";
    e.target.dataset.mode = "save";
    setExpenseFormMode(false);
    const modal = document.getElementById("expenseModal");
    if (modal) {
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", "true");
    }
    const select = document.getElementById("paymentStatus");
    if (select) select.value = "Due";
    const remaining = e.target.elements.remainingAmount;
    if (remaining) remaining.value = "0";
    loadAdmin();
  });
}
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
document.getElementById("contactForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.getElementById("contactMessage");
  const response = await api("/settings/contact", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData(event.target)) });
  message.textContent = response.ok ? "Contact numbers updated successfully." : ((await response.json().catch(() => ({}))).message || "Could not update contact numbers.");
  message.className = response.ok ? "text-success" : "text-danger";
});
document.getElementById("saveWelcomeMessage")?.addEventListener("click", async () => {
  const field = document.getElementById("welcomeMessage");
  const message = document.getElementById("scrollSettingsMessage");
  const response = await api("/settings/scroll", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ welcomeMessage: field?.value || "" }) });
  if (message) { message.textContent = response.ok ? "Welcome message saved." : "Could not save welcome message."; message.className = response.ok ? "text-success" : "text-danger"; }
});
document.getElementById("deleteWelcomeMessage")?.addEventListener("click", async () => {
  const field = document.getElementById("welcomeMessage");
  const message = document.getElementById("scrollSettingsMessage");
  const response = await api("/settings/scroll", { method: "DELETE" });
  if (response.ok && field) field.value = "";
  if (message) { message.textContent = response.ok ? "Welcome message deleted." : "Could not delete welcome message."; message.className = response.ok ? "text-success" : "text-danger"; }
});
document.getElementById("deleteUpi")?.addEventListener("click", async () => {
  if (!window.confirm("Delete the public UPI ID and QR code?")) return;
  const response = await api("/settings/upi", { method: "DELETE" });
  const message = document.getElementById("contactMessage");
  if (response.ok) { document.querySelector('#contactForm [name="upiId"]').value = ""; message.textContent = "UPI ID and QR code deleted."; message.className = "text-success"; } else { message.textContent = "Could not delete UPI details."; message.className = "text-danger"; }
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
    input.accept = "image/*,video/*";
    input.onchange = async () => { if (!input.files[0]) return; const form = new FormData(); form.append("image", input.files[0]); await api(`/gallery/${replace.dataset.galleryReplace}/replace`, { method: "POST", body: form }); loadAdmin(); };
    input.click();
  }
});
