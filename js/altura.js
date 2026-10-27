(() => {
/* Shared helpers. Bundled as one scope by tools/build/build.mjs; exposes window.Altura. */
window.Altura = window.Altura || {};
Altura.qs = (sel, root = document) => root.querySelector(sel);
Altura.qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
Altura.reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
Altura.el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) node.setAttribute(k, v);
  for (const c of [].concat(children)) node.append(c);
  return node;
};
/* Focus trap for the full-screen menu. */
Altura.trapFocus = (container, event) => {
  if (event.key !== 'Tab') return;
  const items = Altura.qsa('a[href], button:not([disabled])', container).filter((n) => n.offsetParent !== null);
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) { last.focus(); event.preventDefault(); }
  else if (!event.shiftKey && document.activeElement === last) { first.focus(); event.preventDefault(); }
};
/* Header state + accessible full-screen menu. */
(() => {
  const header = Altura.qs('.site-header');
  const toggle = Altura.qs('.menu-toggle');
  const panel = Altura.qs('#menu-panel');
  if (!header) return;
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  if (!toggle || !panel) return;

  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('.menu-toggle__label').textContent = open ? 'Close' : 'Menu';
    panel.classList.toggle('is-open', open);
    header.classList.toggle('is-menu-open', open);
    document.body.classList.toggle('menu-locked', open);
    panel.inert = !open;
    if (open) panel.querySelector('a').focus(); else toggle.focus();
  };
  panel.inert = true;
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (e) => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    if (!open) return;
    if (e.key === 'Escape') setOpen(false);
    else Altura.trapFocus(header, e);
  });
  panel.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  window.matchMedia('(min-width: 1024px)').addEventListener('change', (m) => { if (m.matches) setOpen(false); });
})();
/* Gentle reveal via IntersectionObserver. No libraries. */
(() => {
  const nodes = Altura.qsa('[data-reveal]');
  if (!nodes.length) return;
  if (!('IntersectionObserver' in window) || Altura.reducedMotion()) { nodes.forEach((n) => n.classList.add('is-visible')); return; }
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  nodes.forEach((n) => io.observe(n));
})();
/* Catalogue filters: a filter is offered only when the data holds 2+ distinct values for it. */
Altura.FILTERS = [
  ['collection', 'Collection'], ['type', 'Type'], ['colorFamily', 'Colour'], ['bloomForm', 'Bloom form'],
  ['bloomSize', 'Bloom size'], ['stemLength', 'Stem length'], ['fragrance', 'Fragrance'],
  ['availability', 'Availability'], ['breeder', 'Breeder'],
];
Altura.availableFilters = (records) => Altura.FILTERS
  .map(([key, label]) => ({ key, label, values: [...new Set(records.map((r) => r[key]).filter(Boolean))].sort() }))
  .filter((f) => f.values.length > 1);
Altura.applyFilters = (records, active) => records.filter((r) => Object.entries(active).every(([k, v]) => !v || r[k] === v));
/* Data-driven flower catalogue. Reads data/varieties.json (approved records only).
   Empty or unavailable data => component stays hidden; nothing is invented.
   Records are expected to follow docs/data-models/variety.md and carry verificationStatus. */
(() => {
  const root = Altura.qs('[data-catalogue]');
  if (!root) return;
  const track = Altura.qs('.catalogue__track', root);
  const filterBox = Altura.qs('.catalogue__filters', root);
  let records = [];

  const card = (r) => {
    const facts = [r.colorFamily || r.color, r.stemLength && `${r.stemLength} cm`].filter(Boolean).join(' · ');
    const media = Altura.el('div', { class: 'flower-card__media' });
    if (r.heroImage) media.append(Altura.el('img', { src: r.heroImage, alt: r.altText || r.name, loading: 'lazy', decoding: 'async', width: 800, height: 1000 }));
    const body = Altura.el('div', { class: 'flower-card__body' }, [
      r.type || r.collection ? Altura.el('span', { class: 'flower-card__cat' }, r.type || r.collection) : '',
      Altura.el('h3', {}, r.name),
      facts ? Altura.el('span', { class: 'flower-card__facts' }, facts) : '',
      Altura.el('a', { class: 'link-arrow', href: `varieties/${encodeURIComponent(r.slug)}.html` }, `Explore ${r.name}`),
    ]);
    return Altura.el('article', { class: 'flower-card' }, [media, body]);
  };

  const render = () => {
    const active = {};
    Altura.qsa('select', filterBox).forEach((s) => { active[s.name] = s.value; });
    const shown = Altura.applyFilters(records, active);
    track.replaceChildren(...shown.map(card));
  };

  const mount = (data) => {
    records = (Array.isArray(data) ? data : []).filter((r) => r && r.slug && r.name && r.verificationStatus);
    if (!records.length) return;
    filterBox.replaceChildren(...Altura.availableFilters(records).map((f) => {
      const select = Altura.el('select', { name: f.key, id: `f-${f.key}` }, [Altura.el('option', { value: '' }, 'All'), ...f.values.map((v) => Altura.el('option', { value: v }, v))]);
      select.addEventListener('change', render);
      return Altura.el('label', { for: `f-${f.key}` }, [f.label, select]);
    }));
    root.hidden = false;
    render();
  };

  Altura.mountCatalogue = mount; // allows local testing without publishing records
  fetch(root.dataset.catalogue).then((r) => (r.ok ? r.json() : [])).then(mount).catch(() => {});
})();
/* Shared form niceties: opens optional <details> when a field inside is invalid. */
document.addEventListener('invalid', (e) => {
  const d = e.target.closest && e.target.closest('details');
  if (d) d.open = true;
}, true);
/* Dated events: once an event's end date has passed, wording switches from scheduled to concluded.
   Post-event content must still be replaced with verified recap information. */
(() => {
  Altura.qsa('[data-event-end]').forEach((node) => {
    const end = new Date(`${node.dataset.eventEnd}T23:59:59`);
    if (Date.now() > end) node.textContent = 'Concluded';
  });
})();
/* Buyer enquiry — front-end only. No endpoint exists, nothing is transmitted or stored.
   When config enables enquiries, a server-side handler (integrations/buyers) must receive the POST. */
(() => {
  const form = Altura.qs('[data-enquiry]');
  if (!form) return;
  const status = Altura.qs('[data-enquiry-status]', form);
  const endpoint = form.dataset.endpoint; // intentionally absent in development
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!endpoint) return;
    if (!form.reportValidity()) return;
    status.textContent = 'Sending…';
    // Submission wiring is deferred until a private endpoint, consent text and CRM routing are approved.
  });
})();
})();
