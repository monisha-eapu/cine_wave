/* ==============================================================================
   CineWave - Movie Ticket Booking System Frontend Application Engine
   Prepared for: Monisha (Centurion University)
   Supports dual mode: Live PostgreSQL API Backend + Fallback Seed State
   ============================================================================== */

const API_BASE = '/api';
const LOCAL_DEMO_PROFILES = [
  { user_id: 2, name: 'Demo Customer', role: 'CUSTOMER' },
  { user_id: 1, name: 'Demo Admin', role: 'ADMIN' }
];

function getLocalDemoUsers() {
  const savedUsers = JSON.parse(localStorage.getItem('cinewave_local_users') || '[]');
  const additionalUsers = savedUsers.filter(user =>
    !LOCAL_DEMO_PROFILES.some(profile => Number(user.user_id) === profile.user_id)
  );
  return [...LOCAL_DEMO_PROFILES, ...additionalUsers];
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateOffsetString(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return localDateString(date);
}

function normalizeShowDate(value) {
  if (value === 'Today') return dateOffsetString(0);
  if (value === 'Tomorrow') return dateOffsetString(1);
  return String(value || '').slice(0, 10);
}

function getShowStart(show) {
  const date = normalizeShowDate(show.show_date);
  const match = String(show.show_time || '').match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!date || !match) return new Date(NaN);
  let hours = Number(match[1]);
  const meridiem = match[4] && match[4].toUpperCase();
  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day, hours, Number(match[2]), Number(match[3] || 0));
}

function formatShowDate(value, options = { weekday: 'short', day: 'numeric', month: 'short' }) {
  const date = normalizeShowDate(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return String(value || '');
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, options).format(new Date(year, month - 1, day));
}

function formatShowTime(value) {
  const start = getShowStart({ show_date: dateOffsetString(0), show_time: value });
  return Number.isNaN(start.getTime())
    ? String(value || '')
    : new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(start);
}

function showHasStarted(show) {
  return getShowStart(show).getTime() <= Date.now();
}

function cancellationIsBlocked(show) {
  return getShowStart(show).getTime() - Date.now() < 2 * 60 * 60 * 1000;
}

// Application State
const state = {
  currentUser: JSON.parse(localStorage.getItem('cinewave_user')) || null,
  authToken: localStorage.getItem('cinewave_auth_token') || '',
  movies: [],
  shows: [],
  screens: [],
  selectedShow: null,
  selectedSeats: new Set(),
  dbOnline: false,
  selectedDateByMovie: {},
  availableDatesByMovie: {},
  filteredShowsByMovieDate: {},
  loadingMovieDates: new Set(),
  movieDateErrors: {},
  historyBookings: [],
  historyTab: 'upcoming',
  adminReports: null,
  adminCharts: {},
  nextShowAt: null,
  
  // Local fallback data structure if PostgreSQL server is not yet running locally
  localData: {
    users: getLocalDemoUsers(),
    movies: [
      {
        movie_id: 1,
        title: 'Oppenheimer',
        genre: 'Biography / Drama',
        language: 'English',
        duration_min: 180,
        rating: 'R',
        poster_path: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=600&q=80',
        description: 'The story of J. Robert Oppenheimer and the creation of the atomic bomb.'
      },
      {
        movie_id: 2,
        title: 'Dune: Part Two',
        genre: 'Sci-Fi / Action',
        language: 'English',
        duration_min: 166,
        rating: 'PG-13',
        poster_path: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80',
        description: 'Paul Atreides unites with Chani and the Fremen to seek revenge against conspirators.'
      },
      {
        movie_id: 3,
        title: 'Avatar: The Way of Water',
        genre: 'Sci-Fi / Adventure',
        language: 'English',
        duration_min: 192,
        rating: 'PG-13',
        poster_path: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&q=80',
        description: 'Jake Sully lives with his family on Pandora when a familiar threat returns.'
      },
      {
        movie_id: 4,
        title: 'Interstellar',
        genre: 'Sci-Fi / Drama',
        language: 'English',
        duration_min: 169,
        rating: 'PG-13',
        poster_path: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=600&q=80',
        description: 'Explorers travel through a wormhole in space in an attempt to ensure humanity survival.'
      }
    ],
    shows: [
      { show_id: 1, movie_id: 1, screen_id: 1, theatre_name: 'CineWave Grand Theatre', screen_name: 'Screen 1 (IMAX 70mm)', show_date: dateOffsetString(1), show_time: '19:00:00', price_silver: 12.00, price_gold: 18.00, price_platinum: 25.00 },
      { show_id: 2, movie_id: 2, screen_id: 2, theatre_name: 'CineWave Grand Theatre', screen_name: 'Screen 2 (Dolby Cinema)', show_date: dateOffsetString(1), show_time: '16:00:00', price_silver: 10.00, price_gold: 15.00, price_platinum: 22.00 },
      { show_id: 3, movie_id: 3, screen_id: 1, theatre_name: 'CineWave Grand Theatre', screen_name: 'Screen 1 (IMAX 70mm)', show_date: dateOffsetString(2), show_time: '13:00:00', price_silver: 11.00, price_gold: 16.00, price_platinum: 24.00 },
      { show_id: 4, movie_id: 4, screen_id: 2, theatre_name: 'CineWave Grand Theatre', screen_name: 'Screen 2 (Dolby Cinema)', show_date: dateOffsetString(2), show_time: '18:15:00', price_silver: 12.00, price_gold: 17.00, price_platinum: 25.00 }
    ],
    bookings: JSON.parse(localStorage.getItem('cinewave_local_bookings')) || [
      {
        booking_id: 1,
        booking_ref: 'BK-984210',
        user_id: 2,
        movie_title: 'Oppenheimer',
        poster_path: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=600&q=80',
        theatre_name: 'CineWave Grand Theatre',
        screen_name: 'Screen 1 (IMAX 70mm)',
        show_date: dateOffsetString(1),
        show_time: '19:00:00',
        seat_number: 'A1, A2',
        amount: 24.00,
        genre: 'Biography / Drama',
        status: 'CONFIRMED',
        booking_time: new Date().toISOString()
      }
    ],
    bookedSeatsByShow: JSON.parse(localStorage.getItem('cinewave_local_booked_seats')) || { 1: [1, 2] }
  }
};

// ==============================================================================
// INITIALIZATION & DOM EVENTS
// ==============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('showDate').min = localDateString();
  await checkDatabaseHealth();
  setupEventListeners();
  await loadMoviesAndShows();
  
  if (state.currentUser) {
    showMainCatalogView();
  } else {
    showAuthLandingView();
  }
  updateAuthUI();
});

// Check PostgreSQL DB connection
async function checkDatabaseHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (res.ok) {
      state.dbOnline = true;
      return;
    }
  } catch (err) {
    // DB or server offline fallback
  }

  state.dbOnline = false;
}

// Setup Event Listeners
function setupEventListeners() {
  // Brand Logo Click
  document.getElementById('brandBtn').addEventListener('click', () => {
    if (state.currentUser) showMainCatalogView();
    else showAuthLandingView();
  });

  // Navigation Links
  document.getElementById('navMoviesBtn').addEventListener('click', () => {
    showMainCatalogView();
    switchView('movies');
  });
  document.getElementById('navHistoryBtn').addEventListener('click', () => {
    showMainCatalogView();
    switchView('history');
  });
  document.getElementById('navAdminBtn').addEventListener('click', () => {
    showMainCatalogView();
    switchView('admin');
  });

  // Auth Landing View Button
  document.getElementById('openAuthModal').addEventListener('click', showAuthLandingView);

  // Auth Mode Tabs Switcher (Sign In vs New User Registration)
  document.getElementById('tabLoginBtn').addEventListener('click', () => switchAuthTab('login'));
  document.getElementById('tabRegisterBtn').addEventListener('click', () => switchAuthTab('register'));
  document.querySelectorAll('.demo-login-btn').forEach(button => {
    button.addEventListener('click', () => loginWithDemoRole(button.dataset.demoRole));
  });

  // Skip to Catalog Button
  document.getElementById('skipToCatalogBtn').addEventListener('click', showMainCatalogView);

  // Hero Book Button
  document.getElementById('heroBookBtn').addEventListener('click', () => {
    const firstShow = state.shows.find(s => s.movie_id === 1) || state.shows[0];
    if (firstShow) openSeatModal(firstShow);
  });

  // Search & Filter
  document.getElementById('searchInput').addEventListener('input', renderMoviesGrid);
  document.getElementById('genreFilter').addEventListener('change', renderMoviesGrid);
  document.getElementById('moviesGrid').addEventListener('click', event => {
    const dateButton = event.target.closest('.date-chip');
    const showButton = event.target.closest('.showtime-btn');
    if (dateButton) {
      selectMovieDate(Number(dateButton.dataset.movieId), dateButton.dataset.date);
    } else if (showButton) {
      window.openSeatModalById(showButton.dataset.showId);
    }
  });

  document.getElementById('historyUpcomingTab').addEventListener('click', () => {
    state.historyTab = 'upcoming';
    renderUserBookings();
  });
  document.getElementById('historyPastTab').addEventListener('click', () => {
    state.historyTab = 'past';
    renderUserBookings();
  });
  ['historySearch', 'historyFromDate', 'historyToDate', 'historyStatus'].forEach(id => {
    const element = document.getElementById(id);
    element.addEventListener('input', renderUserBookings);
    element.addEventListener('change', renderUserBookings);
  });
  setInterval(renderNextShowCountdown, 60000);

  document.getElementById('applyReportRange').addEventListener('click', () => loadAdminReports());
  document.querySelectorAll('.report-quick-filter').forEach(button => {
    button.addEventListener('click', () => setQuickReportRange(Number(button.dataset.days)));
  });
  document.getElementById('exportReportCsv').addEventListener('click', exportAdminReportCsv);

  // Auth Forms
  document.getElementById('loginForm').addEventListener('submit', handleLoginSubmit);
  document.getElementById('registerForm').addEventListener('submit', handleRegisterSubmit);
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);

  // Seat Modal Actions
  document.getElementById('closeSeatModal').addEventListener('click', () => closeModal('seatModal'));
  document.getElementById('confirmBookingBtn').addEventListener('click', handleConfirmBooking);
  document.getElementById('paymentMethod').addEventListener('change', updateSeatSummary);

  // Ticket Modal Actions
  document.getElementById('closeTicketModal').addEventListener('click', () => closeModal('ticketModal'));
  document.getElementById('viewBookingsBtn').addEventListener('click', () => {
    closeModal('ticketModal');
    showMainCatalogView();
    switchView('history');
  });

  // Admin Sub-Tabs
  document.getElementById('tabReports').addEventListener('click', () => switchAdminTab('reports'));
  document.getElementById('tabAddMovie').addEventListener('click', () => switchAdminTab('addMovie'));
  document.getElementById('tabCreateShow').addEventListener('click', () => switchAdminTab('createShow'));

  // Admin Forms
  document.getElementById('addMovieForm').addEventListener('submit', handleAddMovieSubmit);
  document.getElementById('createShowForm').addEventListener('submit', handleCreateShowSubmit);
}

// ==============================================================================
// LAYOUT & AUTH TAB SWITCHERS
// ==============================================================================

function showAuthLandingView() {
  document.getElementById('authPageWrapper').classList.remove('hidden');
  document.getElementById('mainAppLayout').classList.add('hidden');
  switchAuthTab('login');
}

function showMainCatalogView() {
  document.getElementById('authPageWrapper').classList.add('hidden');
  document.getElementById('mainAppLayout').classList.remove('hidden');
  switchView('movies');
}

function switchAuthTab(mode) {
  const tabLogin = document.getElementById('tabLoginBtn');
  const tabReg = document.getElementById('tabRegisterBtn');
  const loginForm = document.getElementById('loginForm');
  const regForm = document.getElementById('registerForm');

  if (mode === 'login') {
    tabLogin.classList.add('active');
    tabReg.classList.remove('active');
    loginForm.classList.remove('hidden');
    regForm.classList.add('hidden');
  } else {
    tabReg.classList.add('active');
    tabLogin.classList.remove('active');
    regForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
  }
}

function switchView(viewName) {
  const sections = {
    movies: document.getElementById('moviesSection'),
    history: document.getElementById('historySection'),
    admin: document.getElementById('adminSection')
  };

  const navBtns = {
    movies: document.getElementById('navMoviesBtn'),
    history: document.getElementById('navHistoryBtn'),
    admin: document.getElementById('navAdminBtn')
  };

  Object.keys(sections).forEach(key => {
    if (sections[key]) sections[key].classList.add('hidden');
    if (navBtns[key]) navBtns[key].classList.remove('active');
  });

  if (sections[viewName]) sections[viewName].classList.remove('hidden');
  if (navBtns[viewName]) navBtns[viewName].classList.add('active');

  const hero = document.getElementById('heroBanner');
  if (viewName === 'movies') hero.classList.remove('hidden');
  else hero.classList.add('hidden');

  if (viewName === 'history') loadUserBookings();
  if (viewName === 'admin') loadAdminReports();
}

function updateAuthUI() {
  const loggedOutView = document.getElementById('loggedOutView');
  const loggedInView = document.getElementById('loggedInView');
  const navHistoryBtn = document.getElementById('navHistoryBtn');
  const navAdminBtn = document.getElementById('navAdminBtn');
  const demoQuickLogins = document.getElementById('demoQuickLogins');
  demoQuickLogins.classList.toggle('hidden', state.dbOnline || Boolean(state.currentUser));

  if (state.currentUser) {
    loggedOutView.classList.add('hidden');
    loggedInView.classList.remove('hidden');
    navHistoryBtn.classList.remove('hidden');

    document.getElementById('userNameDisplay').textContent = state.currentUser.name;
    document.getElementById('userRoleDisplay').textContent = state.currentUser.role;
    document.getElementById('userAvatar').textContent = state.currentUser.name.charAt(0).toUpperCase();

    if (state.currentUser.role === 'ADMIN') {
      navAdminBtn.classList.remove('hidden');
    } else {
      navAdminBtn.classList.add('hidden');
    }
  } else {
    loggedOutView.classList.remove('hidden');
    loggedInView.classList.add('hidden');
    navHistoryBtn.classList.add('hidden');
    navAdminBtn.classList.add('hidden');
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  if (state.dbOnline) {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      state.currentUser = data.user;
      state.authToken = data.token;
      if (!state.authToken) throw new Error('Login response did not include an access token.');
    } catch (err) {
      showToast(err.message, 'error');
      return;
    }
  } else {
    // Fallback authentication
    const user = state.localData.users.find(u =>
      String(u.email || '').toLowerCase() === email.toLowerCase() || String(u.user_id) === email
    );
    if (!user || !user.password || user.password !== password) {
      showToast('Invalid login credentials.', 'error');
      return;
    }
    state.currentUser = { ...user };
    state.authToken = '';
    localStorage.removeItem('cinewave_auth_token');
  }

  localStorage.setItem('cinewave_user', JSON.stringify(state.currentUser));
  if (state.authToken) localStorage.setItem('cinewave_auth_token', state.authToken);
  updateAuthUI();
  showMainCatalogView();
  showToast(`Welcome back, ${state.currentUser.name}!`, 'success');
}

function loginWithDemoRole(role) {
  if (state.dbOnline) {
    showToast('Quick demo login is available only when PostgreSQL is offline.', 'error');
    return;
  }
  const user = state.localData.users.find(candidate => candidate.role === role);
  if (!user) {
    showToast(`No local ${role.toLowerCase()} demo account is available.`, 'error');
    return;
  }
  const { password: _, ...userWithoutPassword } = user;
  state.currentUser = userWithoutPassword;
  state.authToken = '';
  localStorage.removeItem('cinewave_auth_token');
  localStorage.setItem('cinewave_user', JSON.stringify(state.currentUser));
  updateAuthUI();
  showMainCatalogView();
  showToast(`Demo ${role.toLowerCase()} session started.`, 'success');
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('regName').value;
  const email = document.getElementById('regEmail').value;
  const phone = document.getElementById('regPhone').value;
  const password = document.getElementById('regPassword').value;
  if (state.dbOnline) {
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, phone })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      state.currentUser = data.user;
    } catch (err) {
      showToast(err.message, 'error');
      return;
    }
  } else {
    const newUser = { user_id: Date.now(), name, email, password, phone, role: 'CUSTOMER' };
    state.localData.users.push(newUser);
    localStorage.setItem('cinewave_local_users', JSON.stringify(state.localData.users));
    const { password: _, ...userWithoutPassword } = newUser;
    state.currentUser = userWithoutPassword;
  }

  localStorage.setItem('cinewave_user', JSON.stringify(state.currentUser));
  updateAuthUI();
  showMainCatalogView();
  showToast('New user account registered successfully! Welcome to CineWave.', 'success');
}

function handleLogout() {
  state.currentUser = null;
  state.authToken = '';
  localStorage.removeItem('cinewave_user');
  localStorage.removeItem('cinewave_auth_token');
  updateAuthUI();
  showAuthLandingView();
  showToast('Logged out successfully.', 'info');
}

// ==============================================================================
// MOVIE CATALOG & SHOWTIMES RENDERER
// ==============================================================================

async function loadMoviesAndShows() {
  if (state.dbOnline) {
    try {
      const [movRes, showRes] = await Promise.all([
        fetch(`${API_BASE}/movies`),
        fetch(`${API_BASE}/shows`)
      ]);
      if (!movRes.ok || !showRes.ok) {
        throw new Error('Unable to load movies or showtimes from the database.');
      }
      state.movies = await movRes.json();
      state.shows = await showRes.json();
    } catch (err) {
      console.error('API Load error', err);
      state.dbOnline = false;
      state.movies = state.localData.movies;
      state.shows = getLocalShows();
      updateAuthUI();
    }
  } else {
    state.movies = state.localData.movies;
    state.shows = getLocalShows();
  }

  renderMoviesGrid();
  populateAdminMovieSelect();
}

function renderMoviesGrid() {
  const grid = document.getElementById('moviesGrid');
  const searchVal = document.getElementById('searchInput').value.toLowerCase();
  const genreVal = document.getElementById('genreFilter').value;

  const filteredMovies = state.movies.filter(movie => {
    const matchesSearch = movie.title.toLowerCase().includes(searchVal) || movie.genre.toLowerCase().includes(searchVal);
    const matchesGenre = (genreVal === 'ALL') || movie.genre.includes(genreVal);
    return matchesSearch && matchesGenre;
  });

  if (filteredMovies.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">No movies match your filter criteria.</div>`;
    return;
  }

  grid.innerHTML = filteredMovies.map(movie => {
    const movieId = Number(movie.movie_id);
    const selectedDate = state.selectedDateByMovie[movieId] || dateOffsetString(0);
    const dateStrip = Array.from({ length: 7 }, (_, index) => {
      const date = dateOffsetString(index);
      return `
        <button type="button"
          class="date-chip ${date === selectedDate ? 'active' : ''} ${index === 0 ? 'today' : ''}"
          data-movie-id="${movieId}" data-date="${date}"
          aria-pressed="${date === selectedDate}">
          <span>${formatShowDate(date, { weekday: 'short' })}</span>
          <strong>${formatShowDate(date, { day: 'numeric', month: 'short' })}</strong>
        </button>
      `;
    }).join('');

    return `
      <div class="movie-card">
        <div class="poster-wrapper">
          <img src="${movie.poster_path || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba'}" alt="${movie.title}" class="movie-poster">
          <span class="rating-badge">${movie.rating || 'PG-13'}</span>
          <span class="genre-tag">${movie.genre.split('/')[0]}</span>
        </div>
        <div class="movie-info">
          <h3 class="movie-card-title">${movie.title}</h3>
          <div class="movie-card-meta">
            <span><i class="fa-regular fa-clock"></i> ${movie.duration_min} mins</span>
            <span><i class="fa-solid fa-language"></i> ${movie.language}</span>
          </div>
          <div class="showtimes-label">Choose a date</div>
          <div class="date-strip" aria-label="Show dates for ${movie.title}">${dateStrip}</div>
          <div class="showtimes-label">Showtimes · ${formatShowDate(selectedDate)}</div>
          <div class="showtimes-grid" id="showtimes-${movieId}">
            ${renderMovieShowtimes(movie, selectedDate)}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function getLocalShows() {
  return state.localData.shows.map(show => {
    const movie = state.localData.movies.find(item => Number(item.movie_id) === Number(show.movie_id));
    return {
      ...show,
      movie_title: show.movie_title || movie?.title || 'Movie',
      poster_path: show.poster_path || movie?.poster_path || '',
      genre: show.genre || movie?.genre || '',
      language: show.language || movie?.language || '',
      duration_min: show.duration_min || movie?.duration_min || 0,
      rating: show.rating || movie?.rating || ''
    };
  });
}

function renderMovieShowtimes(movie, date) {
  const movieId = Number(movie.movie_id);
  const cacheKey = `${movieId}:${date}`;
  if (state.loadingMovieDates.has(cacheKey)) {
    return '<p class="showtimes-state" role="status">Loading showtimes…</p>';
  }
  if (state.movieDateErrors[cacheKey]) {
    return `<p class="showtimes-state error-message" role="alert">${state.movieDateErrors[cacheKey]}</p>`;
  }

  const availableDates = state.availableDatesByMovie[movieId];
  if (availableDates && !availableDates.includes(date)) {
    return '<p class="showtimes-state">No shows on this date</p>';
  }

  let shows = Object.prototype.hasOwnProperty.call(state.filteredShowsByMovieDate, cacheKey)
    ? state.filteredShowsByMovieDate[cacheKey]
    : state.shows.filter(show => Number(show.movie_id) === movieId && normalizeShowDate(show.show_date) === date);

  shows = shows.filter(show => !showHasStarted(show));
  if (shows.length === 0) {
    return '<p class="showtimes-state">No shows on this date</p>';
  }

  const groups = new Map();
  shows.forEach(show => {
    const groupName = `${show.theatre_name || 'Theatre'} · ${show.screen_name || `Screen ${show.screen_id}`}`;
    if (!groups.has(groupName)) groups.set(groupName, []);
    groups.get(groupName).push(show);
  });

  return Array.from(groups, ([groupName, groupShows]) => `
    <div class="showtime-group">
      <h4>${groupName}</h4>
      <div class="showtime-options">
        ${groupShows.map(show => `
          <button class="showtime-btn" type="button" data-show-id="${show.show_id}">
            ${formatShowTime(show.show_time)}
          </button>
        `).join('')}
      </div>
    </div>
  `).join('');
}

async function selectMovieDate(movieId, date) {
  state.selectedDateByMovie[movieId] = date;
  const cacheKey = `${movieId}:${date}`;
  delete state.movieDateErrors[cacheKey];
  renderMoviesGrid();

  const movie = state.movies.find(item => Number(item.movie_id) === movieId);
  if (!movie) return;

  state.loadingMovieDates.add(cacheKey);
  renderMoviesGrid();
  try {
    if (state.dbOnline) {
      if (!state.availableDatesByMovie[movieId]) {
        const datesResponse = await fetch(`${API_BASE}/movies/${movieId}/dates`);
        const datesData = await datesResponse.json();
        if (!datesResponse.ok) throw new Error(datesData.error || 'Unable to load show dates.');
        state.availableDatesByMovie[movieId] = datesData.map(normalizeShowDate);
      }

      if (state.availableDatesByMovie[movieId].includes(date)) {
        const params = new URLSearchParams({ date, movie_id: String(movieId) });
        const showsResponse = await fetch(`${API_BASE}/shows?${params}`);
        const showsData = await showsResponse.json();
        if (!showsResponse.ok) throw new Error(showsData.error || 'Unable to load showtimes.');
        state.filteredShowsByMovieDate[cacheKey] = showsData;
        const returnedIds = new Set(showsData.map(show => Number(show.show_id)));
        state.shows = state.shows.filter(show => !returnedIds.has(Number(show.show_id)));
        state.shows.push(...showsData);
      } else {
        state.filteredShowsByMovieDate[cacheKey] = [];
      }
    } else {
      const localDates = state.localData.shows
        .filter(show => Number(show.movie_id) === movieId)
        .map(show => normalizeShowDate(show.show_date));
      state.availableDatesByMovie[movieId] = [...new Set(localDates)];
      state.filteredShowsByMovieDate[cacheKey] = state.localData.shows.filter(
        show => Number(show.movie_id) === movieId && normalizeShowDate(show.show_date) === date
      );
    }
  } catch (err) {
    state.movieDateErrors[cacheKey] = err.message || 'Unable to load showtimes. Please try again.';
  } finally {
    state.loadingMovieDates.delete(cacheKey);
    renderMoviesGrid();
  }
}

// ==============================================================================
// SEAT SELECTION MAP & BOOKING ENGINE
// ==============================================================================

window.openSeatModalById = function(showId) {
  const show = state.shows.find(s => s.show_id == showId);
  if (show) openSeatModal(show);
};

async function openSeatModal(show) {
  if (!state.currentUser) {
    showAuthLandingView();
    showToast('Please sign in or register to pick seats and book tickets.', 'info');
    return;
  }
  if (showHasStarted(show)) {
    showToast('This show has already started and can no longer be booked.', 'error');
    return;
  }

  state.selectedShow = show;
  state.selectedSeats.clear();

  document.getElementById('seatModalTitle').textContent = `Select Seats - ${show.movie_title || 'Movie'}`;
  document.getElementById('seatModalSubtitle').textContent = `${show.theatre_name || 'Theatre'} - ${show.screen_name || 'Screen'} | Date: ${formatShowDate(show.show_date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} | Time: ${formatShowTime(show.show_time)}`;

  let seatsData = [];
  let bookedSeatIds = new Set();

  if (state.dbOnline) {
    try {
      const res = await fetch(`${API_BASE}/shows/${show.show_id}/seats`);
      const data = await res.json();
      seatsData = data.seats;
    } catch (err) {
      console.error('Fetch seats error', err);
    }
  } else {
    const bookedLocal = state.localData.bookedSeatsByShow[show.show_id] || [];
    bookedSeatIds = new Set(bookedLocal);

    let idCount = 1;
    const rows = ['A', 'B', 'C', 'D', 'E'];
    rows.forEach((r, rIdx) => {
      let cat = 'SILVER';
      if (rIdx === 2 || rIdx === 3) cat = 'GOLD';
      if (rIdx === 4) cat = 'PLATINUM';

      for (let c = 1; c <= 10; c++) {
        const sNum = `${r}${c}`;
        const sId = idCount++;
        seatsData.push({
          seat_id: sId,
          seat_number: sNum,
          category: cat,
          is_booked: bookedSeatIds.has(sId)
        });
      }
    });
  }

  renderSeatGrid(seatsData);
  updateSeatSummary();
  openModal('seatModal');
}

function renderSeatGrid(seats) {
  const wrapper = document.getElementById('seatGridWrapper');
  wrapper.innerHTML = '';

  const rowsMap = {};
  seats.forEach(s => {
    const rowChar = s.seat_number.charAt(0);
    if (!rowsMap[rowChar]) rowsMap[rowChar] = [];
    rowsMap[rowChar].push(s);
  });

  Object.keys(rowsMap).forEach(rowChar => {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'seat-row';

    const label = document.createElement('span');
    label.className = 'row-label';
    label.textContent = rowChar;
    rowDiv.appendChild(label);

    rowsMap[rowChar].forEach(seat => {
      const seatBtn = document.createElement('div');
      seatBtn.className = `seat-item ${seat.category.toLowerCase()} ${seat.is_booked ? 'booked' : ''}`;
      seatBtn.textContent = seat.seat_number.substring(1);
      seatBtn.title = `${seat.seat_number} - ${seat.category} ($${getSeatPrice(seat.category)})`;

      if (!seat.is_booked) {
        seatBtn.addEventListener('click', () => toggleSeatSelection(seat, seatBtn));
      }

      rowDiv.appendChild(seatBtn);
    });

    wrapper.appendChild(rowDiv);
  });
}

function toggleSeatSelection(seat, element) {
  if (state.selectedSeats.has(seat)) {
    state.selectedSeats.delete(seat);
    element.classList.remove('selected');
  } else {
    state.selectedSeats.add(seat);
    element.classList.add('selected');
  }
  updateSeatSummary();
}

function getSeatPrice(category) {
  if (!state.selectedShow) return 10;
  if (category === 'SILVER') return parseFloat(state.selectedShow.price_silver || 10);
  if (category === 'GOLD') return parseFloat(state.selectedShow.price_gold || 15);
  if (category === 'PLATINUM') return parseFloat(state.selectedShow.price_platinum || 22);
  return 10;
}

function updateSeatSummary() {
  const listEl = document.getElementById('selectedSeatsList');
  const totalEl = document.getElementById('totalPriceDisplay');
  const confirmBtn = document.getElementById('confirmBookingBtn');

  if (state.selectedSeats.size === 0) {
    listEl.textContent = 'None';
    totalEl.textContent = '$0.00';
    confirmBtn.disabled = true;
    updatePaymentQr(0, null);
    return;
  }

  const seatNumbers = Array.from(state.selectedSeats).map(s => s.seat_number);
  let total = 0;
  state.selectedSeats.forEach(s => {
    total += getSeatPrice(s.category);
  });

  listEl.textContent = seatNumbers.join(', ');
  totalEl.textContent = `$${total.toFixed(2)}`;
  confirmBtn.disabled = false;
  updatePaymentQr(total, document.getElementById('paymentMethod').value);
}

function createPaymentQr(container, amount, bookingRef) {
  if (typeof QRCode === 'undefined') return;
  container.innerHTML = '';
  const paymentData = `upi://pay?pa=cinewave@upi&pn=CineWave&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(bookingRef)}`;
  new QRCode(container, {
    text: paymentData,
    width: 128,
    height: 128,
    colorDark: '#0f172a',
    colorLight: '#ffffff'
  });
}

function updatePaymentQr(amount, paymentMethod) {
  const panel = document.getElementById('paymentQrPanel');
  const code = document.getElementById('paymentQrCode');
  if (paymentMethod !== 'UPI' || amount <= 0) {
    panel.classList.add('hidden');
    code.innerHTML = '';
    return;
  }
  panel.classList.remove('hidden');
  createPaymentQr(code, amount, 'CineWave seat booking');
}

async function handleConfirmBooking() {
  if (state.selectedSeats.size === 0 || !state.selectedShow) return;

  const seatArray = Array.from(state.selectedSeats);
  const seatIds = seatArray.map(s => s.seat_id);
  const seatNumbers = seatArray.map(s => s.seat_number).join(', ');
  const show = state.selectedShow;
  const paymentMethod = document.getElementById('paymentMethod').value;
  let showDate = show.show_date;
  let showTime = show.show_time;

  let bookingRef = 'BK-' + Math.floor(100000 + Math.random() * 900000);
  let totalAmount = 0;
  seatArray.forEach(s => totalAmount += getSeatPrice(s.category));

  if (state.dbOnline) {
    try {
      const res = await fetch(`${API_BASE}/bookings`, {
        method: 'POST',
        headers: authenticatedHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          show_id: show.show_id,
          seat_ids: seatIds,
          payment_method: paymentMethod
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      bookingRef = data.bookingRef;
      totalAmount = data.totalAmount;
      showDate = data.show_date || showDate;
      showTime = data.show_time || showTime;
    } catch (err) {
      showToast(err.message, 'error');
      return;
    }
  } else {
    if (!state.localData.bookedSeatsByShow[show.show_id]) {
      state.localData.bookedSeatsByShow[show.show_id] = [];
    }
    state.localData.bookedSeatsByShow[show.show_id].push(...seatIds);
    localStorage.setItem('cinewave_local_booked_seats', JSON.stringify(state.localData.bookedSeatsByShow));

    const newBooking = {
      booking_id: Date.now(),
      booking_ref: bookingRef,
      user_id: state.currentUser.user_id,
      movie_title: show.movie_title || 'Oppenheimer',
      poster_path: show.poster_path || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1',
      screen_name: show.screen_name || 'Screen 1',
      theatre_name: show.theatre_name || 'CineWave Grand Theatre',
      show_date: showDate,
      show_time: showTime,
      genre: state.localData.movies.find(movie => Number(movie.movie_id) === Number(show.movie_id))?.genre || '',
      seat_number: seatNumbers,
      amount: totalAmount,
      payment_method: paymentMethod,
      status: 'CONFIRMED',
      booking_time: new Date().toISOString()
    };

    state.localData.bookings.unshift(newBooking);
    localStorage.setItem('cinewave_local_bookings', JSON.stringify(state.localData.bookings));
  }

  closeModal('seatModal');
  displayDigitalTicket({
    bookingRef,
    movieTitle: show.movie_title || 'Movie',
    posterPath: show.poster_path || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1',
    screenName: show.screen_name || 'Screen 1',
    theatreName: show.theatre_name || 'CineWave Grand Theatre',
    showDate,
    showTime,
    seats: seatNumbers,
    amount: totalAmount,
    paymentMethod
  });

  showToast('Tickets booked successfully!', 'success');
}

function displayDigitalTicket(ticket) {
  document.getElementById('ticketRefDisplay').textContent = `REF: ${ticket.bookingRef}`;
  document.getElementById('ticketMovieTitle').textContent = ticket.movieTitle;
  document.getElementById('ticketMoviePoster').src = ticket.posterPath;
  document.getElementById('ticketScreen').textContent = ticket.screenName;
  document.getElementById('ticketTheatre').textContent = ticket.theatreName;
  document.getElementById('ticketDate').textContent = formatShowDate(ticket.showDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  document.getElementById('ticketTime').textContent = formatShowTime(ticket.showTime);
  document.getElementById('ticketSeats').textContent = ticket.seats;
  document.getElementById('ticketAmount').textContent = `$${parseFloat(ticket.amount).toFixed(2)}`;
  document.getElementById('ticketPayment').textContent = formatPaymentMethod(ticket.paymentMethod);
  const ticketQrPanel = document.getElementById('ticketPaymentQr');
  const ticketQrCode = document.getElementById('ticketQrCode');
  if (ticket.paymentMethod === 'UPI') {
    ticketQrPanel.classList.remove('hidden');
    createPaymentQr(ticketQrCode, parseFloat(ticket.amount), ticket.bookingRef);
  } else {
    ticketQrPanel.classList.add('hidden');
    ticketQrCode.innerHTML = '';
  }

  openModal('ticketModal');
}

function formatPaymentMethod(method) {
  return {
    UPI: 'UPI',
    CARD: 'Credit / Debit Card',
    NET_BANKING: 'Net Banking',
    CASH: 'Pay at Theatre Counter'
  }[method] || 'UPI';
}

// ==============================================================================
// CUSTOMER BOOKING HISTORY & CANCELLATION
// ==============================================================================

async function loadUserBookings() {
  const container = document.getElementById('historyList');
  if (!state.currentUser) return;

  container.innerHTML = '<p class="loading-message" role="status">Loading your bookings…</p>';
  if (state.dbOnline) {
    try {
      const res = await fetch(
        `${API_BASE}/bookings/user/${state.currentUser.user_id}`,
        { headers: authenticatedHeaders() }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to load your booking history.');
      state.historyBookings = data;
    } catch (err) {
      container.innerHTML = `<p class="error-message" role="alert">${err.message || 'Unable to load your booking history.'}</p>`;
      return;
    }
  } else {
    state.historyBookings = state.localData.bookings.filter(b => b.user_id === state.currentUser.user_id);
  }

  renderUserBookings();
}

function renderUserBookings() {
  const container = document.getElementById('historyList');
  const groupedBookings = new Map();
  state.historyBookings.forEach(booking => {
    const key = booking.booking_ref;
    if (!groupedBookings.has(key)) {
      groupedBookings.set(key, {
        ...booking,
        booking_ids: [],
        seats: [],
        amount: 0,
        booking_count: 0
      });
    }
    const order = groupedBookings.get(key);
    order.booking_ids.push(booking.booking_id);
    order.seats.push(booking.seat_number);
    order.amount += Number(booking.amount || 0);
    order.booking_count += 1;
    if (booking.status === 'CANCELLED') order.status = 'CANCELLED';
  });
  const bookings = Array.from(groupedBookings.values());
  const upcomingTab = document.getElementById('historyUpcomingTab');
  const pastTab = document.getElementById('historyPastTab');
  upcomingTab.classList.toggle('active', state.historyTab === 'upcoming');
  pastTab.classList.toggle('active', state.historyTab === 'past');
  upcomingTab.setAttribute('aria-selected', String(state.historyTab === 'upcoming'));
  pastTab.setAttribute('aria-selected', String(state.historyTab === 'past'));

  const visibleBookings = bookings.filter(booking => {
    const past = showHasStarted(booking);
    const search = document.getElementById('historySearch').value.trim().toLowerCase();
    const from = document.getElementById('historyFromDate').value;
    const to = document.getElementById('historyToDate').value;
    const status = document.getElementById('historyStatus').value;
    const showDate = normalizeShowDate(booking.show_date);
    const matchesSearch = !search || [
      booking.movie_title,
      booking.theatre_name,
      booking.screen_name,
      booking.booking_ref,
      booking.seats.join(' ')
    ].some(value => String(value || '').toLowerCase().includes(search));
    const matchesDate = (!from || showDate >= from) && (!to || showDate <= to);
    const matchesStatus = status === 'ALL' || booking.status === status;
    return (state.historyTab === 'past' ? past : !past) && matchesSearch && matchesDate && matchesStatus;
  });
  renderCustomerDashboard(bookings);
  if (bookings.length === 0) {
    container.innerHTML = `<div style="text-align: center; padding: 3rem; color: var(--text-muted);">You have no active or past bookings.</div>`;
    return;
  }
  if (visibleBookings.length === 0) {
    container.innerHTML = `<div class="history-empty">No ${state.historyTab} bookings to display.</div>`;
    return;
  }

  container.innerHTML = visibleBookings.map(b => `
    <div class="history-card">
      <img src="${b.poster_path || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1'}" alt="Poster" class="history-poster">
      <div class="history-info">
        <h4 class="history-title">${b.movie_title}</h4>
        <div class="history-meta">
          <span><i class="fa-solid fa-building"></i> ${b.theatre_name || 'CineWave Grand Theatre'}</span> | 
          <span><i class="fa-solid fa-film"></i> ${b.screen_name || 'Screen 1'}</span> | 
          <span><i class="fa-regular fa-calendar"></i> ${formatShowDate(b.show_date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} at ${formatShowTime(b.show_time)}</span><br>
          <span><i class="fa-solid fa-chair text-gold"></i> Seats: ${b.seats.join(', ')}</span> | 
          <span><i class="fa-solid fa-wallet"></i> ${formatPaymentMethod(b.payment_method)}</span> | 
          <span>Ref: <strong class="text-rose">${b.booking_ref}</strong></span>
        </div>
      </div>
      <div>
        <div class="history-status-badge ${b.status === 'CONFIRMED' ? 'status-confirmed' : 'status-cancelled'}">
          ${b.status}
        </div>
        <div style="font-weight: 700; font-size: 1.1rem; text-align: right; margin-top: 0.4rem;">$${b.amount.toFixed(2)}</div>
        ${b.status === 'CONFIRMED' && !cancellationIsBlocked(b) ? `
          <button class="btn btn-xs btn-outline" style="margin-top: 0.4rem; color: var(--red-danger);" onclick="cancelBooking(${b.booking_ids[0]})">
            <i class="fa-solid fa-ban"></i> Cancel Booking
          </button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

function renderCustomerDashboard(orders) {
  const confirmedOrders = orders.filter(order => order.status === 'CONFIRMED');
  const futureOrders = confirmedOrders
    .filter(order => !showHasStarted(order))
    .sort((a, b) => getShowStart(a) - getShowStart(b));
  const genreCounts = new Map();
  state.historyBookings.forEach(booking => {
    if (booking.status !== 'CONFIRMED' || !booking.genre) return;
    genreCounts.set(booking.genre, (genreCounts.get(booking.genre) || 0) + 1);
  });
  const favouriteGenre = Array.from(genreCounts.entries()).sort((a, b) => b[1] - a[1])[0];
  document.getElementById('customerTotalBookings').textContent = orders.length;
  document.getElementById('customerUpcomingShows').textContent = futureOrders.length;
  document.getElementById('customerAmountSpent').textContent = `$${confirmedOrders.reduce((sum, order) => sum + order.amount, 0).toFixed(2)}`;
  document.getElementById('customerFavouriteGenre').textContent = favouriteGenre ? favouriteGenre[0] : '—';

  const next = futureOrders[0];
  state.nextShowAt = next ? getShowStart(next) : null;
  const content = document.getElementById('nextShowContent');
  content.innerHTML = next
    ? `<strong>${next.movie_title}</strong><span>${formatShowDate(next.show_date, { weekday: 'long', day: 'numeric', month: 'long' })} · ${formatShowTime(next.show_time)}</span><strong id="nextShowCountdown"></strong>`
    : '<span>No upcoming shows booked.</span>';
  renderNextShowCountdown();
}

function renderNextShowCountdown() {
  const countdown = document.getElementById('nextShowCountdown');
  if (!countdown || !state.nextShowAt) return;
  const remaining = Math.max(0, state.nextShowAt.getTime() - Date.now());
  const totalHours = Math.floor(remaining / (60 * 60 * 1000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  countdown.textContent = `In ${days} days ${hours} hrs ${minutes} min`;
}

window.cancelBooking = async function(bookingId) {
  const selectedBooking = state.historyBookings.find(booking => Number(booking.booking_id) === Number(bookingId));
  if (selectedBooking && cancellationIsBlocked(selectedBooking)) {
    showToast('Bookings cannot be cancelled within 2 hours of the show start time.', 'error');
    return;
  }
  if (!confirm('Are you sure you want to cancel this ticket booking? The seats will be released.')) return;

  if (state.dbOnline) {
    try {
      const res = await fetch(`${API_BASE}/bookings/cancel/${bookingId}`, {
        method: 'POST',
        headers: authenticatedHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(data.message, 'success');
    } catch (err) {
      showToast(err.message, 'error');
      return;
    }
  } else {
    const booking = state.localData.bookings.find(b => Number(b.booking_id) === Number(bookingId));
    if (booking) {
      if (cancellationIsBlocked(booking)) {
        showToast('Bookings cannot be cancelled within 2 hours of the show start time.', 'error');
        return;
      }
      state.localData.bookings
        .filter(item => item.booking_ref === booking.booking_ref)
        .forEach(item => { item.status = 'CANCELLED'; });
    }
    localStorage.setItem('cinewave_local_bookings', JSON.stringify(state.localData.bookings));
    showToast('Booking cancelled and seats released.', 'success');
  }

  loadUserBookings();
};

// ==============================================================================
// ADMIN DASHBOARD & REPORTS
// ==============================================================================

function switchAdminTab(tabName) {
  const tabs = {
    reports: document.getElementById('tabReports'),
    addMovie: document.getElementById('tabAddMovie'),
    createShow: document.getElementById('tabCreateShow')
  };

  const contents = {
    reports: document.getElementById('contentReports'),
    addMovie: document.getElementById('contentAddMovie'),
    createShow: document.getElementById('contentCreateShow')
  };

  Object.keys(tabs).forEach(key => {
    tabs[key].classList.remove('active');
    contents[key].classList.add('hidden');
  });

  tabs[tabName].classList.add('active');
  contents[tabName].classList.remove('hidden');

  if (tabName === 'reports') loadAdminReports();
  if (tabName === 'addMovie') renderAdminMovieList();
}

async function loadAdminReports() {
  const fromInput = document.getElementById('reportFromDate');
  const toInput = document.getElementById('reportToDate');
  if (!fromInput.value || !toInput.value) setQuickReportRange(30, false);
  const from = fromInput.value;
  const to = toInput.value;
  const status = document.getElementById('reportStatus');
  if (from && to && from > to) {
    status.textContent = 'The from date must be on or before the to date.';
    status.className = 'report-status error-message';
    return;
  }

  status.textContent = 'Loading report…';
  status.className = 'report-status loading-message';
  try {
    let data;
    if (state.dbOnline) {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const response = await adminFetch(`${API_BASE}/admin/reports?${params}`);
      data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load sales report.');
    } else {
      data = buildLocalAdminReport(from, to);
    }

    state.adminReports = data;
    renderAdminReport(data);
    if (typeof Chart === 'undefined') {
      status.textContent = 'Report data loaded, but charts are unavailable because Chart.js did not load.';
      status.className = 'report-status error-message';
    } else {
      status.textContent = 'Report updated.';
      status.className = 'report-status';
    }
  } catch (err) {
    status.textContent = err.message || 'Unable to load sales report.';
    status.className = 'report-status error-message';
  }
}

function authenticatedHeaders(initialHeaders = {}) {
  if (!state.authToken) {
    throw new Error('Please sign in again to get an access token.');
  }
  const headers = new Headers(initialHeaders);
  headers.set('Authorization', `Bearer ${state.authToken}`);
  return headers;
}

function adminFetch(url, options = {}) {
  if (!state.authToken) {
    throw new Error('Please sign in again to get an admin access token.');
  }
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${state.authToken}`);
  return fetch(url, { ...options, headers });
}

function setQuickReportRange(days, load = true) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - Math.max(0, days - 1));
  document.getElementById('reportFromDate').value = localDateString(start);
  document.getElementById('reportToDate').value = localDateString(end);
  document.querySelectorAll('.report-quick-filter').forEach(button => {
    button.classList.toggle('active', Number(button.dataset.days) === days);
  });
  if (load) loadAdminReports();
}

function buildLocalAdminReport(from, to) {
  const confirmed = state.localData.bookings.filter(booking => {
    const bookingDate = localDateString(new Date(booking.booking_time));
    return booking.status === 'CONFIRMED' && (!from || bookingDate >= from) && (!to || bookingDate <= to);
  });
  const movieSales = state.localData.movies.map(movie => {
    const movieBookings = confirmed.filter(booking => booking.movie_title === movie.title);
    return {
      title: movie.title,
      genre: movie.genre,
      tickets_sold: movieBookings.reduce((sum, booking) => sum + String(booking.seat_number || '').split(',').filter(Boolean).length, 0),
      revenue: movieBookings.reduce((sum, booking) => sum + Number(booking.amount || 0), 0)
    };
  });
  const categoryStats = {
    SILVER: { tickets_sold: 0, revenue: 0 },
    GOLD: { tickets_sold: 0, revenue: 0 },
    PLATINUM: { tickets_sold: 0, revenue: 0 }
  };
  confirmed.forEach(booking => {
    const seats = String(booking.seat_number || '').split(',').map(seat => seat.trim()).filter(Boolean);
    const perSeatAmount = Number(booking.amount || 0) / Math.max(seats.length, 1);
    seats.forEach(seat => {
      const row = seat.charAt(0).toUpperCase();
      const category = row === 'E' ? 'PLATINUM' : ['C', 'D'].includes(row) ? 'GOLD' : 'SILVER';
      categoryStats[category].tickets_sold += 1;
      categoryStats[category].revenue += perSeatAmount;
    });
  });
  const categorySales = Object.entries(categoryStats).map(([category, totals]) => ({ category, ...totals }));
  const dailyMap = new Map();
  confirmed.forEach(booking => {
    const day = localDateString(new Date(booking.booking_time));
    dailyMap.set(day, (dailyMap.get(day) || 0) + Number(booking.amount || 0));
  });
  if (from && to) {
    const start = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T00:00:00`);
    for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      const day = localDateString(cursor);
      if (!dailyMap.has(day)) dailyMap.set(day, 0);
    }
  }
  const upcomingShows = state.localData.shows
    .filter(show => !showHasStarted(show))
    .map(show => ({
      ...show,
      movie_title: show.movie_title || state.localData.movies.find(movie => Number(movie.movie_id) === Number(show.movie_id))?.title || 'Movie',
      total_seats: 50,
      seats_sold: (state.localData.bookedSeatsByShow[show.show_id] || []).length
    }));
  const todayRevenue = state.localData.bookings
    .filter(booking => booking.status === 'CONFIRMED' && localDateString(new Date(booking.booking_time)) === localDateString())
    .reduce((sum, booking) => sum + Number(booking.amount || 0), 0);
  const sold = upcomingShows.reduce((sum, show) => sum + Number(show.seats_sold), 0);
  const capacity = upcomingShows.reduce((sum, show) => sum + Number(show.total_seats), 0);
  return {
    summary: {
      total_revenue: confirmed.reduce((sum, booking) => sum + Number(booking.amount || 0), 0),
      total_tickets_sold: confirmed.reduce((sum, booking) => sum + String(booking.seat_number || '').split(',').filter(Boolean).length, 0),
      total_orders: new Set(confirmed.map(booking => booking.booking_ref)).size,
      today_revenue: todayRevenue,
      occupancy_rate: capacity ? 100 * sold / capacity : 0
    },
    movieSales,
    categorySales,
    dailyRevenue: Array.from(dailyMap, ([report_date, revenue]) => ({ report_date, revenue })),
    upcomingShows
  };
}

function renderAdminReport(data) {
  const summary = data.summary || {};
  const money = value => `$${Number(value || 0).toFixed(2)}`;
  document.getElementById('statRevenue').textContent = money(summary.total_revenue);
  document.getElementById('statTickets').textContent = Number(summary.total_tickets_sold || 0);
  document.getElementById('statOrders').textContent = Number(summary.total_orders || 0);
  document.getElementById('statTodayRevenue').textContent = money(summary.today_revenue);
  document.getElementById('statOccupancy').textContent = `${Number(summary.occupancy_rate || 0).toFixed(1)}%`;

  document.getElementById('movieSalesTableBody').innerHTML = (data.movieSales || []).map(movie => `
    <tr><td><strong>${movie.title}</strong></td><td>${movie.genre}</td><td>${movie.tickets_sold}</td><td class="text-rose">${money(movie.revenue)}</td></tr>
  `).join('') || '<tr><td colspan="4">No sales in this date range.</td></tr>';
  document.getElementById('categorySalesTableBody').innerHTML = (data.categorySales || []).map(category => `
    <tr><td><span class="tier-pill ${String(category.category).toLowerCase()}">${category.category}</span></td><td>${category.tickets_sold}</td><td class="text-gold">${money(category.revenue)}</td></tr>
  `).join('') || '<tr><td colspan="3">No category sales in this date range.</td></tr>';

  document.getElementById('upcomingShowsTableBody').innerHTML = (data.upcomingShows || []).map(show => {
    const total = Number(show.total_seats || 0);
    const sold = Number(show.seats_sold || 0);
    const percent = total ? Math.min(100, sold / total * 100) : 0;
    return `<tr>
      <td><strong>${show.movie_title}</strong></td>
      <td>${formatShowDate(show.show_date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · ${formatShowTime(show.show_time)}</td>
      <td>${show.theatre_name || 'Theatre'}<br>${show.screen_name || 'Screen'}</td>
      <td>${sold} / ${total}</td>
      <td><div class="occupancy-progress"><span style="width:${percent}%"></span></div><small>${percent.toFixed(0)}%</small></td>
    </tr>`;
  }).join('') || '<tr><td colspan="5">No upcoming shows scheduled.</td></tr>';

  renderAdminCharts(data);
}

function renderAdminCharts(data) {
  if (typeof Chart === 'undefined') {
    return;
  }
  const charts = [
    {
      key: 'daily',
      element: 'dailyRevenueChart',
      type: 'line',
      labels: (data.dailyRevenue || []).map(item => formatShowDate(item.report_date, { month: 'short', day: 'numeric' })),
      values: (data.dailyRevenue || []).map(item => Number(item.revenue || 0)),
      label: 'Revenue'
    },
    {
      key: 'movie',
      element: 'movieRevenueChart',
      type: 'bar',
      labels: (data.movieSales || []).map(item => item.title),
      values: (data.movieSales || []).map(item => Number(item.revenue || 0)),
      label: 'Revenue'
    },
    {
      key: 'category',
      element: 'categoryTicketsChart',
      type: 'doughnut',
      labels: ['SILVER', 'GOLD', 'PLATINUM'],
      values: ['SILVER', 'GOLD', 'PLATINUM'].map(name =>
        Number((data.categorySales || []).find(item => item.category === name)?.tickets_sold || 0)
      ),
      label: 'Tickets'
    }
  ];
  charts.forEach(config => {
    if (state.adminCharts[config.key]) state.adminCharts[config.key].destroy();
    const canvas = document.getElementById(config.element);
    state.adminCharts[config.key] = new Chart(canvas, {
      type: config.type,
      data: {
        labels: config.labels,
        datasets: [{
          label: config.label,
          data: config.values,
          borderColor: '#38bdf8',
          backgroundColor: config.type === 'doughnut'
            ? ['#94a3b8', '#fbbf24', '#c084fc']
            : 'rgba(56, 189, 248, 0.45)',
          tension: 0.3,
          fill: config.type === 'line'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#cbd5e1' } } },
        scales: config.type === 'doughnut' ? {} : {
          x: { ticks: { color: '#a7b3c5' }, grid: { color: 'rgba(148,163,184,.1)' } },
          y: { beginAtZero: true, ticks: { color: '#a7b3c5' }, grid: { color: 'rgba(148,163,184,.1)' } }
        }
      }
    });
  });
}

function exportAdminReportCsv() {
  if (!state.adminReports) {
    showToast('Load a report before exporting it.', 'error');
    return;
  }
  const rows = [
    ['Report', 'From', document.getElementById('reportFromDate').value, 'To', document.getElementById('reportToDate').value],
    [],
    ['Summary', 'Value'],
    ['Total Revenue', state.adminReports.summary.total_revenue],
    ['Tickets Sold', state.adminReports.summary.total_tickets_sold],
    ['Total Orders', state.adminReports.summary.total_orders],
    ["Today's Revenue", state.adminReports.summary.today_revenue],
    ['Upcoming Occupancy (%)', state.adminReports.summary.occupancy_rate],
    [],
    ['Daily Revenue'],
    ['Date', 'Revenue'],
    ...(state.adminReports.dailyRevenue || []).map(item => [item.report_date, item.revenue]),
    [],
    ['Revenue by Movie'],
    ['Movie', 'Genre', 'Tickets Sold', 'Revenue'],
    ...(state.adminReports.movieSales || []).map(item => [item.title, item.genre, item.tickets_sold, item.revenue]),
    [],
    ['Tickets by Seat Category'],
    ['Category', 'Tickets Sold', 'Revenue'],
    ...(state.adminReports.categorySales || []).map(item => [item.category, item.tickets_sold, item.revenue]),
    [],
    ['Upcoming Shows'],
    ['Movie', 'Date', 'Time', 'Theatre', 'Screen', 'Seats Sold', 'Total Seats'],
    ...(state.adminReports.upcomingShows || []).map(item => [
      item.movie_title, item.show_date, item.show_time, item.theatre_name, item.screen_name, item.seats_sold, item.total_seats
    ])
  ];
  const csv = rows.map(row => row.map(value => {
    const safeValue = String(value == null ? '' : value);
    return `"${safeValue.replace(/"/g, '""')}"`;
  }).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `cinewave-report-${localDateString()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

async function handleAddMovieSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('movieTitle').value;
  const genre = document.getElementById('movieGenre').value;
  const language = document.getElementById('movieLang').value;
  const duration_min = document.getElementById('movieDuration').value;
  const rating = document.getElementById('movieRating').value;
  const poster_path = document.getElementById('moviePoster').value;
  const description = document.getElementById('movieDesc').value;

  const moviePayload = { title, genre, language, duration_min, rating, poster_path, description };

  if (state.dbOnline) {
    try {
      const res = await adminFetch(`${API_BASE}/movies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(moviePayload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save movie.');

      showToast('New movie added to database!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
      return;
    }
  } else {
    const newMovie = { movie_id: Date.now(), ...moviePayload };
    state.localData.movies.unshift(newMovie);
    showToast('Movie added locally!', 'success');
  }

  document.getElementById('addMovieForm').reset();
  await loadMoviesAndShows();
  renderAdminMovieList();
}

function renderAdminMovieList() {
  const container = document.getElementById('adminMovieList');
  container.innerHTML = state.movies.map(m => `
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.8rem; border-bottom: 1px solid var(--border-glass);">
      <div>
        <strong>${m.title}</strong> (${m.duration_min} min)
        <div style="font-size: 0.75rem; color: var(--text-muted);">${m.genre} | ${m.language}</div>
      </div>
      <button class="btn btn-xs btn-outline" style="color: var(--red-danger);" onclick="deleteMovie(${m.movie_id})">
        <i class="fa-solid fa-trash"></i> Delete
      </button>
    </div>
  `).join('');
}

window.deleteMovie = async function(movieId) {
  if (!confirm('Are you sure you want to delete this movie?')) return;

  if (state.dbOnline) {
    try {
      const res = await adminFetch(`${API_BASE}/movies/${movieId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete movie.');
      showToast('Movie deleted from database.', 'info');
    } catch (err) {
      showToast(err.message, 'error');
    }
  } else {
    state.localData.movies = state.localData.movies.filter(m => m.movie_id !== movieId);
    showToast('Movie deleted.', 'info');
  }

  await loadMoviesAndShows();
  renderAdminMovieList();
};

function populateAdminMovieSelect() {
  const select = document.getElementById('showMovieSelect');
  if (!select) return;

  select.innerHTML = state.movies.map(m => `
    <option value="${m.movie_id}">${m.title} (${m.duration_min} mins)</option>
  `).join('');
}

async function handleCreateShowSubmit(e) {
  e.preventDefault();
  const dateInput = document.getElementById('showDate');
  dateInput.min = localDateString();
  const movie_id = document.getElementById('showMovieSelect').value;
  const screen_id = document.getElementById('showScreenSelect').value;
  const show_date = dateInput.value;
  const show_time = document.getElementById('showTime').value;
  const price_silver = document.getElementById('priceSilver').value;
  const price_gold = document.getElementById('priceGold').value;
  const price_platinum = document.getElementById('pricePlatinum').value;

  const showPayload = { movie_id, screen_id, show_date, show_time, price_silver, price_gold, price_platinum };
  if (getShowStart(showPayload).getTime() <= Date.now()) {
    showToast('A show cannot be scheduled in the past.', 'error');
    return;
  }

  if (state.dbOnline) {
    try {
      const res = await adminFetch(`${API_BASE}/shows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(showPayload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create show slot.');

      showToast('New show slot scheduled!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
      return;
    }
  } else {
    const duplicate = state.localData.shows.some(show =>
      Number(show.screen_id) === Number(screen_id) &&
      normalizeShowDate(show.show_date) === show_date &&
      String(show.show_time).slice(0, 5) === show_time.slice(0, 5)
    );
    if (duplicate) {
      showToast('This screen already has a show scheduled at that date and time.', 'error');
      return;
    }

    const movie = state.movies.find(m => m.movie_id == movie_id);
    const newShow = {
      show_id: Date.now(),
      movie_id,
      movie_title: movie ? movie.title : 'Movie',
      screen_id,
      screen_name: screen_id == 1 ? 'Screen 1 (IMAX 70mm)' : 'Screen 2 (Dolby Cinema)',
      show_date,
      show_time,
      price_silver,
      price_gold,
      price_platinum
    };
    state.localData.shows.push(newShow);
    showToast('Show slot created locally!', 'success');
  }

  await loadMoviesAndShows();
  switchAdminTab('reports');
}

// ==============================================================================
// UTILITY HELPERS (MODALS & TOASTS)
// ==============================================================================

function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.remove('hidden');
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.add('hidden');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-circle-exclamation' : 'fa-info-circle'}"></i>
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
