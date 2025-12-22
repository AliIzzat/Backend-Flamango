// Google calls this function after the Maps JS API is loaded
function initMap() {
  const el = document.getElementById('map');
  if (!el) return; // no map element on this page

  // Read data-* attributes from the map container
  const custLat = parseFloat(el.dataset.custLat);
  const custLng = parseFloat(el.dataset.custLng);
  const rLat = parseFloat(el.dataset.restaurantLat);
  const rLng = parseFloat(el.dataset.restaurantLng);

  // Basic map centered on customer (fallback to Doha if missing)
  const center = (Number.isFinite(custLat) && Number.isFinite(custLng))
    ? { lat: custLat, lng: custLng }
    : { lat: 25.2854, lng: 51.5310 }; // default: Doha

  const map = new google.maps.Map(el, {
    zoom: 13,
    center
  });

  // Add markers if valid
  if (Number.isFinite(custLat) && Number.isFinite(custLng)) {
    new google.maps.Marker({
      position: { lat: custLat, lng: custLng },
      map,
      label: "C", // Customer
      title: "Customer Location"
    });
  }

  if (Number.isFinite(rLat) && Number.isFinite(rLng)) {
    new google.maps.Marker({
      position: { lat: rLat, lng: rLng },
      map,
      label: "R", // Restaurant
      title: "Restaurant Location"
    });
  }

  // Optional: draw a driving route between restaurant and customer
  if (Number.isFinite(custLat) && Number.isFinite(custLng) &&
      Number.isFinite(rLat) && Number.isFinite(rLng)) {
    const directionsService = new google.maps.DirectionsService();
    const directionsRenderer = new google.maps.DirectionsRenderer();
    directionsRenderer.setMap(map);

    directionsService.route(
      {
        origin: { lat: rLat, lng: rLng },
        destination: { lat: custLat, lng: custLng },
        travelMode: google.maps.TravelMode.DRIVING
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
          directionsRenderer.setDirections(result);
        } else {
          console.warn("Directions request failed:", status);
        }
      }
    );
  }
}

// Expose it globally so Google Maps can call it
window.initMap = initMap;













// function initMap() {
//   // Create the map with a default center
//   const map = new google.maps.Map(document.getElementById("map"), {
//     zoom: 15,
//     center: { lat: 25.2854, lng: 51.5310 }, // fallback center (Doha)
//     gestureHandling: "greedy"
//   });

//   // Try HTML5 geolocation
//   if (navigator.geolocation) {
//     navigator.geolocation.getCurrentPosition(
//       pos => {
//         const userLoc = {
//           lat: pos.coords.latitude,
//           lng: pos.coords.longitude
//         };

//         console.log("Accuracy (m):", pos.coords.accuracy, pos);

//         // Center the map at the user location
//         map.setCenter(userLoc);

//         // Place a marker
//         new google.maps.Marker({
//           position: userLoc,
//           map,
//           title: "Your Location"
//         });

//         // Draw accuracy circle
//         new google.maps.Circle({
//           map,
//           center: userLoc,
//           radius: pos.coords.accuracy,
//           fillOpacity: 0.15,
//           strokeOpacity: 0.4
//         });
//       },
//       err => {
//         console.error("Geolocation error:", err);
//         alert("Could not get your location. Showing default center.");
//       },
//       { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
//     );
//   } else {
//     alert("Geolocation not supported by this browser.");
//   }
//   window.initMap = initMap;
// }
