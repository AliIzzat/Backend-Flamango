window.addEventListener("DOMContentLoaded", () => {
  const hash = window.location.hash;
  if (!hash) return;

  const mealId = hash.replace('#', '');
  const target = document.getElementById(mealId);

  if (target) {
    const imageWrapper = target.querySelector('.image-wrapper');
    if (imageWrapper) {
      imageWrapper.classList.add('selected');
    }

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});
