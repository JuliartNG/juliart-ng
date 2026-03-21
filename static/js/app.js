/* ═══════════════════════════════════════════════════
   JULIART NG — App Logic 2026
   Cart · Velvet Tray · Checkout · Ghost Admin
   ═══════════════════════════════════════════════════ */

'use strict';

// ── State ──────────────────────────────────────────────────────────────────
let currentProduct  = null;
let cartState       = { items: [], total: 0, count: 0 };
let uploadedImgUrl  = null;

// ── Boot ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', refreshCart);

// ══════════════════════════════════════════════════════════════════════════
//  CART
// ══════════════════════════════════════════════════════════════════════════
async function refreshCart() {
  try {
    const res = await fetch('/cart');
    cartState = await res.json();
    updateFAB(cartState.count);
  } catch (e) { console.error('Cart refresh failed', e); }
}

async function cartAdd() {
  if (!currentProduct) return;
  await fetch(`/cart/add/${currentProduct.id}`, { method: 'POST' });
  await refreshCart();
  syncTrayButtons();
}

async function cartRemove() {
  if (!currentProduct) return;
  await fetch(`/cart/remove/${currentProduct.id}`, { method: 'POST' });
  await refreshCart();
  syncTrayButtons();
}

async function clearCart() {
  await fetch('/cart/clear', { method: 'POST' });
  await refreshCart();
  closeCheckout();
}

function updateFAB(count) {
  const wrap  = document.getElementById('fabWrap');
  const badge = document.getElementById('fabBadge');
  if (!wrap) return;
  wrap.style.display  = count > 0 ? 'block' : 'none';
  badge.textContent   = count;
}

// ══════════════════════════════════════════════════════════════════════════
//  VELVET TRAY
// ══════════════════════════════════════════════════════════════════════════
function openTray(el) {
  currentProduct = {
    id:       el.dataset.id,
    name:     el.dataset.name,
    price:    parseFloat(el.dataset.price),
    image:    el.dataset.image,
    category: el.dataset.category,
    desc:     el.dataset.desc,
  };

  document.getElementById('trayImg').src         = currentProduct.image;
  document.getElementById('trayImg').alt         = currentProduct.name;
  document.getElementById('trayCat').textContent  = currentProduct.category;
  document.getElementById('trayName').textContent = currentProduct.name;
  document.getElementById('trayPrice').textContent= '₦' + fmt(currentProduct.price);
  document.getElementById('trayDesc').textContent = currentProduct.desc;

  syncTrayButtons();

  document.getElementById('trayOverlay').classList.add('open');
  document.getElementById('velvetTray').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeTray() {
  document.getElementById('trayOverlay').classList.remove('open');
  document.getElementById('velvetTray').classList.remove('open');
  document.body.style.overflow = '';
  currentProduct = null;
}

function syncTrayButtons() {
  if (!currentProduct) return;
  const inCart = cartState.items.some(i => String(i.id) === String(currentProduct.id));
  document.getElementById('trayAdd').style.display    = inCart ? 'none'  : 'block';
  document.getElementById('trayRemove').style.display = inCart ? 'block' : 'none';
}

// ══════════════════════════════════════════════════════════════════════════
//  CHECKOUT
// ══════════════════════════════════════════════════════════════════════════
function openCheckout() {
  renderCheckout();
  document.getElementById('checkoutOverlay').classList.add('open');
  document.getElementById('checkoutSheet').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCheckout() {
  document.getElementById('checkoutOverlay').classList.remove('open');
  document.getElementById('checkoutSheet').classList.remove('open');
  document.body.style.overflow = '';
}

function renderCheckout() {
  const { items, total } = cartState;
  const container = document.getElementById('checkoutItems');

  if (!items.length) {
    container.innerHTML = '<p style="color:var(--brown-lite);font-size:14px;padding:16px 0">Your tray is empty.</p>';
    document.getElementById('checkoutTotal').textContent = '₦0';
    setOrderLinks([], 0);
    return;
  }

  container.innerHTML = items.map(i => `
    <div class="ci-row">
      <img src="${i.image}" alt="${i.name}" class="ci-img" loading="lazy"/>
      <div class="ci-info">
        <div class="ci-name">${i.name}</div>
        <div class="ci-sub">Qty: ${i.qty}</div>
      </div>
      <div class="ci-price">₦${fmt(i.price * i.qty)}</div>
    </div>`).join('');

  document.getElementById('checkoutTotal').textContent = '₦' + fmt(total);
  setOrderLinks(items, total);
}

function setOrderLinks(items, total) {
  const lines = items.map(i => `• ${i.name} x${i.qty}  —  ₦${fmt(i.price * i.qty)}`);
  const msg   = [
    '✨ *Juliart NG — Order Request* ✨',
    '',
    ...lines,
    '',
    `*Total: ₦${fmt(total)}*`,
    '',
    'Please confirm availability and share payment details. Thank you! 🙏'
  ].join('\n');

  const enc = encodeURIComponent(msg);
  document.getElementById('waBtn').href  = `https://wa.me/${WHATSAPP}?text=${enc}`;
  document.getElementById('smsBtn').href = `sms:?body=${enc}`;
}

// ══════════════════════════════════════════════════════════════════════════
//  GHOST ADMIN — IMAGE UPLOAD
// ══════════════════════════════════════════════════════════════════════════
function triggerPicker() {
  document.getElementById('imagePicker').click();
}

async function handlePick(input) {
  const file = input.files[0];
  if (!file) return;

  // Instant local preview
  const reader = new FileReader();
  reader.onload = e => {
    const prev = document.getElementById('uploadPreview');
    prev.src          = e.target.result;
    prev.style.display = 'block';
    document.getElementById('uploadPlaceholder').style.display = 'none';
  };
  reader.readAsDataURL(file);

  // Show progress bar
  const barWrap = document.getElementById('uploadBar');
  const fill    = document.getElementById('uploadFill');
  const status  = document.getElementById('uploadStatus');
  barWrap.style.display = 'flex';
  fill.style.width      = '0%';
  fill.style.background = 'var(--gold)';
  status.textContent    = 'Uploading photo…';

  // Animate progress while uploading
  let pct = 0;
  const tick = setInterval(() => {
    pct = Math.min(pct + 7, 82);
    fill.style.width = pct + '%';
  }, 100);

  const form = new FormData();
  form.append('image', file);

  try {
    const res  = await fetch('/admin/upload', { method: 'POST', body: form });
    clearInterval(tick);

    if (res.ok) {
      const data        = await res.json();
      uploadedImgUrl    = data.url;
      fill.style.width  = '100%';
      status.textContent = '✓ Photo ready — fill in details below';
    } else {
      status.textContent    = '✗ Upload failed. Try again.';
      fill.style.background = '#e53935';
    }
  } catch (err) {
    clearInterval(tick);
    status.textContent    = '✗ Network error. Try again.';
    fill.style.background = '#e53935';
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  GHOST ADMIN — ADD PRODUCT
// ══════════════════════════════════════════════════════════════════════════
async function adminAdd() {
  if (!uploadedImgUrl) {
    alert('Please pick a photo first 📷');
    return;
  }

  const name  = document.getElementById('aName').value.trim();
  const price = parseFloat(document.getElementById('aPrice').value);
  const cat   = document.getElementById('aCat').value.trim()  || 'Jewelry';
  const desc  = document.getElementById('aDesc').value.trim();

  if (!name)       { alert('Please enter the piece name.');  return; }
  if (!price || price <= 0) { alert('Please enter a valid price.'); return; }

  const res = await fetch('/admin/add', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ name, price, image: uploadedImgUrl, category: cat, desc })
  });

  if (res.ok) {
    const p = await res.json();
    injectCard(p);
    resetAdminForm();
  } else {
    alert('Something went wrong. Please try again.');
  }
}

function resetAdminForm() {
  ['aName','aPrice','aCat','aDesc'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('uploadPreview').style.display   = 'none';
  document.getElementById('uploadPreview').src             = '';
  document.getElementById('uploadPlaceholder').style.display = 'flex';
  document.getElementById('uploadBar').style.display       = 'none';
  document.getElementById('uploadFill').style.width        = '0%';
  document.getElementById('imagePicker').value             = '';
  uploadedImgUrl = null;
}

// ══════════════════════════════════════════════════════════════════════════
//  GHOST ADMIN — INJECT NEW CARD INTO GRID
// ══════════════════════════════════════════════════════════════════════════
function injectCard(p) {
  // Remove empty state if present
  const empty = document.querySelector('.empty-state');
  if (empty) empty.remove();

  const grid = document.getElementById('productGrid');
  const art  = document.createElement('article');
  art.className = 'product-card';
  art.dataset.id       = p.id;
  art.dataset.name     = p.name;
  art.dataset.price    = p.price;
  art.dataset.image    = p.image;
  art.dataset.category = p.category;
  art.dataset.desc     = p.desc;
  art.onclick = function () { openTray(this); };

  art.innerHTML = `
    <div class="card-img-wrap">
      <img src="${p.image}" alt="${p.name}" loading="lazy" class="card-img"/>
      <div class="card-overlay"></div>
      ${IS_ADMIN ? `<button class="delete-btn" onclick="deleteProduct(event,${p.id})">✕</button>` : ''}
    </div>
    <div class="card-body">
      <span class="card-cat">${p.category}</span>
      <h3  class="card-name">${p.name}</h3>
      <p   class="card-price">₦${fmt(p.price)}</p>
    </div>`;

  grid.prepend(art);
}

// ══════════════════════════════════════════════════════════════════════════
//  GHOST ADMIN — DELETE PRODUCT
// ══════════════════════════════════════════════════════════════════════════
async function deleteProduct(e, pid) {
  e.stopPropagation();
  if (!confirm('Remove this piece from the collection?')) return;

  const res = await fetch(`/admin/delete/${pid}`, { method: 'DELETE' });
  if (res.ok) {
    const card = document.querySelector(`.product-card[data-id="${pid}"]`);
    if (card) {
      card.style.transition = 'opacity 0.3s, transform 0.3s';
      card.style.opacity    = '0';
      card.style.transform  = 'scale(0.94)';
      setTimeout(() => {
        card.remove();
        // Show empty state if grid is now empty
        if (!document.querySelector('.product-card')) {
          document.getElementById('productGrid').innerHTML = `
            <div class="empty-state">
              <div class="empty-ornament">✦</div>
              <p class="empty-title">The collection is being curated</p>
              <p class="empty-sub">New pieces will appear here soon.<br/>Check back shortly.</p>
            </div>`;
        }
      }, 320);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  UTILS
// ══════════════════════════════════════════════════════════════════════════
function fmt(n) {
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0 });
}
