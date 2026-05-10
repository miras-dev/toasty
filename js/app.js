(function () {
  'use strict';

  function setActiveNav() {
    var page = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.sb-navigation li').forEach(function (li) {
      li.classList.remove('sb-active');
    });
    // Top-level links
    document.querySelectorAll('.sb-navigation > li > a').forEach(function (link) {
      if (link.getAttribute('href') === page) {
        link.parentElement.classList.add('sb-active');
      }
    });
    // Dropdown links — mark child li and parent sb-has-children as active
    document.querySelectorAll('.sb-navigation > li ul li a').forEach(function (link) {
      if (link.getAttribute('href') === page) {
        link.parentElement.classList.add('sb-active');
        var parent = link.closest('.sb-has-children');
        if (parent) parent.classList.add('sb-active');
      }
    });
  }

  function initCookieBanner() {
    var banner = document.getElementById('tt-cookie-banner');
    if (!banner) return;
    if (localStorage.getItem('tt-cookies') !== null) return;

    banner.classList.add('tt-visible');

    var acceptBtn = document.getElementById('tt-accept-cookies');
    var declineBtn = document.getElementById('tt-decline-cookies');

    if (acceptBtn) {
      acceptBtn.addEventListener('click', function () {
        localStorage.setItem('tt-cookies', 'accepted');
        banner.classList.remove('tt-visible');
      });
    }
    if (declineBtn) {
      declineBtn.addEventListener('click', function () {
        localStorage.setItem('tt-cookies', 'declined');
        banner.classList.remove('tt-visible');
      });
    }
  }

  setActiveNav();
  initCookieBanner();

  document.addEventListener('swup:contentReplaced', function () {
    setActiveNav();
  });
})();
