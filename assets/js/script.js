// 初始化粒子背景 - 增强互动性
if(document.getElementById('particles-js')) {
    particlesJS('particles-js', {
        particles: {
            number: { value: 80, density: { enable: true, value_area: 800 } },
            color: { value: '#00ffcc' }, // 使用主色调
            shape: { type: 'circle' },
            opacity: { value: 0.5, random: true },
            size: { value: 3, random: true },
            line_linked: { 
                enable: true, 
                distance: 150, 
                color: '#00ffcc', 
                opacity: 0.3, 
                width: 1 
            },
            move: { enable: true, speed: 2, direction: 'none', random: false, straight: false, out_mode: 'out', bounce: false }
        },
        interactivity: {
            detect_on: 'canvas',
            events: { 
                onhover: { enable: true, mode: 'grab' }, // 鼠标悬停改为 Grab (连线) 更有黑客感
                onclick: { enable: true, mode: 'push' }, 
                resize: true 
            },
            modes: { 
                grab: { distance: 180, line_linked: { opacity: 0.8 } }, // 连线增强
                push: { particles_nb: 4 } 
            }
        },
        retina_detect: true
    });
}

// 初始化 AOS 动画
if(typeof AOS !== 'undefined') {
    AOS.init({ once: true, duration: 800, offset: 50 });
}

// Front Matter 解析器 (保持不变，逻辑是通用的)
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

// ================= 首页列表加载 =================
async function loadPosts() {
    const container = document.getElementById('postList');
    if (!container) return;

    try {
        const res = await fetch('posts/index.json?t=' + Date.now());
        if (!res.ok) throw new Error('索引文件获取失败');
        
        const { posts = [] } = await res.json();
        
        if (posts.length === 0) {
            container.innerHTML = '<div class="loading-terminal">>> 暂无文章发布 (Empty)</div>';
            return;
        }

        const articles = [];

        // 获取文章详情
        await Promise.all(posts.map(async (filename) => {
            try {
                const url = `posts/${encodeURIComponent(filename)}`;
                const r = await fetch(url);
                if (!r.ok) return;
                
                const text = await r.text();
                const { title, date, categories, tags, content } = parseFrontMatter(text);
                
                // 生成纯文本摘要
                const plain = marked.parse(content).replace(/<[^>]+>/g, '');
                const excerpt = plain.slice(0, 120) + '...';
                
                articles.push({ 
                    file: filename,
                    title: title || filename.replace('.md', ''), 
                    date: date || 'YYYY-MM-DD', 
                    categories, tags, excerpt 
                });
            } catch (e) {
                console.warn('Skipped:', filename);
            }
        }));

        // 按日期倒序排序
        articles.sort((a, b) => new Date(b.date) - new Date(a.date));
        container.innerHTML = '';

        articles.forEach((post, index) => {
            const card = document.createElement('div');
            card.className = 'post-preview';
            card.setAttribute('data-aos', 'fade-up'); // 向上浮现动画
            
            const tagHtml = [...post.categories, ...post.tags]
                .map(t => `<span class="tag">${t}</span>`).join('');

            // 使用专业博客词汇：阅读全文
            card.innerHTML = `
                <div class="card-content">
                    <h3>${post.title}</h3>
                    <div class="meta">
                        <span>[ ${post.date} ]</span>
                        ${tagHtml}
                    </div>
                    <p>${post.excerpt}</p>
                    <div class="read-more">阅读全文 >></div> 
                </div>
            `;

            card.addEventListener('click', () => {
                location.href = `article.html?post=${encodeURIComponent(post.file)}`;
            });

            container.appendChild(card);
        });

    } catch (err) {
        console.error(err);
        container.innerHTML = `<div class="loading-terminal" style="color:var(--secondary)">>> 系统错误: 无法加载文章列表</div>`;
    }
}

// ================= 文章详情加载 =================
async function loadArticle(filename) {
    const container = document.getElementById('article-content');
    if(!container) return;

    try {
        const url = `posts/${filename}`;
        const res = await fetch(url);
        
        if(!res.ok) throw new Error('File Not Found');
        
        const text = await res.text();
        const { title, date, content } = parseFrontMatter(text);

        document.title = `${title} | ddddd_Blog`;

        const htmlContent = marked.parse(content);

        container.innerHTML = `
            <h1>${title}</h1>
            <div style="margin-bottom:30px; color:#666; font-family:var(--font-mono); font-size:0.9rem;">
                <span style="color:var(--primary)">发布时间:</span> ${date}
            </div>
            ${htmlContent}
        `;

        if(typeof hljs !== 'undefined') {
            hljs.highlightAll();
        }

    } catch (err) {
        container.innerHTML = `
            <h1 style="color:var(--secondary)">404 Not Found</h1>
            <p>文章加载失败，请检查链接是否正确。</p>
            <br>
            <p style="color:#666;">Error Log: ${err.message}</p>
        `;
    }
}

// 启动
if(document.getElementById('postList')) {
    loadPosts();
}
