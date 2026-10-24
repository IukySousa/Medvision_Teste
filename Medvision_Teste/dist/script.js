// Marca o documento como preparado para JavaScript.
// O CSS usa a classe `.js` para habilitar animações sem esconder conteúdo caso o JS falhe.
document.documentElement.classList.add('js');

// Referências da navegação mobile e do vídeo principal da página.
const menuToggle = document.querySelector('.menu-toggle');
const navPanel = document.querySelector('.nav-panel');
const heroVideo = document.querySelector('.hero-media video');
const soundToggle = document.querySelector('[data-video-sound]');

// Navegadores bloqueiam autoplay com som.
// Este clique é a interação explícita que permite alternar o áudio do vision1.
soundToggle?.addEventListener('click', async () => {
  const shouldEnableSound = heroVideo.muted;
  heroVideo.muted = !shouldEnableSound;
  heroVideo.volume = 0.85;

  try {
    await heroVideo.play();
    soundToggle.setAttribute('aria-pressed', String(shouldEnableSound));
    soundToggle.innerHTML = shouldEnableSound
      ? '<span aria-hidden="true">◖</span> Desativar som'
      : '<span aria-hidden="true">◖</span> Ativar som';
  } catch {
    heroVideo.muted = true;
  }
});

// Abre e fecha o menu em telas pequenas, atualizando o estado ARIA para leitores de tela.
menuToggle?.addEventListener('click', () => {
  const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-expanded', String(!isOpen));
  navPanel.classList.toggle('is-open', !isOpen);
});

// Após escolher um link no celular, fecha o menu para liberar a área de conteúdo.
navPanel?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  menuToggle?.setAttribute('aria-expanded', 'false');
  navPanel.classList.remove('is-open');
}));

// Seleciona os capítulos que entram suavemente durante a rolagem.
const sectionsToReveal = document.querySelectorAll(
  '.intro, .feature-showcase, .detail-section, .take-gallery, .teams, .image-break, .about, .faq, .photo-carousel, .final-cta'
);

// A classe `reveal` contém o estado inicial; `is-visible` é adicionada quando a seção aparece.
sectionsToReveal.forEach((section) => section.classList.add('reveal'));

// IntersectionObserver é mais eficiente que ouvir o evento scroll a cada pixel.
// Se a pessoa preferir movimento reduzido (ou o navegador não suportar a API), mostra tudo imediatamente.
if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver((entries, instance) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      instance.unobserve(entry.target);
    });
  }, { threshold: 0.12 });

  sectionsToReveal.forEach((section) => observer.observe(section));
} else {
  sectionsToReveal.forEach((section) => section.classList.add('is-visible'));
}

// Inicializa cada carrossel identificado por `data-carousel`.
// A lógica suporta botões, indicadores, teclado, arrastar e autoplay.
document.querySelectorAll('[data-carousel]').forEach((carousel) => {
  const track = carousel.querySelector('.carousel-track');
  const slides = [...carousel.querySelectorAll('.carousel-slide')];
  const dots = carousel.querySelector('.carousel-dots');
  const previous = carousel.querySelector('[data-carousel-prev]');
  const next = carousel.querySelector('[data-carousel-next]');
  const progress = carousel.querySelector('.carousel-progress span');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let activeIndex = 0;
  let intervalId;
  let startX = 0;
  let dragDistance = 0;

  // Cria dinamicamente um indicador/botão para cada foto do carrossel.
  slides.forEach((slide, index) => {
    const dot = document.createElement('button');
    dot.className = 'carousel-dot';
    dot.type = 'button';
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', `Ir para a foto ${index + 1}`);
    dot.setAttribute('aria-selected', String(index === 0));
    dot.addEventListener('click', () => goTo(index, true));
    dots.append(dot);
  });

  // Retorna os indicadores atuais e move o trilho para uma foto específica.
  // Também atualiza classe visual, atributo ARIA e barra de progresso.
  const getDots = () => [...dots.querySelectorAll('.carousel-dot')];
  const goTo = (index, userInitiated = false) => {
    activeIndex = (index + slides.length) % slides.length;
    track.style.transform = `translateX(${-slides[activeIndex].offsetLeft}px)`;
    slides.forEach((slide, slideIndex) => slide.classList.toggle('is-active', slideIndex === activeIndex));
    getDots().forEach((dot, dotIndex) => dot.setAttribute('aria-selected', String(dotIndex === activeIndex)));
    progress.style.width = `${((activeIndex + 1) / slides.length) * 100}%`;
    if (userInitiated) restartAutoplay();
  };

  // Autoplay é desativado para quem usa redução de movimento.
  // Ele também pausa em hover, foco ou quando a aba não está visível.
  const stopAutoplay = () => window.clearInterval(intervalId);
  const startAutoplay = () => {
    if (reduceMotion) return;
    stopAutoplay();
    intervalId = window.setInterval(() => goTo(activeIndex + 1), 4800);
  };
  const restartAutoplay = () => { stopAutoplay(); startAutoplay(); };

  // Controles diretos: botões, setas do teclado e gesto de arrastar/tocar.
  previous.addEventListener('click', () => goTo(activeIndex - 1, true));
  next.addEventListener('click', () => goTo(activeIndex + 1, true));
  carousel.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') goTo(activeIndex - 1, true);
    if (event.key === 'ArrowRight') goTo(activeIndex + 1, true);
  });
  carousel.addEventListener('mouseenter', stopAutoplay);
  carousel.addEventListener('mouseleave', startAutoplay);
  carousel.addEventListener('focusin', stopAutoplay);
  carousel.addEventListener('focusout', startAutoplay);
  carousel.addEventListener('pointerdown', (event) => {
    startX = event.clientX;
    dragDistance = 0;
    carousel.setPointerCapture?.(event.pointerId);
    stopAutoplay();
  });
  carousel.addEventListener('pointermove', (event) => {
    if (!startX) return;
    dragDistance = event.clientX - startX;
  });
  carousel.addEventListener('pointerup', () => {
    if (Math.abs(dragDistance) > 45) goTo(activeIndex + (dragDistance < 0 ? 1 : -1));
    startX = 0;
    startAutoplay();
  });
  // Recalcula a posição porque a largura dos slides muda em cada breakpoint.
  window.addEventListener('resize', () => goTo(activeIndex));
  document.addEventListener('visibilitychange', () => document.hidden ? stopAutoplay() : startAutoplay());
  goTo(0);
  startAutoplay();
});
