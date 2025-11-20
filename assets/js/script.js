// ===== 粒子升级：鼠标强吸引 + 抓取连线 =====
particlesJS('particles-js', {
  particles: {
    number: { value: 90 },
    color: { value: ['#89fffd', '#ff8af7', '#74f2ce', '#ffffff'] },
    shape: { type: ['circle', 'triangle'] },
    opacity: { value: 0.8, random: true },
    size: { value: 3, random: true },
    line_linked: { enable: true, distance: 150, color: '#ffffff', opacity: 0.3, width: 1 },
    move: {
      enable: true,
      speed: 3,
      direction: 'none',
      random: false,
      straight: false,
      out_mode: 'out',
      attract: { enable: true, rotateX: 600, rotateY: 1200 } // ← 关键：强鼠标跟随
    }
  },
  interactivity: {
    events: {
      onhover: { enable: true, mode: 'grab' }, // 鼠标附近粒子被牵引
      onclick: { enable: true, mode: 'push' },
      resize: true
    },
    modes: {
      grab: { distance: 180, line_linked: { opacity: 0.8 } },
      push: { particles_nb: 6 }
    }
  },
  retina_detect: true
});

// 预加载超美动画
window.addEventListener('load', () => {
  AOS.init({ once: true, duration: 1200, easing: 'ease-out-quart' });

  const preloader = document.getElementById('preloader');
  setTimeout(() => {
    preloader.style.opacity = '0';
    setTimeout(() => preloader.remove(), 1200);
  }, 1500);
});

// ===== 新增：文章内图片目录 + 灯箱功能 =====
function generateImageTOC() {
  const images = document.querySelectorAll('.post-content img');
  if (images.length === 0) return;

  const toc = document.createElement('div');
  toc.className = 'image-toc';
  toc.innerHTML = `<h4>📸 本文图片 (${images.length})</h4><ul></ul>`;

  const ul = toc.querySelector('ul');

  images.forEach((img, index) => {
    const id = `img-${index + 1}`;
    img.id = id;
    img.onclick = () => window.location.hash = id; // 点击放大

    const li = document.createElement('li');
    li.innerHTML = `<a href="#${id}">图片 ${index + 1}${img.alt ? ' - ' + img.alt : ''}</a>`;
    ul.appendChild(li);
  });

  // 插入到文章最前面
  const content = document.querySelector('.post-content');
  content?.parentNode.insertBefore(toc, content);
}

// 如果是文章页（有 .post-content），才执行
if (document.querySelector('.post-content')) {
  generateImageTOC();

  // 灯箱关闭（点击黑背景）
  document.querySelectorAll('.post-content img').forEach(img => {
    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox';
    lightbox.id = img.id;
    lightbox.innerHTML = `<img src="${img.src}" alt="${img.alt || ''}">`;
    document.body.appendChild(lightbox);

    lightbox.addEventListener('click', () => {
      history.back(); // 优雅关闭
    });
  });
}

// 原有的首页文章加载保持不变……
const posts = ['welcome.md' /* 继续添加 */];

async function loadPosts() {
  const container = document.getElementById('postList');
  // ... 你原来的 loadPosts 代码不变
}
loadPosts();