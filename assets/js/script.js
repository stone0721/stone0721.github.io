// assets/js/script.js - 最终稳定版（支持你的 YAML 格式）

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

// 解析 Front Matter（完美支持你的格式：categories: CTF Reverse）
function parseFrontMatter(text) {
  const regex = /^---\s*[\r\n]+([\s\S]*?)[\r\n]+---/;
  const match = text.match(regex);
  if (!match) return { title: '', date: '', categories: [], tags: [], content: text };

  const yaml = match[1];
  const content = text.slice(match[0].length);

  const meta = { title: '', date: '', categories: [], tags: [] };

  yaml.split('\n').forEach(line => {
    const [key, ...valArr] = line.split(':');
    if (!key) return;
    const value = valArr.join(':').trim();

    if (key.trim() === 'title') meta.title = value.replace(/^["']|["']$/g, '');
    if (key.trim() === 'date') meta.date = value.replace(/^["']|["']$/g, '');
    if (key.trim() === 'categories') {
      // 支持 "CTF Reverse" 或 "CTF, Reverse" 或 ['CTF', 'Reverse']
      meta.categories = value.split(/[\s,]+/).filter(Boolean).map(v => v.replace(/^["'\[]|["'\]]$/g, ''));
    }
    if (key.trim() === 'tags') {
      meta.tags = value.split(/[\s,]+/).filter(Boolean).map(v => v.replace(/^["'\[]|["'\]]$/g, ''));
    }
  });

  if (!meta.title) meta.title = '未命名文章';
  if (!meta.date) meta.date = '1970-01-01';

  return { title: meta.title, date: meta.date, categories: meta.categories, tags: meta.tags, content: content.trim() };
}

// 主函数
async function loadPosts() {
  const container = document.getElementById('postList');
  container.innerHTML = '<p style="text-align:center;color:#89fffd;padding:60px;">加载中...</p>';

  try {
    const res = await fetch('posts/index.json?t=' + Date.now());
    if (!res.ok) throw new Error('index.json not found');

    const { posts } = await res.json();
    if (!Array.isArray(posts) || posts.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:#aaa;">暂无文章</p>';
      return;
    }

    const articles = [];

    for (const file of posts) {
      try {
        const r = await fetch(`posts/${file}?t=${Date.now()}`);
        if (!r.ok) continue;
        const md = await r.text();
        const { title, date, categories, tags, content } = parseFrontMatter(md);

        articles.push({
          file,
          title,
          date,
          categories,
          tags,
          excerpt: marked.parse(content.slice(0, 300)).replace(/<[^>]*>/g, '').slice(0, 140) + '...'
        });
      } catch (e) { console.warn('加载失败:', file); }
    }

    // 按日期倒序
    articles.sort((a, b) => new Date(b.date) - new Date(a.date));

    container.innerHTML = '';

    articles.forEach(post => {
      const tags = [...post.categories, ...post.tags].filter(Boolean);
      const tagsHtml = tags.length ? `<div class="tags">${tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>` : '';

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
        document.body.style.opacity = 0;
        setTimeout(() => location.href = `posts/${post.file.replace('.md', '.html')}`, 500);
      };
      container.appendChild(card);
    });

  } catch (err) {
    container.innerHTML = '<p style="text-align:center;color:#f66;">加载失败：posts/index.json 未生成<br>请检查 GitHub Actions 是否运行成功</p>';
  }
}

loadPosts();