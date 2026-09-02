document.addEventListener("DOMContentLoaded", async () => {
  const response = await fetch("/api/public");
  if (!response.ok) return;
  const data = await response.json();
  const table = document.querySelector("#donationsList")?.closest("table");
  if (!table) return;
  table.querySelector("thead tr").innerHTML =
    "<th>Flat number</th><th>Donor name</th><th>Mobile number</th><th>Amount</th><th>Payment mode</th><th>Time</th>";
  table.querySelector("tbody").innerHTML =
    data.donations
      .map(
        (item) =>
          `<tr><td>${item.flatNumber || "--"}</td><td>${item.donorName || "--"}</td><td>${item.mobile || "--"}</td><td class="fw-bold">${money(item.amount)}</td><td>${item.paymentMode || "--"}</td><td>${new Date(item.createdAt || item.date).toLocaleString("en-IN")}</td></tr>`,
      )
      .join("") || '<tr><td colspan="6">No donations recorded yet.</td></tr>';
});
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
    `<div class="donation-popup-wrap"><table class="donation-popup-table"><thead><tr><th>Flat number</th><th>Donor name</th><th>Mobile number</th><th>Amount</th><th>Payment mode</th><th>Time</th></tr></thead><tbody>${data.donations.map((item) => `<tr><td>${item.flatNumber || "--"}</td><td>${item.donorName || "--"}</td><td>${item.mobile || "--"}</td><td><strong>${money(item.amount)}</strong></td><td>${item.paymentMode || "--"}</td><td>${new Date(item.createdAt || item.date).toLocaleString("en-IN")}</td></tr>`).join("") || '<tr><td colspan="6">No donations recorded yet.</td></tr>'}</tbody></table></div>`;
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
    `<div class="expense-popup-wrap"><table class="expense-popup-table"><thead><tr><th>Expense name</th><th>Amount</th><th>Payment mode</th><th>Time</th></tr></thead><tbody>${data.expenses.map((item) => `<tr><td>${item.name || "--"}</td><td><strong>${money(item.amount)}</strong></td><td>${item.paymentMode || "--"}</td><td>${new Date(item.createdAt || item.date).toLocaleString("en-IN")}</td></tr>`).join("") || '<tr><td colspan="4">No expenditure recorded yet.</td></tr>'}</tbody></table></div>`;
});
publicExpenseTableObserver.observe(document.body, {
  subtree: true,
  attributes: true,
  attributeFilter: ["class"],
});
document.addEventListener("DOMContentLoaded", () => {
  const zipLink = document.querySelector('a[href="/api/gallery/zip"]');
  if (zipLink) {
    const button = document.createElement("button");
    button.id = "downloadSelected";
    button.type = "button";
    button.className = "btn btn-dark-red";
    button.textContent = "Download selected ↧";
    zipLink.replaceWith(button);
  }
});
const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
const date = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Date to be announced";
document
  .querySelectorAll("#nav .nav-link, #nav .navbar-brand")
  .forEach((link) =>
    link.addEventListener("click", () => {
      const nav = document.getElementById("nav");
      if (nav.classList.contains("show") && window.bootstrap)
        window.bootstrap.Collapse.getOrCreateInstance(nav).hide();
    }),
  );
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
  document.getElementById("galleryList").innerHTML =
    data.gallery
      .map(
        (g) =>
          `<figure class="gallery-item"><div class="gallery-placeholder">ॐ</div><figcaption>${g.title}<a class="float-end text-white" href="${g.path}" download>↧</a></figcaption></figure>`,
      )
      .join("") || "<p>Memories will appear here after the first upload.</p>";
  document.getElementById("donationsList").innerHTML =
    data.donations
      .map(
        (d) =>
          `<tr><td>${d.donorName}</td><td>${date(d.date)}</td><td>${d.paymentMode || "Cash"}</td><td class="text-end fw-bold">${money(d.amount)}</td></tr>`,
      )
      .join("") || '<tr><td colspan="4">No donations recorded yet.</td></tr>';
}
loadPortal();
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
fetch("/api/public")
  .then((response) => response.json())
  .then((data) => {
    const images = data.gallery.length
      ? data.gallery
      : [
          {
            title: "Ganesh Utsav memories",
            path: "/Ganesh%20Idol.jpg",
            originalName: "Ganesh Idol.jpg",
          },
        ];
    const list = document.getElementById("galleryList");
    list.innerHTML = images
      .map(
        (image, index) =>
          `<figure class="gallery-item"><img src="${image.path}" alt="${image.title}" loading="lazy"><figcaption><label><input class="gallery-select" type="checkbox" value="${image.path}" data-name="${image.originalName || image.title || `ganesh-memory-${index + 1}.jpg`}"> Select</label><span>${image.title}</span><a class="gallery-download" href="${image.path}" download="${image.originalName || image.title || `ganesh-memory-${index + 1}.jpg`}" title="Download this image">↧</a></figcaption></figure>`,
      )
      .join("");
    const download = document.getElementById("downloadSelected");
    if (download)
      download.addEventListener("click", () => {
        const selected = [
          ...document.querySelectorAll(".gallery-select:checked"),
        ];
        if (!selected.length) {
          alert("Select at least one image first.");
          return;
        }
        selected.forEach((input, index) =>
          setTimeout(() => {
            const link = document.createElement("a");
            link.href = input.value;
            link.download = input.dataset.name;
            link.click();
          }, index * 350),
        );
      });
  });
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
      ? data.expenses
          .map(
            (item) =>
              `<div class="finance-detail"><span>${item.name}<small>${date(item.date)}</small></span><strong>${money(item.amount)}</strong></div>`,
          )
          .join("")
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
          "🕉️ SD COLONY GANESH UTSAV<br><em>COMMITTEE 🕉️</em>";
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
  const nav = document.querySelector(".navbar .container");
  if (!nav || document.getElementById("languageSelect")) return;
  const select = document.createElement("select");
  select.id = "languageSelect";
  select.className = "language-select";
  select.setAttribute("aria-label", "Select language");
  select.innerHTML =
    '<option value="en">English</option><option value="te">తెలుగు</option>';
  select.value = localStorage.getItem("ganeshLanguage") || "en";
  select.addEventListener("change", () => {
    localStorage.setItem("ganeshLanguage", select.value);
    location.reload();
  });
  nav.insertBefore(select, nav.querySelector(".navbar-toggler"));
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
document.addEventListener("DOMContentLoaded", async () => {
  const table = document.querySelector("#donationsList")?.closest("table");
  if (!table) return;
  const response = await fetch("/api/public");
  if (!response.ok) return;
  const data = await response.json();
  const safe = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  table.querySelector("thead tr").innerHTML =
    '<th>Flat number</th><th>Donor name</th><th>Mobile number</th><th>Amount</th><th>Payment mode</th><th>Time</th><th class="text-center">Receipt</th>';
  table.querySelector("tbody").innerHTML =
    data.donations
      .map(
        (item) =>
          `<tr><td>${safe(item.flatNumber || "--")}</td><td>${safe(item.donorName || "--")}</td><td>${safe(item.mobile || "--")}</td><td class="fw-bold">${money(item.amount)}</td><td>${safe(item.paymentMode || "--")}</td><td>${safe(new Date(item.createdAt || item.date).toLocaleString("en-IN"))}</td><td class="text-center"><button class="public-receipt-download" type="button" data-public-receipt="${safe(item.receiptNumber || "")}" title="Download receipt" aria-label="Download receipt">&#11015;</button></td></tr>`,
      )
      .join("") || '<tr><td colspan="7">No donations recorded yet.</td></tr>';
});
document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-public-receipt]");
  if (!button || !button.dataset.publicReceipt) return;
  button.disabled = true;
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
