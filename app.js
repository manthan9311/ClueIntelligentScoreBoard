/**
 * app.js
 * UI Coordinator, State Manager, and Event Handlers
 */

import { solveGame, STATES } from './solver.js';

// Predefined Game Editions Configuration
const PRESENTS = {
  classic: {
    name: "Classic Clue",
    suspects: ["Col. Mustard", "Miss Scarlet", "Mr. Green", "Mrs. Peacock", "Mrs. White", "Prof. Plum"],
    weapons: ["Candlestick", "Knife", "Lead Pipe", "Revolver", "Rope", "Wrench"],
    rooms: ["Kitchen", "Ballroom", "Conservatory", "Dining Room", "Billiard Room", "Library", "Lounge", "Hall", "Study"]
  },
  master: {
    name: "Clue Master Detective",
    suspects: ["Col. Mustard", "Miss Scarlet", "Mr. Green", "Mrs. Peacock", "Mrs. White", "Prof. Plum", "Miss Peach", "Monsieur Brunette", "Madame Rose", "Sergeant Gray"],
    weapons: ["Candlestick", "Knife", "Lead Pipe", "Revolver", "Rope", "Wrench", "Poison", "Horseshoe"],
    rooms: ["Courtyard", "Gazebo", "Drawing Room", "Dining Room", "Kitchen", "Carriage House", "Trophy Room", "Conservatory", "Studio", "Billiard Room", "Library", "Fountain"]
  },
  hp: {
    name: "Harry Potter Clue",
    suspects: ["Harry", "Ron", "Hermione", "Ginny", "Luna", "Neville"],
    weapons: ["Poison", "Grim", "Gryffindor Sword", "Petrified Broom", "Cursed Necklace", "Love Potion"],
    rooms: ["Great Hall", "Hospital Wing", "Room of Requirement", "Gryffindor Common Room", "Potions Classroom", "Divination Classroom", "Owlery", "Library", "Hagrid's Cabin"]
  }
};

const DEFAULT_COLORS = [
  "#ec4899", // Pink
  "#3b82f6", // Blue
  "#10b981", // Green
  "#f59e0b", // Yellow
  "#a855f7", // Purple
  "#f97316", // Orange
];

// App State
let state = {
  view: 'setup', // 'setup' | 'game'
  theme: 'dark', // 'dark' | 'light'
  activeTab: 'scorecard', // 'scorecard' | 'suggestions' | 'intel'
  gameConfig: {
    themeId: 'classic',
    cards: [], // { id, name, category }
    players: [] // { id, name, cardCount, color }
  },
  userGrid: {}, // userGrid[entityId][cardId] = STATES
  roundGrid: {}, // roundGrid[entityId][cardId] = string note (round indicator)
  suggestions: [], // logged suggestions list
  deducedGrid: {},
  reasonsGrid: {},
  contradiction: null
};

// Target Cell for bottom-sheet editor
let editingCell = {
  entityId: null,
  cardId: null
};

// DOM References
const setupView = document.getElementById('setup-view');
const gameView = document.getElementById('game-view');
const appNav = document.getElementById('app-navigation');
const restartBtn = document.getElementById('restart-btn');
const themeToggleBtn = document.getElementById('theme-toggle');
const setupForm = document.getElementById('setup-form');
const themeSelect = document.getElementById('game-theme');
const customDeckSection = document.getElementById('custom-deck-section');
const customSuspectsInput = document.getElementById('custom-suspects');
const customWeaponsInput = document.getElementById('custom-weapons');
const customRoomsInput = document.getElementById('custom-rooms');
const playersContainer = document.getElementById('players-list-container');
const addPlayerBtn = document.getElementById('add-player-btn');
const autoDistributeBtn = document.getElementById('auto-distribute-btn');
const cardAllocationWarning = document.getElementById('card-allocation-warning');
const currentAllocatedSpan = document.getElementById('current-allocated-cards');
const expectedCardsSpan = document.getElementById('expected-cards-count');

// Scorecard & Suggestions DOM
const scorecardGridTable = document.getElementById('scorecard-grid');
const suggForm = document.getElementById('suggestion-form');
const suggPlayerSelect = document.getElementById('sugg-player');
const suggSuspectSelect = document.getElementById('sugg-suspect');
const suggWeaponSelect = document.getElementById('sugg-weapon');
const suggRoomSelect = document.getElementById('sugg-room');
const refuteFlowContainer = document.getElementById('refutation-players-flow');
const revealedCardSection = document.getElementById('revealed-card-section');
const revealedCardSelect = document.getElementById('sugg-revealed-card');
const timelineContainer = document.getElementById('suggestion-timeline-container');

// Intel Dashboard DOM
const envelopeStatusContainer = document.getElementById('envelope-status-container');
const confirmedHoldingsContainer = document.getElementById('confirmed-holdings-container');
const contradictionBanner = document.getElementById('contradiction-banner');
const contradictionMessage = document.getElementById('contradiction-message');
const solvedBanner = document.getElementById('solved-banner');
const solvedDetails = document.getElementById('solved-details');

// Bottom Sheet DOM
const sheetOverlay = document.getElementById('bottom-sheet-overlay');
const cellSheet = document.getElementById('cell-editor-sheet');
const sheetTitle = document.getElementById('sheet-title');
const sheetSubtitle = document.getElementById('sheet-subtitle');
const sheetBtnClose = document.getElementById('btn-sheet-close');
const btnStatusNo = document.getElementById('btn-status-no');
const btnStatusMaybe = document.getElementById('btn-status-maybe');
const btnStatusYes = document.getElementById('btn-status-yes');
const customNoteInput = document.getElementById('custom-note-input');
const autoDeductionSection = document.getElementById('auto-deduction-section');
const deductionReasonText = document.getElementById('deduction-reason-text');

// Init application
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadStateFromLocalStorage();
  setupGlobalEventListeners();
  
  if (state.view === 'game') {
    switchToView('game');
    runSolverAndRender();
  } else {
    switchToView('setup');
    initSetupScreen();
  }
});

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  state.theme = savedTheme;
  document.body.className = savedTheme === 'dark' ? 'dark-theme' : 'light-theme';
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  document.body.className = state.theme === 'dark' ? 'dark-theme' : 'light-theme';
  localStorage.setItem('theme', state.theme);
}

// LocalStorage Persistence
function saveStateToLocalStorage() {
  localStorage.setItem('clue_state', JSON.stringify(state));
}

function loadStateFromLocalStorage() {
  try {
    const data = localStorage.getItem('clue_state');
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed.gameConfig && parsed.gameConfig.cards && parsed.gameConfig.cards.length > 0) {
        state = parsed;
      }
    }
  } catch (err) {
    console.error("Failed to load local storage state", err);
  }
}

// View switcher
function switchToView(viewName) {
  state.view = viewName;
  saveStateToLocalStorage();
  
  const desktopNav = document.getElementById('desktop-navigation');
  
  if (viewName === 'setup') {
    setupView.classList.add('active');
    gameView.classList.remove('active');
    appNav.classList.add('hidden');
    if (desktopNav) desktopNav.classList.add('hidden');
    restartBtn.classList.add('hidden');
  } else {
    setupView.classList.remove('active');
    gameView.classList.add('active');
    appNav.classList.remove('hidden');
    if (desktopNav) desktopNav.classList.remove('hidden');
    restartBtn.classList.remove('hidden');
    
    // Switch to active tab
    switchTab(state.activeTab || 'scorecard');
  }
}

// Navigation Tabs
function switchTab(tabId) {
  state.activeTab = tabId;
  saveStateToLocalStorage();
  
  // Set navbar button state
  document.querySelectorAll('.nav-item').forEach(btn => {
    if (btn.dataset.tab === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Toggle tab contents
  document.querySelectorAll('.game-tab-content').forEach(content => {
    if (content.id === `tab-${tabId}`) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });

  // Run specific renders
  if (tabId === 'scorecard') {
    renderScorecardGrid();
  } else if (tabId === 'suggestions') {
    initSuggestionForm();
    renderSuggestionTimeline();
  } else if (tabId === 'intel') {
    renderIntelDashboard();
  }
}

// Setup Mode Functions
function initSetupScreen() {
  // Clear any existing list
  playersContainer.innerHTML = '';
  
  // Populate setup players if empty
  if (!state.gameConfig.players || state.gameConfig.players.length === 0) {
    // Add 4 default players to start
    const defaultNames = ["You", "Alice", "Bob", "Charlie"];
    defaultNames.forEach((name, idx) => {
      addPlayerRow(name, 0, DEFAULT_COLORS[idx % DEFAULT_COLORS.length]);
    });
  } else {
    state.gameConfig.players.forEach(p => {
      addPlayerRow(p.name, p.cardCount, p.color);
    });
  }

  // Set theme dropdown
  themeSelect.value = state.gameConfig.themeId || 'classic';
  toggleCustomDeckVisibility();
  
  updateCardAllocationVerification();
}

function toggleCustomDeckVisibility() {
  if (themeSelect.value === 'custom') {
    customDeckSection.classList.remove('hidden');
    // Pre-fill inputs with classic Clue lists if empty
    if (!customSuspectsInput.value) {
      customSuspectsInput.value = PRESENTS.classic.suspects.join(', ');
      customWeaponsInput.value = PRESENTS.classic.weapons.join(', ');
      customRoomsInput.value = PRESENTS.classic.rooms.join(', ');
    }
  } else {
    customDeckSection.classList.add('hidden');
  }
  updateCardAllocationVerification();
}

function addPlayerRow(name = '', cardCount = 0, color = null) {
  const idx = playersContainer.children.length;
  if (idx >= 6) return; // Limit to 6 players maximum

  const pColor = color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
  
  const row = document.createElement('div');
  row.className = 'player-setup-row';
  row.innerHTML = `
    <input type="color" class="player-color-picker" value="${pColor}" title="Choose player accent color">
    <input type="text" class="form-control player-name-input" placeholder="Player ${idx + 1}" value="${name || 'Player ' + (idx + 1)}" required style="flex: 1;">
    <div class="form-group" style="margin-bottom: 0;">
      <input type="number" class="form-control player-card-count-input" placeholder="Cards" value="${cardCount}" min="0" max="15" title="Cards count">
    </div>
    <button type="button" class="btn btn-secondary btn-sm delete-player-btn" style="padding: 10px; color: var(--color-no);" title="Remove player">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        <line x1="10" y1="11" x2="10" y2="17"></line>
        <line x1="14" y1="11" x2="14" y2="17"></line>
      </svg>
    </button>
  `;

  // Attach delete event
  row.querySelector('.delete-player-btn').addEventListener('click', () => {
    if (playersContainer.children.length <= 3) {
      alert("At least 3 players are required to play Clue.");
      return;
    }
    row.remove();
    updateCardAllocationVerification();
  });

  // Attach input listener to re-verify totals
  row.querySelector('.player-card-count-input').addEventListener('input', updateCardAllocationVerification);
  row.querySelector('.player-name-input').addEventListener('input', updateCardAllocationVerification);

  playersContainer.appendChild(row);
  updateCardAllocationVerification();
}

function getActiveThemeDeck() {
  const theme = themeSelect.value;
  if (theme === 'custom') {
    const parse = (str) => str.split(',').map(s => s.trim()).filter(s => s.length > 0);
    return {
      name: "Custom Game",
      suspects: parse(customSuspectsInput.value),
      weapons: parse(customWeaponsInput.value),
      rooms: parse(customRoomsInput.value)
    };
  }
  return PRESENTS[theme] || PRESENTS.classic;
}

function updateCardAllocationVerification() {
  const deck = getActiveThemeDeck();
  const totalCards = deck.suspects.length + deck.weapons.length + deck.rooms.length;
  // Solution is always 3 cards (1 suspect, 1 weapon, 1 room)
  const expectedTotal = totalCards - 3;
  
  expectedCardsSpan.textContent = expectedTotal;

  // Compute current allocated sum
  let sum = 0;
  document.querySelectorAll('.player-card-count-input').forEach(input => {
    sum += parseInt(input.value) || 0;
  });

  currentAllocatedSpan.textContent = sum;

  if (sum === expectedTotal) {
    cardAllocationWarning.classList.add('hidden');
    return true;
  } else {
    cardAllocationWarning.classList.remove('hidden');
    return false;
  }
}

function autoDistributeCards() {
  const deck = getActiveThemeDeck();
  const totalCards = deck.suspects.length + deck.weapons.length + deck.rooms.length;
  const cardsToDistribute = totalCards - 3;

  const playerRows = document.querySelectorAll('.player-setup-row');
  const playerCount = playerRows.length;
  if (playerCount === 0) return;

  const baseCards = Math.floor(cardsToDistribute / playerCount);
  let remainder = cardsToDistribute % playerCount;

  playerRows.forEach((row, idx) => {
    const input = row.querySelector('.player-card-count-input');
    // Distribute remainder cards to players in order
    const count = baseCards + (idx < remainder ? 1 : 0);
    input.value = count;
  });

  updateCardAllocationVerification();
}

// Initialize active game configuration
function launchCaseFiles(e) {
  e.preventDefault();

  // Validate cards allocation
  const isAllocationValid = updateCardAllocationVerification();
  if (!isAllocationValid) {
    const expected = expectedCardsSpan.textContent;
    const allocated = currentAllocatedSpan.textContent;
    const proceed = confirm(`Warning: Player card counts add up to ${allocated}, but should equal exactly ${expected}. Do you want to continue anyway? (Automatic solver deductions might be less precise or flag fake contradictions)`);
    if (!proceed) return;
  }

  // Parse deck cards
  const deck = getActiveThemeDeck();
  const cardList = [];
  const makeId = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

  deck.suspects.forEach(s => cardList.push({ id: 's_' + makeId(s), name: s, category: 'suspect' }));
  deck.weapons.forEach(w => cardList.push({ id: 'w_' + makeId(w), name: w, category: 'weapon' }));
  deck.rooms.forEach(r => cardList.push({ id: 'r_' + makeId(r), name: r, category: 'room' }));

  // Parse players
  const playerList = [];
  const playerRows = document.querySelectorAll('.player-setup-row');
  playerRows.forEach((row, idx) => {
    const name = row.querySelector('.player-name-input').value.trim() || `Player ${idx + 1}`;
    const cardCount = parseInt(row.querySelector('.player-card-count-input').value) || 0;
    const color = row.querySelector('.player-color-picker').value;
    playerList.push({
      id: 'p_' + idx,
      name,
      cardCount,
      color
    });
  });

  // Re-initialize state
  state.gameConfig = {
    themeId: themeSelect.value,
    cards: cardList,
    players: playerList
  };
  state.userGrid = {};
  state.roundGrid = {};
  state.suggestions = [];
  state.deducedGrid = {};
  state.reasonsGrid = {};
  state.contradiction = null;
  state.activeTab = 'scorecard';

  // Seed grid databases
  const entities = [...playerList.map(p => p.id), 'envelope'];
  entities.forEach(entityId => {
    state.userGrid[entityId] = {};
    state.roundGrid[entityId] = {};
    cardList.forEach(c => {
      state.userGrid[entityId][c.id] = STATES.MAYBE;
      state.roundGrid[entityId][c.id] = "";
    });
  });

  switchToView('game');
  runSolverAndRender();
}

// Active Game Engine Actions
function runSolverAndRender() {
  const cards = state.gameConfig.cards;
  const players = state.gameConfig.players;
  
  // Run deductions in the solver
  const { grid, reasons, contradiction } = solveGame(cards, players, state.userGrid, state.suggestions);
  
  state.deducedGrid = grid;
  state.reasonsGrid = reasons;
  state.contradiction = contradiction;

  saveStateToLocalStorage();

  // Show Contradiction Banner if any
  if (contradiction) {
    contradictionMessage.textContent = contradiction;
    contradictionBanner.classList.remove('hidden');
  } else {
    contradictionBanner.classList.add('hidden');
  }

  // Check if Envelope is solved
  checkEnvelopeSolved();

  // Re-render currently active tab
  switchTab(state.activeTab);
}

function checkEnvelopeSolved() {
  const cards = state.gameConfig.cards;
  const solved = { suspect: null, weapon: null, room: null };

  ['suspect', 'weapon', 'room'].forEach(cat => {
    const catCards = cards.filter(c => c.category === cat);
    catCards.forEach(c => {
      if (state.deducedGrid['envelope'] && state.deducedGrid['envelope'][c.id] === STATES.YES) {
        solved[cat] = c.name;
      }
    });
  });

  if (solved.suspect && solved.weapon && solved.room) {
    solvedDetails.innerHTML = `🕵️‍♂️ <strong>${solved.suspect}</strong> &bull; 🪓 <strong>${solved.weapon}</strong> &bull; 🏰 <strong>${solved.room}</strong>`;
    solvedBanner.classList.remove('hidden');
  } else {
    solvedBanner.classList.add('hidden');
  }
}

// Tab 1: Render Scorecard Grid
function renderScorecardGrid() {
  const cards = state.gameConfig.cards;
  const players = state.gameConfig.players;
  
  let html = '<thead><tr><th>Card</th>';
  // Render Player Column Headers
  players.forEach(p => {
    html += `<th style="border-bottom: 3px solid ${p.color};">${escapeHtml(p.name)} (${p.cardCount})</th>`;
  });
  // Envelope column
  html += `<th style="border-bottom: 3px solid #a855f7;">Envelope</th></tr></thead><tbody>`;

  const categories = [
    { key: 'suspect', label: 'Suspects (Who)' },
    { key: 'weapon', label: 'Weapons (What)' },
    { key: 'room', label: 'Rooms (Where)' }
  ];

  categories.forEach(cat => {
    const catCards = cards.filter(c => c.category === cat.key);
    
    // Category header row
    html += `<tr class="category-header-row"><td colspan="${players.length + 2}">${cat.label}</td></tr>`;

    catCards.forEach(card => {
      html += `<tr><td>${escapeHtml(card.name)}</td>`;

      // Render each player's status cell
      players.forEach(p => {
        html += renderCell(p.id, card.id);
      });

      // Render envelope cell
      html += renderCell('envelope', card.id);
      
      html += '</tr>';
    });
  });

  html += '</tbody>';
  scorecardGridTable.innerHTML = html;

  // Add click events to scorecard cells
  document.querySelectorAll('.scorecard-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      const entityId = cell.dataset.entity;
      const cardId = cell.dataset.card;
      openCellEditor(entityId, cardId);
    });
  });
}

function renderCell(entityId, cardId) {
  const userVal = state.userGrid[entityId] ? state.userGrid[entityId][cardId] : STATES.MAYBE;
  const deducedVal = state.deducedGrid[entityId] ? state.deducedGrid[entityId][cardId] : STATES.MAYBE;
  const reason = state.reasonsGrid[entityId] ? state.reasonsGrid[entityId][cardId] : null;
  const roundIndicator = state.roundGrid[entityId] ? state.roundGrid[entityId][cardId] : '';

  let cellClass = 'scorecard-cell';
  let cellText = '';
  
  const displayVal = deducedVal !== STATES.MAYBE ? deducedVal : userVal;
  
  if (displayVal === STATES.YES) {
    cellClass += ' cell-yes';
    cellText = '✅';
  } else if (displayVal === STATES.NO) {
    cellClass += ' cell-no';
    cellText = '❌';
  }

  // Deduced distinction
  if (userVal === STATES.MAYBE && deducedVal !== STATES.MAYBE) {
    cellClass += ' cell-deduced';
  }

  // Custom round note badge overlay
  let badgeHtml = '';
  if (roundIndicator) {
    badgeHtml = `<span class="round-badge" title="Round / Custom Indicator">${escapeHtml(roundIndicator)}</span>`;
  }

  const tooltip = reason ? `title="Deduced: ${escapeHtml(reason)}"` : '';

  return `<td class="${cellClass}" data-entity="${entityId}" data-card="${cardId}" ${tooltip}>
    <span class="cell-value">${cellText}</span>
    ${badgeHtml}
  </td>`;
}

// Cell bottom-sheet editor handlers
function openCellEditor(entityId, cardId) {
  editingCell.entityId = entityId;
  editingCell.cardId = cardId;

  const card = state.gameConfig.cards.find(c => c.id === cardId);
  const entityName = entityId === 'envelope' 
    ? 'Envelope' 
    : state.gameConfig.players.find(p => p.id === entityId)?.name || 'Player';

  sheetTitle.textContent = `Card: ${card.name}`;
  sheetSubtitle.innerHTML = `Investigator: <strong>${entityName}</strong>`;

  // Get current user value and deduced value
  const userVal = state.userGrid[entityId][cardId];
  const deducedVal = state.deducedGrid[entityId][cardId];
  const reason = state.reasonsGrid[entityId][cardId];
  const roundVal = state.roundGrid[entityId][cardId] || '';

  // Select active status button
  document.querySelectorAll('.status-toggle-btn').forEach(btn => {
    const btnState = parseInt(btn.dataset.state);
    if (btnState === userVal) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Pre-fill round selection
  document.querySelectorAll('.round-btn').forEach(btn => {
    if (btn.dataset.round === roundVal) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  customNoteInput.value = roundVal;

  // Show / Hide auto-deduction explanation
  if (userVal === STATES.MAYBE && deducedVal !== STATES.MAYBE && reason) {
    deductionReasonText.textContent = reason;
    autoDeductionSection.classList.remove('hidden');
  } else {
    autoDeductionSection.classList.add('hidden');
  }

  // Slide bottom sheet up
  sheetOverlay.classList.add('active');
  cellSheet.classList.add('active');
}

function closeCellEditor() {
  sheetOverlay.classList.remove('active');
  cellSheet.classList.remove('active');
}

function handleStatusToggle(e) {
  const btn = e.currentTarget;
  const newState = parseInt(btn.dataset.state);
  
  const { entityId, cardId } = editingCell;
  if (!entityId || !cardId) return;

  state.userGrid[entityId][cardId] = newState;

  // Reflect change immediately on buttons
  document.querySelectorAll('.status-toggle-btn').forEach(b => {
    b.classList.toggle('active', b === btn);
  });

  runSolverAndRender();
}

function handleRoundSelect(e) {
  const btn = e.currentTarget;
  const roundVal = btn.dataset.round;

  const { entityId, cardId } = editingCell;
  if (!entityId || !cardId) return;

  state.roundGrid[entityId][cardId] = roundVal;
  customNoteInput.value = roundVal;

  document.querySelectorAll('.round-btn').forEach(b => {
    b.classList.toggle('active', b === btn);
  });

  runSolverAndRender();
}

function handleCustomNoteInput() {
  const val = customNoteInput.value.trim();
  const { entityId, cardId } = editingCell;
  if (!entityId || !cardId) return;

  state.roundGrid[entityId][cardId] = val;

  // Clear active quick round buttons if custom text doesn't match
  document.querySelectorAll('.round-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.round === val && val !== '');
  });

  runSolverAndRender();
}

// Tab 2: Suggestions Log Flow
function initSuggestionForm() {
  const cards = state.gameConfig.cards;
  const players = state.gameConfig.players;

  // 1. Fill who suggested dropdown
  suggPlayerSelect.innerHTML = players.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');

  // 2. Fill cards dropdowns
  suggSuspectSelect.innerHTML = cards.filter(c => c.category === 'suspect')
    .map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  
  suggWeaponSelect.innerHTML = cards.filter(c => c.category === 'weapon')
    .map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  
  suggRoomSelect.innerHTML = cards.filter(c => c.category === 'room')
    .map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

  // 3. Update Refuter Form layouts when Suggester changes
  suggPlayerSelect.removeEventListener('change', renderRefutationFlow);
  suggPlayerSelect.addEventListener('change', renderRefutationFlow);

  // 4. Update the revealed card choices based on selects
  const updateRevealedChoices = () => {
    const sId = suggSuspectSelect.value;
    const wId = suggWeaponSelect.value;
    const rId = suggRoomSelect.value;
    
    const sName = cards.find(c => c.id === sId)?.name || 'Suspect';
    const wName = cards.find(c => c.id === wId)?.name || 'Weapon';
    const rName = cards.find(c => c.id === rId)?.name || 'Room';

    revealedCardSelect.innerHTML = `
      <option value="">Unspecified (Card hidden from us)</option>
      <option value="${sId}">${escapeHtml(sName)}</option>
      <option value="${wId}">${escapeHtml(wName)}</option>
      <option value="${rId}">${escapeHtml(rName)}</option>
    `;
  };

  [suggSuspectSelect, suggWeaponSelect, suggRoomSelect].forEach(select => {
    select.removeEventListener('change', updateRevealedChoices);
    select.addEventListener('change', updateRevealedChoices);
  });

  renderRefutationFlow();
  updateRevealedChoices();
}

function renderRefutationFlow() {
  const players = state.gameConfig.players;
  const suggesterId = suggPlayerSelect.value;

  // We order the refuters clockwise starting AFTER the suggester
  const suggesterIdx = players.findIndex(p => p.id === suggesterId);
  const orderedRefuters = [];
  
  for (let i = 1; i < players.length; i++) {
    const nextIdx = (suggesterIdx + i) % players.length;
    orderedRefuters.push(players[nextIdx]);
  }

  let html = '';
  orderedRefuters.forEach(p => {
    html += `
      <div class="refute-player-pill" data-player-id="${p.id}">
        <div class="refute-player-pill-left">
          <span class="player-avatar-dot" style="background-color: ${p.color};"></span>
          <strong>${escapeHtml(p.name)}</strong>
        </div>
        <div class="refute-status-toggles">
          <button type="button" class="refute-status-btn state-passed active" data-refuted="false">Passed</button>
          <button type="button" class="refute-status-btn state-refuted" data-refuted="true">Refuted</button>
        </div>
      </div>
    `;
  });

  refuteFlowContainer.innerHTML = html;

  // Attach button triggers to refuters lists
  document.querySelectorAll('.refute-status-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const isRefuted = btn.dataset.refuted === 'true';
      const pill = btn.closest('.refute-player-pill');
      const pillPlayerId = pill.dataset.playerId;

      // Toggle buttons inside this pill
      pill.querySelectorAll('.refute-status-btn').forEach(b => {
        b.classList.toggle('active', b === btn);
      });

      if (isRefuted) {
        // If a player refuted, all subsequent players in order are automatically set to passed
        // and cannot refute (since only one player refutes in a Clue turn).
        let foundRefuter = false;
        document.querySelectorAll('.refute-player-pill').forEach(item => {
          if (foundRefuter) {
            // Set all subsequent players to 'Passed'
            item.querySelector('.state-passed').click();
          }
          if (item.dataset.playerId === pillPlayerId) {
            foundRefuter = true;
          }
        });

        // Show the 'revealed card dropdown' if "You" are the suggester, or if the refuter is "You"
        const isUserSuggester = (suggesterId === 'p_0'); // Assumes 'p_0' is "You" (first player)
        const isUserRefuter = (pillPlayerId === 'p_0');
        
        if (isUserSuggester || isUserRefuter) {
          revealedCardSection.classList.remove('hidden');
        } else {
          revealedCardSection.classList.add('hidden');
          revealedCardSelect.value = '';
        }
      } else {
        // Check if any refuters are still set to Refuted, otherwise hide revealed dropdown
        const hasRefuter = Array.from(document.querySelectorAll('.refute-player-pill'))
          .some(item => item.querySelector('.state-refuted').classList.contains('active'));
        
        if (!hasRefuter) {
          revealedCardSection.classList.add('hidden');
          revealedCardSelect.value = '';
        }
      }
    });
  });

  // Reset revealed card section initially
  revealedCardSection.classList.add('hidden');
  revealedCardSelect.value = '';
}

function handleSuggestionSubmit(e) {
  e.preventDefault();

  const suggesterId = suggPlayerSelect.value;
  const suspectId = suggSuspectSelect.value;
  const weaponId = suggWeaponSelect.value;
  const roomId = suggRoomSelect.value;
  const revealedCardId = revealedCardSelect.value || null;

  // Compute passed players and refuter
  const passedPlayerIds = [];
  let refuterId = null;

  const refutePills = document.querySelectorAll('.refute-player-pill');
  for (let pill of refutePills) {
    const pid = pill.dataset.playerId;
    const isRefuted = pill.querySelector('.state-refuted').classList.contains('active');
    
    if (isRefuted) {
      refuterId = pid;
      break; // Stops checking clockwise at the refuter
    } else {
      passedPlayerIds.push(pid);
    }
  }

  // Create suggestion object
  const suggestion = {
    suggesterId,
    suspectId,
    weaponId,
    roomId,
    refuterId,
    passedPlayerIds,
    revealedCardId
  };

  state.suggestions.push(suggestion);
  
  // Clear and reset form
  suggForm.reset();
  initSuggestionForm();

  runSolverAndRender();
}

function renderSuggestionTimeline() {
  const cards = state.gameConfig.cards;
  const players = state.gameConfig.players;
  
  if (state.suggestions.length === 0) {
    timelineContainer.innerHTML = '<div class="timeline-empty">No suggestions logged yet. Logs will feed the solver\'s logic automatically.</div>';
    return;
  }

  let html = '';
  state.suggestions.forEach((sugg, idx) => {
    const suggesterName = players.find(p => p.id === sugg.suggesterId)?.name || 'Player';
    const suspectName = cards.find(c => c.id === sugg.suspectId)?.name || 'Suspect';
    const weaponName = cards.find(c => c.id === sugg.weaponId)?.name || 'Weapon';
    const roomName = cards.find(c => c.id === sugg.roomId)?.name || 'Room';

    let refuterNameText = 'no one refuted';
    if (sugg.refuterId) {
      const refuterName = players.find(p => p.id === sugg.refuterId)?.name || 'Player';
      const shownName = sugg.revealedCardId 
        ? ` (showed <strong>${cards.find(c => c.id === sugg.revealedCardId)?.name}</strong>)`
        : ' (showed a card)';
      refuterNameText = `refuted by <strong>${escapeHtml(refuterName)}</strong>${shownName}`;
    }

    const passedText = sugg.passedPlayerIds.length > 0
      ? `Passed: ${sugg.passedPlayerIds.map(pid => players.find(p => p.id === pid)?.name).join(', ')}`
      : 'No passes';

    html += `
      <div class="timeline-item">
        <div class="timeline-item-left">
          <div class="sugg-number-badge">${idx + 1}</div>
          <div class="timeline-item-content">
            <h4>${escapeHtml(suggesterName)} <span>suggested:</span></h4>
            <p>🕵️‍♂️ <strong>${escapeHtml(suspectName)}</strong> &bull; 🪓 <strong>${escapeHtml(weaponName)}</strong> &bull; 🏰 <strong>${escapeHtml(roomName)}</strong></p>
            <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
              ${refuterNameText} &bull; <span style="font-style: italic;">${escapeHtml(passedText)}</span>
            </p>
          </div>
        </div>
        <button type="button" class="btn-delete-sugg" data-idx="${idx}" title="Delete this suggestion">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;
  });

  timelineContainer.innerHTML = html;

  // Attach delete buttons
  document.querySelectorAll('.btn-delete-sugg').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      if (confirm(`Are you sure you want to delete suggestion #${idx + 1}?`)) {
        state.suggestions.splice(idx, 1);
        runSolverAndRender();
      }
    });
  });
}

// Tab 3: Intel Dashboard Status
function renderIntelDashboard() {
  const cards = state.gameConfig.cards;
  const players = state.gameConfig.players;

  // 1. Render Envelope Statuses
  let envelopeHtml = '';
  ['suspect', 'weapon', 'room'].forEach(cat => {
    const catCards = cards.filter(c => c.category === cat);
    
    // Find if we have a YES for this category
    const yesCard = catCards.find(c => state.deducedGrid['envelope'] && state.deducedGrid['envelope'][c.id] === STATES.YES);
    
    if (yesCard) {
      envelopeHtml += `
        <div class="prediction-row" style="border-left: 4px solid var(--color-yes);">
          <span class="prediction-category">${cat}</span>
          <span class="prediction-card-name text-yes">${escapeHtml(yesCard.name)}</span>
          <span class="prediction-status-badge solved">SOLVED</span>
        </div>
      `;
    } else {
      // Find remaining possibilities (cells not marked NO)
      const possibilities = catCards.filter(c => state.deducedGrid['envelope'] && state.deducedGrid['envelope'][c.id] !== STATES.NO);
      const text = possibilities.length === 1 
        ? escapeHtml(possibilities[0].name)
        : `${possibilities.length} possibilities remaining`;
      
      envelopeHtml += `
        <div class="prediction-row" style="border-left: 4px solid var(--text-muted);">
          <span class="prediction-category">${cat}</span>
          <span class="prediction-card-name" style="color: var(--text-secondary);">${text}</span>
          <span class="prediction-status-badge searching">SEARCHING</span>
        </div>
      `;
    }
  });
  envelopeStatusContainer.innerHTML = envelopeHtml;

  // 2. Render Confirmed Player Card Holdings
  let confirmedHtml = '';
  players.forEach(p => {
    const playerConfirmedCards = cards.filter(c => state.deducedGrid[p.id] && state.deducedGrid[p.id][c.id] === STATES.YES);

    if (playerConfirmedCards.length > 0) {
      const pills = playerConfirmedCards.map(c => `
        <span class="confirmed-card-pill" style="border-color: ${p.color};">${escapeHtml(c.name)}</span>
      `).join('');

      confirmedHtml += `
        <div class="confirmed-player-block">
          <div class="confirmed-player-header" style="color: ${p.color};">
            <span class="player-avatar-dot" style="background-color: ${p.color};"></span>
            <strong>${escapeHtml(p.name)}</strong> 
            <span style="font-weight: normal; font-size: 0.75rem; color: var(--text-muted);">
              (${playerConfirmedCards.length} of ${p.cardCount} confirmed)
            </span>
          </div>
          <div class="confirmed-cards-pills">${pills}</div>
        </div>
      `;
    }
  });

  if (!confirmedHtml) {
    confirmedHtml = '<div class="confirmed-empty">No player holdings confirmed yet. Log clues to solve them!</div>';
  }
  confirmedHoldingsContainer.innerHTML = confirmedHtml;
}

// Global Event Listeners Setup
function setupGlobalEventListeners() {
  // Theme Toggle
  themeToggleBtn.addEventListener('click', toggleTheme);

  // Restart Button
  restartBtn.addEventListener('click', () => {
    if (confirm("Reset current investigation? All scorecards and suggestions will be cleared.")) {
      state.view = 'setup';
      switchToView('setup');
      initSetupScreen();
    }
  });

  // Setup view actions
  themeSelect.addEventListener('change', toggleCustomDeckVisibility);
  addPlayerBtn.addEventListener('click', () => addPlayerRow('', 0, null));
  autoDistributeBtn.addEventListener('click', autoDistributeCards);
  setupForm.addEventListener('submit', launchCaseFiles);

  // Navigation tab bar
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });

  // Bottom Sheet Edit Closes
  sheetBtnClose.addEventListener('click', closeCellEditor);
  sheetOverlay.addEventListener('click', closeCellEditor);

  // Bottom Sheet Cell actions
  document.querySelectorAll('.status-toggle-btn').forEach(btn => {
    btn.addEventListener('click', handleStatusToggle);
  });

  document.querySelectorAll('.round-btn').forEach(btn => {
    btn.addEventListener('click', handleRoundSelect);
  });

  customNoteInput.addEventListener('input', handleCustomNoteInput);

  // Suggestions form submit
  suggForm.addEventListener('submit', handleSuggestionSubmit);
}

// Utility Helpers
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
