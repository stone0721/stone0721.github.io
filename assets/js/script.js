// 初始化粒子背景
if(document.getElementById('particles-js')) {
    particlesJS('particles-js', {
        particles: {
            number: { value: 60, density: { enable: true, value_area: 800 } },
            color: { value: '#00f3ff' },
            shape: { type: 'circle' },
            opacity: { value: 0.5, random: true },
            size: { value: 3, random: true },
            line_linked: { enable: true, distance: 150, color: '#00f3ff', opacity: 0.2, width: 1 },
            move: { enable: true, speed: 1.5 }
        },
        interactivity: {
            detect_on: 'canvas',
            events: { onhover: { enable: true, mode: 'repulse' }, onclick: { enable: true, mode: 'push' } },
            modes: { repulse: { distance: 100, duration: 0.4 } }
        }
    });
}

// 初始化动画库
if(typeof AOS !== 'undefined') {
    AOS.init({ once: true, duration: 800, offset: 100 });
}

// 解析 Front Matter (YAML头信息)
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

// ================= 首页列表加载逻辑 =================
async function loadPosts() {
    const container = document.getElementById('postList');
    if (!container) return; // 如果不在首页，这部分不执行

    try {
        const res = await fetch('posts/index.json?t=' + Date.now());
        if (!res.ok) throw new Error('索引文件丢失');
        
        const { posts = [] } = await res.json();
        
        if (posts.length === 0) {
            container.innerHTML = '<div style="color:#888">>> 系统日志为空 <<</div>';
            return;
        }

        const articles = [];

        // 并行获取文章元数据
        await Promise.all(posts.map(async (filename) => {
            try {
                const url = `posts/${encodeURIComponent(filename)}`;
                const r = await fetch(url);
                if (!r.ok) return;
                
                const text = await r.text();
                const { title, date, categories, tags, content } = parseFrontMatter(text);
                
                // 生成摘要 (去除 Markdown 符号)
                const plain = marked.parse(content).replace(/<[^>]+>/g, '');
                const excerpt = plain.slice(0, 100) + '...';
                
                articles.push({ 
                    file: filename,
                    title: title || filename.replace('.md', ''), 
                    date: date || '未知日期', 
                    categories, tags, excerpt 
                });
            } catch (e) {
                console.warn('加载失败:', filename);
            }
        }));

        // 按日期倒序
        articles.sort((a, b) => new Date(b.date) - new Date(a.date));
        container.innerHTML = '';

        articles.forEach((post, index) => {
            const card = document.createElement('div');
            card.className = 'post-preview';
            card.setAttribute('data-aos', 'fade-up');
            card.setAttribute('data-aos-delay', index * 50);
            
            const tagHtml = [...post.categories, ...post.tags]
                .map(t => `<span class="tag">#${t}</span>`).join('');

            card.innerHTML = `
                <div class="card-content">
                    <h3>${post.title}</h3>
                    <div class="meta">
                        <span class="date">[ ${post.date} ]</span>
                        ${tagHtml}
                    </div>
                    <p>${post.excerpt}</p>
                    <div class="read-more">读取档案_ ></div>
                </div>
            `;

            // 点击跳转到 article.html 并携带参数
            card.addEventListener('click', () => {
                // 使用 encodeURIComponent 确保中文文件名安全传输
                location.href = `article.html?post=${encodeURIComponent(post.file)}`;
            });

            container.appendChild(card);
        });

    } catch (err) {
        console.error(err);
        container.innerHTML = `<div style="color:red">系统错误: ${err.message}</div>`;
    }
}

// ================= 详情页文章渲染逻辑 =================
async function loadArticle(filename) {
    const container = document.getElementById('article-content');
    if(!container) return;

    try {
        const url = `posts/${filename}`; // 文件名已经是 url encoded 的字符串(如果来自URL参数)
        const res = await fetch(url);
        
        if(!res.ok) throw new Error('档案损坏或不存在 (404)');
        
        const text = await res.text();
        const { title, date, content } = parseFrontMatter(text);

        // 设置网页标题
        document.title = `${title} | 系统日志`;

        // 渲染 Markdown
        const htmlContent = marked.parse(content);

        // 组装 HTML
        container.innerHTML = `
            <h1>${title}</h1>
            <div style="margin-bottom:30px; color:#666; font-size:0.9rem;">
                发布时间: <span style="color:var(--secondary)">${date}</span>
            </div>
            ${htmlContent}
        `;

        // 启用代码高亮
        if(typeof hljs !== 'undefined') {
            hljs.highlightAll();
        }

    } catch (err) {
        container.innerHTML = `
            <h2 style="color:var(--secondary)">ERROR_404</h2>
            <p>无法读取目标档案: ${err.message}</p>
            <a href="index.html" class="read-more" style="margin-top:20px; display:inline-block"><< 返回首页</a>
        `;
    }
}

// 启动首页列表加载
if(document.getElementById('postList')) {
    loadPosts();
}
