document.querySelectorAll('[data-print-resource]').forEach((button) => {
  button.addEventListener('click', () => {
    if (typeof gtag === 'function') {
      gtag('event', 'resource_print', {
        resource_name: button.dataset.resourceName || document.title
      });
    }
    window.print();
  });
});
