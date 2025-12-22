document.addEventListener('DOMContentLoaded', () => {
  // 1️⃣ Handle quantity input updates
  document.querySelectorAll('.quantity-input').forEach(input => {
    input.addEventListener('input', () => {
      const mealId = input.dataset.id;
      const quantity = parseInt(input.value) || 1;
      fetch('/cart/update-quantities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mealId, quantity })
      }).then(res => {
        if (!res.ok) {
          console.error('❌ Failed to update cart quantity');
        }
      });
    });
  });

  // 2️⃣ Increment/Decrement buttons
  document.querySelectorAll(".quantity-wrapper").forEach(wrapper => {
    const input = wrapper.querySelector(".quantity-input");
    const incrementBtn = wrapper.querySelector(".increment");
    const decrementBtn = wrapper.querySelector(".decrement");

    incrementBtn.addEventListener("click", () => {
      let current = parseInt(input.value) || 1;
      if (current < 100) input.value = current + 1;
      input.dispatchEvent(new Event('input'));
    });

    decrementBtn.addEventListener("click", () => {
      let current = parseInt(input.value) || 1;
      if (current > 1) input.value = current - 1;
      input.dispatchEvent(new Event('input'));
    });
  });

  // 3️⃣ Remove button
  const removeButton = document.querySelector("#remove-button");
  if (removeButton) {
    removeButton.addEventListener("click", () => {
      fetch('/cart/remove-selected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
        .then(res => {
          if (res.ok) {
            location.reload();
          } else {
            console.error("❌ Failed to remove items");
          }
        })
        .catch(err => {
          console.error("❌ Error removing items:", err);
        });
    });
  }
});

// 4️⃣ Track navigation behavior
let navigationType = null;

window.addEventListener("load", () => {
  const nav = performance.getEntriesByType("navigation")[0];
  if (nav?.type === "reload") {
    navigationType = "refresh";
  } else if (nav?.type === "navigate") {
    navigationType = "navigation";
  } else {
    navigationType = "initial-load";
  }
});

document.addEventListener("click", (e) => {
  if (e.target.tagName === 'A' && e.target.origin === location.origin) {
    navigationType = "navigation";
  }
});

window.addEventListener("beforeunload", () => {
  if (navigationType === "refresh") {
    //console.log("🔄 Refreshing cart page");
  } else if (navigationType === "navigation") {
   // console.log("➡️ Navigating away from cart");
  } else {
    //console.log("❌ Closing tab/browser on cart page");
    navigator.sendBeacon("/session/clear-cart");
  }
});
