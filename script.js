const $ = s => document.querySelector(s), $$ = s => document.querySelectorAll(s);

const hamburger = $('.hamburger'), navMenu = $('.nav-menu');
if (hamburger) hamburger.onclick = () => { navMenu?.classList.toggle('active'); hamburger.classList.toggle('active'); };

document.addEventListener('click', e => {
  const link = e.target.closest('.nav-link');
  if (link) { navMenu?.classList.remove('active'); hamburger?.classList.remove('active'); }

  const anchor = e.target.closest('a[href^="#"]');
  if (anchor) {
    const href = anchor.getAttribute('href');
    if (href !== '#' && $(href)) { e.preventDefault(); $(href).scrollIntoView({ behavior: 'smooth' }); }
  }
});

// Active nav link + parallax (single scroll handler)
const sections = $$('section'), navLinks = $$('.nav-link'), hero = $('.hero');
function onScroll() {
  const y = window.pageYOffset;
  for (let i = sections.length - 1; i >= 0; i--) {
    const sec = sections[i], top = sec.offsetTop - 220;
    if (y >= top) {
      const id = sec.id;
      navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#${id}`));
      break;
    }
  }
  if (hero) hero.style.backgroundPosition = `0 ${window.scrollY * 0.5}px`;
}
window.addEventListener('scroll', onScroll); onScroll();

// Contact form
const contactForm = $('.contact-form');
if (contactForm) contactForm.addEventListener('submit', e => {
  e.preventDefault();
  const name = contactForm.querySelector('input[type="text"]')?.value.trim();
  const email = contactForm.querySelector('input[type="email"]')?.value.trim();
  const message = contactForm.querySelector('textarea')?.value.trim();
  if (name && email && message) { alert('Thank you for your message! I will get back to you soon.'); contactForm.reset(); }
  else alert('Please fill in all fields.');
});

// Reveal on scroll
const revealSelector = '.about-content, .publications-list, .teaching .about-content, .contact-content';
if ('IntersectionObserver' in window) {
  const ro = new IntersectionObserver((entries, o) => entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('reveal-visible'); o.unobserve(en.target); } }), { threshold: 0.15, rootMargin: '0px 0px -80px 0px' });
  $$(revealSelector).forEach(el => { el.classList.add('reveal'); ro.observe(el); });
} else $$(revealSelector).forEach(el => el.classList.add('reveal-visible'));
