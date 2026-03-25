/* ═══════════════════════════════════════════════════
   JULIART NG — App Logic 2026
   Clean version — no auth, touch swipe gallery
   ═══════════════════════════════════════════════════ */
'use strict';

// ── State ──────────────────────────────────────────────────────────────────
let currentProduct = null;
let cartState      = { items: [], total: 0, count: 0 };
let galleryImages  = [];
let galleryIndex   = 0;
let uploadedUrls   = { 1: null, 2: null, 3: null, 4: null };
let activeCat      = 'all';

// Touch swipe state
let touchStartX = 0;
let touchEndX   = 0;

// ── Boot ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  refreshCart();
});

// ══════════════════════════════════════════════════════════════════════════
//  CART
// ══════════════════════════════════════════════════════════════════════════
async function refreshCart() {
  try {
    const res = await fetch('/cart');
    cartState = await res.json();
    updateFAB(cartState.count);
  } catch(e) {}
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
  applyFilters();
}

function applyFilters() {
  const search  = (document.getElementById('searchInput').value || '').toLowerCase().trim();
  const cards   = document.querySelectorAll('.product-card');
  let   visible = 0;

  cards.forEach(card => {
    const name   = (card.dataset.name || '').toLowerCase();
    const cat    = card.dataset.category || '';
    const matchS = !search || name.includes(search);
    const matchC = activeCat === 'all' || cat === activeCat;
    if (matchS && matchC) { card.style.display = ''; visible++; }
    else                  { card.style.display = 'none'; }
  });

  const noRes = document.getElementById('noResults');
  if (noRes) {
    noRes.style.display = (visible === 0 && cards.length > 0) ? 'block' : 'none';
    const st = document.getElementById('searchTerm');
    if (st) st.textContent = search || activeCat;
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  VELVET TRAY
// ══════════════════════════════════════════════════════════════════════════
function openTray(el) {
  let images = [];
  try { images = JSON.parse(el.dataset.images || '[]'); } catch(e) {}
  images = images.filter(Boolean);
  if (!images.length) return;

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
  const inCart = cartState.items.some(i => String(i.id) === String(currentProduct.id));
  const addBtn = document.getElementById('trayAdd');
  const remBtn = document.getElementById('trayRemove');
  const notice = document.getElementById('soldOutNotice');

  if (currentProduct.soldOut) {
    addBtn.style.display = 'block';
    addBtn.disabled      = true;
    notice.style.display = 'block';
    remBtn.style.display = 'none';
  } else {
    addBtn.disabled      = false;
    notice.style.display = 'none';
    addBtn.style.display = inCart ? 'none'  : 'block';
    remBtn.style.display = inCart ? 'block' : 'none';
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  IMAGE GALLERY — TOUCH SWIPE FIXED
// ══════════════════════════════════════════════════════════════════════════
function buildGallery(images) {
  galleryImages = images;
  galleryIndex  = 0;

  const track = document.getElementById('trayTrack');
  const dots  = document.getElementById('trayDots');
  const prev  = document.getElementById('trayPrev');
  const next  = document.getElementById('trayNext');

  // Build slides
  track.innerHTML = '';
  track.style.width = (images.length * 100) + '%';
  images.forEach(src => {
    const slide = document.createElement('div');
    slide.className = 'tray-slide';
    slide.style.width = (100 / images.length) + '%';
    const img = document.createElement('img');
    img.src = src;
    img.alt = 'product';
    slide.appendChild(img);
    track.appendChild(slide);
  });

  // Build dots
  dots.innerHTML = '';
  if (images.length > 1) {
    images.forEach((_, i) => {
      const dot = document.createElement('div');
      dot.className = 'tray-dot' + (i === 0 ? ' active' : '');
      dot.onclick   = () => goToSlide(i);
      dots.appendChild(dot);
    });
  }

  // Arrows
  const show = images.length > 1;
  if (prev) prev.style.display = show ? 'flex' : 'none';
  if (next) next.style.display = show ? 'flex' : 'none';

  // Touch events
  const wrap = document.querySelector('.tray-track-wrap');
  if (wrap) {
    wrap.removeEventListener('touchstart', onTouchStart);
    wrap.removeEventListener('touchend',   onTouchEnd);
    wrap.addEventListener('touchstart', onTouchStart, { passive: true });
    wrap.addEventListener('touchend',   onTouchEnd,   { passive: true });
  }

  updateGalleryPosition();
}

function onTouchStart(e) {
  touchStartX = e.changedTouches[0].screenX;
}

function onTouchEnd(e) {
  touchEndX = e.changedTouches[0].screenX;
  const diff = touchStartX - touchEndX;
  if (Math.abs(diff) > 40) {
    if (diff > 0) galleryNext();
    else          galleryPrev();
  }
}

function updateGalleryPosition() {
  const track = document.getElementById('trayTrack');
  if (track) {
    track.style.transform = `translateX(-${galleryIndex * (100 / galleryImages.length)}%)`;
  }
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

  const reader = new FileReader();
  reader.onload = e => {
    const prev = document.getElementById(`prev${n}`);
    prev.src = e.target.result;
    prev.style.display = 'block';
    document.querySelector(`#slot${n} .slot-placeholder`).style.display = 'none';
  };
  reader.readAsDataURL(file);

  const status = document.getElementById(`status${n}`);
  status.textContent = 'Uploading…';
  status.classList.add('show');

  const form = new FormData();
  form.append('image', file);

  try {
    const res = await fetch('/admin/upload', { method: 'POST', body: form });
    if (res.ok) {
      const data      = await res.json();
      uploadedUrls[n] = data.url;
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

  if (!name)                { alert('Please enter the piece name.');   return; }
  if (!price || price <= 0) { alert('Please enter a valid price.');    return; }

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
    const st = document.getElementById(`status${n}`);
    st.textContent = ''; st.classList.remove('show');
    uploadedUrls[n] = null;
  });
}

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
//  GHOST ADMIN — SOLD OUT & DELETE
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
      const badge = card.querySelector('.sold-badge, .new-badge');
      if (badge) badge.remove();
      if (data.sold_out) {
        const b = document.createElement('div');
        b.className = 'sold-badge'; b.textContent = 'Sold Out';
        card.querySelector('.card-img-wrap').prepend(b);
      }
    }
  }
}

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
//  CATEGORY MANAGER
// ══════════════════════════════════════════════════════════════════════════
async function openCatManager() {
  await loadCatManagerList();
  document.getElementById('catManagerOverlay').classList.add('open');
  document.getElementById('catManagerPopup').classList.add('open');
}

function closeCatManager() {
  document.getElementById('catManagerOverlay').classList.remove('open');
  document.getElementById('catManagerPopup').classList.remove('open');
  const inp = document.getElementById('newCatInput');
  if (inp) inp.value = '';
}

async function loadCatManagerList() {
  const res  = await fetch('/admin/categories');
  const cats = await res.json();
  const list = document.getElementById('catManagerList');
  if (!cats.length) {
    list.innerHTML = '<p style="color:var(--brown-lite);font-size:13px;padding:8px 0">No categories yet.</p>';
    return;
  }
  list.innerHTML = cats.map(c =>
    `<div class="cat-manager-item">
      <span>${c.name}</span>
      <button class="cat-manager-del" onclick="deleteCatFromManager(${c.id},'${c.name}')">Remove</button>
    </div>`
  ).join('');
}

async function addCategoryFromManager() {
  const input = document.getElementById('newCatInput');
  const name  = input.value.trim();
  if (!name) { alert('Please enter a category name.'); return; }
  const res = await fetch('/admin/categories/add', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  if (res.ok) { input.value = ''; await loadCatManagerList(); window.location.reload(); }
  else { const d = await res.json(); alert(d.error || 'Could not add.'); }
}

async function deleteCatFromManager(id, name) {
  if (!confirm(`Remove "${name}" from categories?`)) return;
  const res = await fetch(`/admin/categories/delete/${id}`, { method: 'DELETE' });
  if (res.ok) { await loadCatManagerList(); window.location.reload(); }
}

document.addEventListener('DOMContentLoaded', () => {
  const field = document.getElementById('newCatInput');
  if (field) field.addEventListener('keydown', e => { if (e.key === 'Enter') addCategoryFromManager(); });
});

// ══════════════════════════════════════════════════════════════════════════
//  UTILS
// ══════════════════════════════════════════════════════════════════════════
function fmt(n) {
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0 });
     }
