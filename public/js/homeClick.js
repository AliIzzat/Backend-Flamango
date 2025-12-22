alert("Script is running");

document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll('.meal-card').forEach(card => {
    card.addEventListener('click', function () {
      const restaurant = encodeURIComponent(card.dataset.restaurant?.trim());
      const mealId = card.dataset.id;
      if (restaurant && mealId) {
        window.location.href = `/restaurant/${restaurant}#${mealId}`;
      }
    });
  });
});
