window.addEventListener('DOMContentLoaded', () => {
  const track = document.getElementById('carouselTrack');
  const items = document.querySelectorAll('.carousel-item');
  let index = 0;

  const itemWidth = items[0].offsetWidth;

  // Clone first slide to allow looping
  items.forEach(item => track.appendChild(item.cloneNode(true)));

  setInterval(() => {
    index++;
    track.style.transition = 'transform 0.6s ease-in-out';
    track.style.transform = `translateX(-${itemWidth * index}px)`;

    if (index >= items.length) {
      setTimeout(() => {
        track.style.transition = 'none';
        track.style.transform = 'translateX(0)';
        index = 0;
      }, 600);
    }
  }, 3000); // Every 3 seconds
});
