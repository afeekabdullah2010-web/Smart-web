(function () {
  'use strict';
  function toast(text) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(window.spToast);
    window.spToast = setTimeout(function () { el.classList.remove('show'); }, 3000);
  }
  window.toast = toast;
  window.toggleNav = function () {
    var sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('open');
  };
  function showServerNotice() {
    document.body.innerHTML = '<main style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:10vh auto;padding:30px;color:#15243a"><h1>Open through the secure server</h1><p>This protected dashboard cannot be opened directly from a file. Start <code>python server.py</code> in the project folder, then open <code>http://127.0.0.1:8000</code>.</p></main>';
  }
  function signOut(csrf) {
    fetch('/auth/logout', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'csrf=' + encodeURIComponent(csrf)
    }).then(function () { location.href = '/'; });
  }
  function setIdentity(account) {
    document.querySelectorAll('[data-person]').forEach(function (node) { node.textContent = account.name; });
    document.querySelectorAll('[data-role]').forEach(function (node) { node.textContent = account.role; });
    document.querySelectorAll('[data-signout],#staffSignout,#clientSignout').forEach(function (node) {
      node.onclick = function () { signOut(account.csrf); };
    });
    if (account.role === 'Admin' && !document.getElementById('secureUsersLink')) {
      var actions = document.querySelector('.top-actions');
      if (actions) actions.insertAdjacentHTML('afterbegin', '<a id="secureUsersLink" class="secondary" href="/admin/users">Manage users</a>');
    }
  }
  if (location.protocol === 'file:') {
    showServerNotice();
    return;
  }
  fetch('/api/me', { credentials: 'same-origin' }).then(function (response) {
    if (!response.ok) { location.href = '/auth/login'; return null; }
    return response.json();
  }).then(function (account) {
    if (account) setIdentity(account);
  }).catch(function () { location.href = '/auth/login'; });
}());
