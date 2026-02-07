// ======================== state.js ==========================
let categories = [];
let tvs = [];
let selectedCategoryId = null;
let currentMediaTv = null;
let currentUserId = null;
let openActionsCategoryId = null;
let dzSelectedFiles = [];
let uploadMode = 'file';
let playlistEnabled = false;

// ===== GETTERS =====
export function getCategories() { return categories; }
export function getTVs() { return tvs; }
export function getSelectedCategoryId() { return selectedCategoryId; }
export function getCurrentMediaTv() { return currentMediaTv; }
export function getCurrentUserId() { return currentUserId; }
export function getOpenActionsCategoryId() { return openActionsCategoryId; }
export function getDzSelectedFiles() { return dzSelectedFiles; }
export function getUploadMode() { return uploadMode; }
export function getPlaylistEnabled() { return playlistEnabled; }

// ===== SETTERS =====
export function setCategories(value) { categories = value; }
export function setTVs(value) { tvs = value; }
export function setSelectedCategoryId(value) { selectedCategoryId = value; }
export function setCurrentMediaTv(value) { currentMediaTv = value; }
export function setCurrentUserId(value) { currentUserId = value; }
export function setOpenActionsCategoryId(value) { openActionsCategoryId = value; }
export function setDzSelectedFiles(value) { dzSelectedFiles = value; }
export function setUploadMode(value) { uploadMode = value; }
export function setPlaylistEnabled(value) { playlistEnabled = value; }