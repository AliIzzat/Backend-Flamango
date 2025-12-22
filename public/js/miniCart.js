// public/js/miniCart.js
(function () {
  const $panel = document.getElementById('miniCart');
  const $list  = document.getElementById('miniCartList');
  const $total = document.getElementById('miniCartTotal');
  const $fab   = document.getElementById('miniCartFab');
  const $close = document.getElementById('miniCartClose');

  // Counters: header badge (#cart-count) + FAB badge (#miniCartCount) + any .js-cart-count
  function updateCounts(count) {
    const n = Number(count) || 0;
    const els = [
      ...document.querySelectorAll('.js-cart-count'),
      document.getElementById('cart-count'),
      document.getElementById('miniCartCount'),
    ].filter(Boolean);

    els.forEach(el => {
      el.textContent = String(n);
      el.style.transition = 'transform 120ms ease';
      el.style.transform = 'scale(1.2)';
      setTimeout(() => (el.style.transform = 'scale(1)'), 130);
    });
  }

  // ----- checkout form bits -----
  const $miniForm = document.getElementById('miniCartCheckoutForm');
  const $miniLat  = document.getElementById('miniLatitude');
  const $miniLng  = document.getElementById('miniLongitude');
  const $miniBtn  = document.getElementById('miniCheckoutBtn');

  function syncLatLng() {
    const pageLat = document.getElementById('latitude')?.value;
    const pageLng = document.getElementById('longitude')?.value;
    if ($miniLat && $miniLng && pageLat && pageLng) {
      $miniLat.value = pageLat;
      $miniLng.value = pageLng;
      return;
    }
    if (navigator.geolocation && $miniLat && $miniLng) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          $miniLat.value = pos.coords.latitude;
          $miniLng.value = pos.coords.longitude;
        },
        () => {}
      );
    }
  }

  // ----- render -----
  window.renderMiniCart = function (summary) {
    const safe = summary && typeof summary === 'object' ? summary : { items: [], total: 0, count: 0 };
    const items = Array.isArray(safe.items) ? safe.items : [];

    if ($list) {
      $list.innerHTML = items.length
        ? items.map(i => `
            <li class="mini-row" data-id="${i.id}">
              <span class="name">${i.name}</span>
              <span class="qty-controls">
                <button class="qty-btn" data-cart-dec data-id="${i.id}" aria-label="Decrease">−</button>
                <span class="qty">×${i.qty}</span>
                <button class="qty-btn" data-cart-inc data-id="${i.id}" aria-label="Increase">+</button>
              </span>
              <span class="line">QR ${i.lineTotal}</span>
            </li>
          `).join('')
        : `<li class="mini-cart__empty">Your cart is empty</li>`;
    }

    if ($total) $total.textContent = `QR ${safe.total || 0}`;

    // Enable/disable checkout
    if ($miniBtn) {
      const disabled = items.length === 0;
      $miniBtn.disabled = disabled;
      $miniBtn.classList.toggle('disabled', disabled);
    }

    // Update ALL counters (header, fab, any .js-cart-count)
    updateCounts(safe.count);
  };

  // ----- open/close -----
  window.openCart  = () => { if ($panel) { $panel.classList.remove('hidden'); $panel.setAttribute('aria-hidden', 'false'); } };
  window.closeCart = () => { if ($panel) { $panel.classList.add('hidden');   $panel.setAttribute('aria-hidden', 'true');  } };

  $fab?.addEventListener('click', openCart);
  $close?.addEventListener('click', closeCart);

  // ----- hydrate on load / BFCache restore -----
  window.addEventListener('pageshow', async () => {
    syncLatLng();
    try {
      const r = await fetch('/cart/mini', { credentials: 'same-origin', headers: { 'Accept': 'application/json' } });
      const d = await r.json();
      renderMiniCart(d.summary);
    } catch {
      renderMiniCart({ items: [], total: 0, count: 0 });
    }
  });

  // ----- guard checkout -----
  $miniForm?.addEventListener('submit', (e) => {
    // if you rely on header badge, also look for any counter
    const anyCountEl = document.getElementById('miniCartCount') || document.getElementById('cart-count');
    const hasItems = Number(anyCountEl?.textContent || '0') > 0;
    if (!hasItems) {
      e.preventDefault();
      return;
    }
    syncLatLng();
  });

  // ----- quantity +/- inside popup -----
  document.addEventListener('click', async (e) => {
    const inc = e.target.closest('[data-cart-inc]');
    const dec = e.target.closest('[data-cart-dec]');
    if (!inc && !dec) return;

    const mealId = (inc || dec).dataset.id;
    const delta = inc ? +1 : -1;

    try {
      const r = await fetch('/cart/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ mealId, delta })
      });
      const d = await r.json();
      if (!d?.success) throw new Error(d?.message || 'Update failed');
      renderMiniCart(d.summary); // totals + lines refresh here
      // broadcast so other UI (e.g., header on other partials) can react
      window.dispatchEvent(new CustomEvent('cart:updated', { detail: { summary: d.summary } }));
    } catch (err) {
      console.error('qty update failed', err);
      fetch('/cart/mini', { headers: { 'Accept': 'application/json' } })
        .then(r => r.json())
        .then(d => renderMiniCart(d.summary));
      alert('Could not update quantity.');
    }
  });

  // ----- react to global updates (e.g., /cart/add from menu.js) -----
  window.addEventListener('cart:updated', (e) => {
    const { summary } = e.detail || {};
    if (summary) renderMiniCart(summary);
  });
})();
