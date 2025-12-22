// cart-add.js (lean)
(() => {
  if (window.__CART_ADD_BOUND__) return;
  window.__CART_ADD_BOUND__ = true;
 // console.log('[cart-add] bound');

  // 1) Optional AJAX add-to-cart: runs ONLY if the form has data-ajax="true"
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.add-to-cart');
    if (!btn) return;

    const form = btn.closest('form');
    const ajax = form && form.dataset.ajax === 'true';
    if (!ajax) return;               // ✅ no AJAX? let the normal form submit/redirect

    e.preventDefault();
    e.stopPropagation();

    const mealId = form.querySelector('input[name="mealId"]')?.value || btn.dataset.id;
    const qty    = Number(form.querySelector('input[name="qty"]')?.value || 1);

    try {
      const res = await fetch('/cart/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin',
        body: JSON.stringify({ mealId, qty })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error('add failed');

      // tiny feedback + optional badge update
      const old = btn.textContent; btn.textContent = 'Added ✓';
      setTimeout(() => (btn.textContent = old), 900);
      const badge = document.querySelector('.cart-badge');
      if (badge) badge.textContent = (data.count ?? data.summary?.count ?? '').toString();
    } catch (err) {
      console.error('[cart-add] fetch error', err);
      alert('❌ Could not reach server');
    }
  });

  // 2) Heart toggle (kept, delegated)
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.heart-icon');
    if (!btn) return;
    e.preventDefault(); e.stopPropagation();

    const mealId = btn.dataset.id;
    try {
      const res = await fetch('/favorites/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mealId })
      });
      if (!res.ok) return;

      const path = btn.querySelector('svg path');
      const isFav = path.getAttribute('fill') === 'red';
      if (isFav) {
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'red');
        path.setAttribute('stroke-width', '2');
      } else {
        path.setAttribute('fill', 'red');
        path.removeAttribute('stroke');
        path.removeAttribute('stroke-width');
      }
    } catch (err) {
      console.error('[cart-add] heart toggle error', err);
    }
  });
})();
