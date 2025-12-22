console.log('menu click handler loaded');

document.addEventListener('click', async (e) => {
  if (e.target.closest('.heart-icon')) return; // ignore ❤️

  const card = e.target.closest('.meal-card');
  if (!card) return;

  e.preventDefault();

  const mealId = card.dataset.mealId || card.getAttribute('data-meal-id');
  console.log('meal card clicked:', mealId);
  if (!mealId) return console.warn('No meal id on card');

  try {
    const res = await fetch('/cart/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      credentials: 'same-origin',
      body: JSON.stringify({ mealId, qty: 1 })
    });

    const data = await res.json();
    console.log('cart/add response:', data);
    if (!res.ok || !data.success) throw new Error(data.error || `Add failed (${res.status})`);

       // 🔔 Fire global event so miniCart.js + header counters can update
    window.dispatchEvent(new CustomEvent('cart:updated', {
      detail: { summary: data.summary }
    }));


  } catch (err) {
    console.error('Add to cart error:', err);
    alert('Could not add to cart.');
  }
});
