// chatjs/state.js — Shared mutable state for the chat page
// ─────────────────────────────────────────────────────────────────────────────

export const state = {
  conversations:  [],
  activeConvId:   null,
  activeMessages: [],
  busy:           false,
  searchFilter:   '',
  currentUser: {
    username:   'there',
    globalName: 'there',
    avatarUrl:  null,
  },
};
