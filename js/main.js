/* Toasty Turtle Cafe */

$(function () {

  "use strict";

  // Replace with the deployed Google Apps Script Web App URL
  var GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyixU1lqYkSUjvm_JwNaSh6OlzYc1PsE2y6eyXYPDPkMBRZ8aAlYVIonvoEm_O_gqsZkA/exec';


  var datepickerConfig = {
    minDate: new Date(),
    timepicker: true,
    onSelect: function (fd, date, inst) {
      if (!date) return;
      var hours = date.getHours();
      var minutes = date.getMinutes();
      var isWeekend = (date.getDay() === 0 || date.getDay() === 6);
      var openHour = isWeekend ? 9 : 8;
      var closeHour = isWeekend ? 23 : 22;
      if (hours < openHour) {
        date.setHours(openHour, 0, 0, 0);
        inst.selectedHour = openHour;
        inst.selectedMinutes = 0;
        inst._setCurrentTime(date);
        inst._updateDatepicker();
      } else if (hours > closeHour || (hours === closeHour && minutes > 0)) {
        date.setHours(closeHour, 0, 0, 0);
        inst.selectedHour = closeHour;
        inst.selectedMinutes = 0;
        inst._setCurrentTime(date);
        inst._updateDatepicker();
      }
    },
  };

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /***************************

  preloader — the logo fills as the page actually loads

  ***************************/
  (function () {
    var preloader = document.querySelector('.tt-preloader');
    if (!preloader) return;
    var loader = preloader.querySelector('.tt-logo-loader');
    var images = Array.prototype.filter.call(document.images, function (img) {
      return !preloader.contains(img);
    });
    var total = images.length;
    var loaded = 0;
    var target = 0.1;
    var shown = 0;
    var finished = false;
    var start = performance.now();
    var last = start;
    var MIN_VISIBLE = 450; // long enough to read, short enough not to feel like waiting

    function bump() {
      loaded++;
      if (!finished) target = Math.max(target, 0.1 + 0.8 * (loaded / Math.max(total, 1)));
    }
    images.forEach(function (img) {
      if (img.complete) bump();
      else {
        img.addEventListener('load', bump, { once: true });
        img.addEventListener('error', bump, { once: true });
      }
    });

    function hide() {
      if (preloader.classList.contains('tt-hidden')) return;
      loader.style.setProperty('--tt-p', '1');
      preloader.classList.add('tt-hidden');
      preloader.setAttribute('aria-busy', 'false');
    }
    function finish() {
      if (finished) return;
      finished = true;
      target = 1;
      setTimeout(hide, 1200); // rAF pauses in background tabs — don't depend on it
    }
    if (document.readyState === 'complete') finish();
    else window.addEventListener('load', finish, { once: true });
    setTimeout(finish, 8000); // never trap people behind the loader

    function frame(now) {
      var dt = now - last;
      last = now;
      // critically damped approach: always moves from the current value, never overshoots
      shown += (target - shown) * (1 - Math.exp(-dt / (reduceMotion ? 60 : 110)));
      if (target - shown < 0.002) shown = target;
      loader.style.setProperty('--tt-p', shown.toFixed(4));
      if (finished && shown >= 1 && now - start >= MIN_VISIBLE) return hide();
      requestAnimationFrame(frame);
    }
    preloader.setAttribute('aria-busy', 'true');
    requestAnimationFrame(frame);
  })();

  /***************************

  click effect (global — not re-init needed)

  ***************************/
  var cursor = document.querySelector('.sb-click-effect');
  document.addEventListener('mousemove', function (e) {
    cursor.setAttribute('style', "top:" + (e.pageY - 15) + "px; left:" + (e.pageX - 15) + "px;");
  });
  document.addEventListener('click', function () {
    cursor.classList.add('sb-click');
    setTimeout(function () { cursor.classList.remove('sb-click'); }, 600);
  });

  /***************************

  nav toggles (global — not re-init needed)

  ***************************/
  $('.sb-menu-btn').on('click', function () {
    $('.sb-menu-btn , .sb-navigation').toggleClass('sb-active');
    $('.sb-info-btn , .sb-info-bar , .sb-minicart').removeClass('sb-active');
  });
  $('.sb-info-btn').on('click', function () {
    $('.sb-info-btn , .sb-info-bar').toggleClass('sb-active');
    $('.sb-menu-btn , .sb-navigation , .sb-minicart').removeClass('sb-active');
  });
  $('.sb-btn-cart').on('click', function () {
    $('.sb-minicart').toggleClass('sb-active');
    $('.sb-info-btn , .sb-info-bar , .sb-navigation , .sb-menu-btn').removeClass('sb-active');
  });
  $(window).on('scroll', function () {
    var scrolled = $(window).scrollTop() >= 10;
    $('.sb-top-bar-frame').toggleClass('sb-scroll', scrolled);
    $('.sb-info-bar , .sb-minicart').toggleClass('sb-scroll', scrolled);
  });
  $(document).on('click', function (e) {
    var el = '.sb-minicart , .sb-btn-cart , .sb-menu-btn , .sb-navigation , .sb-info-btn , .sb-info-bar';
    if ($(e.target).closest(el).length) return;
    $(el).removeClass('sb-active');
  });
  function fixMobileDropdowns() {
    if ($(window).width() < 992) $(".sb-has-children > a").attr("href", "#.");
  }
  fixMobileDropdowns();
  $(window).resize(fixMobileDropdowns);

  /***************************

  add to cart (global counter)

  ***************************/
  var counter = parseInt($('.sb-cart-number').text(), 10) || 0;

  /***************************

  swup

  ***************************/
  // swup fetches pages over XHR, which browsers block on file:// — there it would
  // hang mid-transition forever, so fall back to normal page loads.
  var canSwup = /^https?:$/.test(window.location.protocol);
  if (canSwup) {
    new Swup({
      containers: ['#sb-dynamic-content'],
      animateHistoryBrowsing: true,
      linkSelector: '.sb-navigation a:not([data-no-swup]) , a:not([data-no-swup])',
    });

    // If a page fails to load (404, network error) swup never finishes the
    // transition; after a short wait, do a normal navigation instead.
    var lastHref = null;
    var stuckTimer = null;
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (a) lastHref = a.href;
    }, true);
    document.addEventListener('swup:clickLink', function () {
      clearTimeout(stuckTimer);
      var href = lastHref;
      stuckTimer = setTimeout(function () {
        if (href && document.documentElement.classList.contains('is-animating')) {
          window.location.href = href;
        }
      }, 4000);
    });
    document.addEventListener('swup:contentReplaced', function () {
      clearTimeout(stuckTimer);
    });
  }

  /***************************

  page-level init — called on first load and after every swup transition

  ***************************/
  function initPage() {

    // faq
    $('.sb-faq li .sb-question').on('click', function () {
      $(this).find('.sb-plus-minus-toggle').toggleClass('sb-collapsed');
      $(this).parent().toggleClass('sb-active');
    });

    // isotope
    $('.sb-filter a').on('click', function () {
      $('.sb-filter .sb-active').removeClass('sb-active');
      $(this).addClass('sb-active');
      $('.sb-masonry-grid').isotope({ filter: $(this).data('filter') });
      return false;
    });
    $('.sb-masonry-grid').isotope({
      itemSelector: '.sb-grid-item',
      percentPosition: true,
      masonry: { columnWidth: '.sb-grid-sizer' }
    });
    $('.sb-tabs').isotope({ filter: '.sb-ingredients-tab' });

    // fancybox
    var fancyboxOptions = reduceMotion
      ? { animationEffect: "fade", animationDuration: 200, transitionEffect: "fade", transitionDuration: 200 }
      : { animationEffect: "zoom-in-out", animationDuration: 400, transitionDuration: 500 };
    $('[data-fancybox="menu"]').fancybox(fancyboxOptions);
    $('[data-fancybox="gallery"]').fancybox(fancyboxOptions);
    $.fancybox.defaults.hash = false;

    // add to cart
    $('.sb-atc').on('click', function () {
      counter++;
      $('.sb-cart-number').addClass('sb-added');
      $(this).addClass('sb-added');
      setTimeout(function () { $('.sb-cart-number').removeClass('sb-added'); }, 600);
      setTimeout(function () { $('.sb-cart-number').text(counter); }, 300);
    });

    // quantity
    $('.sb-add').on('click', function () {
      if ($(this).prev().val() < 10) $(this).prev().val(+$(this).prev().val() + 1);
    });
    $('.sb-sub').on('click', function () {
      if ($(this).next().val() > 1) $(this).next().val(+$(this).next().val() - 1);
    });

    // sticky
    var sticky = new Sticky('.sb-sticky');
    if ($(window).width() < 992) sticky.destroy();

    // form submissions (reservation, contact, franchise)
    $('#form, #contact-form, #franchise-form').on('submit', function (e) {
      e.preventDefault();
      var $form = $(this);
      var $btn = $form.find('.sb-cf-submit');
      $btn.prop('disabled', true);

      // Build URL-encoded body (same format GAS expects)
      var params = [];
      $form.serializeArray().forEach(function (field) {
        params.push(encodeURIComponent(field.name) + '=' + encodeURIComponent(field.value));
      });

      fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.join('&')
      })
        .then(function () {
          $form.closest('.sb-form-content').find('.sb-success-result').addClass('sb-active');
        })
        .catch(function () {
          alert('Could not submit. Please check your connection and try again.');
          $btn.prop('disabled', false);
        });
    });

    // sliders
    var slide = { parallax: !reduceMotion, speed: reduceMotion ? 0 : 600 };
    new Swiper('.sb-short-menu-slider-3i', { slidesPerView: 3, spaceBetween: 30, parallax: slide.parallax, speed: slide.speed, navigation: { prevEl: '.sb-short-menu-prev', nextEl: '.sb-short-menu-next' }, breakpoints: { 992: { slidesPerView: 2 }, 768: { slidesPerView: 1 } } });
    new Swiper('.sb-short-menu-slider-2-3i', { slidesPerView: 3, spaceBetween: 30, parallax: slide.parallax, speed: slide.speed, navigation: { prevEl: '.sb-short-menu-prev-2', nextEl: '.sb-short-menu-next-2' }, breakpoints: { 992: { slidesPerView: 2 }, 768: { slidesPerView: 1 } } });
    new Swiper('.sb-short-menu-slider-4i', { slidesPerView: 4, spaceBetween: 30, parallax: slide.parallax, speed: slide.speed, navigation: { prevEl: '.sb-short-menu-prev', nextEl: '.sb-short-menu-next' }, breakpoints: { 992: { slidesPerView: 2 }, 768: { slidesPerView: 1 } } });
    new Swiper('.sb-short-menu-slider-2-4i', { slidesPerView: 4, spaceBetween: 30, parallax: slide.parallax, speed: slide.speed, navigation: { prevEl: '.sb-short-menu-prev-2', nextEl: '.sb-short-menu-next-2' }, breakpoints: { 992: { slidesPerView: 2 }, 768: { slidesPerView: 1 } } });
    new Swiper('.sb-reviews-slider', { slidesPerView: 2, spaceBetween: 30, parallax: slide.parallax, speed: slide.speed, navigation: { prevEl: '.sb-reviews-prev', nextEl: '.sb-reviews-next' }, breakpoints: { 992: { slidesPerView: 2 }, 768: { slidesPerView: 1 } } });
    new Swiper('.sb-blog-slider-2i', { slidesPerView: 2, spaceBetween: 30, parallax: slide.parallax, speed: slide.speed, navigation: { prevEl: '.sb-blog-prev', nextEl: '.sb-blog-next' }, breakpoints: { 992: { slidesPerView: 2 }, 768: { slidesPerView: 1 } } });
    new Swiper('.sb-blog-slider-3i', { slidesPerView: 3, spaceBetween: 30, parallax: slide.parallax, speed: slide.speed, navigation: { prevEl: '.sb-blog-prev', nextEl: '.sb-blog-next' }, breakpoints: { 992: { slidesPerView: 2 }, 768: { slidesPerView: 1 } } });

    // map
    if ($('#map').length) {
      mapboxgl.accessToken = 'YOUR_MAPBOX_TOKEN';
      var map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/stoscar/ckk6qpt2h0yi517o77x3tw34f',
        center: [-79.394900, 43.643102],
        zoom: 15
      });
      new mapboxgl.Marker().setLngLat([-79.394900, 43.643102]).addTo(map);
    }
    $('.sb-lock').on('click', function () {
      $('.sb-map').toggleClass('sb-active');
      $('.sb-lock').toggleClass('sb-active');
      $('.sb-lock .fas').toggleClass('fa-unlock');
    });

    // datepicker
    $('.sb-datepicker').datepicker(datepickerConfig);
  }

  // Run on first load
  initPage();

  // Re-run after every swup page transition
  document.addEventListener('swup:contentReplaced', function () {
    $('.sb-info-btn , .sb-info-bar , .sb-minicart , .sb-menu-btn , .sb-navigation').removeClass('sb-active');
    $('.sb-top-bar-frame').removeClass('sb-scroll');
    $('a').removeClass('sb-click');
    if ($('html').hasClass('is-rendering')) {
      $("html, body").animate({ scrollTop: 0 }, { duration: 0 });
    }
    initPage();
  });

});
