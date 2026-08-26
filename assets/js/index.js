const FORMSPREE_ENDPOINT = 'https://formspree.io/f/xojnlpwn';
const GOOGLE_PLACE_ID = 'ChIJIXBcemG9cEgRBMTesaRCGc4';
const GOOGLE_MAPS_API_KEY = window.TS_GOOGLE_MAPS_API_KEY || '';
const FALLBACK_REVIEWS = [
  {
    author_name: 'Priya H.',
    rating: 5,
    text: 'My son went up two full grades in one term. Kevin explains things so clearly and really understands how students think. Absolutely worth every penny.',
    relative_time_description: 'Parent · Year 11'
  },
  {
    author_name: 'Claire W.',
    rating: 5,
    text: 'Serena is outstanding. My daughter was really struggling with reading and in just a few months she is flying. Her patience and warmth make every session a joy.',
    relative_time_description: 'Parent · Year 2'
  },
  {
    author_name: 'Rohan A.',
    rating: 5,
    text: 'I needed a B to study medicine and ended up with an A*. Kevin’s knowledge of the A-Level spec is exceptional. I cannot thank Teaching Success enough.',
    relative_time_description: 'Student · Year 13'
  }
];
const FALLBACK_REVIEW_SUMMARY = {
  rating: Number((FALLBACK_REVIEWS.reduce((sum, item) => sum + Number(item.rating || 0), 0) / FALLBACK_REVIEWS.length).toFixed(1)),
  totalRatings: FALLBACK_REVIEWS.length,
  label: 'featured reviews',
  cardLabel: 'Featured Review'
};
const MANUAL_REVIEW_SUMMARY = window.TS_MANUAL_REVIEW_SUMMARY || FALLBACK_REVIEW_SUMMARY;
const REVIEWS_STATE = {
  items: [],
  index: 0,
  timer: null,
  placeUrl: 'https://g.page/r/CcTE3rGkQhnOEBM/review',
  totalRatings: null,
  rating: null,
  label: 'featured reviews',
  cardLabel: 'Featured Review'
};

let bookingInFlight = false;

const $ = (id) => document.getElementById(id);

function trackGAEvent(eventName, params = {}) {
  if (typeof gtag === 'function') {
    gtag('event', eventName, params);
  }
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncateText(text, max = 340) {
  const value = String(text || '').trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

function openM(id) {
  const modal = $(`modal-${id}`);
  if (!modal) return;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

function closeM(id) {
  const modal = $(`modal-${id}`);
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  if (!document.querySelector('.mo.open')) {
    document.body.classList.remove('modal-open');
  }
}

function toast(message) {
  const el = $('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(el._timeoutId);
  el._timeoutId = setTimeout(() => el.classList.remove('show'), 3400);
}

function clearBookingForm() {
  ['book-parent', 'book-email', 'book-student', 'book-phone', 'book-notes'].forEach((id) => {
    const input = $(id);
    if (input) input.value = '';
  });
}

function setBookingSubmitState(isLoading) {
  const button = $('book-submit');
  if (!button) return;
  button.disabled = isLoading;
  button.textContent = isLoading ? 'Sending…' : 'Send Enquiry';
}

async function doBook() {
  if (bookingInFlight) return;

  const parent = $('book-parent')?.value.trim() || '';
  const email = $('book-email')?.value.trim() || '';
  const student = $('book-student')?.value.trim() || '';
  const phone = $('book-phone')?.value.trim() || '';
  const subject = $('book-subject')?.value || '';
  const year = $('book-year')?.value || '';
  const notes = $('book-notes')?.value.trim() || '';

  if (!parent || !email || !student || !phone) {
    toast('Please fill in all required fields.');
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    toast('Please enter a valid email address.');
    return;
  }

  const formData = {
    parent,
    email,
    student,
    phone,
    subject,
    year,
    notes,
    _replyto: email,
    _subject: `New Trial Booking: ${student} (${subject})`
  };

  bookingInFlight = true;
  setBookingSubmitState(true);

  try {
    const response = await fetch(FORMSPREE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    if (!response.ok) {
      throw new Error(`Formspree returned ${response.status}`);
    }

    trackGAEvent('book_trial_submit', {
      event_category: 'lead',
      subject,
      year_group: year
    });
    trackGAEvent('generate_lead', {
      event_category: 'lead',
      lead_source: 'free_trial_form',
      subject,
      year_group: year
    });

    closeM('book');
    clearBookingForm();
    toast('Booking request sent. We will contact you within 24 hours.');
  } catch (error) {
    console.error('Form submission error:', error);
    toast('Something went wrong. Please call 07909 274901.');
  } finally {
    bookingInFlight = false;
    setBookingSubmitState(false);
  }
}

function renderReviewCard() {
  const host = $('review-slide');
  const meta = $('reviews-meta');
  const link = $('reviews-link');
  const dotsWrap = $('review-dots');

  if (!host || !meta || !dotsWrap) return;
  if (!REVIEWS_STATE.items.length) {
    host.innerHTML = '<p class="ttbody">Reviews will appear here shortly.</p>';
    meta.textContent = 'Featured reviews from local families.';
    return;
  }

  const review = REVIEWS_STATE.items[REVIEWS_STATE.index];
  const initials = (review.author_name || 'TS')
    .split(' ')
    .map((part) => part[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const stars = '★'.repeat(Math.max(1, Math.min(5, Math.round(Number(review.rating) || 5))));

  host.innerHTML = `
    <div class="ttsubj">${escapeHtml(REVIEWS_STATE.cardLabel)}</div>
    <div class="ttstars">${stars}</div>
    <p class="ttbody">${escapeHtml(truncateText(review.text))}</p>
    <div class="ttauth">
      <div class="ttav" style="background:var(--green)">${escapeHtml(initials)}</div>
      <div>
        <div class="ttnm">${escapeHtml(review.author_name || 'Anonymous')}</div>
        <div class="ttinf">${escapeHtml(review.relative_time_description || 'Teaching Success')}</div>
      </div>
    </div>
  `;

  if (REVIEWS_STATE.rating !== null && REVIEWS_STATE.totalRatings !== null) {
    meta.textContent = `${REVIEWS_STATE.rating.toFixed(1)}★ from ${REVIEWS_STATE.totalRatings} ${REVIEWS_STATE.label}`;
  } else {
    meta.textContent = 'Featured reviews from local families.';
  }

  if (link) {
    link.href = REVIEWS_STATE.placeUrl;
  }

  dotsWrap.innerHTML = REVIEWS_STATE.items
    .map((_, index) => (
      `<button class="review-dot ${index === REVIEWS_STATE.index ? 'active' : ''}" aria-label="Go to review ${index + 1}" data-review-index="${index}"></button>`
    ))
    .join('');
}

function showReviewAt(index) {
  if (!REVIEWS_STATE.items.length) return;
  REVIEWS_STATE.index = (index + REVIEWS_STATE.items.length) % REVIEWS_STATE.items.length;
  renderReviewCard();
}

function startReviewCycle() {
  clearInterval(REVIEWS_STATE.timer);
  if (REVIEWS_STATE.items.length < 2) return;
  REVIEWS_STATE.timer = setInterval(() => {
    showReviewAt(REVIEWS_STATE.index + 1);
  }, 5000);
}

function loadMapsJs(apiKey) {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.places) {
      resolve();
      return;
    }

    const existing = $('gmaps-places-js');
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = 'gmaps-places-js';
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly`;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function fetchGooglePlaceReviews() {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error('Missing Google Maps API key');
  }

  await loadMapsJs(GOOGLE_MAPS_API_KEY);

  return new Promise((resolve, reject) => {
    const service = new google.maps.places.PlacesService(document.createElement('div'));
    service.getDetails({
      placeId: GOOGLE_PLACE_ID,
      fields: ['name', 'rating', 'user_ratings_total', 'reviews', 'url']
    }, (place, status) => {
      if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
        reject(new Error(`Places API failed: ${status}`));
        return;
      }
      resolve(place);
    });
  });
}

function applyFallbackReviewSummary() {
  REVIEWS_STATE.items = [...FALLBACK_REVIEWS];
  REVIEWS_STATE.totalRatings = Number(MANUAL_REVIEW_SUMMARY.totalRatings ?? FALLBACK_REVIEW_SUMMARY.totalRatings);
  REVIEWS_STATE.rating = Number(MANUAL_REVIEW_SUMMARY.rating ?? FALLBACK_REVIEW_SUMMARY.rating);
  REVIEWS_STATE.label = MANUAL_REVIEW_SUMMARY.label || FALLBACK_REVIEW_SUMMARY.label;
  REVIEWS_STATE.cardLabel = MANUAL_REVIEW_SUMMARY.cardLabel || FALLBACK_REVIEW_SUMMARY.cardLabel;
}

async function initReviews() {
  try {
    const place = await fetchGooglePlaceReviews();
    const reviews = (place.reviews || []).filter((review) => review?.text).sort((a, b) => (b.time || 0) - (a.time || 0));

    if (!reviews.length) {
      throw new Error('No Google review text returned');
    }

    REVIEWS_STATE.items = reviews;
    REVIEWS_STATE.placeUrl = place.url || REVIEWS_STATE.placeUrl;
    REVIEWS_STATE.totalRatings = Number(place.user_ratings_total || 0);
    REVIEWS_STATE.rating = Number(place.rating || 0);
    REVIEWS_STATE.label = 'Google reviews';
    REVIEWS_STATE.cardLabel = 'Google Review';
  } catch (error) {
    console.warn('Using fallback reviews:', error);
    applyFallbackReviewSummary();
  }

  REVIEWS_STATE.index = 0;
  renderReviewCard();
  startReviewCycle();
}

function bindPhoneTracking() {
  document.querySelectorAll('a[href^="tel:"]').forEach((link) => {
    link.addEventListener('click', () => {
      trackGAEvent('phone_click', {
        event_category: 'lead',
        event_label: (link.getAttribute('href') || '').replace('tel:', '')
      });
    });
  });
}

function toggleWaBox() {
  const box = $('wa-box');
  const button = $('wa-toggle');
  if (!box || !button) return;
  box.classList.toggle('collapsed');
  button.textContent = box.classList.contains('collapsed') ? 'WhatsApp' : 'Close';
}

function sendWhatsAppMessage() {
  const number = '447909274901';
  const textarea = $('wa-msg');
  const message = textarea?.value.trim() || '';

  if (!message) {
    toast('Please write a message first.');
    return;
  }

  trackGAEvent('whatsapp_send', {
    event_category: 'lead',
    event_label: 'website_widget'
  });

  const text = encodeURIComponent(`Website enquiry:\n${message}`);
  window.open(`https://wa.me/${number}?text=${text}`, '_blank');
  textarea.value = '';
}

function bindUi() {
  document.querySelectorAll('[data-open-modal]').forEach((button) => {
    button.addEventListener('click', () => openM(button.dataset.openModal));
  });

  document.querySelectorAll('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', () => closeM(button.dataset.closeModal));
  });

  document.querySelectorAll('[data-toast]').forEach((button) => {
    button.addEventListener('click', () => toast(button.dataset.toast));
  });

  document.querySelectorAll('.mo').forEach((modal) => {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeM(modal.id.replace('modal-', ''));
      }
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('.mo.open').forEach((modal) => {
      closeM(modal.id.replace('modal-', ''));
    });
  });

  $('review-dots')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-review-index]');
    if (!button) return;
    showReviewAt(Number(button.dataset.reviewIndex));
  });

  $('wa-toggle')?.addEventListener('click', toggleWaBox);
  $('wa-send')?.addEventListener('click', sendWhatsAppMessage);
  $('book-submit')?.addEventListener('click', doBook);
}

document.addEventListener('DOMContentLoaded', () => {
  bindUi();
  bindPhoneTracking();
  initReviews();
});
