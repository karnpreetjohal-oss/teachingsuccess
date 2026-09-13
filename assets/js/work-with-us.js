const FORMSPREE_ENDPOINT = 'https://formspree.io/f/xojnlpwn';
let tutorApplicationInFlight = false;

const $ = (id) => document.getElementById(id);

function trackGAEvent(eventName, params = {}) {
  if (typeof gtag === 'function') gtag('event', eventName, params);
}

function toast(message) {
  const element = $('toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(element._timeoutId);
  element._timeoutId = setTimeout(() => element.classList.remove('show'), 3400);
}

function setTutorApplicationState(isLoading, message = '', isError = false) {
  const button = $('apply-submit');
  const status = $('application-status');
  if (button) {
    button.disabled = isLoading;
    button.innerHTML = isLoading ? 'Sending…' : 'Submit my details <span aria-hidden="true">→</span>';
  }
  if (status) {
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  }
}

async function submitTutorApplication(event) {
  event.preventDefault();
  if (tutorApplicationInFlight) return;

  const form = $('tutor-application');
  if (!form) return;
  if (!form.checkValidity()) {
    form.reportValidity();
    setTutorApplicationState(false, 'Please complete all required fields before submitting.', true);
    return;
  }

  const email = $('apply-email').value.trim();
  const application = {
    application_type: 'Self-employed tutor application',
    name: $('apply-name').value.trim(),
    email,
    phone: $('apply-phone').value.trim(),
    location: $('apply-location').value.trim(),
    subjects: $('apply-subjects').value.trim(),
    highest_level_taught: $('apply-level').value,
    lesson_format: $('apply-format').value,
    teaching_experience: $('apply-experience').value,
    enhanced_dbs_status: $('apply-dbs').value,
    qualifications_and_experience: $('apply-qualifications').value.trim(),
    availability_and_travel: $('apply-availability').value.trim(),
    professional_profile: $('apply-profile').value.trim() || 'Not supplied',
    additional_notes: $('apply-notes').value.trim() || 'Not supplied',
    self_employed_confirmation: $('apply-confirm').checked ? 'Confirmed' : 'Not confirmed',
    _replyto: email,
    _subject: `New self-employed tutor application: ${$('apply-name').value.trim()}`
  };

  tutorApplicationInFlight = true;
  setTutorApplicationState(true, 'Sending your application…');

  try {
    const response = await fetch(FORMSPREE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(application)
    });
    if (!response.ok) throw new Error(`Formspree returned ${response.status}`);

    trackGAEvent('tutor_application_submit', {
      event_category: 'recruitment',
      highest_level_taught: application.highest_level_taught,
      lesson_format: application.lesson_format
    });
    form.reset();
    setTutorApplicationState(false, 'Thank you — your details have been sent. We will be in touch if there is a suitable opportunity.');
    toast('Tutor application sent successfully.');
  } catch (error) {
    console.error('Tutor application error:', error);
    setTutorApplicationState(false, 'We could not send your details. Please try again or call 07909 274901.', true);
  } finally {
    tutorApplicationInFlight = false;
  }
}

function bindPhoneTracking() {
  document.querySelectorAll('a[href^="tel:"]').forEach((link) => {
    link.addEventListener('click', () => trackGAEvent('phone_click', {
      event_category: 'recruitment',
      event_label: (link.getAttribute('href') || '').replace('tel:', '')
    }));
  });
}

document.addEventListener('DOMContentLoaded', () => {
  $('tutor-application')?.addEventListener('submit', submitTutorApplication);
  bindPhoneTracking();
});
