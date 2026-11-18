(() => {
  'use strict';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];

  // Motion follows viewport position, so scrolling back reverses every reveal.
  // The separate translate property preserves each card's hover transform.
  const reveals = $$('.reveal').map(element => ({ element, x: 0, y: 0, stagger: 0 }));
  const revealByElement = new Map(reveals.map(state => [state.element, state]));
  const nearbyReveals = new Set();
  let revealObserver;
  let refreshAllReveals = true;
  const clamp = value => Math.max(0, Math.min(1, value));

  function updateReveals() {
    if (reducedMotion.matches) return;
    const viewport = window.innerHeight;
    const topEdge = Math.min($('.site-header').offsetHeight + 8, viewport * .22);
    const compact = window.innerWidth <= 760;
    if (refreshAllReveals) {
      $$('.education-grid, .skills-grid, .project-grid, .community-grid').forEach(grid => {
        const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
        [...grid.children].filter(element => !element.hidden).forEach((element, index) => {
          const state = revealByElement.get(element);
          if (state) state.stagger = (index % columns) * (compact ? 8 : 14);
        });
      });
    }
    const states = refreshAllReveals ? reveals : [...nearbyReveals];
    refreshAllReveals = false;
    // Batch geometry reads before writes; subtract our own offset to avoid drift.
    const measurements = states.filter(({ element }) => !element.hidden).map(state => {
      const rect = state.element.getBoundingClientRect();
      return { state, top: rect.top - state.y, height: rect.height };
    });
    measurements.forEach(({ state, top, height }) => {
      const entryRange = Math.min(viewport * .18, Math.max(48, height * .55));
      const exitRange = Math.min(viewport * .12, Math.max(36, height * .35));
      const entering = clamp((viewport - top - state.stagger) / entryRange);
      const leaving = clamp((top + height - topEdge) / exitRange);
      const progress = state.element.matches(':focus-within') ? 1 : Math.min(entering, leaving);
      const opacity = 1 - Math.pow(1 - progress, 3);
      const direction = entering <= leaving ? 1 : -1;
      const distance = (1 - opacity) * direction;
      const side = state.element.dataset.reveal;
      state.x = (side === 'left' ? -1 : side === 'right' ? 1 : 0) * (compact ? 22 : 46) * distance;
      state.y = (side ? 10 : compact ? 24 : 36) * distance;
      state.element.style.setProperty('--reveal-opacity', opacity.toFixed(4));
      state.element.style.setProperty('--reveal-x', `${state.x}px`);
      state.element.style.setProperty('--reveal-y', `${state.y}px`);
    });
  }

  function configureRevealMotion() {
    revealObserver?.disconnect();
    nearbyReveals.clear();
    refreshAllReveals = true;
    if (reducedMotion.matches) {
      document.documentElement.classList.remove('js-motion');
      reveals.forEach(state => {
        state.x = state.y = 0;
        ['--reveal-opacity', '--reveal-x', '--reveal-y'].forEach(property => state.element.style.removeProperty(property));
      });
    } else {
      if ('IntersectionObserver' in window) {
        revealObserver = new IntersectionObserver(entries => {
          entries.forEach(entry => {
            const state = revealByElement.get(entry.target);
            if (entry.isIntersecting) nearbyReveals.add(state);
            else nearbyReveals.delete(state);
          });
          requestScrollUpdate();
        }, { rootMargin: '200px 0px', threshold: 0 });
        reveals.forEach(({ element }) => revealObserver.observe(element));
      } else reveals.forEach(state => nearbyReveals.add(state));
      updateReveals();
      document.documentElement.classList.add('js-motion');
    }
    requestScrollUpdate();
  }

  const menu = $('#mobile-nav');
  const menuToggle = $('.menu-toggle');
  const closeMenu = () => {
    menu.hidden = true;
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Open navigation');
  };
  menuToggle.addEventListener('click', () => {
    const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
    menu.hidden = isOpen;
    menuToggle.setAttribute('aria-expanded', String(!isOpen));
    menuToggle.setAttribute('aria-label', isOpen ? 'Open navigation' : 'Close navigation');
  });
  $$('#mobile-nav a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !menu.hidden) { closeMenu(); menuToggle.focus(); }
  });
  document.addEventListener('click', event => {
    if (!menu.hidden && !event.target.closest('.site-header')) closeMenu();
  });
  window.matchMedia('(min-width: 761px)').addEventListener('change', event => { if(event.matches) closeMenu(); });

  const progress = $('.reading-progress');
  const navigationLinks = $$('.desktop-nav a');
  const sections = $$('main > section[id]');
  let scrollTicking = false;
  function updateScroll() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const current = sections.filter(section => section.getBoundingClientRect().top <= 180).at(-1);
    updateReveals();
    progress.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
    navigationLinks.forEach(link => {
      const active = current && link.getAttribute('href') === '#' + current.id;
      link.classList.toggle('active', Boolean(active));
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    scrollTicking = false;
  }
  function requestScrollUpdate() {
    if (!scrollTicking) { window.requestAnimationFrame(updateScroll); scrollTicking = true; }
  }
  function refreshRevealLayout() {
    refreshAllReveals = true;
    requestScrollUpdate();
  }
  window.addEventListener('scroll', requestScrollUpdate, { passive:true });
  window.addEventListener('resize', refreshRevealLayout, { passive:true });
  window.addEventListener('pageshow', refreshRevealLayout);
  document.addEventListener('focusin', requestScrollUpdate);
  document.addEventListener('focusout', requestScrollUpdate);
  // Recalculate after the opening animation, font loading or a filtered grid reflow.
  document.addEventListener('animationend', event => {
    if (event.animationName === 'hero-enter') refreshRevealLayout();
  });
  if ('ResizeObserver' in window) new ResizeObserver(refreshRevealLayout).observe($('#main'));
  document.fonts?.ready.then(refreshRevealLayout);
  reducedMotion.addEventListener('change', configureRevealMotion);
  configureRevealMotion();
  updateScroll();

  const roles = ['Life sciences & biopharmaceuticals', 'Analytical chemistry & quality', 'Cell Biology', 'Microbiology'];
  const roleText = $('#rotating-role');
  let roleIndex = 0;
  let typingTimer;
  function rotateRole() {
    if (reducedMotion.matches || document.hidden) {
      typingTimer = window.setTimeout(rotateRole, 3500);
      return;
    }
    let text = roleText.textContent;
    function erase() {
      if (reducedMotion.matches) { roleText.textContent = roles[roleIndex]; return; }
      text = text.slice(0, -1);
      roleText.textContent = text;
      if (text.length) typingTimer = window.setTimeout(erase, 23);
      else {
        roleIndex = (roleIndex + 1) % roles.length;
        let letter = 0;
        function type() {
          if (reducedMotion.matches) { roleText.textContent = roles[roleIndex]; return; }
          roleText.textContent = roles[roleIndex].slice(0, ++letter);
          typingTimer = window.setTimeout(letter < roles[roleIndex].length ? type : rotateRole, letter < roles[roleIndex].length ? 43 : 3700);
        }
        typingTimer = window.setTimeout(type, 200);
      }
    }
    erase();
  }
  if (!reducedMotion.matches) typingTimer = window.setTimeout(rotateRole, 3900);
  reducedMotion.addEventListener('change', event => {
    window.clearTimeout(typingTimer);
    if (event.matches) roleText.textContent = roles[roleIndex];
    else typingTimer = window.setTimeout(rotateRole, 3700);
  });

  const experience = {
    teaching: {
      period:'SEPTEMBER 2026 — PRESENT', kind:'Part-time', title:'Laboratory Demonstrator', company:'Technological University Dublin, Ireland',
      description:'Helping 20+ undergraduate students turn theory into safe, confident laboratory practice.',
      points:['Guide practical work in line with established procedures, risk assessments and PPE requirements.','Support student learning with technical instruction, documentation review and assessment feedback.','Promote good laboratory practice and escalate technical or safety concerns.'],
      lesson:'Knowledge matters most when you can help someone else understand it.'
    },
    research: {
      period:'APRIL — JULY 2026', kind:'Research', title:'Postgraduate Research', company:'Technological University Dublin, Ireland',
      description:'Investigating phytochemistry, anticancer activity and antimicrobial effects in Forsythiae fructus extracts.',
      points:['Profiled 4 medicinal plant extracts using TLC, NMR and PCA, maintaining traceable GLP-style records and investigating anomalous results.','Discovered novel anticancer activity in sensitive and drug-resistant lung cancer cells using 3 biological and 3 technical replicates under aseptic conditions.','Identified antibacterial and novel antifungal activity against 3 bacterial and 1 fungal strain through controlled MIC testing; analysed and communicated findings within project timelines.'],
      lesson:'A useful result begins with a careful method and the willingness to question it.'
    },
    cipla: {
      period:'JUNE — JULY 2024', kind:'Voluntary internship', title:'Analytical R&D Intern', company:'Cipla Pharmaceuticals, Mumbai, India',
      description:'Bringing academic chemistry into a regulated pharmaceutical research and development setting.',
      points:['Supported HPLC method development and validation for small-molecule antivirals (Cabotegravir) in line with ICH Q2 expectations.','Performed 15+ analytical sample preparations and release-style tests using GC, dissolution testing (USP Apparatus 2 & 4) and polarimetry.','Worked with Empower, system suitability checks, approved methods and traceable documentation.'],
      lesson:'Precision is not just a laboratory skill. It is a responsibility to the people relying on the result.'
    },
    hospital: {
      period:'UNDERGRADUATE PRACTICAL EXPOSURE', kind:'Voluntary experience', title:'Hospital Pharmacy Intern', company:'Lilavati Hospital and Research Centre, Mumbai, India',
      description:'Learning how pharmaceutical knowledge fits into a wider patient-care team.',
      points:['Observed the importance of precision in the hospital pharmacy environment.','Learned how collaboration and clear communication support patient safety.','Developed a broader understanding of the responsibilities behind safe medicine use.'],
      lesson:'Healthcare works best when careful science and thoughtful teamwork meet.'
    },
    retail: {
      period:'UNDERGRADUATE PRACTICAL EXPOSURE', kind:'Voluntary experience', title:'Retail Pharmacy Intern', company:'Community pharmacy, India',
      description:'Understanding the everyday connection between medicines and the people who use them.',
      points:['Learned to understand patients’ concerns and communicate with empathy.','Explored the day-to-day responsibilities behind safe medicine use.','Saw how patience and clear communication can make pharmaceutical knowledge more useful.'],
      lesson:'The most valuable conversations often start with listening.'
    }
  };
  const experienceTabs = $$('.experience-tab');
  function selectExperience(tab, focus = false) {
    const item = experience[tab.dataset.experience];
    experienceTabs.forEach(button => {
      const active = button === tab;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      button.classList.toggle('active', active);
    });
    const panel = $('#experience-panel');
    panel.setAttribute('aria-labelledby', tab.id);
    for (const key of ['period','kind','title','company','description','lesson']) $('#experience-' + key).textContent = item[key];
    $('#experience-points').replaceChildren(...item.points.map(text => {
      const li = document.createElement('li'); li.textContent = text; return li;
    }));
    if (!reducedMotion.matches) panel.animate([{opacity:.25,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}], {duration:300,easing:'ease-out'});
    if (focus) tab.focus();
  }
  experienceTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectExperience(tab));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % experienceTabs.length;
      else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index - 1 + experienceTabs.length) % experienceTabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = experienceTabs.length - 1;
      if (next !== undefined) { event.preventDefault(); selectExperience(experienceTabs[next], true); }
    });
  });

  const skillData = {
    'hplc-empower':['HPLC & Empower','At Cipla, I contributed to HPLC method development and validation and reviewed system suitability in Empower. I also used HPLC in tablet reverse engineering at Trinity College Dublin.'],
    gc:['GC & MassHunter','Gained practical experience with gas chromatography and MassHunter during analytical R&D internship at Cipla.'],
    nmr:['¹H NMR & Bruker','Used NMR spectral analysis and metabolite profiling to investigate the chemical composition of Forsythiae fructus extracts and compare the effects of different extraction solvents during my masters project.'],
    tlc:['Thin-layer chromatography','Developed phytochemical fingerprints of plant extracts during my master’s research. TLC also supported compound characterisation in the Eg5 inhibitor project.'],
    extraction:['Reflux extraction & solvent optimisation','Prepared four solvent extracts of Forsythiae fructus and investigated how solvent polarity influenced the phytochemical profile and biological activity.'],
    cells:['Mammalian cell culture','Independently maintained DLKP and DLKP-A lung cancer cell cultures, including thawing, seeding, passaging and expansion, with aseptic technique and contamination control.'],
    cytotoxicity:['Alamar Blue & MTT assay','Screened plant extracts for cytotoxic effects in lung cancer cell lines using Alamar Blue and MTT viability assays.'],
    mic:['Broth microdilution & MIC','Assessed antimicrobial effects against three bacterial strains and one fungal strain using broth microdilution,again durin my masters project'],
    lyophilisation:['Lyophilisation','Used freeze drying as part of the extract preparation toolkit in my master’s research, alongside reflux extraction and solvent optimisation.'],
    prism:['GraphPad Prism','Used GraphPad Prism for statistical analysis and visual presentation of experimental findings, including cell viability and biological activity data.'],
    pca:['PCA & ANOVA','Applied multivariate and statistical analysis to compare phytochemical profiles and experimental responses, exploring the relationship between extract composition and biological activity.'],
    systems:['Empower & LIMS','Used Empower for analytical data acquisition and review, and supported LIMS entries during my Cipla internship. My focus is on traceable records and reliable reporting.'],
    'bruker-masshunter':['Bruker & MassHunter','Bruker to support NMR data of Forsythiae fructus extracts research project and mass spectrometry was used during analytical internship at Cipla.'],
    quality:['GMP, GLP & data integrity','Bring a foundation in cGMP, GLP, approved-method and SOP adherence and documentation from regulated R&D, research and teaching laboratories.']
  };
  const skillCards = $$('.skill-card');
  const detail = $('#skill-detail');
  let selectedSkill;
  function closeSkill(restoreFocus = false) {
    detail.hidden = true;
    skillCards.forEach(card => card.setAttribute('aria-expanded', 'false'));
    if (restoreFocus && selectedSkill && !selectedSkill.hidden) selectedSkill.focus();
    selectedSkill = null;
  }
  skillCards.forEach(card => card.addEventListener('click', () => {
    if (selectedSkill === card) { closeSkill(); return; }
    selectedSkill = card;
    const [title, description] = skillData[card.dataset.skill];
    skillCards.forEach(button => button.setAttribute('aria-expanded', String(button === card)));
    $('#skill-detail-title').textContent = title;
    $('#skill-detail-text').textContent = description;
    detail.hidden = false;
    // Bring the panel into view only when it is outside the viewport.
    if (detail.getBoundingClientRect().bottom > window.innerHeight - 20) detail.scrollIntoView({behavior:reducedMotion.matches ? 'instant' : 'smooth',block:'nearest'});
  }));
  $('#skill-close').addEventListener('click', () => closeSkill(true));
  $$('.filter-button').forEach(button => button.addEventListener('click', () => {
    closeSkill();
    const filter = button.dataset.filter;
    $$('.filter-button').forEach(item => {
      item.classList.toggle('active', item === button);
      item.setAttribute('aria-pressed', String(item === button));
    });
    let shown = 0;
    skillCards.forEach(card => {
      const visible = filter === 'all' || card.dataset.category === filter;
      card.hidden = !visible;
      if (visible) {
        shown++;
        if (!reducedMotion.matches) card.animate([{opacity:0,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],{duration:280,easing:'ease-out'});
      }
    });
    $('#skill-filter-status').textContent = `${shown} techniques shown.`;
    refreshRevealLayout();
  }));

  const projects = {
    masters: {
      eyebrow:'MASTER’S RESEARCH · 2026', title:'Forsythiae fructus: from phytochemistry to biological activity.', image:'assets/research-masters.webp', alt:'Tanmayee presenting her master’s research poster',
      body:`<p><strong>The question:</strong> Can different extraction solvents reveal compounds with promising biological activity?</p><p>I investigated the phytochemical composition and biological activity of Forsythiae fructus using four different solvent extracts. The project connected laboratory preparation, biological screening and chemical analysis.</p><h3>How I explored it</h3><ul><li>Independently cultured DLKP and DLKP-A lung cancer cell lines, followed by Alamar Blue cytotoxicity screening and IC₅₀ determination.</li><li>Assessed antimicrobial effects against three bacterial strains and one fungal strain using broth microdilution and MIC testing.</li><li>Used TLC, ¹H NMR and PCA to explore relationships between extraction solvent, chemical composition and biological activity.</li></ul><h3>What I found</h3><ul><li>Ethyl acetate and ethanol extracts showed cytotoxicity against DLKP cell lines.</li><li>The 70% aqueous ethanol extract demonstrated antimicrobial activity against Staphylococcus species.</li></ul><p class="dialog-note">These are laboratory findings from a research project. Further work would be needed to establish the active compounds and their potential applications.</p>`,
      links:[['Read full portfolio','assets/Tanmayee_Tivarekar_Portfolio.pdf']]
    },
    eg5: {
      eyebrow:'INTERCITY RESEARCH COMPETITION · UNIVERSITY OF MUMBAI', title:'Designing potential anticancer agents.', image:'assets/research-eg5.webp', alt:'Tanmayee presenting the Eg5 anticancer research project',
      body:`<p><strong>Parallel Synthesis and SAR Studies of Mitotic Kinesin Eg5 Inhibitors as Anticancer Agents.</strong></p><p>This research combined medicinal chemistry, molecular docking and biological screening to investigate candidate anticancer compounds.</p><h3>From design to investigation</h3><ul><li>Designed and synthesised eight candidates across two chemical series using parallel synthesis and structure–activity relationship analysis.</li><li>Used TLC and FTIR spectroscopy for compound characterisation.</li><li>Identified ETB3 as the most promising lead among the synthesised candidates, with the strongest docking score and lowest GI₅₀ in HepG2 screening.</li></ul>`,
      links:[['View research materials','https://drive.google.com/drive/u/0/folders/1IZReCUjd7PyZcvMYdSr0H3s25nNIIBGn']]
    },
    catalyst: {
      eyebrow:'UNDERGRADUATE RESEARCH', title:'Finding possibility in the everyday.', image:'assets/research-catalyst.webp', alt:'Glassware and eggshell catalyst from the undergraduate research project',
      body:`<p><strong>Eggshell as a heterogeneous catalyst in organic transformations.</strong></p><p>My undergraduate research explored the use of eggshell as a catalyst in organic transformations, connecting an everyday material with a practical chemistry question.</p><h3>What it taught me</h3><p>The project strengthened my interest in experimental chemistry and in looking at familiar materials with a research mindset. It was an early opportunity to move from learning established ideas to investigating one in the laboratory.</p>`,
      links:[['Read full portfolio','assets/Tanmayee_Tivarekar_Portfolio.pdf']]
    },
    tablets: {
      eyebrow:'TRINITY COLLEGE DUBLIN · JANUARY–MARCH 2026', title:'Working backwards to understand a formulation.', image:null,
      body:`<p><strong>Reverse engineering of tablets.</strong></p><p>Working with an unknown tablet formulation, I used analytical methods to identify and quantify the active pharmaceutical ingredient and assess formulation quality.</p><h3>How I investigated it</h3><ul><li>Used UV-Vis, FTIR, HPLC, solubility testing and liquid–liquid extraction to investigate the API.</li><li>Confirmed identity using British Pharmacopoeia and European Pharmacopoeia methods.</li><li>Completed content uniformity, disintegration, friability and hardness testing, and reported results against pharmacopoeial limits.</li></ul><h3>What I took forward</h3><p>A systematic approach to unknown samples: choose complementary methods, document the reasoning and evaluate the result against defined criteria.</p>`,
      links:[['Download CV','assets/Tivarekar_Tanmayee_CV.pdf']]
    }
  };
  const dialog = $('#project-dialog');
  let projectTrigger;
  $$('[data-slideshow]').forEach(slideshow => {
    const slides = [...slideshow.querySelectorAll('.tablet-slide')];
    const counter = slideshow.querySelector('.tablet-slide-count');
    let activeSlide = 0;
    const showSlide = index => {
      activeSlide = (index + slides.length) % slides.length;
      slides.forEach((slide, slideIndex) => { slide.hidden = slideIndex !== activeSlide; });
      counter.textContent = `${String(activeSlide + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
    };
    slideshow.querySelector('.tablet-slide-previous').addEventListener('click', () => showSlide(activeSlide - 1));
    slideshow.querySelector('.tablet-slide-next').addEventListener('click', () => showSlide(activeSlide + 1));
  });
  function openProject(button) {
    const project = projects[button.dataset.project];
    projectTrigger = button;
    $('#dialog-eyebrow').textContent = project.eyebrow;
    $('#dialog-title').textContent = project.title;
    $('#dialog-body').innerHTML = project.body;
    const imageWrap = $('#dialog-image-wrap');
    imageWrap.hidden = !project.image;
    $('.dialog-shell').style.gridTemplateColumns = !project.image ? '1fr' : '';
    if (project.image) { $('#dialog-image').src = project.image; $('#dialog-image').alt = project.alt; }
    $('#dialog-links').replaceChildren(...project.links.map(([label, href]) => {
      const link = document.createElement('a');
      link.className = 'text-link'; link.href = href; link.textContent = label + ' ↗'; link.target = '_blank'; link.rel = 'noopener';
      return link;
    }));
    dialog.showModal();
    document.body.classList.add('modal-open');
    dialog.scrollTop = 0;
    $('.dialog-close').focus();
  }
  $$('[data-project]').forEach(button => button.addEventListener('click', () => openProject(button)));
  $('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const bounds = dialog.getBoundingClientRect();
    if(event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('modal-open');
    if(projectTrigger) projectTrigger.focus({preventScroll:true});
  });

  const copyButton = $('#copy-email');
  copyButton.addEventListener('click', async () => {
    const status = $('#copy-status');
    try {
      await navigator.clipboard.writeText('tanmayee.tivarekar@gmail.com');
      status.textContent = 'Copied!';
      copyButton.setAttribute('aria-label','Email address copied');
      setTimeout(() => { status.textContent = ''; copyButton.setAttribute('aria-label','Copy email address'); }, 3500);
    } catch {
      status.textContent = 'Select the address to copy.';
    }
  });
  $('#copyright-year').textContent = new Date().getFullYear();
})();
