/* ═══════════════════════════════════════════════════
   JULIART NG — App Logic 2026
   Gallery · Cart · Tray · Wishlist · Search · Filter · Admin
   ═══════════════════════════════════════════════════ */
'use strict';

// ── State ──────────────────────────────────────────────────────────────────
let currentProduct  = null;
let cartState       = { items: [], total: 0, count: 0 };
let galleryImages   = [];
let galleryIndex    = 0;
let uploadedUrls    = { 1: null, 2: null, 3: null, 4: null };
let wishlist        = JSON.parse(localStorage.getItem('juliart_wish') || '[]');
let activeCat       = 'all';
let searchTerm      = '';

// ── Boot ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  refreshCart();
  syncAllWishButtons();
  updateWishlistNav();
});

// ══════════════════════════════════════════════════════════════════════════
//  CART
// ══════════════════════════════════════════════════════════════════════════
async function refreshCart() {
  try {
    const res = await fetch('/cart');
    cartState = await res.json();
    updateFAB(cartState.count);
  } catch(e) { console.error(e); }
}

async function cartAdd() {
  if (!currentProduct || currentProduct.soldOut) return;
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
  wrap.style.display = count > 0 ? 'block' : 'none';
  badge.textContent  = count;
}

// ══════════════════════════════════════════════════════════════════════════
//  SEARCH & FILTER
// ══════════════════════════════════════════════════════════════════════════
function filterCat(btn, cat) {
  activeCat = cat;
  document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  applyFilters();
}

function filterProducts() {
  searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
  applyFilters();
}

function applyFilters() {
  const cards   = document.querySelectorAll('.product-card');
  let   visible = 0;

  cards.forEach(card => {
    const name = card.dataset.name.toLowerCase();
    const cat  = card.dataset.category;
    const matchSearch = !searchTerm || name.includes(searchTerm);
    const matchCat    = activeCat === 'all' || cat === activeCat;

    if (matchSearch && matchCat) {
      card.style.display = '';
      visible++;
    } else {
      card.style.display = 'none';
    }
  });

  const noRes = document.getElementById('noResults');
  const empty = document.getElementById('emptyState');
  if (noRes) {
    noRes.style.display = visible === 0 && cards.length > 0 ? 'block' : 'none';
    const st = document.getElementById('searchTerm');
    if (st) st.textContent = searchTerm || activeCat;
  }
  if (empty) empty.style.display = cards.length === 0 ? 'block' : 'none';
}

// ══════════════════════════════════════════════════════════════════════════
//  VELVET TRAY
// ══════════════════════════════════════════════════════════════════════════
function openTray(el) {
  let images = [];
  try { images = JSON.parse(el.dataset.images || '[]'); } catch(e) { images = []; }
  if (!images.length && el.dataset.image) images = [el.dataset.image];

  currentProduct = {
    id:       el.dataset.id,
    name:     el.dataset.name,
    price:    parseFloat(el.dataset.price),
    category: el.dataset.category,
    desc:     el.dataset.desc,
    soldOut:  el.dataset.soldout === 'true',
    images:   images
  };

  document.getElementById('trayCat').textContent   = currentProduct.category;
  document.getElementById('trayName').textContent  = currentProduct.name;
  document.getElementById('trayPrice').textContent = '₦' + fmt(currentProduct.price);
  document.getElementById('trayDesc').textContent  = currentProduct.desc;

  buildGallery(images);
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
  const inCart  = cartState.items.some(i => String(i.id) === String(currentProduct.id));
  const addBtn  = document.getElementById('trayAdd');
  const remBtn  = document.getElementById('trayRemove');
  const notice  = document.getElementById('soldOutNotice');
  const wishBtn = document.getElementById('trayWish');

  if (currentProduct.soldOut) {
    addBtn.style.display    = 'block';
    addBtn.disabled         = true;
    notice.style.display    = 'block';
    remBtn.style.display    = 'none';
  } else {
    addBtn.disabled         = false;
    notice.style.display    = 'none';
    addBtn.style.display    = inCart ? 'none'  : 'block';
    remBtn.style.display    = inCart ? 'block' : 'none';
  }

  const wished = wishlist.includes(String(currentProduct.id));
  wishBtn.textContent = wished ? '♥ Saved' : '♡ Save';
  wishBtn.classList.toggle('wished', wished);
}

// ══════════════════════════════════════════════════════════════════════════
//  GALLERY SWIPE
// ══════════════════════════════════════════════════════════════════════════
function buildGallery(images) {
  galleryImages = images;
  galleryIndex  = 0;

  const track = document.getElementById('trayTrack');
  const dots  = document.getElementById('trayDots');
  const prev  = document.getElementById('trayPrev');
  const next  = document.getElementById('trayNext');

  track.innerHTML = images.map(src =>
    `<img src="${src}" alt="product photo" loading="lazy"/>`
  ).join('');

  dots.innerHTML = images.length > 1 ? images.map((_, i) =>
    `<div class="tray-dot ${i === 0 ? 'active' : ''}" onclick="goToSlide(${i})"></div>`
  ).join('') : '';

  prev.style.display = images.length > 1 ? 'flex' : 'none';
  next.style.display = images.length > 1 ? 'flex' : 'none';

  updateGalleryPosition();
}

function updateGalleryPosition() {
  document.getElementById('trayTrack').style.transform = `translateX(-${galleryIndex * 100}%)`;
  document.querySelectorAll('.tray-dot').forEach((d, i) =>
    d.classList.toggle('active', i === galleryIndex)
  );
}

function galleryNext() {
  if (galleryImages.length < 2) return;
  galleryIndex = (galleryIndex + 1) % galleryImages.length;
  updateGalleryPosition();
}

function galleryPrev() {
  if (galleryImages.length < 2) return;
  galleryIndex = (galleryIndex - 1 + galleryImages.length) % galleryImages.length;
  updateGalleryPosition();
}

function goToSlide(i) {
  galleryIndex = i;
  updateGalleryPosition();
}

// ══════════════════════════════════════════════════════════════════════════
//  WISHLIST
// ══════════════════════════════════════════════════════════════════════════
function toggleWish(e, pid) {
  e.stopPropagation();
  const id  = String(pid);
  const idx = wishlist.indexOf(id);
  if (idx === -1) {
    wishlist.push(id);
  } else {
    wishlist.splice(idx, 1);
  }
  localStorage.setItem('juliart_wish', JSON.stringify(wishlist));
  syncAllWishButtons();
  updateWishlistNav();
}

function toggleWishTray() {
  if (!currentProduct) return;
  toggleWish({ stopPropagation: () => {} }, currentProduct.id);
  syncTrayButtons();
}

function syncAllWishButtons() {
  document.querySelectorAll('.wish-btn').forEach(btn => {
    const id = String(btn.dataset.id);
    btn.classList.toggle('wished', wishlist.includes(id));
    btn.textContent = wishlist.includes(id) ? '♥' : '♡';
  });
}

function updateWishlistNav() {
  const btn   = document.getElementById('wishlistNavBtn');
  const count = document.getElementById('wishlistCount');
  if (!btn) return;
  btn.style.display   = wishlist.length > 0 ? 'flex' : 'none';
  count.textContent   = wishlist.length;
}

function openWishlist() {
  const container = document.getElementById('wishlistItems');
  const cards     = document.querySelectorAll('.product-card');
  const map       = {};
  cards.forEach(c => { map[c.dataset.id] = c; });

  if (wishlist.length === 0) {
    container.innerHTML = '<div class="wish-empty">No saved pieces yet.<br/>Tap ♡ on any piece to save it.</div>';
  } else {
    container.innerHTML = wishlist.map(id => {
      const c = map[id];
      if (!c) return '';
      let images = [];
      try { images = JSON.parse(c.dataset.images || '[]'); } catch(e) {}
      const img = images[0] || '';
      return `
        <div class="wish-item">
          <img src="${img}" alt="${c.dataset.name}" onclick="closeWishlist();openTray(document.querySelector('.product-card[data-id=\\'${id}\\']'))"/>
          <div class="wish-item-info">
            <div class="wish-item-name">${c.dataset.name}</div>
            <div class="wish-item-price">₦${fmt(parseFloat(c.dataset.price))}</div>
          </div>
          <button class="wish-remove" onclick="toggleWish(event,${id});renderWishlistItems()">✕</button>
        </div>`;
    }).join('');
  }

  document.getElementById('wishlistOverlay').classList.add('open');
  document.getElementById('wishlistSheet').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function renderWishlistItems() {
  updateWishlistNav();
  syncAllWishButtons();
  openWishlist();
}

function closeWishlist() {
  document.getElementById('wishlistOverlay').classList.remove('open');
  document.getElementById('wishlistSheet').classList.remove('open');
  document.body.style.overflow = '';
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
    '✨ *Juliart NG — Order Request* ✨', '',
    ...lines, '',
    `*Total: ₦${fmt(total)}*`, '',
    'Please confirm availability and share payment details. Thank you! 🙏'
  ].join('\n');
  const enc = encodeURIComponent(msg);
  document.getElementById('waBtn').href  = `https://wa.me/${WHATSAPP}?text=${enc}`;
  document.getElementById('smsBtn').href = `sms:?body=${enc}`;
}

// ══════════════════════════════════════════════════════════════════════════
//  GHOST ADMIN — IMAGE SLOTS
// ══════════════════════════════════════════════════════════════════════════
function triggerSlot(n) {
  document.getElementById(`file${n}`).click();
}

async function handleSlot(n, input) {
  const file = input.files[0];
  if (!file) return;

  // Preview
  const reader = new FileReader();
  reader.onload = e => {
    const prev = document.getElementById(`prev${n}`);
    prev.src = e.target.result;
    prev.style.display = 'block';
    document.querySelector(`#slot${n} .slot-placeholder`).style.display = 'none';
  };
  reader.readAsDataURL(file);

  // Upload
  const status = document.getElementById(`status${n}`);
  status.textContent = 'Uploading…';
  status.classList.add('show');

  const form = new FormData();
  form.append('image', file);

  try {
    const res  = await fetch('/admin/upload', { method: 'POST', body: form });
    if (res.ok) {
      const data        = await res.json();
      uploadedUrls[n]   = data.url;
      status.textContent = '✓ Ready';
    } else {
      status.textContent = '✗ Failed';
    }
  } catch(e) {
    status.textContent = '✗ Error';
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  GHOST ADMIN — ADD PRODUCT
// ══════════════════════════════════════════════════════════════════════════
async function adminAdd() {
  if (!uploadedUrls[1]) { alert('Please upload at least the Front photo 📷'); return; }

  const name  = document.getElementById('aName').value.trim();
  const price = parseFloat(document.getElementById('aPrice').value);
  const cat   = document.getElementById('aCat').value;
  const desc  = document.getElementById('aDesc').value.trim();

  if (!name)           { alert('Please enter the piece name.');   return; }
  if (!price || price <= 0) { alert('Please enter a valid price.'); return; }

  const res = await fetch('/admin/add', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      name, price, category: cat, desc,
      image1: uploadedUrls[1],
      image2: uploadedUrls[2] || null,
      image3: uploadedUrls[3] || null,
      image4: uploadedUrls[4] || null
    })
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
  ['aName','aPrice','aDesc'].forEach(id => document.getElementById(id).value = '');
  [1,2,3,4].forEach(n => {
    document.getElementById(`file${n}`).value = '';
    const prev = document.getElementById(`prev${n}`);
    prev.style.display = 'none'; prev.src = '';
    document.querySelector(`#slot${n} .slot-placeholder`).style.display = 'flex';
    const status = document.getElementById(`status${n}`);
    status.textContent = ''; status.classList.remove('show');
    uploadedUrls[n] = null;
  });
}

// ══════════════════════════════════════════════════════════════════════════
//  GHOST ADMIN — INJECT CARD
// ══════════════════════════════════════════════════════════════════════════
function injectCard(p) {
  const empty = document.querySelector('.empty-state');
  if (empty) empty.remove();

  const grid = document.getElementById('productGrid');
  const art  = document.createElement('article');
  art.className = 'product-card';
  art.dataset.id       = p.id;
  art.dataset.name     = p.name;
  art.dataset.price    = p.price;
  art.dataset.category = p.category;
  art.dataset.desc     = p.desc;
  art.dataset.soldout  = 'false';
  art.dataset.images   = JSON.stringify(p.images || [p.image]);
  art.onclick = function() { openTray(this); };

  art.innerHTML = `
    <div class="card-img-wrap">
      <img src="${p.image}" alt="${p.name}" loading="lazy" class="card-img"/>
      <div class="card-overlay"></div>
      <div class="new-badge">New</div>
      <button class="wish-btn" data-id="${p.id}" onclick="toggleWish(event,${p.id})">♡</button>
      ${IS_ADMIN ? `
      <div class="admin-card-btns">
        <button class="sold-toggle-btn" onclick="toggleSoldOut(event,${p.id},this)">Mark Sold Out</button>
        <button class="delete-btn" onclick="deleteProduct(event,${p.id})">✕</button>
      </div>` : ''}
    </div>
    <div class="card-body">
      <span class="card-cat">${p.category}</span>
      <h3 class="card-name">${p.name}</h3>
      <p class="card-price">₦${fmt(p.price)}</p>
    </div>`;

  grid.prepend(art);
  applyFilters();
}

// ══════════════════════════════════════════════════════════════════════════
//  GHOST ADMIN — SOLD OUT TOGGLE
// ══════════════════════════════════════════════════════════════════════════
async function toggleSoldOut(e, pid, btn) {
  e.stopPropagation();
  const res = await fetch(`/admin/soldout/${pid}`, { method: 'POST' });
  if (res.ok) {
    const data = await res.json();
    const card = document.querySelector(`.product-card[data-id="${pid}"]`);
    if (card) {
      card.dataset.soldout = data.sold_out ? 'true' : 'false';
      card.classList.toggle('sold-out-card', data.sold_out);
      btn.textContent = data.sold_out ? 'Mark Available' : 'Mark Sold Out';

      // Update badge
      let badge = card.querySelector('.sold-badge, .new-badge');
      if (badge) badge.remove();
      if (data.sold_out) {
        const b = document.createElement('div');
        b.className = 'sold-badge'; b.textContent = 'Sold Out';
        card.querySelector('.card-img-wrap').prepend(b);
      }
    }
  }
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
      card.style.transition = 'opacity 0.3s,transform 0.3s';
      card.style.opacity    = '0';
      card.style.transform  = 'scale(0.94)';
      setTimeout(() => {
        card.remove();
        if (!document.querySelector('.product-card')) {
          document.getElementById('productGrid').innerHTML = `
            <div class="empty-state" id="emptyState">
              <div class="empty-ornament">✦</div>
              <p class="empty-title">The collection is being curated</p>
              <p class="empty-sub">New pieces will appear here soon.</p>
            </div>`;
        }
      }, 320);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  GHOST ADMIN — CATEGORY MANAGER
// ══════════════════════════════════════════════════════════════════════════
function openCatManager() {
  loadCatList();
  document.getElementById('catOverlay').classList.add('open');
  document.getElementById('catModal').classList.add('open');
}

function closeCatManager() {
  document.getElementById('catOverlay').classList.remove('open');
  document.getElementById('catModal').classList.remove('open');
}

async function loadCatList() {
  const res  = await fetch('/admin/categories');
  const cats = await res.json();
  const list = document.getElementById('catList');
  const sel  = document.getElementById('aCat');

  list.innerHTML = cats.map(c => `
    <div class="cat-item">
      <span>${c.name}</span>
      <button class="cat-del-btn" onclick="deleteCategory(${c.id},'${c.name}')">Remove</button>
    </div>`).join('');

  sel.innerHTML = cats.map(c =>
    `<option value="${c.name}">${c.name}</option>`
  ).join('');

  // Also update filter tabs
  const tabs = document.getElementById('catTabs');
  const existing = tabs.querySelector('[data-cat="all"]').outerHTML;
  tabs.innerHTML = existing + cats.map(c =>
    `<button class="cat-tab ${activeCat === c.name ? 'active' : ''}" data-cat="${c.name}" onclick="filterCat(this,'${c.name}')">${c.name}</button>`
   ).join('');
}

async function addCategory() {
  const input = document.getElementById('newCatInput');
  const name  = input.value.trim();
  if (!name) { alert('Please enter a category name.'); return; }

  const res = await fetch('/admin/categories/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });

  if (res.ok) {
    input.value = '';
    loadCatList();
  } else {
    const data = await res.json();
    alert(data.error || 'Could not add category.');
  }
}

async function deleteCategory(id, name) {
  if (!confirm(`Remove "${name}" from categories?`)) return;
  const res = await fetch(`/admin/categories/delete/${id}`, { method: 'DELETE' });
  if (res.ok) loadCatList();
}

// ══════════════════════════════════════════════════════════════════════════
//  UTILS
// ══════════════════════════════════════════════════════════════════════════
function fmt(n) {
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0 });
}
