// Global site configuration editable by the operator.
//
// This file is plain static JS so it can be replaced on the server without a
// build step. The hidden operations panel (see admin.js) can generate this
// exact object for you ("导出 config.js"), so you rarely edit it by hand.
//
// Shape:
//   adminToken            secret token for the hidden panel: URL #ops=<token>
//   site.footerNote       optional sentence shown in the footer
//   ads.topEnabled        show the slim announcement strip (inline, dismissible)
//   ads.bottomEnabled     show the inline sponsor card (inline, dismissible)
//   ads.items[]           { id, slot:'top'|'bottom', text, link, enabled }
//
// Ads are rendered in normal document flow so they never cover the UI, and each
// one carries a close button that remembers the visitor's dismissal locally.
window.SITE_CONFIG = {
  adminToken: 'mkx7d2',
  site: { footerNote: '' },
  ads: {
    topEnabled: true,
    bottomEnabled: true,
    items: []
  }
};
