// map.js
function initGeo() {
  navigator.geolocation.getCurrentPosition(
    pos => console.log('Accuracy (m):', pos.coords.accuracy, pos),
    err => console.error(err),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );

  const watchId = navigator.geolocation.watchPosition(
    pos => console.log('Watch accuracy:', pos.coords.accuracy),
    err => console.error(err),
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
  );
}
