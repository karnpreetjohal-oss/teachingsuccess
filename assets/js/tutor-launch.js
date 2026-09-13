(() => {
  'use strict';
  const endpoint = 'https://formspree.io/f/xojnlpwn';
  let sending = false;

  function track(eventName) {
    if (typeof window.gtag === 'function') window.gtag('event', eventName, { event_category: 'tutor_launch' });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('launch-form');
    const button = document.getElementById('launch-submit');
    const status = document.getElementById('launch-status');
    if (!form || !button || !status) return;

    function setState(loading, message, isError = false) {
      button.disabled = loading;
      button.textContent = loading ? 'Sending…' : 'Send my enquiry →';
      form.setAttribute('aria-busy', String(loading));
      status.textContent = message;
      status.classList.toggle('is-error', isError);
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (sending) return;
      // Reject whitespace-only required text without sending an enquiry.
      form.querySelectorAll('input[required], textarea[required]').forEach((field) => {
        if (field.type !== 'checkbox') field.setCustomValidity(field.value.trim() ? '' : 'Please complete this field.');
      });
      if (!form.checkValidity()) {
        form.reportValidity();
        setState(false, 'Please complete the required fields and check your email address.', true);
        return;
      }
      const fields = new FormData(form);
      const value = (name) => String(fields.get(name) || '').trim();
      const payload = {
        enquiry_type: 'Tutor Launch — optional business setup package',
        name: value('name'), email: value('email'),
        phone: value('phone') || 'Not supplied', location: value('location'),
        business_stage: value('business_stage'), subjects_and_age_groups: value('subjects'),
        existing_profile: value('profile_link') || 'Not supplied',
        experience_and_setup_goals: value('goals'),
        setup_service_confirmation: 'Confirmed',
        _replyto: value('email'), _subject: `Tutor Launch setup enquiry: ${value('name')}`
      };
      sending = true;
      setState(true, 'Sending your Tutor Launch enquiry…');
      try {
        const response = await fetch(endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error('Enquiry could not be sent');
        form.reset();
        track('tutor_launch_enquiry_submit');
        setState(false, 'Thank you — your enquiry has been sent. We will contact you to discuss your plans.');
      } catch {
        setState(false, 'We could not send your enquiry. Your details are still here: please try again or call 07909 274901.', true);
      } finally {
        sending = false;
      }
    });
    form.addEventListener('input', (event) => {
      if (typeof event.target.setCustomValidity === 'function') event.target.setCustomValidity('');
    });
    document.querySelectorAll('a[href^="tel:"]').forEach((link) => link.addEventListener('click', () => track('tutor_launch_phone_click')));
  });
})();
