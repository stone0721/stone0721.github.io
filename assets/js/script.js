// 初始化粒子背景
if (document.getElementById('particles-js')) {
    particlesJS('particles-js', {
        particles: {
            number: { value: 50, density: { enable: true, value_area: 800 } },
            color: { value: '#00f3ff' },
            shape: { type: 'circle' },
            opacity: { value: 0.5, random: true },
            size: { value: 3, random: true },
            line_linked: { enable: true, distance: 150, color: '#00f3ff', opacity: 0.2, width: 1 },
            move: { enable: true, speed: 2 }
        },
        interactivity: {
            detect_on: 'canvas',
            events: { onhover: { enable: true, mode: 'repulse' } },
            modes: { repulse: { distance: 100, duration: 0.4 } }
        }
    });
}

// 初始化动画库
if (typeof AOS !== 'undefined') {
    AOS.init({ once: true, duration: 800 });
}

// --- 核心功能：解析 Front Matter (文件头的 YAML 信息) ---
function parseFrontMatter(md) {
    const meta = { title: '', date: '', categories: [], tags: [] };
    let content = md.trim();
    // 匹配 --- 之间的内容
    const fmMatch = content.match(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---/);

    if (fmMatch) {
        // 移除头部，保留正文
        content = content.slice(fmMatch[0].length).trim();
        const lines = fmMatch[1].split('\n');
        lines.forEach(line => {
            const parts = line.split(':');
            if (parts.length < 2) return;
            const key = parts[0].trim();
            const value = parts.slice(1).join(':').trim().replace(/^["']|["']$/g, '');

            if (key === 'title') meta.title = value;
            if (key === 'date') meta.date = value;
            if (key === 'categories' || key === 'tags') {
                meta[key] = value.replace(/[\[\]]/g, '').split(',').map(s => s.trim()).filter(Boolean);
            }
        });
    }
    return { ...meta, content };
}

// --- 功能 A：首页加载文章列表 ---
async function loadPosts() {
    const container = document.getElementById('postList');
    if (!container) return; // 如果不是首页，不执行

    try {
        // 获取文章索引
        const res = await fetch('posts/index.json?t=' + Date.now());
        if (!res.ok) throw new Error('无法加载文章列表');

        const { posts = [] } = await res.json();

        if (posts.length === 0) {
            container.innerHTML = '<div style="color:#aaa; text-align:center">暂无文章</div>';
            return;
        }

        const articles = [];

        // 并行加载所有文章的元数据
        await Promise.all(posts.map(async (filename) => {
            try {
                const url = `posts/${encodeURIComponent(filename)}`;
                const r = await fetch(url);
                if (!r.ok) return;

                const text = await r.text();
                const { title, date, tags, content } = parseFrontMatter(text);

                // 提取纯文本摘要（去掉 Markdown 符号）
                const plain = marked.parse(content).replace(/<[^>]+>/g, '');
                const excerpt = plain.slice(0, 120) + '...';

                articles.push({
                    file: filename,
                    title: title || filename.replace('.md', ''),
                    date: date || '未知日期',
                    tags,
                    excerpt
                });
            } catch (e) {
                console.warn('加载出错:', filename);
            }
        }));

        // 按日期排序 (新的在前)
        articles.sort((a, b) => new Date(b.date) - new Date(a.date));
        container.innerHTML = '';

        // 渲染卡片
        articles.forEach((post, index) => {
            const card = document.createElement('div');
            card.className = 'post-preview';
            card.setAttribute('data-aos', 'fade-up'); // 滚动动画
            card.setAttribute('data-aos-delay', index * 100);

            const tagHtml = post.tags.map(t => `<span class="tag">#${t}</span>`).join('');

            card.innerHTML = `
                <h3>${post.title}</h3>
                <div class="meta">
                    <span>📅 ${post.date}</span>
                    ${tagHtml}
                </div>
                <p>${post.excerpt}</p>
                <div class="read-more">阅读全文 →</div>
            `;

            // 点击事件：跳转到渲染页
            card.addEventListener('click', () => {
                location.href = `article.html?post=${encodeURIComponent(post.file)}`;
            });

            container.appendChild(card);
        });

    } catch (err) {
        container.innerHTML = `<div style="color:red; text-align:center">加载失败: ${err.message}</div>`;
    }
}

// --- 功能 B：详情页加载 Markdown ---
async function loadArticle(filename) {
    const container = document.getElementById('article-content');
    if (!container) return;

    try {
        const url = `posts/${filename}`; // filename 已经是从 URL 获取的
        const res = await fetch(url);

        if (!res.ok) throw new Error('文章不存在 (404)');

        const text = await res.text();
        const { title, date, content } = parseFrontMatter(text);

        // 设置浏览器标题
        document.title = `${title} - ddddd的博客`;

        // 使用 marked 将 Markdown 转换为 HTML
        const htmlContent = marked.parse(content);

        // 渲染到页面
        container.innerHTML = `
            <h1>${title}</h1>
            <div style="color:#888; margin-bottom: 30px; font-size:0.9rem;">
                发布时间：<span style="color:var(--primary)">${date}</span>
            </div>
            ${htmlContent}
        `;

        // 代码高亮
        if (typeof hljs !== 'undefined') {
            hljs.highlightAll();
        }

    } catch (err) {
        container.innerHTML = `
            <h1>出错啦</h1>
            <p>无法读取文章内容：${err.message}</p>
            <p><a href="index.html" style="color:var(--primary)">返回主页</a></p>
        `;
    }
}

// 启动
loadPosts();
