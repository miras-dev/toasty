/* Toasty Turtle Cafe */

$(function() {

  "use strict";

  // Replace with the deployed Google Apps Script Web App URL
  var GOOGLE_SCRIPT_URL = 'YOUR_GOOGLE_SCRIPT_URL';

  var datepickerConfig = {
    minDate: new Date(),
    timepicker: true,
    onSelect: function(fd, date, inst) {
      if (!date) return;
      var hours    = date.getHours();
      var minutes  = date.getMinutes();
      var isWeekend = (date.getDay() === 0 || date.getDay() === 6);
      var openHour  = isWeekend ? 9  : 8;
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

  /***************************

  preloader

  ***************************/
  $(".sb-loading").animate({ opacity: 1 }, { duration: 500 });
  setTimeout(function() {
    $('.sb-preloader-number').each(function() {
      var $this = $(this), countTo = $this.attr('data-count');
      $({ countNum: $this.text() }).animate({ countNum: countTo }, {
        duration: 1000,
        easing: 'swing',
        step: function() { $this.text(Math.floor(this.countNum)); },
      });
    });
    $(".sb-bar").animate({ height: '100%' }, {
      duration: 1000,
      complete: function() { $(".sb-preloader").addClass('sb-hidden'); }
    });
  }, 400);

  /***************************

  click effect (global — not re-init needed)

  ***************************/
  var cursor = document.querySelector('.sb-click-effect');
  document.addEventListener('mousemove', function(e) {
    cursor.setAttribute('style', "top:" + (e.pageY - 15) + "px; left:" + (e.pageX - 15) + "px;");
  });
  document.addEventListener('click', function() {
    cursor.classList.add('sb-click');
    setTimeout(function() { cursor.classList.remove('sb-click'); }, 600);
  });

  /***************************

  nav toggles (global — not re-init needed)

  ***************************/
  $('.sb-menu-btn').on('click', function() {
    $('.sb-menu-btn , .sb-navigation').toggleClass('sb-active');
    $('.sb-info-btn , .sb-info-bar , .sb-minicart').removeClass('sb-active');
  });
  $('.sb-info-btn').on('click', function() {
    $('.sb-info-btn , .sb-info-bar').toggleClass('sb-active');
    $('.sb-menu-btn , .sb-navigation , .sb-minicart').removeClass('sb-active');
  });
  $('.sb-btn-cart').on('click', function() {
    $('.sb-minicart').toggleClass('sb-active');
    $('.sb-info-btn , .sb-info-bar , .sb-navigation , .sb-menu-btn').removeClass('sb-active');
  });
  $(window).on('scroll', function() {
    var scrolled = $(window).scrollTop() >= 10;
    $('.sb-top-bar-frame').toggleClass('sb-scroll', scrolled);
    $('.sb-info-bar , .sb-minicart').toggleClass('sb-scroll', scrolled);
  });
  $(document).on('click', function(e) {
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
  var swup = new Swup({
    containers: ['#sb-dynamic-content'],
    animateHistoryBrowsing: true,
    linkSelector: '.sb-navigation a:not([data-no-swup]) , a:not([data-no-swup])',
  });

  /***************************

  page-level init — called on first load and after every swup transition

  ***************************/
  function initPage() {

    // faq
    $('.sb-faq li .sb-question').on('click', function() {
      $(this).find('.sb-plus-minus-toggle').toggleClass('sb-collapsed');
      $(this).parent().toggleClass('sb-active');
    });

    // isotope
    $('.sb-filter a').on('click', function() {
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
    $('[data-fancybox="menu"]').fancybox({ animationEffect: "zoom-in-out", animationDuration: 600, transitionDuration: 1200 });
    $('[data-fancybox="gallery"]').fancybox({ animationEffect: "zoom-in-out", animationDuration: 600, transitionDuration: 1200 });
    $.fancybox.defaults.hash = false;

    // add to cart
    $('.sb-atc').on('click', function() {
      counter++;
      $('.sb-cart-number').addClass('sb-added');
      $(this).addClass('sb-added');
      setTimeout(function() { $('.sb-cart-number').removeClass('sb-added'); }, 600);
      setTimeout(function() { $('.sb-cart-number').text(counter); }, 300);
    });

    // quantity
    $('.sb-add').on('click', function() {
      if ($(this).prev().val() < 10) $(this).prev().val(+$(this).prev().val() + 1);
    });
    $('.sb-sub').on('click', function() {
      if ($(this).next().val() > 1) $(this).next().val(+$(this).next().val() - 1);
    });

    // sticky
    var sticky = new Sticky('.sb-sticky');
    if ($(window).width() < 992) sticky.destroy();

    // reservation form
    $('#form').on('submit', function(e) {
      e.preventDefault();
      var $btn = $(this).find('.sb-cf-submit');
      $btn.prop('disabled', true);
      fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: new FormData(this) })
        .then(function(res) { return res.json(); })
        .then(function(data) {
          if (data.result === 'success') {
            $('.sb-success-result').addClass('sb-active');
          } else {
            alert('Something went wrong. Please try again.');
            $btn.prop('disabled', false);
          }
        })
        .catch(function() {
          alert('Could not submit reservation. Please try again.');
          $btn.prop('disabled', false);
        });
    });

    // sliders
    new Swiper('.sb-short-menu-slider-3i',   { slidesPerView: 3, spaceBetween: 30, parallax: true, speed: 1000, navigation: { prevEl: '.sb-short-menu-prev',   nextEl: '.sb-short-menu-next'   }, breakpoints: { 992: { slidesPerView: 2 }, 768: { slidesPerView: 1 } } });
    new Swiper('.sb-short-menu-slider-2-3i', { slidesPerView: 3, spaceBetween: 30, parallax: true, speed: 1000, navigation: { prevEl: '.sb-short-menu-prev-2', nextEl: '.sb-short-menu-next-2' }, breakpoints: { 992: { slidesPerView: 2 }, 768: { slidesPerView: 1 } } });
    new Swiper('.sb-short-menu-slider-4i',   { slidesPerView: 4, spaceBetween: 30, parallax: true, speed: 1000, navigation: { prevEl: '.sb-short-menu-prev',   nextEl: '.sb-short-menu-next'   }, breakpoints: { 992: { slidesPerView: 2 }, 768: { slidesPerView: 1 } } });
    new Swiper('.sb-short-menu-slider-2-4i', { slidesPerView: 4, spaceBetween: 30, parallax: true, speed: 1000, navigation: { prevEl: '.sb-short-menu-prev-2', nextEl: '.sb-short-menu-next-2' }, breakpoints: { 992: { slidesPerView: 2 }, 768: { slidesPerView: 1 } } });
    new Swiper('.sb-reviews-slider',         { slidesPerView: 2, spaceBetween: 30, parallax: true, speed: 1000, navigation: { prevEl: '.sb-reviews-prev',       nextEl: '.sb-reviews-next'      }, breakpoints: { 992: { slidesPerView: 2 }, 768: { slidesPerView: 1 } } });
    new Swiper('.sb-blog-slider-2i',         { slidesPerView: 2, spaceBetween: 30, parallax: true, speed: 1000, navigation: { prevEl: '.sb-blog-prev',          nextEl: '.sb-blog-next'         }, breakpoints: { 992: { slidesPerView: 2 }, 768: { slidesPerView: 1 } } });
    new Swiper('.sb-blog-slider-3i',         { slidesPerView: 3, spaceBetween: 30, parallax: true, speed: 1000, navigation: { prevEl: '.sb-blog-prev',          nextEl: '.sb-blog-next'         }, breakpoints: { 992: { slidesPerView: 2 }, 768: { slidesPerView: 1 } } });

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
    $('.sb-lock').on('click', function() {
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
  document.addEventListener('swup:contentReplaced', function() {
    $('.sb-info-btn , .sb-info-bar , .sb-minicart , .sb-menu-btn , .sb-navigation').removeClass('sb-active');
    $('.sb-top-bar-frame').removeClass('sb-scroll');
    $('a').removeClass('sb-click');
    if ($('html').hasClass('is-rendering')) {
      $("html, body").animate({ scrollTop: 0 }, { duration: 0 });
    }
    initPage();
  });

});
