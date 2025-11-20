// assets/js/script.js - 2025 Fixed & Enhanced

// 粒子效果配置
particlesJS('particles-js', {
  particles: {
    number: { value: 80, density: { enable: true, value_area: 800 } },
    color: { value: '#89fffd' },
    shape: { type: 'circle' },
    opacity: { value: 0.5, random: true },
    size: { value: 3, random: true },
    line_linked: { enable: true, distance: 150, color: '#89fffd', opacity: 0.2, width: 1 },
    move: { enable: true, speed: 2, direction: 'none', random: false, straight: false, out_mode: 'out', bounce: false }
  },
  interactivity: {
    detect_on: 'canvas',
    events: { onhover: { enable: true, mode: 'repulse' }, onclick: { enable: true, mode: 'push' } },
    modes: { repulse: { distance: 100, duration: 0.4 }, push: { particles_nb: 4 } }
  },
  retina_detect: true
});

AOS.init({ once: true, duration: 1000, offset: 120 });

// 解析 Front Matter
function parseFrontMatter(md) {
  const meta = { title: '', date: '', categories: [], tags: [] };
  let content = md.trim();
  const fmMatch = content.match(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---/);
  
  if (fmMatch) {
    content = content.slice(fmMatch[0].length).trim();
    const lines = fmMatch[1].split('\n');
    lines.forEach(line => {
      const parts = line.split(':');
      if (parts.length < 2) return;
      const key = parts[0].trim();
      const value = parts.slice(1).join(':').trim().replace(/^["']|["']$/g, '');
      
      if (key === 'title') meta.title = value;
      if (key === 'date') meta.date = value;
      if (['categories', 'tags'].includes(key)) {
        meta[key] = value.replace(/[\[\]]/g, '').split(',').map(s => s.trim()).filter(Boolean);
      }
    });
  }
  return { ...meta, content };
}

// 主逻辑
async function loadPosts() {
  const container = document.getElementById('postList');
  const preloader = document.getElementById('preloader');
  
  if (!container) return;

  try {
    // 1. 获取索引
    const res = await fetch('posts/index.json?t=' + Date.now());
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    
    const { posts = [] } = await res.json();
    
    if (posts.length === 0) {
      container.innerHTML = '<div class="error-msg">SYSTEM EMPTY // NO DATA FOUND</div>';
      removePreloader();
      return;
    }

    const articles = [];

    // 2. 并行获取文章内容
    await Promise.all(posts.map(async (filename) => {
      try {
        // ★ 关键修复：使用 encodeURIComponent 处理中文文件名
        const url = `posts/${encodeURIComponent(filename)}?t=${Date.now()}`;
        const r = await fetch(url);
        if (!r.ok) return;
        
        const text = await r.text();
        const { title, date, categories, tags, content } = parseFrontMatter(text);
        
        // 提取摘要（纯文本前120字）
        const plain = marked.parse(content).replace(/<[^>]+>/g, '');
        const excerpt = plain.slice(0, 120) + '...';
        
        articles.push({ 
          file: filename, // 保持原始文件名用于跳转
          title: title || filename.replace('.md', ''), 
          date: date || '1970-01-01', 
          categories, tags, excerpt 
        });
      } catch (e) {
        console.warn('Failed to load:', filename);
      }
    }));

    // 3. 排序与渲染
    articles.sort((a, b) => new Date(b.date) - new Date(a.date));
    container.innerHTML = '';

    articles.forEach((post, index) => {
      const card = document.createElement('div');
      card.className = 'post-preview';
      card.setAttribute('data-aos', 'fade-up');
      card.setAttribute('data-aos-delay', index * 100); // 级联延迟动画
      
      const tagHtml = [...post.categories, ...post.tags]
        .map(t => `<span class="tag">#${t}</span>`).join('');

      card.innerHTML = `
        <div class="card-glow"></div>
        <div class="card-content">
            <h3>${post.title}</h3>
            <div class="meta">
                <span class="date">DATA: ${post.date}</span>
                <div class="tags-container">${tagHtml}</div>
            </div>
            <p>${post.excerpt}</p>
            <div class="read-more">ACCESS FILE_ ></div>
        </div>
      `;

      // 点击跳转
      card.addEventListener('click', () => {
        document.body.style.opacity = 0;
        setTimeout(() => {
            // ★ 关键：跳转时同样处理中文路径
            location.href = `posts/${encodeURIComponent(post.file)}`;
        }, 500);
      });

      container.appendChild(card);
    });

  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="error-msg">SYSTEM FAILURE: ${err.message}</div>`;
  } finally {
    removePreloader();
  }
}

// 启动
loadPosts();
