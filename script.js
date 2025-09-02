(function () {
  'use strict';

  // Data simulation
  /** @type {Record<string, {username:string, city:string, role:'citizen'|'authority'|'admin', id:string, authorityId?:string, password?:string}>} */
  const users = {};
  /** @type {Array<{id:string, title:string, description:string, imageUrl?:string, social?:string, category:'Garbage'|'Water'|'Roads'|'Power', status:'Pending'|'In Progress'|'Resolved', postedBy:string, createdAt:number, authorityId?:string, updates?:Array<{message:string, timestamp:number, author:string}>}>} */
  const complaints = [
    { id: uid(), title: 'Overflowing bins on 5th Ave', description: 'Public trash bins are overflowing and attracting pests near the park entrance.', category: 'Garbage', status: 'Pending', postedBy: 'alex', createdAt: Date.now() - 1000 * 60 * 60 },
    { id: uid(), title: 'Broken water main', description: 'Water leak at Maple St & 3rd. Street is slippery and unsafe.', category: 'Water', status: 'In Progress', postedBy: 'sam', createdAt: Date.now() - 1000 * 60 * 90 },
    { id: uid(), title: 'Potholes on Oak Blvd', description: 'Large potholes across two lanes causing vehicle damage.', category: 'Roads', status: 'Pending', postedBy: 'jordan', createdAt: Date.now() - 1000 * 60 * 30 },
    { id: uid(), title: 'Street lights out', description: 'Several street lights have been out for a week around Pine Ave.', category: 'Power', status: 'Resolved', postedBy: 'lee', createdAt: Date.now() - 1000 * 60 * 300 }
  ];

  // Ratings: complaintId -> { total:number, count:number, userRatings: Record<string, number> }
  const ratingsByComplaintId = {};

  let currentUser = null; // { username, city, role, id, authorityId? }
  let theme = 'light';
  let currentCategory = 'All';
  let currentPublicCategory = 'All';
  let currentAuthorityCategory = 'All';
  
  // Authorities (admin-managed)
  /** @type {Array<{id:string, name:string, department:string, username?:string}>} */
  const authorities = [
    { id: uid(), name: 'Garbage Dept', department: 'Sanitation', username: 'garbage_dept' },
    { id: uid(), name: 'Water Authority', department: 'Utilities', username: 'water_dept' },
    { id: uid(), name: 'Roads Authority', department: 'Public Works', username: 'roads_dept' },
  ];
  
  // Alerts (admin-managed)
  const adminAlerts = [];
  
  // User activity logs
  const userActivityLogs = [];

  // Elements
  const els = {
    navToggle: document.getElementById('navToggle'),
    navMenu: document.getElementById('navMenu'),
    loginBtn: document.getElementById('loginBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    openReportBtn: document.getElementById('openReportBtn'),
    openReportBtn2: document.getElementById('openReportBtn2'),
    navLogoutBtn: document.getElementById('navLogoutBtn'),
    publicFeedList: document.getElementById('publicFeedList'),
    dashboard: document.getElementById('dashboard'),
    feedList: document.getElementById('feedList'),
    detailsBody: document.getElementById('detailsBody'),
    toasts: document.getElementById('toasts'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    loginModal: document.getElementById('loginModal'),
    postModal: document.getElementById('postModal'),
    usernameInput: document.getElementById('usernameInput'),
    citySelect: document.getElementById('citySelect'),
    passwordInput: document.getElementById('passwordInput'),
    usernameError: document.getElementById('usernameError'),
    cityError: document.getElementById('cityError'),
    passwordError: document.getElementById('passwordError'),
    loginForm: document.getElementById('loginForm'),
    postForm: document.getElementById('postForm'),
    postCategory: document.getElementById('postCategory'),
    postDescription: document.getElementById('postDescription'),
    postCategoryError: document.getElementById('postCategoryError'),
    postDescriptionError: document.getElementById('postDescriptionError'),
    inlinePostForm: document.getElementById('inlinePostForm'),
    inlineCategory: document.getElementById('inlineCategory'),
    inlineDescription: document.getElementById('inlineDescription'),
    inlineCategoryError: document.getElementById('inlineCategoryError'),
    inlineDescriptionError: document.getElementById('inlineDescriptionError'),
    inlineImageUrl: document.getElementById('inlineImageUrl'),
    inlineSocial: document.getElementById('inlineSocial'),
    adminSection: document.getElementById('admin'),
    adminNav: document.getElementById('adminNav'),
    adminComplaintSelect: document.getElementById('adminComplaintSelect'),
    adminAuthoritySelect: document.getElementById('adminAuthoritySelect'),
    adminAssignAuthority: document.getElementById('adminAssignAuthority'),
    adminMarkProgress: document.getElementById('adminMarkProgress'),
    adminMarkResolved: document.getElementById('adminMarkResolved'),
    adminDelete: document.getElementById('adminDelete'),
    authorityNameInput: document.getElementById('authorityNameInput'),
    authorityDeptInput: document.getElementById('authorityDeptInput'),
    addAuthorityBtn: document.getElementById('addAuthorityBtn'),
    authorityList: document.getElementById('authorityList'),
    adminAlertInput: document.getElementById('adminAlertInput'),
    addAdminAlertBtn: document.getElementById('addAdminAlertBtn'),
    adminAlertsList: document.getElementById('adminAlertsList'),
    chartStatus: document.getElementById('chartStatus'),
    chartCategory: document.getElementById('chartCategory'),
    demoUserBtn: document.getElementById('demoUserBtn'),
    demoAdminBtn: document.getElementById('demoAdminBtn'),
    navLinks: Array.from(document.querySelectorAll('.nav-link')),
    sections: {
      home: document.getElementById('home'),
      report: document.getElementById('report'),
      reported: document.getElementById('reported'),
      dashboard: document.getElementById('dashboard'),
      admin: document.getElementById('admin'),
    },
    postImageUrl: document.getElementById('postImageUrl'),
    postSocial: document.getElementById('postSocial'),
    // New admin registration inputs
    authorityUsernameInput: document.getElementById('authorityUsernameInput'),
    authorityPasswordInput: document.getElementById('authorityPasswordInput'),
    regCitizenUsername: document.getElementById('regCitizenUsername'),
    regCitizenPassword: document.getElementById('regCitizenPassword'),
    regCitizenCity: document.getElementById('regCitizenCity'),
    addCitizenBtn: document.getElementById('addCitizenBtn'),
    regAuthorityUsername: document.getElementById('regAuthorityUsername'),
    regAuthorityPassword: document.getElementById('regAuthorityPassword'),
    regAuthorityLink: document.getElementById('regAuthorityLink'),
    addAuthorityUserBtn: document.getElementById('addAuthorityUserBtn'),
  };

  // Navigation toggle for small screens
  if (els.navToggle) {
    els.navToggle.addEventListener('click', () => {
      const expanded = els.navToggle.getAttribute('aria-expanded') === 'true';
      els.navToggle.setAttribute('aria-expanded', String(!expanded));
      els.navMenu.classList.toggle('show');
    });
  }

  // Open login modal
  els.loginBtn?.addEventListener('click', () => openModal('loginModal'));

  // Theme toggle
  els.themeToggleBtn?.addEventListener('click', () => {
    theme = theme === 'light' ? 'dark' : 'light';
    applyTheme();
    saveState();
  });

  // Single-page section router
  function showSection(key) {
    Object.entries(els.sections).forEach(([name, node]) => {
      if (!node) return;
      if (name === key) {
        node.removeAttribute('data-hide');
        if (name === 'dashboard' && currentUser) {
          node.hidden = false;
        }
      } else {
        if (name === 'dashboard') {
          node.hidden = name === 'dashboard' ? (currentUser ? true : true) : false; // will be managed by auth
        }
        node.setAttribute('data-hide', 'true');
      }
    });
    els.navLinks.forEach(a => a.classList.toggle('is-active', a.getAttribute('data-section-target') === key));
    // scroll to top of revealed section
    const node = els.sections[key];
    node && node.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  els.navLinks.forEach(a => {
    a.addEventListener('click', (e) => {
      const target = a.getAttribute('data-section-target');
      if (!target) return;
      if (target === 'dashboard' && !currentUser) {
        e.preventDefault();
        notify('Please login to access the dashboard.');
        openModal('loginModal');
        return;
      }
      e.preventDefault();
      showSection(target);
    });
  });

  document.querySelectorAll('.js-show-section').forEach(el => {
    el.addEventListener('click', (e) => {
      const target = el.getAttribute('data-section-target');
      if (!target) return;
      e.preventDefault();
      showSection(target);
    });
  });

  // Log out (navbar)
  els.navLogoutBtn?.addEventListener('click', () => {
    currentUser = null;
    notify('You have been logged out.');
    updateAuthUI();
    // Return to Home to avoid hidden dashboard leaving a blank screen
    showSection('home');
    renderPublicFeed();
    renderFeed();
  });

  // Open report modal buttons
  [els.openReportBtn, els.openReportBtn2].forEach((btn) => {
    btn?.addEventListener('click', () => {
      if (!currentUser) {
        openModal('loginModal');
        notify('Please login to post a complaint.');
      } else {
        openModal('postModal');
        els.postCategory.focus();
      }
    });
  });

  // Filters
  document.querySelectorAll('.filters .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const scope = chip.getAttribute('data-scope') || 'dash';
      const container = chip.parentElement;
      container.querySelectorAll('.chip').forEach(c => { c.classList.remove('is-active'); c.setAttribute('aria-selected', 'false'); });
      chip.classList.add('is-active');
      chip.setAttribute('aria-selected', 'true');
      if (scope === 'public') {
        currentPublicCategory = chip.getAttribute('data-category') || 'All';
        renderPublicFeed();
      } else {
        currentCategory = chip.getAttribute('data-category') || 'All';
        renderFeed();
      }
    });
  });

  // Demo logins
  els.demoUserBtn?.addEventListener('click', () => {
    els.usernameInput.value = 'citizen';
    els.passwordInput.value = '';
    els.citySelect.value = 'Pune';
  });
  els.demoAdminBtn?.addEventListener('click', () => {
    els.usernameInput.value = 'admin';
    els.passwordInput.value = 'Admin@123';
    els.citySelect.value = 'Mumbai';
  });

  // Login form
  els.loginForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = (els.usernameInput.value || '').trim();
    const city = els.citySelect.value;
    const password = els.passwordInput ? els.passwordInput.value : '';

    let ok = true;
    if (username.length < 2) {
      els.usernameError.textContent = 'Please enter at least 2 characters.';
      ok = false;
    } else {
      els.usernameError.textContent = '';
    }
    if (!city) {
      els.cityError.textContent = 'Please select your city.';
      ok = false;
    } else {
      els.cityError.textContent = '';
    }
    if (!ok) return;

    // Admin credential check
    const normalized = username.toLowerCase();
    if (normalized === 'admin') {
      if (password !== 'Admin@123') {
        els.passwordError.textContent = 'Invalid admin password. Use Admin@123';
        return;
      } else {
        els.passwordError.textContent = '';
      }
    } else {
      els.passwordError.textContent = '';
    }
    
    if (!users[normalized]) {
      users[normalized] = { username: normalized, city };
      notify(`Welcome to CityWatch, ${normalized}!`);
    } else {
      notify(`Welcome back, ${normalized}!`);
    }
    currentUser = users[normalized];
    closeModal('loginModal');
    updateAuthUI();
    maybeRevealDashboard();
    // reveal dashboard if requested by nav earlier
    updateCharts();
    renderAuthorityList();
    saveState();
  });

  // Post form
  els.postForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!currentUser) {
      notify('Please login first.');
      return;
    }

    const category = els.postCategory.value;
    const description = (els.postDescription.value || '').trim();
    let ok = true;
    if (!category) { els.postCategoryError.textContent = 'Pick a category.'; ok = false; } else { els.postCategoryError.textContent = ''; }
    if (description.length < 10) { els.postDescriptionError.textContent = 'Min 10 characters.'; ok = false; } else { els.postDescriptionError.textContent = ''; }
    if (!ok) return;

    const title = generateTitleFromDescription(description, category);
    const newComplaint = {
      id: uid(),
      title,
      description,
      category: /** @type any */(category),
      status: 'Pending',
      postedBy: currentUser.username,
      createdAt: Date.now(),
      imageUrl: (els.postImageUrl && els.postImageUrl.value || '').trim() || undefined,
      social: (els.postSocial && els.postSocial.value || '').trim() || undefined,
    };
    complaints.unshift(newComplaint);
    notify('Complaint submitted successfully.');
    closeModal('postModal');
    els.postForm.reset();
    renderFeed();
    renderPublicFeed();
    updateCharts();
    saveState();
  });

  // Inline post form (visible section) two-step
  els.inlinePostForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!currentUser) { openModal('loginModal'); notify('Please login to submit an issue.'); return; }
    const description = (els.inlineDescription.value || '').trim();
    let ok = true;
    if (description.length < 10) { els.inlineDescriptionError.textContent = 'Min 10 characters.'; ok = false; } else { els.inlineDescriptionError.textContent = ''; }
    if (!ok) return;
    // show category step
    const step = document.getElementById('inlineCategoryStep');
    step.style.display = '';
    document.getElementById('inlineCategoryConfirm').onclick = () => {
      const category = els.inlineCategory.value;
      if (!category) { els.inlineCategoryError.textContent = 'Pick a category.'; return; } else { els.inlineCategoryError.textContent = ''; }
      const title = generateTitleFromDescription(description, category);
      const newComplaint = { id: uid(), title, description, category, status: 'Pending', postedBy: currentUser.username, createdAt: Date.now(), authorityId: undefined, imageUrl: (els.inlineImageUrl && els.inlineImageUrl.value || '').trim() || undefined, social: (els.inlineSocial && els.inlineSocial.value || '').trim() || undefined };
      complaints.unshift(newComplaint);
      step.style.display = 'none';
      els.inlinePostForm.reset();
      notify('Complaint submitted successfully.');
      renderFeed();
      renderPublicFeed();
      updateCharts();
      document.getElementById('reported').scrollIntoView({ behavior: 'smooth' });
    };
    document.getElementById('inlineCategoryBack').onclick = () => {
      step.style.display = 'none';
    };
  });

  // Modal close buttons and backdrop
  document.addEventListener('click', (e) => {
    const target = /** @type {HTMLElement} */(e.target);
    const closeId = target.getAttribute('data-close');
    if (closeId) closeModal(closeId);
  });

  // Keyboard: ESC to close top-most modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const open = document.querySelector('.modal[aria-hidden="false"]');
      if (open) {
        e.stopPropagation();
        open.setAttribute('aria-hidden', 'true');
      }
    }
  });

  // Initial render
  hydrateState();
  applyTheme();
  renderFeed();
  renderPublicFeed();
  updateAuthUI();
  // Initialize section visibility (home visible)
  showSection('home');

  // Status simulation: every 20s, move one Pending to In Progress and notify
  setInterval(() => {
    const idx = complaints.findIndex(c => c.status === 'Pending');
    if (idx !== -1) {
      complaints[idx].status = 'In Progress';
      const owner = complaints[idx].postedBy;
      if (currentUser && currentUser.username === owner) {
        notify(`Your complaint "${complaints[idx].title}" is now In Progress.`);
      }
      renderFeed();
      renderPublicFeed();
      updateCharts();
      saveState();
    }
  }, 20000);

  // Functions
  function renderFeed() {
    if (!els.feedList) return;
    els.feedList.innerHTML = '';
    const filtered = complaints.filter(c => currentCategory === 'All' ? true : c.category === currentCategory);
    if (filtered.length === 0) {
      els.feedList.innerHTML = '<p class="card" role="status">No complaints found for this category.</p>';
      return;
    }
    for (const c of filtered) {
      const card = document.createElement('button');
      card.className = 'feed-card';
      card.setAttribute('role', 'listitem');
      card.setAttribute('aria-label', `${c.title}. Status ${c.status}. Category ${c.category}. Posted by ${c.postedBy}.`);
      const authority = getAuthorityName(c.authorityId);
      card.innerHTML = `
        <h4 style="margin:0 0 6px">${escapeHTML(c.title)}</h4>
        ${c.imageUrl ? `<img src="${escapeHTML(c.imageUrl)}" alt="Attachment" style="width:100%;max-height:140px;object-fit:cover;border-radius:8px;margin:6px 0;" />` : ''}
        <p style="margin:0;color:#64748b">${escapeHTML(c.description.slice(0, 110))}${c.description.length>110?'…':''}</p>
        <div class="feed-card__meta">
          <span class="badge">${c.category}</span>
          ${renderStatusBadge(c.status)}
          <span>by @${escapeHTML(c.postedBy)}</span>
          ${authority ? `<span class="badge">${escapeHTML(authority)}</span>` : ''}
          ${renderRatingInline(c)}
        </div>
      `;
      card.addEventListener('click', () => renderDetails(c));
      els.feedList.appendChild(card);
    }
  }

  function renderPublicFeed() {
    if (!els.publicFeedList) return;
    els.publicFeedList.innerHTML = '';
    const filtered = complaints.filter(c => currentPublicCategory === 'All' ? true : c.category === currentPublicCategory);
    if (filtered.length === 0) {
      els.publicFeedList.innerHTML = '<p class="card" role="status">No complaints found for this category.</p>';
      return;
    }
    for (const c of filtered) {
      const card = document.createElement('a');
      card.href = '#dashboard';
      card.className = 'feed-card';
      card.setAttribute('role', 'listitem');
      card.setAttribute('aria-label', `${c.title}. Status ${c.status}. Category ${c.category}. Posted by ${c.postedBy}.`);
      const authority = getAuthorityName(c.authorityId);
      card.innerHTML = `
        <h4 style="margin:0 0 6px">${escapeHTML(c.title)}</h4>
        ${c.imageUrl ? `<img src="${escapeHTML(c.imageUrl)}" alt="Attachment" style="width:100%;max-height:140px;object-fit:cover;border-radius:8px;margin:6px 0;" />` : ''}
        <p style="margin:0;color:#64748b">${escapeHTML(c.description.slice(0, 110))}${c.description.length>110?'…':''}</p>
        <div class="feed-card__meta">
          <span class="badge">${c.category}</span>
          ${renderStatusBadge(c.status)}
          <span>by @${escapeHTML(c.postedBy)}</span>
          ${authority ? `<span class="badge">${escapeHTML(authority)}</span>` : ''}
          ${renderRatingInline(c)}
        </div>
      `;
      card.addEventListener('click', (e) => {
        e.preventDefault();
        showSection('dashboard');
        renderDetails(c);
      });
      els.publicFeedList.appendChild(card);
    }
  }

  function renderDetails(c) {
    if (!els.detailsBody) return;
    const authority = getAuthorityName(c.authorityId);
    els.detailsBody.innerHTML = `
      <div class="detail">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span class="badge">${c.category}</span>
          ${renderStatusBadge(c.status)}
        </div>
        <h4 style="margin:0 0 6px">${escapeHTML(c.title)}</h4>
        ${c.imageUrl ? `<img src="${escapeHTML(c.imageUrl)}" alt="Attachment" style="width:100%;max-height:220px;object-fit:cover;border-radius:10px;margin:6px 0;" />` : ''}
        <p style="margin:6px 0 10px;color:#475569">${escapeHTML(c.description)}</p>
        ${c.social ? `<p style=\"margin:0;color:#64748b\">Shared on: <strong>${escapeHTML(c.social)}</strong></p>` : ''}
        <p style="margin:0;color:#64748b">Posted by <strong>@${escapeHTML(c.postedBy)}</strong> · ${timeAgo(c.createdAt)}</p>
        ${authority ? `<p style="margin:6px 0 0;color:#64748b">Assigned to: <strong>${escapeHTML(authority)}</strong></p>` : ''}
        <div style="margin-top:10px">${renderRatingControls(c)}</div>
      </div>
    `;
    els.detailsBody.focus();
    attachRatingHandlers(c);
  }

  function renderStatusBadge(status) {
    const map = { 'Pending': 'badge--pending', 'In Progress': 'badge--progress', 'Resolved': 'badge--resolved' };
    return `<span class="badge ${map[status]}">${status}</span>`;
  }

  function getRatingData(complaintId) {
    if (!ratingsByComplaintId[complaintId]) {
      ratingsByComplaintId[complaintId] = { total: 0, count: 0, userRatings: {} };
    }
    return ratingsByComplaintId[complaintId];
  }

  function getAverageRating(complaintId) {
    const r = getRatingData(complaintId);
    return r.count === 0 ? 0 : r.total / r.count;
  }

  function renderRatingInline(c) {
    const avg = getAverageRating(c.id);
    const avgText = avg ? avg.toFixed(1) : '—';
    return `<span class="rating__avg" title="Average rating">★ ${avgText}</span>`;
  }

  function renderRatingControls(c) {
    const avg = getAverageRating(c.id);
    const canRate = currentUser && c.status === 'Resolved';
    const r = getRatingData(c.id);
    const myRating = currentUser ? (r.userRatings[currentUser.username] || 0) : 0;
    const stars = [1,2,3,4,5].map(n => `<button class="star ${n <= (myRating || Math.round(avg)) ? 'is-filled' : ''}" data-star="${n}" ${canRate ? '' : 'disabled'} aria-label="Rate ${n} star${n>1?'s':''}">★</button>`).join('');
    const note = canRate ? '' : `<span class="muted" style="margin-left:8px">${currentUser ? 'Rate after resolution' : 'Login to rate'}</span>`;
    return `<div class="rating"><div class="rating__stars">${stars}</div><span class="rating__avg">Avg ${avg ? avg.toFixed(1) : '—'}</span>${note}</div>`;
  }

  function attachRatingHandlers(c) {
    const wrap = els.detailsBody && els.detailsBody.querySelector('.rating__stars');
    if (!wrap) return;
    wrap.querySelectorAll('.star').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!currentUser) { notify('Login to rate'); openModal('loginModal'); return; }
        if (c.status !== 'Resolved') { notify('Rating available after resolution.'); return; }
        const n = Number(btn.getAttribute('data-star')) || 0;
        const data = getRatingData(c.id);
        const prev = data.userRatings[currentUser.username];
        if (prev) {
          data.total -= prev;
          data.count -= 1;
        }
        data.userRatings[currentUser.username] = n;
        data.total += n;
        data.count += 1;
        notify(`Thanks! You rated ${n} star${n>1?'s':''}.`);
        // Re-render details and lists to reflect averages
        renderDetails(c);
        renderFeed();
        renderPublicFeed();
        saveState();
      });
    });
  }

  // Persistence
  function saveState() {
    try {
      const state = {
        users,
        currentUser,
        complaints,
        ratingsByComplaintId,
        authorities,
        adminAlerts,
        userActivityLogs,
        theme,
      };
      localStorage.setItem('citywatch_state', JSON.stringify(state));
    } catch {}
  }

  function hydrateState() {
    try {
      const raw = localStorage.getItem('citywatch_state');
      if (!raw) return;
      const state = JSON.parse(raw);
      if (state && typeof state === 'object') {
        Object.assign(users, state.users || {});
        currentUser = state.currentUser || null;
        if (Array.isArray(state.complaints)) {
          complaints.splice(0, complaints.length, ...state.complaints);
        }
        if (state.ratingsByComplaintId && typeof state.ratingsByComplaintId === 'object') {
          Object.assign(ratingsByComplaintId, state.ratingsByComplaintId);
        }
        if (Array.isArray(state.authorities)) {
          authorities.splice(0, authorities.length, ...state.authorities);
        }
        if (Array.isArray(state.adminAlerts)) {
          adminAlerts.splice(0, adminAlerts.length, ...state.adminAlerts);
        }
        if (Array.isArray(state.userActivityLogs)) {
          userActivityLogs.splice(0, userActivityLogs.length, ...state.userActivityLogs);
        }
        theme = state.theme || 'light';
      }
    } catch {}
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
    if (els.themeToggleBtn) {
      els.themeToggleBtn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      els.themeToggleBtn.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
    }
  }

  function updateAuthUI() {
    const dash = els.dashboard;
    if (!dash) return;
    if (currentUser) {
      dash.hidden = false;
      document.querySelector('#dashboard .dashboard__header h2').textContent = `Your Dashboard · @${currentUser.username}`;
      document.getElementById('loginBtn').style.display = 'none';
      els.navLogoutBtn.style.display = '';
      // admin
      const isAdmin = currentUser.username.toLowerCase() === 'admin';
      els.adminNav.hidden = !isAdmin;
      els.adminSection.hidden = !isAdmin;
      if (isAdmin) { populateAdminSelect(); renderAuthorityOptions(); renderAuthorityList(); }
    } else {
      dash.hidden = true;
      document.getElementById('loginBtn').style.display = '';
      els.navLogoutBtn.style.display = 'none';
      els.adminNav.hidden = true;
      els.adminSection.hidden = true;
      // Ensure public sections remain visible
      showSection('home');
    }
    saveState();
  }

  function maybeRevealDashboard() {
    const dash = els.dashboard;
    if (dash && currentUser) {
      dash.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'false');
    // focus first field
    setTimeout(() => {
      const first = modal.querySelector('input, select, textarea, button');
      first && first.focus();
    }, 0);
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
  }

  function notify(message) {
    if (!els.toasts) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.role = 'status';
    toast.textContent = message;
    els.toasts.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  // Admin actions
  function populateAdminSelect() {
    if (!els.adminComplaintSelect) return;
    els.adminComplaintSelect.innerHTML = '';
    for (const c of complaints) {
      const opt = document.createElement('option');
      opt.value = c.id; opt.textContent = `${c.title} · ${c.status}`;
      els.adminComplaintSelect.appendChild(opt);
    }
  }

  function renderAuthorityOptions() {
    if (!els.adminAuthoritySelect) return;
    els.adminAuthoritySelect.innerHTML = '';
    for (const a of authorities) {
      const opt = document.createElement('option');
      opt.value = a.id; opt.textContent = `${a.name}`;
      els.adminAuthoritySelect.appendChild(opt);
    }
    // Also populate link dropdown in user registration
    if (els.regAuthorityLink) {
      els.regAuthorityLink.innerHTML = '';
      for (const a of authorities) {
        const opt = document.createElement('option');
        opt.value = a.id; opt.textContent = `${a.name}`;
        els.regAuthorityLink.appendChild(opt);
      }
    }
  }

  function renderAuthorityList() {
    if (!els.authorityList) return;
    els.authorityList.innerHTML = authorities.length ? `Registered: ${authorities.map(a => `<strong>${a.name}</strong> (${a.department})`).join(', ')}` : 'No authorities yet.';
  }

  // Admin: register authority org + optional authority login
  els.addAuthorityBtn?.addEventListener('click', () => {
    const name = (els.authorityNameInput?.value || '').trim();
    const dept = (els.authorityDeptInput?.value || '').trim();
    const uname = (els.authorityUsernameInput?.value || '').trim();
    const pwd = (els.authorityPasswordInput?.value || '').trim();
    if (!name || !dept) { notify('Enter authority name and department.'); return; }
    const newAuth = { id: uid(), name, department: dept, username: uname || undefined };
    authorities.push(newAuth);
    if (uname) {
      users[uname] = { username: uname, city: 'Mumbai', role: 'authority', id: uid(), authorityId: newAuth.id, password: pwd || 'ChangeMe@123' };
    }
    if (els.authorityNameInput) els.authorityNameInput.value = '';
    if (els.authorityDeptInput) els.authorityDeptInput.value = '';
    if (els.authorityUsernameInput) els.authorityUsernameInput.value = '';
    if (els.authorityPasswordInput) els.authorityPasswordInput.value = '';
    renderAuthorityOptions();
    renderAuthorityList();
    renderUserManagement?.();
    notify('Authority registered.');
    saveState();
  });

  // Admin: quick citizen registration
  els.addCitizenBtn?.addEventListener('click', () => {
    const uname = (els.regCitizenUsername?.value || '').trim().toLowerCase();
    const pwd = (els.regCitizenPassword?.value || '').trim();
    const city = els.regCitizenCity?.value || 'Pune';
    if (!uname) { notify('Enter a citizen username.'); return; }
    if (users[uname]) { notify('Username already exists.'); return; }
    users[uname] = { username: uname, city, role: 'citizen', id: uid(), password: pwd || undefined };
    els.regCitizenUsername.value = '';
    els.regCitizenPassword.value = '';
    renderUserManagement?.();
    notify('Citizen registered.');
    saveState();
  });

  // Admin: quick authority user registration
  els.addAuthorityUserBtn?.addEventListener('click', () => {
    const uname = (els.regAuthorityUsername?.value || '').trim().toLowerCase();
    const pwd = (els.regAuthorityPassword?.value || '').trim();
    const authId = els.regAuthorityLink?.value;
    if (!uname || !pwd || !authId) { notify('Enter username, password and select authority.'); return; }
    if (users[uname]) { notify('Username already exists.'); return; }
    users[uname] = { username: uname, city: 'Mumbai', role: 'authority', id: uid(), authorityId: authId, password: pwd };
    els.regAuthorityUsername.value = '';
    els.regAuthorityPassword.value = '';
    renderUserManagement?.();
    notify('Authority user registered.');
    saveState();
  });

  els.adminAssignAuthority?.addEventListener('click', () => {
    const cid = els.adminComplaintSelect?.value; if (!cid) return;
    const aid = els.adminAuthoritySelect?.value; if (!aid) return;
    const c = complaints.find(x => x.id === cid); if (!c) return;
    c.authorityId = aid;
    notify('Authority assigned.');
    renderFeed(); renderPublicFeed();
    saveState();
  });

  els.adminMarkProgress?.addEventListener('click', () => {
    const id = els.adminComplaintSelect?.value; if (!id) return;
    const c = complaints.find(x => x.id === id); if (!c) return;
    c.status = 'In Progress';
    notify(`Marked "${c.title}" as In Progress.`);
    populateAdminSelect();
    renderFeed();
    renderPublicFeed();
    updateCharts();
  });

  els.adminMarkResolved?.addEventListener('click', () => {
    const id = els.adminComplaintSelect?.value; if (!id) return;
    const c = complaints.find(x => x.id === id); if (!c) return;
    c.status = 'Resolved';
    notify(`Marked "${c.title}" as Resolved.`);
    populateAdminSelect();
    renderFeed();
    renderPublicFeed();
    updateCharts();
  });

  els.adminDelete?.addEventListener('click', () => {
    const id = els.adminComplaintSelect?.value; if (!id) return;
    const idx = complaints.findIndex(x => x.id === id); if (idx === -1) return;
    const [removed] = complaints.splice(idx, 1);
    notify(`Deleted "${removed.title}".`);
    populateAdminSelect();
    renderFeed();
    renderPublicFeed();
    updateCharts();
    saveState();
  });

  // Admin Alerts
  els.addAdminAlertBtn?.addEventListener('click', () => {
    const text = (els.adminAlertInput.value || '').trim();
    if (!text) { notify('Enter an alert.'); return; }
    adminAlerts.unshift({ id: uid(), text, createdAt: Date.now() });
    els.adminAlertInput.value = '';
    renderAdminAlerts();
    notify('Alert posted.');
    saveState();
  });

  function renderAdminAlerts() {
    if (!els.adminAlertsList) return;
    els.adminAlertsList.innerHTML = '';
    for (const a of adminAlerts) {
      const li = document.createElement('li');
      li.textContent = `${a.text}`;
      els.adminAlertsList.appendChild(li);
    }
  }

  // Simple charts (no external libs)
  function updateCharts() {
    renderBarChart(els.chartStatus, countByStatus());
    renderBarChart(els.chartCategory, countByCategory());
  }

  function countByStatus() {
    const map = { 'Pending': 0, 'In Progress': 0, 'Resolved': 0 };
    for (const c of complaints) map[c.status] = (map[c.status] || 0) + 1;
    return map;
  }

  function countByCategory() {
    const map = { 'Garbage': 0, 'Water': 0, 'Roads': 0, 'Power': 0 };
    for (const c of complaints) map[c.category] = (map[c.category] || 0) + 1;
    return map;
  }

  function renderBarChart(canvas, dataMap) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const labels = Object.keys(dataMap);
    const values = Object.values(dataMap);
    const w = canvas.width = canvas.clientWidth;
    const h = canvas.height = canvas.clientHeight;
    ctx.clearRect(0,0,w,h);
    const max = Math.max(1, ...values);
    const barWidth = (w - 40) / labels.length;
    labels.forEach((label, i) => {
      const val = values[i];
      const barHeight = (h - 40) * (val / max);
      const x = 20 + i * barWidth + 8;
      const y = h - 20 - barHeight;
      ctx.fillStyle = '#3366ff';
      ctx.fillRect(x, y, barWidth - 16, barHeight);
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'center';
      ctx.fillText(label, x + (barWidth-16)/2, h - 6);
      ctx.fillText(String(val), x + (barWidth-16)/2, y - 6);
    });
  }

  function getAuthorityName(id) {
    if (!id) return '';
    const a = authorities.find(x => x.id === id);
    return a ? a.name : '';
  }

  function escapeHTML(str) {
    return str.replace(/[&<>"] /g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',' ':' ' }[s]));
  }

  function timeAgo(ts) {
    const seconds = Math.floor((Date.now() - ts) / 1000);
    const intervals = [
      ['year', 31536000],
      ['month', 2592000],
      ['day', 86400],
      ['hour', 3600],
      ['minute', 60],
    ];
    for (const [label, secs] of intervals) {
      const v = Math.floor(seconds / secs);
      if (v >= 1) return `${v} ${label}${v>1?'s':''} ago`;
    }
    return 'just now';
  }

  function generateTitleFromDescription(desc, category) {
    const first = desc.split(/[.!?\n]/)[0].trim();
    const short = first.length > 50 ? first.slice(0, 47) + '…' : first;
    return short || `${category} issue reported`;
  }

  function uid() {
    return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  }
})();

// Admin tabs switching
(function setupAdminTabs(){
  const tabsContainer = document.querySelector('#admin .user-tabs');
  if (!tabsContainer) return;
  tabsContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    const tab = btn.getAttribute('data-tab');
    if (!tab) return;
    tabsContainer.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const content = document.getElementById('userManagementContent');
    if (!content) return;
    content.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    const activePane = document.getElementById(tab + 'Tab');
    if (activePane) activePane.classList.add('active');
  });
})();

// Ensure admin lists and selectors populate when admin section becomes visible
const adminObserver = new MutationObserver(() => {
  if (els.adminSection && !els.adminSection.hidden && currentUser && (currentUser.role === 'admin' || currentUser.username === 'admin')) {
    renderAuthorityOptions();
    renderAuthorityList();
    renderUserManagement?.();
  }
});
if (els.adminSection) {
  adminObserver.observe(els.adminSection, { attributes: true, attributeFilter: ['hidden'] });
}


