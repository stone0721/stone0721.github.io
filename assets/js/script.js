// 粒子特效配置（更梦幻星空）
particlesJS('particles-js', {
  particles: {
    number: { value: 100, density: { enable: true, value_area: 800 } },
    color: { value: ['#89fffd', '#ff8af7', '#74f2ce', '#ffffff'] },
    shape: { type: ['circle', 'triangle', 'star'] },
    opacity: { value: 0.8, random: true },
    size: { value: 4, random: true },
    line_linked: { enable: true, distance: 180, color: '#ffffff', opacity: 0.2, width: 1 },
    move: { enable: true, speed: 3, direction: 'none', random: true, straight: false }
  },
  interactivity: {
    detect_on: 'canvas',
    events: {
      onhover: { enable: true, mode: 'grab' },
      onclick: { enable: true, mode: 'push' },
      resize: true
    },
    modes: {
      grab: { distance: 200, line_linked: { opacity: 0.7 } },
      push: { particles_nb: 4 }
    }
  },
  retina_detect: true
});

// 预加载淡出
window.addEventListener('load', () => {
  AOS.init({ once: true, duration: 1200, easing: 'ease-out-cubic' });
  
  const preloader = document.getElementById('preloader');
  setTimeout(() => {
    preloader.style.opacity = '0';
    setTimeout(() => preloader.style.display = 'none', 1000);
  }, 800);
});

// 动态加载文章（支持多个 .md 文件）
const posts = [
  'welcome.md',
  // 在此继续添加：'2025-new-year.md', 'ai-revolution.md' ...
];

async function loadPosts() {
  const container = document.getElementById('postList');

  for (const file of posts) {
    try {
      const res = await fetch(`posts/${file}`);
      const md = await res.text();

      // 提取标题（第一行 # 开头）
      const titleMatch = md.match(/^#\s+(.+)/m);
      const title = titleMatch ? titleMatch[1].trim() : file.replace('.md', '');

      // 取前 120 字符作为摘要
      const excerpt = marked.parse(md.replace(/^#.*\n*/, '')).replace(/<[^>]*>/g, '').slice(0, 120) + '...';

      const card = document.createElement('div');
      card.className = 'post-preview';
      card.setAttribute('data-aos', 'fade-up');
      card.innerHTML = `
        <h3>${title}</h3>
        <p>${excerpt}</p>
        <small>点击阅读全文 →</small>
      `;

      card.onclick = () => {
        document.body.style.transition = 'opacity 0.6s';
        document.body.style.opacity = '0';
        setTimeout(() => {
          // 如果你想单页渲染可以改成 location.href = '?post=' + file
          location.href = `posts/${file.replace('.md', '.html')}`;
        }, 600);
      };

      container.appendChild(card);
    } catch (e) {
      console.error('加载文章失败：', file);
    }
  }
}

loadPosts();