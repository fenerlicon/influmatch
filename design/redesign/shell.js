// Panel kabuğu: kenar çubuğu, üst çubuk ve mobil sekme çubuğu tek yerden.
// Kullanım: <body data-role="influencer|brand|admin" data-page="isler" data-title="İşler" data-search="...">
(function () {
  const b = document.body;
  const role = b.dataset.role || 'influencer';
  const page = b.dataset.page || '';
  const title = b.dataset.title || '';
  const crumbParent = b.dataset.parent || '';

  const MENUS = {
    influencer: [
      { id: 'ana', label: 'Ana Sayfa', icon: 'home', href: 'influencer-ana-sayfa.html' },
      { id: 'isler', label: 'İşler', icon: 'briefcase', href: 'isler.html', badge: 3 },
      { id: 'mesajlar', label: 'Mesajlar', icon: 'message-square', href: 'mesajlar.html', badge: 2 },
      { group: 'Fırsatlar' },
      { id: 'ilanlar', label: 'İlanlar', icon: 'megaphone', href: 'influencer-ilanlar.html' },
      { id: 'kesfet', label: 'Keşfet', icon: 'compass', href: 'marka-kesfet.html' },
      { group: 'Ben' },
      { id: 'profil', label: 'Profilim', icon: 'user-round', href: 'profil.html' },
      { id: 'istatistik', label: 'İstatistikler', icon: 'line-chart', href: '#' },
    ],
    brand: [
      { id: 'ana', label: 'Ana Sayfa', icon: 'home', href: 'marka-ana-sayfa.html' },
      { id: 'kesfet', label: 'Keşfet', icon: 'compass', href: 'marka-kesfet.html' },
      { id: 'ilanlar', label: 'İlanlar', icon: 'megaphone', href: 'marka-ilanlar.html', badge: 4 },
      { id: 'isler', label: 'İşler', icon: 'briefcase', href: 'isler.html' },
      { id: 'mesajlar', label: 'Mesajlar', icon: 'message-square', href: 'mesajlar.html', badge: 1 },
      { group: 'Marka' },
      { id: 'profil', label: 'Profilim', icon: 'building-2', href: '#' },
    ],
    admin: [
      { id: 'genel', label: 'Genel Bakış', icon: 'layout-dashboard', href: 'admin.html' },
      { group: 'Kullanıcılar' },
      { id: 'kullanicilar', label: 'Kullanıcılar', icon: 'users', href: '#' },
      { id: 'onaylar', label: 'Marka onayları', icon: 'building-2', href: 'admin.html', badge: 5 },
      { id: 'rozet', label: 'Rozet ve Spotlight', icon: 'award', href: '#' },
      { group: 'Destek' },
      { id: 'destek', label: 'Destek talepleri', icon: 'life-buoy', href: '#', badge: 2 },
      { id: 'bildirim', label: 'Geri bildirimler', icon: 'inbox', href: '#' },
      { id: 'sikayet', label: 'Mesaj şikâyetleri', icon: 'flag', href: '#' },
      { group: 'Sistem' },
      { id: 'limit', label: 'Marka sınırları', icon: 'sliders-horizontal', href: '#' },
      { id: 'api', label: 'API anahtarları', icon: 'key-round', href: '#' },
      { id: 'eposta', label: 'E-posta durumu', icon: 'mail', href: '#' },
    ],
  };
  const ME = {
    influencer: { av: 'EY', cls: 'a1', name: 'Elif Yıldız', sub: '@elifyildiz', sq: false },
    brand: { av: 'NK', cls: 'a3', name: 'Nara Kahve', sub: 'Marka hesabı', sq: true },
    admin: { av: 'AD', cls: 'a4', name: 'Yönetici', sub: 'Admin', sq: false },
  };
  const TABS = {
    influencer: ['ana', 'isler', 'ilanlar', 'mesajlar'],
    brand: ['ana', 'kesfet', 'isler', 'mesajlar'],
    admin: ['genel', 'onaylar', 'destek', 'kullanicilar'],
  };

  const menu = MENUS[role];
  let nav = '';
  for (const m of menu) {
    if (m.group) { nav += `</div><div class="nav-group"><div class="eyebrow">${m.group}</div>`; continue; }
    nav += `<a class="${m.id === page ? 'active' : ''}" href="${m.href}"><i data-lucide="${m.icon}"></i>${m.label}${m.badge ? `<span class="badge">${m.badge}</span>` : ''}</a>`;
  }
  const me = ME[role];
  const spot = role === 'admin' ? '' : role === 'brand'
    ? `<div class="spot-mini"><div class="hstack" style="color:var(--gold);font-weight:600;font-size:13px"><i data-lucide="sparkles" style="width:14px;height:14px"></i>Spotlight Pro</div><div class="small muted" style="margin-top:4px">28 Kasım'a kadar aktif</div></div>`
    : `<div class="spot-mini"><div class="hstack" style="color:var(--gold);font-weight:600;font-size:13px"><i data-lucide="sparkles" style="width:14px;height:14px"></i>Spotlight</div><div class="small muted" style="margin-top:4px">Vitrinde öne çık, profil görüntülenmelerini gör.</div></div>`;

  const side = `<aside class="side">
    <div class="logo">INFLU<b>MATCH</b>${role === 'admin' ? ' <span class="chip" style="margin-left:6px;vertical-align:1px">Admin</span>' : ''}</div>
    <nav class="nav"><div>${nav}</div></nav>
    <div class="side-foot">${spot}
      <nav class="nav"><a class="${page === 'ayarlar' ? 'active' : ''}" href="ayarlar.html"><i data-lucide="settings"></i>Ayarlar</a></nav>
      <div class="me"><div class="av ${me.sq ? 'av-sq ' : ''}${me.cls}">${me.av}</div><div style="min-width:0"><div style="font-weight:500;font-size:13px">${me.name}</div><div class="faint small">${me.sub}</div></div><i data-lucide="log-out" style="width:15px;margin-left:auto;color:var(--text-3)"></i></div>
    </div></aside>`;

  const top = `<header class="top">
      <div class="crumb">${crumbParent ? crumbParent + ' <span style="margin:0 6px">/</span> ' : ''}<b>${title}</b></div>
      <div class="search"><i data-lucide="search"></i>${b.dataset.search || 'Ara'}<span class="kbd">/</span></div>
      <button class="btn btn-ghost btn-icon bell" aria-label="Bildirimler"><i data-lucide="bell"></i></button>
    </header>`;

  const byId = Object.fromEntries(menu.filter((m) => !m.group).map((m) => [m.id, m]));
  const tabbar = `<nav class="mobile-tabbar">${TABS[role].map((id) => {
    const m = byId[id];
    return `<a class="${id === page ? 'active' : ''}" href="${m.href}"><i data-lucide="${m.icon}"></i>${m.label}</a>`;
  }).join('')}<a href="#"><i data-lucide="menu"></i>Menü</a></nav>`;

  const main = document.querySelector('main.main');
  main.insertAdjacentHTML('afterbegin', top);
  const shell = document.createElement('div');
  shell.className = 'shell';
  main.parentNode.insertBefore(shell, main);
  shell.insertAdjacentHTML('afterbegin', side);
  shell.appendChild(main);
  document.body.insertAdjacentHTML('beforeend', tabbar);
})();
