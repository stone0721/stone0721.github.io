// 全局变量存储文章数据，用于搜索和筛选
let allPostsData = [];

// ================= 初始化逻辑 =================
document.addEventListener('DOMContentLoaded', () => {
    // 1. 初始化粒子背景
    if(document.getElementById('particles-js')) {
        initParticles();
    }

    // 2. 首页逻辑
    if(document.getElementById('postList')) {
        initHomePage();
        initTypewriter();
    }

    // 3. 文章页逻辑
    const urlParams = new URLSearchParams(window.location.search);
    const postFile = urlParams.get('post');
    if(postFile && document.getElementById('article-content')) {
        loadArticle(postFile);
    }

    // 4. 初始化 AOS 动画
    if(typeof AOS !== 'undefined') {
        AOS.init({ duration: 800, offset: 100, easing: 'ease-out-quad' });
    }
});

// ================= 首页核心功能 =================
async function initHomePage() {
    const container = document.getElementById('postList');
    const categoryContainer = document.getElementById('categoryList');
    const searchInput = document.getElementById('searchInput');

    try {
        // 加载索引
        const res = await fetch('posts/index.json?t=' + Date.now());
        if (!res.ok) throw new Error("Index file not found");
        const data = await res.json();
        const files = data.posts || [];

        // 并发加载所有 Markdown
        const loadedPosts = await Promise.all(files.map(async (file) => {
            try {
                const r = await fetch(`posts/${encodeURIComponent(file)}`);
                if (!r.ok) return null;
                const text = await r.text();
                const meta = parseFrontMatter(text);
                
                // 生成纯文本摘要 (移除 Markdown 符号)
                const rawContent = meta.content.replace(/[#*`\[\]]/g, '').trim();
                const excerpt = rawContent.slice(0, 120) + '...';

                return { 
                    file, 
                    ...meta, 
                    excerpt
                };
            } catch(e) { 
                console.warn("Load failed:", file);
                return null; 
            }
        }));

        // 过滤无效文章并按日期排序
        allPostsData = loadedPosts.filter(p => p).sort((a, b) => new Date(b.date) - new Date(a.date));

        // 1. 渲染分类按钮
        renderCategories(allPostsData, categoryContainer);

        // 2. 初始渲染所有文章
        renderPosts(allPostsData, container);

        // 3. 绑定搜索事件
        searchInput.addEventListener('input', (e) => {
            const keyword = e.target.value.toLowerCase();
            const filtered = allPostsData.filter(p => 
                (p.title || '').toLowerCase().includes(keyword) || 
                (p.content || '').toLowerCase().includes(keyword)
            );
            renderPosts(filtered, container);
        });

    } catch (err) {
        console.error(err);
        container.innerHTML = '<div style="color:red; text-align:center; padding:20px;">系统离线或索引损坏 (Index Error)</div>';
    }
}

// 渲染文章卡片
function renderPosts(posts, container) {
    container.innerHTML = '';
    if(posts.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:#666; grid-column:1/-1;">未找到相关数据 // No Data Found</div>';
        return;
    }

    posts.forEach((post, index) => {
        const card = document.createElement('div');
        card.className = 'post-preview';
        card.setAttribute('data-aos', 'fade-up');
        if(index < 6) card.setAttribute('data-aos-delay', index * 50);

        // >>> 修复标签显示逻辑 <<<
        // 合并 categories 和 tags，去重
        const allTags = new Set([...(post.categories || []), ...(post.tags || [])]);
        // 生成 HTML
        const tagsHtml = Array.from(allTags).map(t => 
            `<span style="margin-right:8px; color:var(--primary); font-size:0.8rem; font-weight:bold;">#${t}</span>`
        ).join('');

        card.innerHTML = `
            <h3>${post.title}</h3>
            <div class="meta">
                <span>${post.date || 'Unknown Date'}</span>
                <span style="margin: 0 10px; color:#444;">|</span>
                ${tagsHtml} 
            </div>
            <p style="font-size:0.9rem; color:#888; margin-bottom:15px;">${post.excerpt}</p>
            <a href="article.html?post=${encodeURIComponent(post.file)}" class="read-more-btn">
                &lt; 阅读全文 &gt;
            </a>
        `;
        container.appendChild(card);
    });
}

// 渲染分类
function renderCategories(posts, container) {
    const categories = new Set();
    posts.forEach(p => {
        if(p.categories) p.categories.forEach(c => categories.add(c));
    });

    let html = `<button class="cat-btn active" onclick="filterCat('all', this)">ALL</button>`;
    categories.forEach(c => {
        html += `<button class="cat-btn" onclick="filterCat('${c}', this)">${c}</button>`;
    });
    if(container) container.innerHTML = html;
}

// 分类筛选
window.filterCat = function(category, btn) {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const container = document.getElementById('postList');
    if(category === 'all') {
        renderPosts(allPostsData, container);
    } else {
        const filtered = allPostsData.filter(p => 
            (p.categories && p.categories.includes(category))
        );
        renderPosts(filtered, container);
    }
}

// ================= 文章详情页功能 =================
async function loadArticle(filename) {
    const container = document.getElementById('article-content');
    const tocContainer = document.getElementById('toc-content');
    
    try {
        const res = await fetch(`posts/${filename}`);
        if(!res.ok) throw new Error('404 Not Found');
        const text = await res.text();
        
        // 解析
        const { title, date, content, categories, tags } = parseFrontMatter(text);
        document.title = title + " | DevLog";

        // 合并标签用于显示
        const allTags = [...(categories || []), ...(tags || [])];
        const tagsHtml = allTags.map(t => `#${t}`).join('  ');

        // 1. 渲染 HTML 结构
        container.innerHTML = `
            <div class="article-header">
                <h1>${title}</h1>
                <div style="color:#666; font-family:'Consolas', monospace; font-size:0.9rem;">
                    <span>更新日期: ${date}</span>
                    <span style="margin-left:20px; color:var(--primary);">${tagsHtml}</span>
                </div>
            </div>
            <hr style="border:0; border-top:1px dashed #333; margin:30px 0;">
            
            <!-- Markdown 正文 -->
            <div class="markdown-content">
                ${marked.parse(content)}
            </div>
        `;

        // 2. >>> 修复代码高亮 (关键修改) <<<
        // 不再使用 highlightAll，而是精确查找当前文章内的代码块
        if(typeof hljs !== 'undefined') {
            const blocks = container.querySelectorAll('pre code');
            blocks.forEach((block) => {
                hljs.highlightElement(block);
            });
        }

        // 3. 生成目录
        generateTOC(container, tocContainer);

    } catch (err) {
        console.error(err);
        container.innerHTML = `
            <div style="padding:50px; text-align:center;">
                <h2 style="color:#ff5555;">LOAD ERROR</h2>
                <p style="color:#888;">${err.message}</p>
            </div>`;
    }
}

// 生成目录
function generateTOC(articleElement, tocElement) {
    const headers = articleElement.querySelectorAll('h2, h3');
    if (!tocElement) return;

    if (headers.length === 0) {
        tocElement.innerHTML = '<p style="color:#555; font-size:0.8rem; padding-left:10px;">// NO HEADERS DETECTED</p>';
        return;
    }

    const ul = document.createElement('ul');
    ul.className = 'toc-list';

    headers.forEach((header, index) => {
        const id = 'header-' + index;
        header.setAttribute('id', id);

        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = '#' + id;
        a.textContent = header.textContent;
        
        if (header.tagName.toLowerCase() === 'h3') {
            li.className = 'toc-sub';
        }

        a.addEventListener('click', (e) => {
            e.preventDefault();
            header.scrollIntoView({ behavior: 'smooth' });
        });

        li.appendChild(a);
        ul.appendChild(li);
    });

    tocElement.innerHTML = '<div class="toc-title">>> 目录</div>';
    tocElement.appendChild(ul);

    // 滚动监听
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            const id = entry.target.getAttribute('id');
            const link = tocElement.querySelector(`a[href="#${id}"]`);
            if (entry.isIntersecting && link) {
                document.querySelectorAll('.toc-list a').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            }
        });
    }, { rootMargin: '-100px 0px -60% 0px' });

    headers.forEach(h => observer.observe(h));
}

// ================= 辅助工具函数 =================

// 增强版 Front Matter 解析
function parseFrontMatter(text) {
    const meta = { title: 'Untitled', date: 'Unknown', categories: [], tags: [], content: '' };
    
    // 匹配 YAML 头部：以 --- 开头，以 --- 结尾
    const match = text.match(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---([\s\S]*)$/);

    if (match) {
        const yamlBlock = match[1];
        meta.content = match[2].trim();

        // 按行解析 YAML
        yamlBlock.split('\n').forEach(line => {
            const parts = line.split(':');
            if (parts.length < 2) return;

            const key = parts[0].trim();
            // 处理值包含冒号的情况 (如 date: 2023-01-01 12:00)
            let value = parts.slice(1).join(':').trim();
            
            // 去除引号
            value = value.replace(/^['"]|['"]$/g, '');

            if (key === 'title') meta.title = value;
            if (key === 'date') meta.date = value;
            
            // 解析数组格式： [Web安全, 笔记] 或 Web安全, 笔记
            if (['categories', 'tags'].includes(key)) {
                // 去掉中括号
                const cleanValue = value.replace(/[\[\]]/g, '');
                if(cleanValue) {
                    meta[key] = cleanValue.split(',').map(s => s.trim()).filter(Boolean);
                }
            }
        });
    } else {
        meta.content = text; // 没找到头部，全文当作内容
    }

    // 需求修正：修复 WEB 大小写
    meta.content = meta.content.replace(/(?!<a[^>]*>)WEB(?![^<]*<\/a>)/g, 'Web');
    
    // 修复 categories 里的拼写
    if(meta.categories) {
        meta.categories = meta.categories.map(c => c === 'WEB安全' ? 'Web安全' : c);
    }

    return meta;
}

// 粒子特效
function initParticles() {
    particlesJS('particles-js', {
        particles: {
            number: { value: 60 },
            color: { value: '#00f3ff' },
            shape: { type: 'circle' },
            opacity: { value: 0.5, random: true },
            size: { value: 3, random: true },
            line_linked: { enable: true, distance: 150, color: '#00f3ff', opacity: 0.2, width: 1 },
            move: { enable: true, speed: 2 }
        },
        interactivity: {
            detect_on: 'window',
            events: { onhover: { enable: true, mode: 'grab' } }
        }
    });
}

// 打字机
function initTypewriter() {
    const el = document.querySelector('.subtitle');
    if(!el) return;
    const text = "专注于逆向工程、Web安全"; 
    let i = 0;
    el.innerHTML = ""; 
    function type() {
        if(i < text.length) {
            el.innerHTML += text.charAt(i);
            i++;
            setTimeout(type, 100);
        }
    }
    setTimeout(type, 200);
}
