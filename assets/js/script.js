// assets/js/script.js - 2025 Fast & Direct

// 1. 粒子特效 (仅保留背景氛围，不阻碍交互)
particlesJS('particles-js', {
  particles: {
    number: { value: 40 }, // 减少粒子数，更清爽
    color: { value: '#89fffd' },
    shape: { type: 'circle' },
    opacity: { value: 0.3, random: true },
    size: { value: 3, random: true },
    line_linked: { enable: true, distance: 150, color: '#89fffd', opacity: 0.1, width: 1 },
    move: { enable: true, speed: 1 }
  },
  interactivity: {
    events: { onhover: { enable: false } } // 移除鼠标互动干扰，更专注
  }
});

// 2. 初始化滚动动画 (仅用于元素进入视野)
AOS.init({ duration: 600, once: true });

// 3. Front Matter 解析工具
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

// 4. 路由判断
const isPostPage = window.location.pathname.includes('post.html');

if (isPostPage) {
    loadArticle();
} else {
    loadPosts();
}

// === 首页逻辑 ===
async function loadPosts() {
  const container = document.getElementById('postList');
  if (!container) return;

  try {
    const res = await fetch('posts/index.json?t=' + Date.now());
    if (!res.ok) throw new Error('Index not found');
    const { posts = [] } = await res.json();

    const articles = await Promise.all(posts.map(async (file) => {
      try {
        const r = await fetch(`posts/${encodeURIComponent(file)}`);
        const text = await r.text();
        const { title, date, content } = parseFrontMatter(text);
        // 摘要
        const excerpt = marked.parse(content).replace(/<[^>]+>/g, '').slice(0, 100) + '...';
        return { file, title: title || file, date, excerpt };
      } catch { return null; }
    }));

    container.innerHTML = '';
    articles.filter(a => a).sort((a, b) => new Date(b.date) - new Date(a.date))
      .forEach((post) => {
        const card = document.createElement('div');
        card.className = 'post-preview';
        card.setAttribute('data-aos', 'fade-up'); // 仅保留简单的上浮
        
        card.innerHTML = `
            <h3>${post.title}</h3>
            <div class="meta">${post.date}</div>
            <p>${post.excerpt}</p>
        `;
        card.onclick = () => {
            window.location.href = `post.html?file=${encodeURIComponent(post.file)}`;
        };
        container.appendChild(card);
    });
  } catch (e) { console.error(e); }
}

// === 文章页逻辑 (直入主题) ===
async function loadArticle() {
    const params = new URLSearchParams(window.location.search);
    const filename = params.get('file');
    
    const titleEl = document.getElementById('postTitle');
    const contentEl = document.getElementById('postContent');

    if (!filename) {
        titleEl.innerText = 'ERROR: NO FILE';
        return;
    }

    try {
        const res = await fetch(`posts/${filename}?t=` + Date.now());
        if (!res.ok) throw new Error('File not found');
        const md = await res.text();
        const { title, date, content } = parseFrontMatter(md);
        
        // 立即填充内容
        document.title = title;
        titleEl.innerText = title;
        document.getElementById('postDate').innerText = date || '';
        
        contentEl.innerHTML = marked.parse(content);
        
        // 代码高亮
        if (window.Prism) Prism.highlightAll();

    } catch (e) {
        contentEl.innerHTML = `<p style="color:red">Error: ${e.message}</p>`;
    }
}
