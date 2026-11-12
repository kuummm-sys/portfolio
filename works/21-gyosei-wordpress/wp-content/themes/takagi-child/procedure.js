document.querySelectorAll('.procedure').forEach(procedure => {
  const controls = procedure.querySelector('.procedure-controls');
  if (!controls) return;
  const buttons = [...controls.querySelectorAll('button')];
  const panels = [...procedure.querySelectorAll('.procedure-panel')];
  if (buttons.length !== panels.length) return;

  function showPanel(selected) {
    panels.forEach((panel, index) => { panel.hidden = index !== selected; });
    buttons.forEach((button, index) => {
      button.setAttribute('aria-pressed', String(index === selected));
    });
  }
  buttons.forEach((button, index) => {
    button.addEventListener('click', () => showPanel(index));
  });
  showPanel(0);
  procedure.classList.add('is-enhanced');
  controls.hidden = false;
});

const priceRows = document.querySelectorAll('.takagi .wp-block-table tbody tr');
if (priceRows.length && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('price-seen');
      observer.unobserve(entry.target);
    });
  }, {threshold:.2});
  priceRows.forEach(row => observer.observe(row));
}
