// Influmatch Mobil — telefon çerçevelerinin ortak parçaları (durum çubuğu, alt sekme çubuğu).
// Kullanım: <div class="phone" data-tabs="influencer:home"> … </div>  (rol: influencer | brand)
(function () {
  const TABS = {
    influencer: [
      ['home', 'house', 'Ana Sayfa'],
      ['jobs', 'briefcase', 'İşler'],
      ['ads', 'megaphone', 'İlanlar'],
      ['messages', 'message-circle', 'Mesajlar'],
      ['profile', 'user-round', 'Profil'],
    ],
    brand: [
      ['home', 'house', 'Ana Sayfa'],
      ['discover', 'search', 'Keşfet'],
      ['ads', 'megaphone', 'İlanlar'],
      ['jobs', 'briefcase', 'İşler'],
      ['messages', 'message-circle', 'Mesajlar'],
    ],
  };
  // Okunmamış sayıları (örnek)
  const BADGES = { influencer: { jobs: 2, messages: 3 }, brand: { jobs: 1, messages: 2 } };

  document.querySelectorAll('.phone').forEach((phone) => {
    const status = document.createElement('div');
    status.className = 'status';
    status.innerHTML = '<span class="num">9:41</span><span class="ic"><i data-lucide="signal"></i><i data-lucide="wifi"></i><i data-lucide="battery-full"></i></span>';
    phone.prepend(status);
    phone.insertAdjacentHTML('afterbegin', '<div class="island"></div>');
    phone.insertAdjacentHTML('beforeend', '<div class="home-ind"></div>');

    const spec = phone.dataset.tabs;
    if (!spec) return;
    const [role, active] = spec.split(':');
    const bar = document.createElement('nav');
    bar.className = 'tabbar';
    bar.innerHTML = TABS[role].map(([key, icon, label]) => {
      const n = BADGES[role][key];
      return `<a class="${key === active ? 'active' : ''}"><i data-lucide="${icon}"></i>${label}${n ? `<span class="badge">${n}</span>` : ''}</a>`;
    }).join('');
    phone.appendChild(bar);
  });

  if (window.lucide) window.lucide.createIcons();
})();
