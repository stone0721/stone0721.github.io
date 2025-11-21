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
        const data = await res.json();
        const files = data.posts || [];

        // 并发加载所有 Markdown不仅是为了显示，也是为了提取分类
        // 注意：如果文章非常多(上百篇)，建议在生成 index.json 时就包含 metadata，而不是前端去 fetch 解析
        const loadedPosts = await Promise.all(files.map(async (file) => {
            try {
                const r = await fetch(`posts/${encodeURIComponent(file)}`);
                const text = await r.text();
                const meta = parseFrontMatter(text);
                return { 
                    file, 
                    ...meta, 
                    // 简单的纯文本摘要
                    excerpt: marked.parse(meta.content).replace(/<[^>]+>/g, '').slice(0, 100) + '...'
                };
            } catch(e) { return null; }
        }));

        // 过滤掉加载失败的，按日期降序
        allPostsData = loadedPosts.filter(p => p).sort((a, b) => new Date(b.date) - new Date(a.date));

        // 1. 渲染分类按钮
        renderCategories(allPostsData, categoryContainer);

        // 2. 初始渲染所有文章
        renderPosts(allPostsData, container);

        // 3. 绑定搜索事件
        searchInput.addEventListener('input', (e) => {
            const keyword = e.target.value.toLowerCase();
            const filtered = allPostsData.filter(p => 
                p.title.toLowerCase().includes(keyword) || 
                p.content.toLowerCase().includes(keyword)
            );
            renderPosts(filtered, container);
        });

    } catch (err) {
        console.error(err);
        container.innerHTML = '<div style="color:red">系统离线或索引损坏</div>';
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
        // 只有前几个加延迟，避免搜索时闪烁太慢
        if(index < 6) card.setAttribute('data-aos-delay', index * 50);

        const tagsHtml = (post.tags || []).map(t => `<span style="margin-right:5px; color:var(--primary)">#${t}</span>`).join('');

        card.innerHTML = `
            <h3>${post.title}</h3>
            <div class="meta">
                <span>${post.date}</span> &nbsp;|&nbsp; ${tagsHtml}
            </div>
            <p style="font-size:0.9rem; color:#888; margin-bottom:15px;">${post.excerpt}</p>
            <a href="article.html?post=${encodeURIComponent(post.file)}" class="read-more-btn">
                &lt;EXECUTE&gt;
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

    // "全部" 按钮
    let html = `<button class="cat-btn active" onclick="filterCat('all', this)">ALL</button>`;
    
    categories.forEach(c => {
        html += `<button class="cat-btn" onclick="filterCat('${c}', this)">${c}</button>`;
    });
    container.innerHTML = html;
}

// 分类筛选函数 (挂载到 window 以便 HTML onclick 调用)
window.filterCat = function(category, btn) {
    // 按钮样式切换
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const container = document.getElementById('postList');
    if(category === 'all') {
        renderPosts(allPostsData, container);
    } else {
        const filtered = allPostsData.filter(p => p.categories && p.categories.includes(category));
        renderPosts(filtered, container);
    }
}

// ================= 文章详情页功能 (含目录生成) =================
async function loadArticle(filename) {
    const container = document.getElementById('article-content');
    const tocContainer = document.getElementById('toc-content'); // 目录容器
    
    try {
        const res = await fetch(`posts/${filename}`);
        if(!res.ok) throw new Error('404 Not Found');
        const text = await res.text();
        const { title, date, content } = parseFrontMatter(text);

        document.title = title + " | DevLog";

        // 渲染 Markdown
        container.innerHTML = `
            <div class="article-header">
                <h1>${title}</h1>
                <div style="color:#666; font-family:'Consolas'">
                    <span>UID: 0x${Math.floor(Math.random()*9999)}</span> // 
                    <span>DATE: ${date}</span>
                </div>
            </div>
            <hr style="border:0; border-top:1px dashed #333; margin:30px 0;">
            <div class="markdown-content">
                ${marked.parse(content)}
            </div>
        `;

        // 代码高亮
        if(typeof hljs !== 'undefined') hljs.highlightAll();

        // >>> 生成目录 (TOC) <<<
        generateTOC(container, tocContainer);

    } catch (err) {
        container.innerHTML = `<h1>DATA CORRUPTED</h1><p>${err.message}</p>`;
    }
}

// 生成目录逻辑
function generateTOC(articleElement, tocElement) {
    // 查找所有的 h2 和 h3
    const headers = articleElement.querySelectorAll('h2, h3');
        if (headers.length === 0) {
            tocElement.innerHTML = '<p style="color:#555; font-size:0.8rem;">// NO HEADERS DETECTED</p>';
            return;
        }

        const ul = document.createElement('ul');
        ul.className = 'toc-list';

        headers.forEach((header, index) => {
            // 1. 为标题自动添加 ID，作为锚点
            const id = 'header-' + index;
            header.setAttribute('id', id);

            // 2. 创建目录项
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = '#' + id;
            a.textContent = header.textContent;
            
            // 3. 根据标题级别设置缩进样式
            if (header.tagName.toLowerCase() === 'h3') {
                li.className = 'toc-sub';
            }

            // 4. 点击平滑滚动
            a.addEventListener('click', (e) => {
                e.preventDefault();
                header.scrollIntoView({ behavior: 'smooth' });
            });

            li.appendChild(a);
            ul.appendChild(li);
        });

        tocElement.innerHTML = '<div class="toc-title">>> DIRECTORY</div>';
        tocElement.appendChild(ul);

        // 5. 滚动监听 (高亮当前目录项)
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

// 解析 Front Matter (含 WEB -> Web 的拼写修复)
function parseFrontMatter(text) {
    const meta = { title: '', date: '', categories: [], tags: [], content: '' };
    // 简单的 YAML 解析正则
    const match = text.match(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---([\s\S]*)$/);

    if (match) {
        const yaml = match[1];
        meta.content = match[2].trim();

        yaml.split('\n').forEach(line => {
            const [key, ...valParts] = line.split(':');
            if(!key || valParts.length === 0) return;
            
            const val = valParts.join(':').trim().replace(/^['"]|['"]$/g, '');
            
            if (key.trim() === 'title') meta.title = val;
            if (key.trim() === 'date') meta.date = val;
            if (['categories', 'tags'].includes(key.trim())) {
                meta[key.trim()] = val.replace(/[\[\]]/g, '').split(',').map(s => s.trim()).filter(Boolean);
            }
        });
    } else {
        meta.content = text; // 没有头部信息的纯 Markdown
    }

    // >>> 需求1：修复 WEB 大小写问题 <<<
    // 全局替换 content 中的 WEB 为 Web (排除链接中的)
    meta.content = meta.content.replace(/(?!<a[^>]*>)WEB(?![^<]*<\/a>)/g, 'Web');
    // 同时也修复 categories 中的拼写
    meta.categories = meta.categories.map(c => c === 'WEB安全' ? 'Web安全' : c);

    return meta;
}

// 初始化粒子效果
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

// 初始化打字机 (修改文案)
function initTypewriter() {
    const el = document.querySelector('.subtitle');
    if(!el) return;
    // 需求1：文案修正
    const text = "专注于逆向工程、Web安全"; 
    let i = 0;
    el.innerHTML = ""; // 清空
    
    function type() {
        if(i < text.length) {
            el.innerHTML += text.charAt(i);
            i++;
            setTimeout(type, 100);
        }
    }
    setTimeout(type, 500);
}
