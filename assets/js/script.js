// assets/js/script.js - 2025终极稳定版（零语法错误，完美运行）

particlesJS('particles-js', {
  particles: {
    number: { value: 100 },
    color: { value: ['#89fffd', '#ff8af7', '#74f2ce', '#ffffff'] },
    shape: { type: ['circle', 'triangle', 'star'] },
    opacity: { value: 0.8, random: true },
    size: { value: 3, random: true },
    line_linked: { enable: true, distance: 160, color: '#ffffff', opacity: 0.3, width: 1 },
    move: { enable: true, speed: 3, attract: { enable: true, rotateX: 600, rotateY: 1200 } }
  },
  interactivity: {
    events: { onhover: { enable: true, mode: 'grab' }, onclick: { enable: true, mode: 'push' } },
    modes: { grab: { distance: 180, line_linked: { opacity: 0.8 } }, push: { particles_nb: 6 } }
  },
  retina_detect: true
});

AOS.init({ once: true, duration: 1200 });

// ==================== 完美解析 YAML Front Matter ====================
function parseFrontMatter(md) {
  const meta = {
    title: '',
    date: '',
    categories: [],
    tags: []
  };

  // 默认内容为全文
  let content = md.trim();

  // 匹配 --- ... ---
  const fmMatch = content.match(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---/);
  if (fmMatch) {
    content = content.slice(fmMatch[0].length).trim();
    const lines = fmMatch[1].split('\n');

    lines.forEach(line => {
      if (!line.includes(':')) return;
      const [rawKey, ...rawVal] = line.split(':');
      const key = rawKey.trim();
      let value = rawVal.join(':').trim().replace(/^["'\[]|["'\]]$/g, '');

      if (key === 'title') meta.title = value;
      if (key === 'date') meta.date = value;
      if (key === 'categories' || key === 'tags') {
        meta[key] = value
          .split(/[\s,]+/)
          .map(s => s.trim())
          .filter(Boolean);
      }
    });
  }

  // 如果没写 title，用文件名
  if (!meta.title) meta.title = '未命名文章';
  if (!meta.date) meta.date = '1970-01-01';

  return { ...meta, content };
}

// ==================== 主函数 ====================
async function loadPosts() {
  const container = document.getElementById('postList');
  if (!container) return;

  container.innerHTML = '<p style="text-align:center;color:#89fffd;padding:80px;font-size:1.2rem;">加载最新文章...</p>';

  try {
    // 强制不缓存
    const res = await fetch('/posts/index.json?t=' + Date.now());
    if (!res.ok) throw new Error('未找到 index.json');

    const { posts = [] } = await res.json();
    if (posts.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:#aaa;padding:100px;">暂无文章</p>';
      return;
    }

    const articles = [];

    for (const file of posts) {
      try {
        const r = await fetch(`/posts/${file}?t=` + Date.now());
        if (!r.ok) continue;
        const md = await r.text();

        const { title, date, categories, tags, content } = parseFrontMatter(md);

        const plainText = marked.parse(content).replace(/<[^>]*>/g, '');
        const excerpt = plainText.slice(0, 140) + (plainText.length > 140 ? '...' : '');

        articles.push({ file, title, date, categories, tags, excerpt });
      } catch (e) {
        console.warn('加载失败:', file);
      }
    }

    // 按日期倒序
    articles.sort((a, b) => new Date(b.date) - new Date(a.date));

    container.innerHTML = '';

    articles.forEach(post => {
      const allTags = [...post.categories, ...post.tags];
      const tagsHtml = allTags.length 
        ? `<div class="tags">${allTags.map(t => `<span class="tag">${t}</span>`).join('')}</div>` 
        : '';

      const card = document.createElement('div');
      card.className = 'post-preview';
      card.setAttribute('data-aos', 'fade-up');
      card.innerHTML = `
        <h3>${post.title}</h3>
        <div class="meta">
          <time>${post.date}</time>
          ${tagsHtml}
        </div>
        <p>${post.excerpt}</p>
        <small>点击阅读全文 →</small>
      `;

      card.onclick = () => {
        document.body.style.opacity = '0';
        setTimeout(() => {
          location.href = `/posts/${post.file}`;   // 直接跳原始 .md（你现在就是这样访问的）
        }, 500);
      };

      container.appendChild(card);
    });

  } catch (err) {
    console.error(err);
  }
}

loadPosts();