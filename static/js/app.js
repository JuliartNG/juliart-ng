/* ═══════════════════════════════════════════════════
   JULIART NG — App Logic 2026
   ═══════════════════════════════════════════════════ */
'use strict';

// ── State ──────────────────────────────────────────────────────────────────
let currentProduct = null;
let cartState      = { items: [], total: 0, count: 0 };
let galleryImages  = [];
let galleryIndex   = 0;
let uploadedUrls   = { 1: null, 2: null, 3: null, 4: null };
let activeCat      = 'all';

// ── Boot ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  refreshCart();
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
    const name     = (card.dataset.name || '').toLowerCase();
    const cat      = card.dataset.category || '';
    const matchS   = !search || name.includes(search);
    const matchC   = activeCat === 'all' || cat === activeCat;

    if (matchS && matchC) {
      card.style.display = '';
      visible++;
    } else {
      card.style.display = 'none';
    }
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
  const inCart  = cartState.items.some(i => String(i.id) === String(currentProduct.id));
  const addBtn  = document.getElementById('trayAdd');
  const remBtn  = document.getElementById('trayRemove');
  const notice  = document.getElementById('soldOutNotice');
  const wishBtn = document.getElementById('trayWish');

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

  // Sync wish button
  const wishCard = document.querySelector(`.wish-btn[data-id="${currentProduct.id}"]`);
  const wished   = wishCard ? wishCard.classList.contains('wished') : false;
  wishBtn.textContent = wished ? '♥ Saved' : '♡ Save';
  wishBtn.classList.toggle('wished', wished);
}

// ══════════════════════════════════════════════════════════════════════════
//  IMAGE GALLERY — FIXED
// ══════════════════════════════════════════════════════════════════════════
function buildGallery(images) {
  galleryImages = images;
  galleryIndex  = 0;

  const track = document.getElementById('trayTrack');
  const dots  = document.getElementById('trayDots');
  const prev  = document.querySelector('.tray-prev');
  const next  = document.querySelector('.tray-next');

  // Build slides
  track.innerHTML = '';
  images.forEach(src => {
    const img = document.createElement('img');
    img.src   = src;
    img.alt   = 'product photo';
    img.style.cssText = 'width:100%;flex-shrink:0;object-fit:cover;';
    track.appendChild(img);
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

  // Show/hide arrows
  const showArrows = images.length > 1;
  if (prev) prev.style.display = showArrows ? 'flex' : 'none';
  if (next) next.style.display = showArrows ? 'flex' : 'none';

  updateGalleryPosition();
}

function updateGalleryPosition() {
  const track = document.getElementById('trayTrack');
  if (track) track.style.transform = `translateX(-${galleryIndex * 100}%)`;
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
function updateWishlistNav() {
  const btn   = document.getElementById('wishlistNavBtn');
  const count = document.getElementById('wishlistCount');
  if (!btn || !IS_LOGGEDIN) return;
  // Count wished items from DOM
  const wishedCount = document.querySelectorAll('.wish-btn.wished').length;
  count.textContent = wishedCount;
}

async function toggleWish(e, pid) {
  e.stopPropagation();

  if (!IS_LOGGEDIN) {
    openLoginPrompt();
    return;
  }

  const res = await fetch(`/wishlist/toggle/${pid}`, { method: 'POST' });
  if (res.ok) {
    const data = await res.json();
    const btn  = document.querySelector(`.wish-btn[data-id="${pid}"]`);
    if (btn) {
      btn.classList.toggle('wished', data.wishlisted);
      btn.textContent = data.wishlisted ? '♥' : '♡';
    }
    updateWishlistNav();
    // sync tray wish button if open
    if (currentProduct && String(currentProduct.id) === String(pid)) {
      const wishBtn = document.getElementById('trayWish');
      if (wishBtn) {
        wishBtn.textContent = data.wishlisted ? '♥ Saved' : '♡ Save';
        wishBtn.classList.toggle('wished', data.wishlisted);
      }
    }
  }
}

async function toggleWishTray() {
  if (!currentProduct) return;
  await toggleWish({ stopPropagation: () => {} }, currentProduct.id);
}

async function openWishlist() {
  const container = document.getElementById('wishlistItems');
  container.innerHTML = '<p style="color:var(--brown-lite);padding:20px 0;font-size:14px">Loading…</p>';

  document.getElementById('wishlistOverlay').classList.add('open');
  document.getElementById('wishlistSheet').classList.add('open');
  document.body.style.overflow = 'hidden';

  try {
    const res     = await fetch('/wishlist');
    const products = await res.json();

    if (!products.length) {
      container.innerHTML = '<div class="wish-empty">No saved pieces yet.<br/>Tap ♡ on any piece to save it.</div>';
      return;
    }

    container.innerHTML = products.map(p => `
      <div class="wish-item" onclick="closeWishlist();setTimeout(()=>{
        const c=document.querySelector('.product-card[data-id=\\'${p.id}\\']');
        if(c)openTray(c);},300)">
        <img src="${p.image}" alt="${p.name}"/>
        <div class="wish-item-info">
          <div class="wish-item-name">${p.name}</div>
          <div class="wish-item-price">₦${fmt(p.price)}</div>
        </div>
        <button class="wish-remove" onclick="event.stopPropagation();toggleWish(event,${p.id}).then(()=>openWishlist())">✕</button>
      </div>`).join('');
  } catch(e) {
    container.innerHTML = '<p style="color:#c62828;padding:20px 0;font-size:13px">Could not load wishlist.</p>';
  }
}

function closeWishlist() {
  document.getElementById('wishlistOverlay').classList.remove('open');
  document.getElementById('wishlistSheet').classList.remove('open');
  document.body.style.overflow = '';
}

// Login prompt for non-logged-in users trying to wish
function openLoginPrompt() {
  document.getElementById('loginPromptOverlay').classList.add('open');
  document.getElementById('loginPromptPopup').classList.add('open');
}
function closeLoginPrompt() {
  document.getElementById('loginPromptOverlay').classList.remove('open');
  document.getElementById('loginPromptPopup').classList.remove('open');
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
//  CATEGORY INLINE MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════
let activeCatMenuId   = null;
let activeCatMenuName = null;
let catInputMode      = null;

document.addEventListener('click', e => {
  const menu = document.getElementById('catMenuPopup');
  if (menu && menu.classList.contains('show')) {
    if (!menu.contains(e.target) && !e.target.classList.contains('cat-edit-btn')) {
      menu.classList.remove('show');
    }
  }
});

function openCatMenu(e, id, name) {
  e.stopPropagation();
  activeCatMenuId   = id;
  activeCatMenuName = name;

  const menu = document.getElementById('catMenuPopup');
  const rect = e.target.getBoundingClientRect();

  // Position below the button, clamped to screen
  const top  = rect.bottom + window.scrollY + 6;
  const left = Math.min(rect.left + window.scrollX, window.innerWidth - 170);

  menu.style.top  = top  + 'px';
  menu.style.left = left + 'px';
  menu.classList.add('show');
}

function openAddCat() {
  catInputMode = 'add';
  document.getElementById('catInputTitle').textContent   = 'Add Category';
  document.getElementById('catInputConfirm').textContent = 'Add';
  document.getElementById('catInputField').value         = '';
  showCatInput();
}

function openEditCat() {
  document.getElementById('catMenuPopup').classList.remove('show');
  catInputMode = 'edit';
  document.getElementById('catInputTitle').textContent   = 'Edit Category Name';
  document.getElementById('catInputConfirm').textContent = 'Save';
  document.getElementById('catInputField').value         = activeCatMenuName;
  showCatInput();
}

function showCatInput() {
  document.getElementById('catInputOverlay').classList.add('show');
  document.getElementById('catInputPopup').classList.add('show');
  setTimeout(() => document.getElementById('catInputField').focus(), 150);
}

function closeCatInput() {
  document.getElementById('catInputOverlay').classList.remove('show');
  document.getElementById('catInputPopup').classList.remove('show');
  catInputMode = null;
}

async function confirmCatInput() {
  const name = document.getElementById('catInputField').value.trim();
  if (!name) { alert('Please enter a category name.'); return; }

  if (catInputMode === 'add') {
    const res = await fetch('/admin/categories/add', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (res.ok) { closeCatInput(); window.location.reload(); }
    else { const d = await res.json(); alert(d.error || 'Could not add.'); }

  } else if (catInputMode === 'edit') {
    const del = await fetch(`/admin/categories/delete/${activeCatMenuId}`, { method: 'DELETE' });
    if (del.ok) {
      const add = await fetch('/admin/categories/add', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (add.ok) { closeCatInput(); window.location.reload(); }
    }
  }
}

async function confirmDeleteCat() {
  document.getElementById('catMenuPopup').classList.remove('show');
  if (!confirm(`Delete "${activeCatMenuName}"?`)) return;
  const res = await fetch(`/admin/categories/delete/${activeCatMenuId}`, { method: 'DELETE' });
  if (res.ok) window.location.reload();
}

// Enter key support in category input
document.addEventListener('DOMContentLoaded', () => {
  const field = document.getElementById('catInputField');
  if (field) {
    field.addEventListener('keydown', e => {
      if (e.key === 'Enter')  confirmCatInput();
      if (e.key === 'Escape') closeCatInput();
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  UTILS
// ══════════════════════════════════════════════════════════════════════════
function fmt(n) {
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0 });
}
