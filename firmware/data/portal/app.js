/* ioTech Captive Portal — app.js */

(function () {
  'use strict';

  var form    = document.getElementById('provision-form');
  var errDiv  = document.getElementById('error-msg');

  function showError(msg) {
    errDiv.textContent = msg;
    errDiv.style.display = 'block';
  }

  function hideError() {
    errDiv.style.display = 'none';
  }

  form.addEventListener('submit', function (e) {
    hideError();

    var ssid        = document.getElementById('ssid').value.trim();
    var claimToken  = document.getElementById('claim_token').value.trim();
    var backendUrl  = document.getElementById('backend_url').value.trim();

    if (!ssid) {
      e.preventDefault();
      showError('WiFi network name (SSID) is required.');
      return;
    }

    if (!claimToken) {
      e.preventDefault();
      showError('Claim token is required.');
      return;
    }

    if (!backendUrl) {
      e.preventDefault();
      showError('Backend URL is required.');
      return;
    }

    /* Basic URL format check */
    if (!backendUrl.startsWith('http://') && !backendUrl.startsWith('https://')) {
      e.preventDefault();
      showError('Backend URL must start with http:// or https://');
      return;
    }

    /* Let the form submit naturally to POST /provision */
  });
})();
