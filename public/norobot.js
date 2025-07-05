// norobot.js: Disable search engine indexing and enforce nofollow on all links
(function() {
  // Insert <meta name="robots" content="noindex, nofollow"> if not already present
  if (!document.querySelector('meta[name="robots"]')) {
    var meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
  }

  // After DOM is loaded, add rel="nofollow" to all anchor tags
  document.addEventListener('DOMContentLoaded', function() {
    var links = document.querySelectorAll('a');
    for (var i = 0; i < links.length; i++) {
      links[i].setAttribute('rel', 'nofollow');
    }
  });
})();
