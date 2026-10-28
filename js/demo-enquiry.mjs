import { buyerMessage, createReference, conversationUrl } from './whatsapp-core.mjs';
const form = document.querySelector('[data-demo-enquiry]');
if (form) {
  const preview = form.querySelector('[data-demo-preview]');
  const status = form.querySelector('[data-demo-status]');
  const email = form.querySelector('[data-demo-email]');
  const whatsapp = form.querySelector('[data-demo-whatsapp]');
  const demo = new URLSearchParams(location.search).get('demo');
  const names = { 'demo-rose-01': 'Demo Rose 01', 'demo-rose-02': 'Demo Rose 02', 'demo-rose-03': 'Demo Rose 03' };
  if (names[demo]) form.elements.demoInterest.value = names[demo];
  let reference;
  form.addEventListener('input', () => { preview.hidden = true; email.removeAttribute('href'); whatsapp.removeAttribute('href'); status.textContent = ''; });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    try {
      reference ||= createReference();
      const message = '[TEMPLATE TEST — sample enquiry, not an order]\n\n' + buyerMessage(Object.fromEntries(new FormData(form)), reference);
      preview.querySelector('pre').textContent = message;
      email.href = `mailto:${form.dataset.email}?subject=${encodeURIComponent('Altura template test · ' + reference)}&body=${encodeURIComponent(message)}`;
      whatsapp.href = conversationUrl({ enabled: true, approved: true, number: form.dataset.number }, message);
      preview.hidden = false;
      status.textContent = 'Test enquiry prepared. Nothing has been sent.';
      preview.querySelector('pre').focus();
    } catch { status.textContent = 'Could not prepare the enquiry. Use the test email address below.'; }
  });
}
