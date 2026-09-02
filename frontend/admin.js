window.addEventListener('DOMContentLoaded',()=>{setTimeout(()=>{document.querySelectorAll('select[name="paymentMode"]').forEach(select=>{select.value='Cash'});const form=document.getElementById('donationForm');if(form){const fields=['flatNumber','donorName','mobile','amount','paymentMode'].map(name=>form.querySelector(`[name="${name}"]`)).filter(Boolean);const button=form.querySelector('button');fields.forEach(field=>form.insertBefore(field,button));}},0)});
function renderExpenseTable(items,path){const container=document.getElementById('expenseAdminList');container.innerHTML=`<div class="expense-table-wrap"><table class="expense-table"><thead><tr><th>Expense name</th><th>Amount</th><th>Payment mode</th><th>Action</th></tr></thead><tbody>${items.map(item=>`<tr><td>${item.name||'--'}</td><td><strong>${money(item.amount)}</strong></td><td>${item.paymentMode||'--'}</td><td><button data-delete="${path}/${item._id}">Delete</button></td></tr>`).join('')||'<tr><td colspan="4" class="muted">Nothing here yet.</td></tr>'}</tbody></table></div>`}
const defaultExpenseList=renderList;renderList=(id,items,label,path)=>id==='expenseAdminList'?renderExpenseTable(items,path):defaultExpenseList(id,items,label,path);
window.addEventListener('DOMContentLoaded',()=>{const modes='<option value="">Select payment mode</option><option value="Cash">Cash</option><option value="UPI">UPI</option><option value="Bank transfer">Bank transfer</option><option value="Cheque">Cheque</option>';const donationForm=document.getElementById('donationForm');const donationMode=donationForm&&donationForm.querySelector('[name="paymentMode"]');if(donationMode){donationMode.innerHTML=modes;donationMode.setAttribute('aria-label','Select payment mode');donationMode.title='Select payment mode'}const expenseForm=document.getElementById('expenseForm');const amount=expenseForm&&expenseForm.querySelector('[name="amount"]');if(amount&&!expenseForm.querySelector('[name="paymentMode"]')){const select=document.createElement('select');select.name='paymentMode';select.className=amount.className;select.innerHTML=modes;select.setAttribute('aria-label','Select payment mode');select.title='Select payment mode';expenseForm.insertBefore(select,amount)}});
const escapeHtml=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');const donationPopupObserver=new MutationObserver(async()=>{const modal=document.getElementById('adminFinanceModal');if(!modal||!modal.classList.contains('is-open')||modal.querySelector('.donation-popup-table'))return;if(modal.querySelector('h3')?.textContent!=='Donation details')return;const response=await fetch('/api/public');if(!response.ok)return;const data=await response.json();modal.querySelector('.finance-content').innerHTML=`<div class="donation-popup-wrap"><table class="donation-popup-table"><thead><tr><th>Flat number</th><th>Donor name</th><th>Mobile number</th><th>Amount</th><th>Payment mode</th><th>Time</th></tr></thead><tbody>${data.donations.map(item=>`<tr><td>${escapeHtml(item.flatNumber||'--')}</td><td>${escapeHtml(item.donorName||'--')}</td><td>${escapeHtml(item.mobile||'--')}</td><td><strong>${money(item.amount)}</strong></td><td>${escapeHtml(item.paymentMode||'--')}</td><td>${escapeHtml(new Date(item.createdAt||item.date).toLocaleString('en-IN'))}</td></tr>`).join('')||'<tr><td colspan="6">No donations recorded yet.</td></tr>'}</tbody></table></div>`});donationPopupObserver.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
document.addEventListener('click',async event=>{const card=event.target.closest('#adminStats .stat-card');if(!card)return;const response=await fetch('/api/public');if(!response.ok)return;const data=await response.json();const label=card.querySelector('.label').textContent;const title=label==='Donations'?'Donation details':label==='Expenses'?'Expense details':'Balance details';let content='';if(label==='Donations')content=data.donations.length?data.donations.map(item=>`<div class="finance-detail"><span>${item.flatNumber||'--'} · ${item.donorName}<small>${item.mobile||'--'} · ${item.paymentMode||'--'} · ${new Date(item.createdAt||item.date).toLocaleString('en-IN')}</small></span><strong>${money(item.amount)}</strong></div>`).join(''):'<p class="muted">No donations recorded yet.</p>';if(label==='Expenses')content=data.expenses.length?data.expenses.map(item=>`<div class="finance-detail"><span>${item.name}<small>${new Date(item.date).toLocaleDateString('en-IN')} · ${item.description||'No description'}</small></span><strong>${money(item.amount)}</strong></div>`).join(''):'<p class="muted">No expenses recorded yet.</p>';if(label==='Balance')content=`<div class="balance-breakdown"><div><span>Total donations</span><strong>${money(data.stats.totalDonations)}</strong></div><div><span>Total expenditure</span><strong>${money(data.stats.totalExpenses)}</strong></div><div class="balance-result"><span>Current balance</span><strong>${money(data.stats.balance)}</strong></div></div>`;let modal=document.getElementById('adminFinanceModal');if(!modal){modal=document.createElement('div');modal.id='adminFinanceModal';modal.className='finance-modal';modal.innerHTML='<div class="finance-modal-panel" role="dialog" aria-modal="true"><button class="finance-close" type="button" aria-label="Close">×</button><p class="eyebrow">Live finance record</p><h3></h3><div class="finance-content"></div></div>';document.body.appendChild(modal);modal.addEventListener('click',item=>{if(item.target===modal||item.target.closest('.finance-close'))modal.classList.remove('is-open')})}modal.querySelector('h3').textContent=title;modal.querySelector('.finance-content').innerHTML=content;modal.classList.add('is-open')});
window.addEventListener('DOMContentLoaded',()=>{const hour=new Date().getHours();const greeting=hour<12?'Good morning, admin.':hour<17?'Good afternoon, admin.':'Good evening, admin.';const heading=document.querySelector('.admin-body main h1');if(heading)heading.textContent=greeting;const venue=document.querySelector('#eventForm [name="venue"]');if(venue){venue.value='Between Sirius & Samyukta';venue.placeholder='Between Sirius & Samyukta'}});
const defaultRenderList=renderList;renderList=(id,items,label,path)=>id==='donationAdminList'?renderDonationTable(items,path):defaultRenderList(id,items,label,path);
const memberRenderList=renderList;renderList=(id,items,label,path)=>id==='memberAdminList'?renderMemberTable(items,path):memberRenderList(id,items,label,path);function renderMemberTable(items,path){const container=document.getElementById('memberAdminList');container.innerHTML=`<div class="member-table-wrap"><table class="member-table"><thead><tr><th>Name</th><th>Designation</th><th>Mobile number</th><th>Action</th></tr></thead><tbody>${items.map(item=>`<tr><td>${item.name||'--'}</td><td>${item.designation||'--'}</td><td>${item.mobile||'--'}</td><td><button data-delete="${path}/${item._id}">Delete</button></td></tr>`).join('')||'<tr><td colspan="4" class="muted">Nothing here yet.</td></tr>'}</tbody></table></div>`}
const eventRenderList=renderList;renderList=(id,items,label,path)=>id==='eventAdminList'?renderEventTable(items,path):eventRenderList(id,items,label,path);function renderEventTable(items,path){const container=document.getElementById('eventAdminList');container.innerHTML=`<div class="member-table-wrap"><table class="member-table event-table"><thead><tr><th>Event name</th><th>Date</th><th>Time</th><th>Venue</th><th>Action</th></tr></thead><tbody>${items.map(item=>`<tr><td>${item.name||'--'}</td><td>${item.date?new Date(item.date).toLocaleDateString('en-IN'):'--'}</td><td>${item.time||'--'}</td><td>${item.venue||'Between Sirius & Samyukta'}</td><td><button data-delete="${path}/${item._id}">Delete</button></td></tr>`).join('')||'<tr><td colspan="5" class="muted">Nothing here yet.</td></tr>'}</tbody></table></div>`}
function renderDonationTable(items,path){const container=document.getElementById('donationAdminList');container.innerHTML=`<div class="donation-table-wrap"><table class="donation-table"><thead><tr><th>Flat number</th><th>Donor name</th><th>Mobile number</th><th>Amount</th><th>Payment mode</th><th>Time</th><th>Actions</th></tr></thead><tbody>${items.map(item=>`<tr><td>${item.flatNumber||'--'}</td><td>${item.donorName||'--'}</td><td>${item.mobile||'--'}</td><td><strong>${money(item.amount)}</strong></td><td>${item.paymentMode||'--'}</td><td>${new Date(item.createdAt||item.date).toLocaleString('en-IN')}</td><td><div class="admin-actions">${item.receiptNumber?`<button class="admin-icon-btn view-btn" type="button" data-view-receipt="${escapeHtml(item.receiptNumber)}" title="View receipt" aria-label="View receipt">👁</button><button class="admin-icon-btn download-btn" type="button" data-download-receipt="${escapeHtml(item.receiptNumber)}" title="Download receipt" aria-label="Download receipt">⤓</button>`:''}<button class="admin-icon-btn delete-btn" type="button" data-delete="${path}/${item._id}" title="Delete donation" aria-label="Delete donation">🗑</button></div></td></tr>`).join('')||'<tr><td colspan="7" class="muted">Nothing here yet.</td></tr>'}</tbody></table></div>`}

function showReceiptModal(receiptNumber){
  let modal=document.getElementById('receiptPreviewModal');
  if(!modal){
    modal=document.createElement('div');
    modal.id='receiptPreviewModal';
    modal.className='receipt-preview-modal';
    modal.innerHTML='<div class="receipt-preview-panel"><button type="button" class="receipt-close" data-close-receipt="true" aria-label="Close">×</button><div class="receipt-preview-header"><strong>Receipt Preview</strong><span>'+receiptNumber+'</span></div><div class="receipt-preview-box"><div id="receipt-display" style="background:white;padding:20px;max-height:600px;overflow-y:auto;font-family:Segoe UI,sans-serif"></div></div><div class="receipt-preview-footer"><button type="button" class="btn btn-dark-red" data-download-receipt="'+receiptNumber+'">Download JPG</button></div></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click',e=>{if(e.target===modal||e.target.closest('[data-close-receipt]')){modal.classList.remove('is-open');}});
  }
  const display=modal.querySelector('#receipt-display');
  display.innerHTML='<p>Loading...</p>';
  modal.classList.add('is-open');
  
  const image=document.createElement('img');
  image.alt='Donation receipt '+receiptNumber;
  image.style.cssText='display:block;width:100%;height:auto';
  image.src='/api/receipts/'+encodeURIComponent(receiptNumber)+'/image.svg';
  image.onerror=()=>{
    if(image.dataset.fallback){display.innerHTML='<p style="color:red">Unable to load receipt. Please try again.</p>';return;}
    image.dataset.fallback='true';
    image.src='/api/receipts/'+encodeURIComponent(receiptNumber)+'/image';
  };
  display.replaceChildren(image);
}
async function downloadReceiptImage(receiptNumber){
  try{
    let response=await fetch('/api/receipts/'+encodeURIComponent(receiptNumber)+'/image.svg');
    if(!response.ok)response=await fetch('/api/receipts/'+encodeURIComponent(receiptNumber)+'/image');
    if(!response.ok)throw new Error(response.status===404?'Receipt not found':'Receipt service unavailable');
    const sourceUrl=URL.createObjectURL(new Blob([await response.text()],{type:'image/svg+xml'}));
    const image=new Image();
    image.onload=()=>{
      const canvas=document.createElement('canvas');
      canvas.width=1500; canvas.height=2100;
      canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
      canvas.toBlob(jpg=>{
        if(!jpg){alert('Unable to create receipt image. Please try again.');return;}
        const link=document.createElement('a');
        link.href=URL.createObjectURL(jpg);
        link.download=receiptNumber+'.jpg';
        link.click();
        setTimeout(()=>{URL.revokeObjectURL(link.href);URL.revokeObjectURL(sourceUrl);},1000);
      },'image/jpeg',0.92);
    };
    image.onerror=()=>{URL.revokeObjectURL(sourceUrl);alert('Unable to create receipt image. Please try again.');};
    image.src=sourceUrl;
  }catch(e){alert('Download failed: '+e.message);console.error(e);}
}
document.addEventListener('click',async event=>{if(event.target.closest('[data-view-receipt]')){const viewButton=event.target.closest('[data-view-receipt]');event.preventDefault();showReceiptModal(viewButton.dataset.viewReceipt);return}const downloadButton=event.target.closest('[data-download-receipt]');if(downloadButton){event.preventDefault();downloadReceiptImage(downloadButton.dataset.downloadReceipt);return}if(event.target.closest('[data-report]')){const button=event.target.closest('[data-report]');if(!button)return;const response=await api('/reports/'+button.dataset.report);if(!response.ok){alert('Report download failed');return}const blob=await response.blob();const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=button.dataset.report.replace('/','-');link.click();URL.revokeObjectURL(link.href)}});
const submitForm=async(form,endpoint)=>{const response=await api(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(formData(form))});if(!response.ok){alert((await response.json()).message||'Could not save');return null}const saved=await response.json();form.reset();loadAdmin();return saved};
document.addEventListener('submit',async event=>{if(event.target.id!=='donationForm')return;event.preventDefault();const saved=await submitForm(event.target,'/donations');if(!saved)return;let actions=document.getElementById('donationReceiptActions');if(!actions){actions=document.createElement('div');actions.id='donationReceiptActions';actions.className='receipt-actions';event.target.parentElement.appendChild(actions)}const phone=(saved.mobile||'').replace(/\D/g,'');const whatsapp=phone?`https://wa.me/${phone.length===10?'91':''}${phone}?text=${encodeURIComponent(`Thank you for your donation to SD Colony Ganesh Utsav Committee. Receipt: ${saved.receiptNumber}.`)}`:'';actions.innerHTML=`<strong>Receipt ${saved.receiptNumber} generated</strong><button class="btn btn-sm btn-dark-red" type="button" data-download-receipt="${saved.receiptNumber}">Download image</button>${whatsapp?`<a class="btn btn-sm btn-success" href="${whatsapp}" target="_blank" rel="noopener">Send on WhatsApp</a>`:'<span class="muted">Enter a mobile number to share on WhatsApp.</span>'}`;actions.classList.remove('d-none')});
window.addEventListener('DOMContentLoaded',()=>{document.title='Admin · SD Colony Ganesh Utsav Committee';document.querySelector('.admin-nav .navbar-brand').lastChild.textContent=' SD Colony Ganesh Utsav Committee';const timeInput=document.querySelector('#eventForm input[name="time"]');if(timeInput){const select=document.createElement('select');select.name='time';select.className=timeInput.className;select.required=false;select.innerHTML='<option value="">Select hourly time</option>'+Array.from({length:24},(_,hour)=>{const start=hour%12||12;const end=(hour+1)%12||12;const startPeriod=hour<12?'AM':'PM';const endPeriod=(hour+1)<12?'AM':'PM';return `<option value="${start}:00 ${startPeriod} - ${end}:00 ${endPeriod}">${start}:00 ${startPeriod} - ${end}:00 ${endPeriod}</option>`}).join('');timeInput.replaceWith(select)}const donationForm=document.getElementById('donationForm');const donorName=donationForm&&donationForm.querySelector('[name="donorName"]');if(donorName&&!donationForm.querySelector('[name="flatNumber"]')){const flat=document.createElement('input');flat.name='flatNumber';flat.className=donorName.className;flat.placeholder='Flat number';flat.required=true;donationForm.insertBefore(flat,donorName)}});
const token=localStorage.getItem('ganeshToken'); const api=(path,options={})=>fetch('/api'+path,{...options,headers:{...(options.headers||{}),Authorization:`Bearer ${localStorage.getItem('ganeshToken')}`}}); const money=v=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(v||0); const formData=form=>Object.fromEntries(new FormData(form));
function showDashboard(){document.getElementById('loginView').classList.add('d-none');document.getElementById('dashboardView').classList.remove('d-none');loadAdmin();} if(token)showDashboard();
document.getElementById('logout').addEventListener('click',()=>{localStorage.removeItem('ganeshToken');location.reload()});

document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-delete]');
  if(!button)return;
  event.preventDefault();
  if(!window.confirm('Delete this record permanently?'))return;
  button.disabled=true;
  try{
    const response=await api(button.dataset.delete,{method:'DELETE'});
    if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.message||'Delete failed');}
    await loadAdmin();
  }catch(error){button.disabled=false;alert(error.message);}
});

// Login handler
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('loginError');
  errorEl.classList.add('d-none');
  
  const username = document.querySelector('[name="username"]').value.trim();
  const password = document.querySelector('[name="password"]').value;
  
  if (!username || !password) {
    errorEl.textContent = 'Please enter both username and password';
    errorEl.classList.remove('d-none');
    return;
  }
  
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      errorEl.textContent = data.message || 'Login failed. Invalid credentials.';
      errorEl.classList.remove('d-none');
      console.error('Login error:', response.status, data);
      return;
    }
    
    // Success
    localStorage.setItem('ganeshToken', data.token);
    console.log('Login successful');
    showDashboard();
  } catch (err) {
    errorEl.textContent = 'Network error: ' + err.message;
    errorEl.classList.remove('d-none');
    console.error('Login exception:', err);
  }
});

async function loadAdmin(){const r=await api('/public');if(!r.ok)return;const d=await r.json();document.getElementById('adminStats').innerHTML=[['Donations',d.stats.totalDonations],['Expenses',d.stats.totalExpenses],['Balance',d.stats.balance]].map(([a,b])=>`<div class="col-md-4"><div class="stat-card"><span class="label">${a}</span><strong>${money(b)}</strong></div></div>`).join('');renderList('donationAdminList',d.donations,x=>`${x.donorName} · ${money(x.amount)}`,'/donations');renderList('expenseAdminList',d.expenses,x=>`${x.name} · ${money(x.amount)}`,'/expenses');renderList('memberAdminList',d.members,x=>`${x.name} · ${x.designation||''}`,'/members');renderList('eventAdminList',d.events,x=>`${x.name} · ${x.venue||''}`,'/events');renderList('galleryAdminList',d.gallery,x=>`${x.title}`,'/gallery');document.getElementById('lastUpdated').textContent=`Updated ${new Date().toLocaleTimeString()}`;}
function renderList(id,items,label,path){const header=id==='donationAdminList'?'<div class="donation-columns"><span>Flat number</span><span>Donor name</span><span>Mobile number</span><span>Amount</span><span>Payment mode</span><span>Time</span><span>Actions</span></div>':'';document.getElementById(id).innerHTML=header+(items.map(x=>`<div class="admin-row ${id==='donationAdminList'?'donation-row':''}"><span>${id==='donationAdminList'?x.flatNumber||'--':label(x)}</span>${id==='donationAdminList'?`<span>${x.donorName||'--'}</span><span>${x.mobile||'--'}</span><strong>${money(x.amount)}</strong><span>${x.paymentMode||'--'}</span><span>${new Date(x.createdAt||x.date).toLocaleString('en-IN')}</span>`:''}<span class="admin-actions">${id==='donationAdminList'&&x.receiptNumber?`<button data-receipt-image="${x.receiptNumber}">Receipt image</button>`:''}<button data-delete="${path}/${x._id}">Delete</button></span></div>`).join('')||'<div class="admin-row muted">Nothing here yet.</div>');}
async function submitAdmin(form,endpoint){const r=await api(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(formData(form))});if(!r.ok){alert((await r.json()).message||'Could not save');return}form.reset();loadAdmin()}; document.getElementById('expenseForm').addEventListener('submit',e=>{e.preventDefault();submitAdmin(e.target,'/expenses')});document.getElementById('memberForm').addEventListener('submit',e=>{e.preventDefault();submitAdmin(e.target,'/members')});document.getElementById('eventForm').addEventListener('submit',e=>{e.preventDefault();submitAdmin(e.target,'/events')});document.getElementById('galleryForm').addEventListener('submit',async e=>{e.preventDefault();const r=await api('/gallery',{method:'POST',body:new FormData(e.target)});if(!r.ok)alert('Upload failed');e.target.reset();loadAdmin()});
