// assets/js/script.js - 完全零配置自动加载所有文章（终极版）

particlesJS('particles-js', {
  particles: {
    number: { value: 90 },
    color: { value: ['#89fffd', '#ff8af7', '#74f2ce', '#ffffff'] },
    shape: { type: ['circle', 'triangle'] },
    opacity: { value: 0.8, random: true },
    size: { value: 3, random: true },
    line_linked: { enable: true, distance: 150, color: '#ffffff', opacity: 0.3, width: 1 },
    move: { enable: true, speed: 3, attract: { enable: true, rotateX: 600, rotateY: 1200 } }
  },
  interactivity: {
    events: { onhover: { enable: true, mode: 'grab' }, onclick: { enable: true, mode: 'push' } },
    modes: { grab: { distance: 180, line_linked: { opacity: 0.8 } }, push: { particles_nb: 6 } }
  },
  retina_detect: true
});

AOS.init({ once: true, duration: 1200 });

// ==================== 完全自动加载文章（无需任何配置！） ====================
async function loadPostsFullyAuto() {
  const container = document.getElementById('postList');
  if (!container) return;

  container.innerHTML = '<p style="text-align:center;color:#89fffd;padding:60px;">加载最新文章...</p>';

  try {
    const res = await fetch('posts/index.json?t=' + Date.now());
    const data = await res.json();
    const postFiles = data.posts || [];

    if (postFiles.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:#aaa;padding:80px;">暂无文章</p>';
      return;
    }

    container.innerHTML = ''; // 清空加载提示

    for (const file of postFiles) {
      try {
        const mdRes = await fetch(`posts/${file}?t=${Date.now()}`);
        if (!mdRes.ok) continue;
        const md = await mdRes.text();

        let title = file.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const titleMatch = md.match(/^#\s+(.+)/m);
        if (titleMatch) title = titleMatch[1].trim();

        let body = md.replace(/^#.*/gm, '').trim();
        let excerpt = marked.parse(body).replace(/<[^>]*>/g, '').slice(0, 130) + '...';

        const card = document.createElement('div');
        card.className = 'post-preview';
        card.setAttribute('data-aos', 'fade-up');
        card.innerHTML = `
          <h3>${title}</h3>
          <p>${excerpt}</p>
          <small>点击阅读全文 →</small>
        `;
        card.onclick = () => {
          document.body.style.opacity = 0;
          setTimeout(() => location.href = `posts/${file.replace('.md', '.html')}`, 500);
        };
        container.appendChild(card);
      } catch (e) { console.warn('单篇加载失败:', file); }
    }
  } catch (err) {
    container.innerHTML = '<p style="text-align:center;color:#f66;">文章列表加载失败（请检查网络或稍后重试）</p>';
  }
}

loadPostsFullyAuto();