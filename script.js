const BIRTHDAY_IST = new Date('2026-09-12T00:00:00+05:30');
const WISHES_ENDPOINT = '/.netlify/functions/wishes';
const state = { revealed: false, wishes: [], manuallyPaused: false, wishView: 'single', activeWishIndex: 0 };

document.addEventListener('DOMContentLoaded', () => {
    setupCountdown();
    setupAudio();
    setupWishes();
});

function setupCountdown() {
    const screen = document.getElementById('countdownScreen');
    let timer;
    const update = () => {
        const remaining = BIRTHDAY_IST.getTime() - Date.now();
        if (remaining <= 0) { clearInterval(timer); revealBirthday(); return; }
        setTimeValue('days', Math.floor(remaining / 86400000));
        setTimeValue('hours', Math.floor((remaining % 86400000) / 3600000));
        setTimeValue('minutes', Math.floor((remaining % 3600000) / 60000));
        setTimeValue('seconds', Math.floor((remaining % 60000) / 1000));
    };
    screen.addEventListener('transitionend', () => { if (state.revealed) screen.hidden = true; });
    update();
    timer = window.setInterval(update, 1000);
}

function setTimeValue(id, value) { document.getElementById(id).textContent = String(value).padStart(2, '0'); }

function revealBirthday() {
    if (state.revealed) return;
    state.revealed = true;
    document.getElementById('countdownScreen').classList.add('is-hidden');
    document.getElementById('birthdayScreen').classList.remove('is-hidden');
    createSparkles();
    window.setTimeout(fireConfetti, 450);
    window.setInterval(randomConfetti, 4500);
    loadWishes();
    playAudio();
}

function setupAudio() {
    const music = document.getElementById('bgMusic');
    const button = document.getElementById('musicToggle');
    music.volume = 0.72;
    const unlock = () => { if (state.revealed && !state.manuallyPaused) playAudio(); };
    document.addEventListener('pointerdown', unlock, { passive: true });
    document.addEventListener('keydown', unlock);
    music.addEventListener('play', () => updateMusicButton(true));
    music.addEventListener('pause', () => updateMusicButton(false));
    button.addEventListener('click', (event) => {
        event.stopPropagation();
        if (music.paused) { state.manuallyPaused = false; playAudio(); }
        else { state.manuallyPaused = true; music.pause(); }
    });
}

async function playAudio() {
    const music = document.getElementById('bgMusic');
    if (!music || state.manuallyPaused) return;
    try { await music.play(); updateMusicButton(true); }
    catch { updateMusicButton(false); }
}

function updateMusicButton(playing) {
    const button = document.getElementById('musicToggle');
    if (!button) return;
    button.setAttribute('aria-pressed', String(playing));
    document.getElementById('musicLabel').textContent = playing ? 'Pause music' : 'Play music';
}

function setupWishes() {
    const dialog = document.getElementById('wishesDialog');
    const message = document.getElementById('wishMessage');
    const openDialog = (wallOnly = false, viewMode = 'single') => {
        dialog.classList.toggle('is-wall-only', wallOnly);
        dialog.setAttribute('aria-labelledby', wallOnly ? 'wishWallTitle' : 'wishesTitle');
        document.getElementById('wishWallTitle').textContent = wallOnly ? 'Birthday wishes' : 'Wish wall';
        setWishView(wallOnly ? viewMode : 'all', false);
        if (!dialog.open) dialog.showModal();
        loadWishes();
        if (!wallOnly) window.setTimeout(() => document.getElementById('wisherName').focus(), 0);
    };
    document.getElementById('openCountdownWishes').addEventListener('click', () => openDialog());
    document.getElementById('viewCountdownWishes').addEventListener('click', () => openDialog(true, 'single'));
    document.getElementById('openWishes').addEventListener('click', () => openDialog());
    document.getElementById('viewWishes').addEventListener('click', () => openDialog(true, 'single'));
    document.getElementById('viewAllWishes').addEventListener('click', () => openDialog(true, 'all'));
    document.getElementById('showWishSpotlight').addEventListener('click', () => setWishView('single'));
    document.getElementById('showWishWall').addEventListener('click', () => setWishView('all'));
    document.getElementById('previousWish').addEventListener('click', () => moveSpotlight(-1));
    document.getElementById('nextWish').addEventListener('click', () => moveSpotlight(1));
    document.getElementById('closeWishes').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('keydown', (event) => {
        if (!dialog.classList.contains('is-single-view')) return;
        if (event.key === 'ArrowLeft') { event.preventDefault(); moveSpotlight(-1); }
        if (event.key === 'ArrowRight') { event.preventDefault(); moveSpotlight(1); }
    });
    let swipeStartX = null;
    document.getElementById('wishSpotlight').addEventListener('pointerdown', (event) => { swipeStartX = event.clientX; });
    document.getElementById('wishSpotlight').addEventListener('pointerup', (event) => {
        if (swipeStartX === null) return;
        const distance = event.clientX - swipeStartX;
        swipeStartX = null;
        if (Math.abs(distance) > 55) moveSpotlight(distance > 0 ? -1 : 1);
    });
    message.addEventListener('input', () => { document.getElementById('characterCount').textContent = `${message.value.length} / 280`; });
    document.querySelectorAll('.emoji-btn').forEach((button) => button.addEventListener('click', () => {
        const emoji = button.dataset.emoji;
        const start = message.selectionStart;
        const end = message.selectionEnd;
        const nextValue = `${message.value.slice(0, start)}${emoji}${message.value.slice(end)}`.slice(0, message.maxLength);
        message.value = nextValue;
        const cursor = Math.min(start + emoji.length, nextValue.length);
        message.setSelectionRange(cursor, cursor);
        message.dispatchEvent(new Event('input', { bubbles: true }));
        message.focus();
    }));
    document.getElementById('wishForm').addEventListener('submit', submitWish);
    window.setInterval(() => { if (state.revealed && !document.hidden) loadWishes(true); }, 15000);
}

async function loadWishes(silent = false) {
    try {
        const response = await fetch(WISHES_ENDPOINT, { headers: { Accept: 'application/json' }, cache: 'no-store' });
        if (!response.ok) throw new Error();
        const data = await response.json();
        state.wishes = Array.isArray(data.wishes) ? data.wishes : [];
        renderWishes();
    } catch {
        if (isLocalPreview()) { state.wishes = getLocalWishes(); renderWishes(); }
        else if (!silent) document.getElementById('wishList').innerHTML = '<div class="empty-wishes">The wish wall is taking a tiny break. Please try again in a moment.</div>';
    }
}

async function submitWish(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = document.getElementById('submitWish');
    const status = document.getElementById('formStatus');
    const data = new FormData(form);
    const payload = { name: String(data.get('name') || '').trim(), message: String(data.get('message') || '').trim(), website: String(data.get('website') || '') };
    if (!payload.name || !payload.message) { status.textContent = 'Please add your name and a wish.'; return; }
    button.disabled = true; button.firstChild.textContent = 'Sending… '; status.textContent = '';
    try {
        let wish;
        if (isLocalPreview()) wish = saveLocalWish(payload);
        else {
            const response = await fetch(WISHES_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || 'Could not send the wish');
            wish = result.wish;
        }
        state.wishes = [wish, ...state.wishes.filter((item) => item.id !== wish.id)];
        renderWishes(); form.reset();
        document.getElementById('characterCount').textContent = '0 / 280';
        status.textContent = 'Your wish is now on the wall ♥'; fireConfetti();
    } catch (error) { status.textContent = error.message || 'Could not send your wish. Please try again.'; }
    finally { button.disabled = false; button.firstChild.textContent = 'Send my wish '; }
}

function renderWishes() {
    const list = document.getElementById('wishList');
    const ticker = document.getElementById('wishTicker');
    const wishes = state.wishes;
    document.getElementById('wishCount').textContent = `${wishes.length} ${wishes.length === 1 ? 'wish' : 'wishes'}`;
    list.replaceChildren();
    if (!wishes.length) {
        const empty = document.createElement('div'); empty.className = 'empty-wishes'; empty.textContent = 'No wishes yet. Yours can be the very first.'; list.appendChild(empty);
        ticker.innerHTML = '<p class="empty-ticker">Be the first to leave Akshaya a birthday wish ✨</p>'; ticker.style.animation = 'none'; renderWishSpotlight(); return;
    }
    wishes.forEach((wish) => list.appendChild(createWishCard(wish)));
    if (state.activeWishIndex >= wishes.length) state.activeWishIndex = 0;
    renderWishSpotlight();
    ticker.replaceChildren(); ticker.style.animation = '';
    const featured = wishes.slice(0, 10); const repeated = featured.length === 1 ? [...featured, ...featured, ...featured, ...featured] : [...featured, ...featured];
    repeated.forEach((wish) => { const item = document.createElement('p'); const name = document.createElement('strong'); item.className = 'ticker-item'; name.textContent = `${wish.name}: `; item.append(name, document.createTextNode(wish.message)); ticker.appendChild(item); });
}

function setWishView(view, animate = true) {
    const dialog = document.getElementById('wishesDialog');
    state.wishView = view === 'all' ? 'all' : 'single';
    dialog.classList.toggle('is-single-view', state.wishView === 'single');
    dialog.classList.toggle('is-all-view', state.wishView === 'all');
    const singleButton = document.getElementById('showWishSpotlight');
    const allButton = document.getElementById('showWishWall');
    singleButton.classList.toggle('is-active', state.wishView === 'single');
    allButton.classList.toggle('is-active', state.wishView === 'all');
    singleButton.setAttribute('aria-pressed', String(state.wishView === 'single'));
    allButton.setAttribute('aria-pressed', String(state.wishView === 'all'));
    if (state.wishView === 'single') renderWishSpotlight(animate);
}

function moveSpotlight(direction) {
    if (!state.wishes.length) return;
    state.activeWishIndex = (state.activeWishIndex + direction + state.wishes.length) % state.wishes.length;
    renderWishSpotlight(true, direction);
}

function renderWishSpotlight(animate = false, direction = 1) {
    const stage = document.querySelector('.spotlight-stage');
    const wish = state.wishes[state.activeWishIndex];
    const previous = document.getElementById('previousWish');
    const next = document.getElementById('nextWish');
    if (!wish) {
        document.getElementById('spotlightMessage').textContent = 'No wishes yet. The first lovely note could be yours.';
        document.getElementById('spotlightName').textContent = 'Waiting with love';
        document.getElementById('spotlightInitial').textContent = '♡';
        document.getElementById('spotlightTime').textContent = '';
        document.getElementById('spotlightPosition').textContent = '0 of 0';
        previous.disabled = true; next.disabled = true; return;
    }
    document.getElementById('spotlightMessage').textContent = wish.message;
    document.getElementById('spotlightName').textContent = wish.name;
    document.getElementById('spotlightInitial').textContent = Array.from(wish.name.trim())[0]?.toUpperCase() || '♡';
    const time = document.getElementById('spotlightTime');
    time.dateTime = wish.createdAt; time.textContent = formatWishDate(wish.createdAt);
    document.getElementById('spotlightPosition').textContent = `${state.activeWishIndex + 1} of ${state.wishes.length}`;
    previous.disabled = state.wishes.length < 2; next.disabled = state.wishes.length < 2;
    if (animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        stage.classList.remove('slide-forward', 'slide-back');
        void stage.offsetWidth;
        stage.classList.add(direction < 0 ? 'slide-back' : 'slide-forward');
    }
}

function createWishCard(wish) {
    const article = document.createElement('article'), text = document.createElement('p'), footer = document.createElement('footer'), name = document.createElement('strong'), time = document.createElement('time');
    article.className = 'wish-card'; text.textContent = wish.message; name.textContent = `— ${wish.name}`; time.dateTime = wish.createdAt; time.textContent = formatWishDate(wish.createdAt);
    footer.append(name, time); article.append(text, footer); return article;
}

function formatWishDate(value) {
    const date = new Date(value); if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(date);
}

function isLocalPreview() { return ['localhost', '127.0.0.1', ''].includes(location.hostname) || location.protocol === 'file:'; }
function getLocalWishes() { try { return JSON.parse(localStorage.getItem('akshaya-birthday-wishes') || '[]'); } catch { return []; } }
function saveLocalWish(payload) {
    const wish = { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), name: payload.name.slice(0, 40), message: payload.message.slice(0, 280), createdAt: new Date().toISOString() };
    localStorage.setItem('akshaya-birthday-wishes', JSON.stringify([wish, ...getLocalWishes()].slice(0, 80))); return wish;
}

function createSparkles() {
    const container = document.querySelector('.content-overlay'); if (!container || container.querySelector('.sparkle')) return;
    for (let i = 0; i < 26; i += 1) { const sparkle = document.createElement('div'); sparkle.className = 'sparkle'; sparkle.style.left = `${Math.random() * 100}vw`; sparkle.style.top = `${Math.random() * 100}vh`; sparkle.style.animationDelay = `${Math.random() * 3}s`; sparkle.style.animationDuration = `${Math.random() * 2 + 1.5}s`; container.appendChild(sparkle); }
}

function fireConfetti() {
    if (typeof window.confetti !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const end = Date.now() + 2600, defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };
    const timer = setInterval(() => { const left = end - Date.now(); if (left <= 0) return clearInterval(timer); const particleCount = 45 * (left / 2600); window.confetti({ ...defaults, particleCount, origin: { x: randomInRange(.1, .3), y: Math.random() - .2 } }); window.confetti({ ...defaults, particleCount, origin: { x: randomInRange(.7, .9), y: Math.random() - .2 } }); }, 250);
}
function randomConfetti() { if (typeof window.confetti !== 'function' || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) return; window.confetti({ particleCount: 12, angle: Math.random() * 360, spread: 45, origin: { x: Math.random(), y: Math.random() - .15 }, colors: ['#ff6b81', '#ff4757', '#ffffff', '#ffd32a'] }); }
function randomInRange(min, max) { return Math.random() * (max - min) + min; }
