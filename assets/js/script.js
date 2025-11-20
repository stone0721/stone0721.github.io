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

// ==================== 解析 YAML Front Matter ====================
function parseFrontMatter(mdText) {
  const fmRegex = /^---\s*[\r\n]+([\s\S]*?)[\r\n]+---/;
  const match = mdText.match(fmRegex);
  const metadata = {
    title: '',
    date: '',
    categories: '',
    tags: [],
    mathjax: false,
    toc: false
  };

  if (!match) return { metadata, content: mdText.trim() };

  const yamlLines = match[1].split('\n');
  yamlLines.forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) return;
    let key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    // 处理引号
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (key === 'tags' || key === 'categories') {
      // 支持数组或字符串
      if (value.includes(',')) {
        metadata[key] = value.split(',').map(v => v.trim());
      } else if (value.includes('[')) {
        try {
          metadata[key] = eval('(' + value + ')'); // 简单解析 [a, b]
        } catch {}
      } else {
        metadata[key] = value ? [value] : [];
      }
    } else {
      metadata[key] = value;
    }

    // 布尔值处理
    if (value === 'true') metadata[key] = true;
    if (value === 'false') metadata[key] = false;
  });

  const content = mdText.replace(fmRegex, '').trim();
  // 默认标题：如果没写 title，就用文件名
  if (!metadata.title) {
    metadata.title = '未命名文章';
  }
  return { metadata, content };
}

// ==================== 主加载函数 ====================
async function loadPostsWithYAML() {
  const container = document.getElementById('postList');
  if (!container) return;

  container.innerHTML = '<p style="text-align:center;color:#89fffd;padding:80px;font-size:1.2rem;">正在加载文章...</p>';

  try {
    const res = await fetch('posts/index.json?t=' + Date.now());
    const data = await res.json();
    let postFiles = data.posts || [];

    if (postFiles.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:#aaa;padding:100px;">暂无文章</p>';
      return;
    }

    const postsWithMeta = [];

    // 第一轮：读取所有文章的 front matter 和日期
    for (const file of postFiles) {
      try {
        const r = await fetch(`posts/${file}?t=${Date.now()}`);
        if (!r.ok) continue;
        const text = await r.text();
        const { metadata } = parseFrontMatter(text);
        postsWithMeta.push({
          file,
          title: metadata.title || file.replace('.md', ''),
          date: metadata.date || '1970-01-01',
          categories: Array.isArray(metadata.categories) ? metadata.categories : (metadata.categories ? [metadata.categories] : []),
          tags: metadata.tags || [],
          raw: text
        });
      } catch (e) { console.warn(file, e); }
    }

    // 第二轮：按日期倒序排序
    postsWithMeta.sort((a, b) => new Date(b.date) - new Date(a.date));

    container.innerHTML = '';

    // 第三轮：渲染卡片
    for (const post of postsWithMeta) {
      const { metadata, content } = parseFrontMatter(post.raw);

      let excerpt = marked.parse(content).replace(/<[^>]*>/g, '').slice(0, 130).trim();
      if (excerpt.length >= 130) excerpt += '...';

      const card = document.createElement('div');
      card.className = 'post-preview';
      card.setAttribute('data-aos', 'fade-up');

      // 标签拼接
      const allTags = [...post.categories, ...post.tags].filter(Boolean);
      const tagsHtml = allTags.length > 0
        ? `<div class="tags">${allTags.map(t => `<span class="tag">${t}</span>`).join('')}</div>`
        : '';

      card.innerHTML = `
        <h3>${post.title}</h3>
        <div class="meta">
          <time>${post.date}</time>
          ${tagsHtml}
        </div>
        <p>${excerpt}</p>
        <small>点击阅读全文 →</small>
      `;

      card.onclick = () => {
        document.body.style.opacity = 0;
        setTimeout(() => {
          location.href = `posts/${post.file.replace('.md', '.html')}`;
        }, 500);
      };

      container.appendChild(card);
    }

  } catch (err) {
    container.innerHTML = '<p style="text-align:center;color:#f66;">加载失败，请检查网络</p>';
  }
}

loadPostsWithYAML();