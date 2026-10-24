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
  if (!heroVideo) return;
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

// Escolhe o vídeo certo para o dispositivo: versão vertical no celular, horizontal no resto.
// As fontes ficam em data-src-mobile / data-src-desktop na tag <video>.
// O limite de 720px é o mesmo breakpoint de celular usado no CSS.
if (heroVideo) {
  const mobileQuery = window.matchMedia('(max-width: 720px)');

  const applyHeroSource = () => {
    const wanted = mobileQuery.matches
      ? (heroVideo.dataset.srcMobile || heroVideo.dataset.srcDesktop)
      : heroVideo.dataset.srcDesktop;
    if (!wanted || heroVideo.getAttribute('src') === wanted) return;

    const wasPlaying = !heroVideo.paused;
    heroVideo.src = wanted;
    // Na primeira carga o atributo autoplay cuida do início; ao girar o aparelho, retoma se estava tocando.
    if (wasPlaying) heroVideo.play().catch(() => {});
  };

  applyHeroSource();
  mobileQuery.addEventListener('change', applyHeroSource);
}

// Pausa o vídeo (e portanto o som) quando ele sai da tela ou quando a aba fica em segundo plano.
// Ao voltar, retoma apenas se ele estava tocando antes de ser pausado.
if (heroVideo) {
  let heroVisible = true;
  let resumeOnReturn = false;

  const pauseHero = () => {
    if (!heroVideo.paused) {
      resumeOnReturn = true;
      heroVideo.pause();
    }
  };

  const resumeHero = () => {
    if (!resumeOnReturn) return;
    resumeOnReturn = false;
    heroVideo.play().catch(() => {
      // Se o navegador bloquear o retorno com som, volta mudo e atualiza o botão.
      heroVideo.muted = true;
      soundToggle?.setAttribute('aria-pressed', 'false');
      if (soundToggle) soundToggle.innerHTML = '<span aria-hidden="true">◖</span> Ativar som';
      heroVideo.play().catch(() => {});
    });
  };

  const syncHeroPlayback = () => (heroVisible && !document.hidden ? resumeHero() : pauseHero());

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      heroVisible = entry.isIntersecting;
      syncHeroPlayback();
    }, { threshold: 0.15 }).observe(heroVideo);
  }
  document.addEventListener('visibilitychange', syncHeroPlayback);
}

// Abre e fecha o menu em telas pequenas, atualizando o estado ARIA para leitores de tela.
menuToggle?.addEventListener('click', () => {
  const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-expanded', String(!isOpen));
  navPanel?.classList.toggle('is-open', !isOpen);
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

  // CORREÇÃO 1: só o trilho e os slides são obrigatórios.
  // Antes, a falta de qualquer elemento (setas, bolinhas, barra) cancelava tudo em silêncio.
  if (!track || slides.length === 0) {
    console.warn('[carrossel] Faltam .carousel-track ou .carousel-slide em:', carousel);
    return;
  }
  if (!previous) console.warn('[carrossel] Botão [data-carousel-prev] não encontrado.');
  if (!next) console.warn('[carrossel] Botão [data-carousel-next] não encontrado.');
  if (!dots) console.warn('[carrossel] Container .carousel-dots não encontrado.');
  if (!progress) console.warn('[carrossel] Barra .carousel-progress span não encontrada.');

  let activeIndex = 0;
  let intervalId;
  let startX = null;
  let dragDistance = 0;
  let isDragging = false;
  let activePointerId = null;

  // Permite rolar a página na vertical enquanto o arrasto horizontal é tratado aqui.
  carousel.style.touchAction = 'pan-y';

  // Evita que o navegador "arraste a imagem" em vez de mover o carrossel.
  carousel.addEventListener('dragstart', (event) => event.preventDefault());

  // Retorna os indicadores atuais e move o trilho para uma foto específica.
  // Também atualiza classe visual, atributo ARIA e barra de progresso.
  const getDots = () => (dots ? [...dots.querySelectorAll('.carousel-dot')] : []);

  const goTo = (index, userInitiated = false) => {
    activeIndex = (index + slides.length) % slides.length;

    // offsetLeft ignora transform/scale dos slides (getBoundingClientRect não ignora),
    // então a posição final é estável e a imagem não "treme" ao parar.
    // A primeira foto é a referência; Math.round evita meio pixel (borrão/tremida).
    const targetOffset = Math.round(slides[activeIndex].offsetLeft - slides[0].offsetLeft);
    track.style.transform = `translate3d(${-targetOffset}px, 0, 0)`;

    slides.forEach((slide, slideIndex) => slide.classList.toggle('is-active', slideIndex === activeIndex));
    getDots().forEach((dot, dotIndex) => dot.setAttribute('aria-selected', String(dotIndex === activeIndex)));
    if (progress) progress.style.width = `${((activeIndex + 1) / slides.length) * 100}%`;
    if (userInitiated) restartAutoplay();
  };

  // Cria dinamicamente um indicador/botão para cada foto do carrossel.
  if (dots) {
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
  }

  // Autoplay é desativado para quem usa redução de movimento.
  // Ele também pausa em hover, foco ou quando a aba não está visível.
  const stopAutoplay = () => window.clearInterval(intervalId);
  const startAutoplay = () => {
    if (reduceMotion) return;
    stopAutoplay();
    intervalId = window.setInterval(() => goTo(activeIndex + 1), 4800);
  };
  const restartAutoplay = () => { stopAutoplay(); startAutoplay(); };

  // Controles diretos: botões e setas do teclado.
  previous?.addEventListener('click', () => goTo(activeIndex - 1, true));
  next?.addEventListener('click', () => goTo(activeIndex + 1, true));
  carousel.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') goTo(activeIndex - 1, true);
    if (event.key === 'ArrowRight') goTo(activeIndex + 1, true);
  });
  carousel.addEventListener('mouseenter', stopAutoplay);
  carousel.addEventListener('mouseleave', startAutoplay);
  carousel.addEventListener('focusin', stopAutoplay);
  carousel.addEventListener('focusout', startAutoplay);

  // CORREÇÃO 2: gesto de arrastar/tocar.
  // - Ignora toques em botões e links, para que o clique chegue neles normalmente.
  // - Só captura o ponteiro depois que o movimento vira de fato um arrasto
  //   (antes, a captura no pointerdown "roubava" o clique dos botões).
  carousel.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.target.closest('button, a')) return;
    startX = event.clientX;
    dragDistance = 0;
    isDragging = false;
    activePointerId = event.pointerId;
    stopAutoplay();
  });

  carousel.addEventListener('pointermove', (event) => {
    if (startX === null) return;
    dragDistance = event.clientX - startX;
    if (!isDragging && Math.abs(dragDistance) > 8) {
      isDragging = true;
      carousel.setPointerCapture?.(activePointerId);
    }
  });

  const finishDrag = () => {
    if (startX === null) return;
    if (isDragging && Math.abs(dragDistance) > 45) {
      goTo(activeIndex + (dragDistance < 0 ? 1 : -1), true);
    }
    if (activePointerId !== null && carousel.hasPointerCapture?.(activePointerId)) {
      carousel.releasePointerCapture(activePointerId);
    }
    startX = null;
    dragDistance = 0;
    isDragging = false;
    activePointerId = null;
    startAutoplay();
  };
  carousel.addEventListener('pointerup', finishDrag);
  carousel.addEventListener('pointercancel', finishDrag);

  // Recalcula a posição porque a largura dos slides muda em cada breakpoint.
  window.addEventListener('resize', () => goTo(activeIndex));
  document.addEventListener('visibilitychange', () => document.hidden ? stopAutoplay() : startAutoplay());
  goTo(0);
  startAutoplay();
});
