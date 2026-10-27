// Constants & Storage Keys
const STORAGE_KEY = 'macos_memopad_notes';
const THEME_KEY = 'macos_memopad_theme';

// Application State
let notes = [];
let currentNoteId = null;
let isDirty = false;

// DOM Elements
const titleInput = document.getElementById('noteTitle');
const bodyInput = document.getElementById('noteBody');
const notesList = document.getElementById('notesList');
const searchInput = document.getElementById('searchInput');
const statusDot = document.getElementById('statusDot');
const saveStatusText = document.getElementById('saveStatusText');
const wordCountText = document.getElementById('wordCountText');
const toast = document.getElementById('toastMessage');
const themeIcon = document.getElementById('themeIcon');

// Initialize App
function init() {
  loadTheme();
  loadNotes();

  if (notes.length === 0) {
    // Create initial default welcome note
    const defaultNote = {
      id: Date.now().toString(),
      title: "Welcome to macOS Memopad",
      body: "안녕하세요! 간결하고 세련된 macOS 스타일의 Memopad에 오신 것을 환영합니다.\n\n주요 기능:\n• Title 및 Body 실시간 작성\n• Save 버튼 및 단축키(⌘S / Ctrl+S)로 로컬 저장\n• Reset 버튼으로 작성 내용 초기화\n• 좌측 사이드바 메모 리스트 및 검색\n• Export 기능으로 텍스트(.txt) 파일 다운로드\n• 라이트 / 다크 모드 토글 지원\n\n자유롭게 새로운 생각을 기록해 보세요!",
      updatedAt: new Date().toISOString()
    };
    notes.push(defaultNote);
    saveNotesToStorage();
  }

  currentNoteId = notes[0].id;
  renderNotesList();
  loadNoteToEditor(currentNoteId);

  // Keyboard Shortcuts: Ctrl/Cmd + S to save, Ctrl/Cmd + N to new note
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      saveCurrentNote();
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
      e.preventDefault();
      createNewNote();
    }
  });
}

// LocalStorage Management
function loadNotes() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    notes = stored ? JSON.parse(stored) : [];
  } catch (err) {
    notes = [];
  }
}

function saveNotesToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

// Render Note Items in Sidebar
function renderNotesList(filterQuery = '') {
  notesList.innerHTML = '';
  const query = (filterQuery || '').toLowerCase().trim();

  const filteredNotes = notes.filter(n => {
    if (!query) return true;
    const titleMatch = (n.title || '').toLowerCase().includes(query);
    const bodyMatch = (n.body || '').toLowerCase().includes(query);
    return titleMatch || bodyMatch;
  });

  if (filteredNotes.length === 0) {
    notesList.innerHTML = `
      <div style="padding: 28px 16px; text-align: center; color: var(--text-secondary); font-size: 13px;">
        ${query ? 'No matching notes found' : 'No notes yet. Click "+ New Note" to start!'}
      </div>
    `;
    return;
  }

  filteredNotes.forEach(note => {
    const item = document.createElement('div');
    item.className = `note-item ${note.id === currentNoteId ? 'active' : ''}`;
    item.onclick = () => selectNote(note.id);

    const dateStr = formatDateTime(note.updatedAt);
    const titleText = (note.title && note.title.trim()) || 'Untitled Note';
    const previewText = (note.body && note.body.trim().replace(/\n/g, ' ')) || 'No content';

    item.innerHTML = `
      <div class="note-item-title">${escapeHtml(titleText)}</div>
      <div class="note-item-meta">
        <span style="font-weight: 500; font-size: 11px;">${dateStr}</span>
        <span class="note-item-preview">${escapeHtml(previewText)}</span>
      </div>
    `;

    notesList.appendChild(item);
  });
}

// Select & Load Note
function selectNote(id) {
  if (isDirty) {
    // Auto-save previous note before switching
    saveCurrentNote(false);
  }
  currentNoteId = id;
  renderNotesList(searchInput.value);
  loadNoteToEditor(id);
}

function loadNoteToEditor(id) {
  const note = notes.find(n => n.id === id);
  if (note) {
    titleInput.value = note.title || '';
    bodyInput.value = note.body || '';
    setSavedStatus(true);
    updateCounts();
  }
}

// New Note
function createNewNote() {
  if (isDirty) {
    saveCurrentNote(false);
  }

  const newNote = {
    id: Date.now().toString(),
    title: "",
    body: "",
    updatedAt: new Date().toISOString()
  };

  notes.unshift(newNote);
  saveNotesToStorage();
  currentNoteId = newNote.id;

  renderNotesList(searchInput.value);
  loadNoteToEditor(newNote.id);
  titleInput.focus();
  showToast('Created new note');
}

// Save Note
function saveCurrentNote(notify = true) {
  if (!currentNoteId) return;

  const note = notes.find(n => n.id === currentNoteId);
  if (note) {
    note.title = titleInput.value;
    note.body = bodyInput.value;
    note.updatedAt = new Date().toISOString();

    // Move to top of the list
    notes = [note, ...notes.filter(n => n.id !== currentNoteId)];
    saveNotesToStorage();
    renderNotesList(searchInput.value);
    setSavedStatus(true);

    if (notify) {
      showToast('Saved successfully');
    }
  }
}

// Reset Note
function resetCurrentNote() {
  if (confirm('Are you sure you want to reset the current title and body?')) {
    titleInput.value = '';
    bodyInput.value = '';
    handleContentChange();
    titleInput.focus();
    showToast('Reset note contents');
  }
}

// Delete Note
function deleteCurrentNote() {
  if (!currentNoteId) return;

  if (confirm('Delete this note permanently?')) {
    notes = notes.filter(n => n.id !== currentNoteId);
    saveNotesToStorage();

    if (notes.length === 0) {
      createNewNote();
    } else {
      currentNoteId = notes[0].id;
      renderNotesList(searchInput.value);
      loadNoteToEditor(currentNoteId);
    }
    showToast('Note deleted');
  }
}

// Export Note as .txt
function exportNote() {
  const title = titleInput.value.trim() || 'Untitled';
  const body = bodyInput.value;
  const content = `${title}\n\n${body}`;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^a-zA-Z0-9가-힣-_]/g, '_')}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Downloaded text file');
}

// Content change event
function handleContentChange() {
  setSavedStatus(false);
  updateCounts();
}

function setSavedStatus(saved) {
  isDirty = !saved;
  if (saved) {
    statusDot.classList.remove('unsaved');
    saveStatusText.textContent = 'All changes saved';
  } else {
    statusDot.classList.add('unsaved');
    saveStatusText.textContent = 'Unsaved changes (⌘S)';
  }
}

function updateCounts() {
  const text = bodyInput.value.trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const chars = bodyInput.value.length;
  wordCountText.textContent = `${words} words | ${chars} characters`;
}

// Search
function handleSearch(query) {
  renderNotesList(query);
}

// Toast Notification
let toastTimeout;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}

// Dark/Light Theme Toggle
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem(THEME_KEY, newTheme);
  themeIcon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
}

function loadTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  themeIcon.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
}

// Window controls
function toggleFullScreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => { });
  } else {
    document.exitFullscreen().catch(() => { });
  }
}

// Utility: Format Date
function formatDateTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// Utility: Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Run on mount
window.addEventListener('DOMContentLoaded', init);
