document.addEventListener('DOMContentLoaded', function () {
  const checkbox = document.getElementById('addLogoCheckbox');
  const fileInput = document.getElementById('restaurantLogo');
  const nameInput = document.getElementById('restaurant_en');      // For display/slug
  const restaurantField = document.getElementById('restaurant');   // For submission
  const addressInput = document.getElementById('restaurantAddress');
  const detailsInput = document.querySelector('input[name="details"]');

  // Clear session on load
  sessionStorage.removeItem('restaurantName');
  sessionStorage.removeItem('restaurantAddress');
  sessionStorage.removeItem('foodDetails');

  // Save on blur or Enter
  addressInput.addEventListener('blur', saveAddress);
  detailsInput.addEventListener('blur', saveDetails);

  addressInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveAddress();
    }
  });

  detailsInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveDetails();
    }
  });

  function saveAddress() {
    const val = addressInput.value.trim();
    if (val !== '') {
      sessionStorage.setItem('restaurantAddress', val);
      addressInput.readOnly = true;
      addressInput.style.backgroundColor = '#f0f0f0';
    }
  }

  function saveDetails() {
    const val = detailsInput.value.trim();
    if (val !== '') {
      sessionStorage.setItem('foodDetails', val);
      detailsInput.readOnly = true;
      detailsInput.style.backgroundColor = '#f0f0f0';
    }
  }

  // When logo file is selected
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0 && checkbox.checked) {
      const fileName = fileInput.files[0].name.split('.')[0];

      nameInput.value = fileName;
      nameInput.readOnly = true;
      nameInput.style.backgroundColor = '#f0f0f0';

      restaurantField.value = fileName;
      restaurantField.readOnly = true;
      restaurantField.style.backgroundColor = '#f0f0f0';

      sessionStorage.setItem('restaurantName', fileName);
    }
  });

  // Handle checkbox toggle
  checkbox.addEventListener('change', () => {
    if (checkbox.checked) {
      fileInput.disabled = false;
      fileInput.style.opacity = '1';
      fileInput.style.cursor = 'pointer';
    } else {
      fileInput.disabled = true;
      fileInput.value = '';
      fileInput.style.opacity = '0.4';
      fileInput.style.cursor = 'not-allowed';

      // Reset only if previously auto-filled
      if (sessionStorage.getItem('restaurantName')) {
        nameInput.value = '';
        restaurantField.value = '';
        sessionStorage.removeItem('restaurantName');
      }

      nameInput.readOnly = false;
      nameInput.style.backgroundColor = '';
      restaurantField.readOnly = false;
      restaurantField.style.backgroundColor = '';
      addressInput.readOnly = false;
      addressInput.style.backgroundColor = '';
      detailsInput.readOnly = false;
      detailsInput.style.backgroundColor = '';
    }
  });

  // Restore session-stored values
  if (sessionStorage.getItem('restaurantAddress')) {
    addressInput.value = sessionStorage.getItem('restaurantAddress');
    addressInput.readOnly = true;
    addressInput.style.backgroundColor = '#f0f0f0';
  }

  if (sessionStorage.getItem('restaurantName')) {
    const saved = sessionStorage.getItem('restaurantName');

    nameInput.value = saved;
    nameInput.readOnly = true;
    nameInput.style.backgroundColor = '#f0f0f0';

    restaurantField.value = saved;
    restaurantField.readOnly = true;
    restaurantField.style.backgroundColor = '#f0f0f0';

    checkbox.checked = true;
    fileInput.disabled = false;
    fileInput.style.opacity = '1';
    fileInput.style.cursor = 'pointer';
  }

  if (sessionStorage.getItem('foodDetails')) {
    detailsInput.value = sessionStorage.getItem('foodDetails');
    detailsInput.readOnly = true;
    detailsInput.style.backgroundColor = '#f0f0f0';
  }

  // Final safety: block submit if restaurant name is empty
  document.querySelector('form').addEventListener('submit', function (e) {
    if (restaurantField.value.trim() === '') {
      alert('Restaurant name is required.');
      e.preventDefault();
    }
  });
});
