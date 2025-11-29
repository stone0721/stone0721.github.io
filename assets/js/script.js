// 全局变量存储文章数据
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
        initMobileTocToggle(); // 初始化移动端目录切换
    }

    // 4. 初始化 AOS
    if(typeof AOS !== 'undefined') {
        AOS.init({ duration: 600, offset: 50, easing: 'ease-out-quart', once: true });
    }
});


// ================= 首页核心功能 =================
async function initHomePage() {
    const container = document.getElementById('postList');
    const categoryContainer = document.getElementById('categoryList');
    const searchInput = document.getElementById('searchInput');

    try {
        const res = await fetch('posts/index.json?t=' + Date.now());
        if (!res.ok) throw new Error("Index file not found");
        const data = await res.json();
        const files = data.posts || [];

        const loadedPosts = await Promise.all(files.map(async (file) => {
            try {
                const r = await fetch(`posts/${encodeURIComponent(file)}`);
                if (!r.ok) return null;
                const text = await r.text();
                const meta = parseFrontMatter(text);
                
                let excerpt = '';
                const moreTag = '<!--more-->';
                
                if (meta.content.includes(moreTag)) {
                    excerpt = meta.content.split(moreTag)[0];
                } else {
                    excerpt = meta.content.slice(0, 100) + '...';
                }
                // 去除 Markdown 符号
                excerpt = excerpt.replace(/[#*`$!\[\]]/g, '').replace(/\n/g, ' ').trim();

                return { file, ...meta, excerpt };
            } catch(e) { return null; }
        }));

        allPostsData = loadedPosts.filter(p => p).sort((a, b) => new Date(b.date) - new Date(a.date));

        renderCategories(allPostsData, categoryContainer);
        renderPosts(allPostsData, container);

        searchInput.addEventListener('input', (e) => {
            const keyword = e.target.value.toLowerCase();
            const filtered = allPostsData.filter(p => 
                (p.title || '').toLowerCase().includes(keyword) || 
                (p.content || '').toLowerCase().includes(keyword)
            );
            renderPosts(filtered, container);
        });

    } catch (err) {
        container.innerHTML = '<div style="color:#666; text-align:center;">暂无文章数据</div>';
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

        const allTags = new Set([...(post.categories || []), ...(post.tags || [])]);
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
            <p style="font-size:0.9rem; color:#888; margin-bottom:15px; line-height:1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${post.excerpt}</p>
            <a href="article.html?post=${encodeURIComponent(post.file)}" class="read-more-btn">
                &lt; 阅读全文 &gt;
            </a>
        `;
        container.appendChild(card);
    });
}

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

// ================= 文章详情页 =================
async function loadArticle(filename) {
    const container = document.getElementById('article-content');
    const tocContainer = document.getElementById('toc-content');
    
    try {
        const res = await fetch(`posts/${filename}`);
        if(!res.ok) throw new Error('404 Not Found');
        const text = await res.text();
        const { title, date, content, categories, tags } = parseFrontMatter(text);
        
        document.title = title + " | ddddd";

        container.innerHTML = `
            <div class="article-header">
                <h1>${title}</h1>
                <div style="color:#666; font-family:'Consolas', monospace; font-size:0.85rem; margin-top:10px;">
                    <span>更新时间: ${date}</span>
                </div>
            </div>
            <div style="height:1px; background:#222; margin:30px 0;"></div>
            <div class="markdown-content">
                ${marked.parse(content)}
            </div>
        `;

// 代码高亮与复制功能
        if(typeof hljs !== 'undefined') {
            container.querySelectorAll('pre code').forEach((block) => {
                // 1. 执行高亮
                hljs.highlightElement(block);
                
                // 2. 获取父级 pre 元素
                const pre = block.parentElement;
                
                // 3. 获取语言名称 (例如 class="language-python")
                let lang = 'CODE';
                block.classList.forEach(cls => {
                    if(cls.startsWith('language-')) {
                        lang = cls.replace('language-', '').toUpperCase();
                    }
                });
                // 设置 data-lang 属性，供 CSS 的 ::after 读取显示
                pre.setAttribute('data-lang', lang);

                // 4. 创建复制按钮
                const btn = document.createElement('button');
                btn.className = 'copy-btn';
                btn.innerHTML = '复制'; // 初始文字
                
                // 5. 复制逻辑
                btn.addEventListener('click', () => {
                    // 获取纯文本，去除可能存在的HTML标签干扰
                    const codeText = block.innerText; 
                    
                    navigator.clipboard.writeText(codeText).then(() => {
                        // 成功反馈
                        btn.innerHTML = '已复制';
                        btn.classList.add('copied');
                        
                        // 2秒后恢复
                        setTimeout(() => {
                            btn.innerHTML = '复制';
                            btn.classList.remove('copied');
                        }, 2000);
                    }).catch(err => {
                        console.error('复制失败:', err);
                        btn.innerHTML = '错误';
                    });
                });

                // 将按钮添加到 pre 块中
                pre.appendChild(btn);
            });
        }

        generateTOC(container, tocContainer);

    } catch (err) {
        console.error(err);
        container.innerHTML = `<div style="padding:50px; text-align:center; color:#666;">文章加载失败</div>`;
    }
}

// 生成目录 -  支持三层结构 (H2, H3, H4)
function generateTOC(articleElement, tocElement) {
    //  选择器增加 h4
    const headers = articleElement.querySelectorAll('h2, h3, h4');
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
        
        //  根据标签名添加不同的类名，用于 CSS 缩进
        const tagName = header.tagName.toLowerCase();
        if (tagName === 'h3') {
            li.className = 'toc-sub'; // 二级
        } else if (tagName === 'h4') {
            li.className = 'toc-sub-2'; // 三级 (CSS中定义缩进)
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
                // 先移除所有高亮
                document.querySelectorAll('.toc-list a').forEach(l => l.classList.remove('active'));
                // 添加当前高亮
                link.classList.add('active');
            }
        });
    }, { rootMargin: '0px 0px 0px 0px' });
    headers.forEach(h => observer.observe(h));
}

// 辅助函数
function parseFrontMatter(text) {
    const meta = { title: 'Untitled', date: 'Unknown', categories: [], tags: [], content: '' };
    const match = text.match(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---([\s\S]*)$/);

    if (match) {
        const yamlBlock = match[1];
        meta.content = match[2].trim();
        yamlBlock.split('\n').forEach(line => {
            const parts = line.split(':');
            if (parts.length < 2) return;
            const key = parts[0].trim();
            let value = parts.slice(1).join(':').trim().replace(/^['"]|['"]$/g, '');
            if (key === 'title') meta.title = value;
            if (key === 'date') meta.date = value;
            if (['categories', 'tags'].includes(key)) {
                meta[key] = value.replace(/[\[\]]/g, '').split(',').map(s => s.trim()).filter(Boolean);
            }
        });
    } else {
        meta.content = text; 
    }
    return meta;
}

// 移动端目录切换功能
function initMobileTocToggle() {
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'toc-toggle-btn';
    toggleBtn.textContent = '目录';
    document.body.appendChild(toggleBtn);
    
    const tocSidebar = document.querySelector('.toc-sidebar');
    
    if (tocSidebar) {
        toggleBtn.addEventListener('click', function() {
            tocSidebar.classList.toggle('active');
            toggleBtn.textContent = tocSidebar.classList.contains('active') ? '关闭' : '目录';
        });
        
        // 点击目录链接后关闭目录
        const tocLinks = tocSidebar.querySelectorAll('a');
        tocLinks.forEach(link => {
            link.addEventListener('click', function() {
                tocSidebar.classList.remove('active');
                toggleBtn.textContent = '目录';
            });
        });
    }
}

// ================= 粒子配置优化 =================
function initParticles() {
    particlesJS('particles-js', {
        particles: {
            number: { value: 80, density: { enable: true, value_area: 800 } },
            color: { value: '#00f3ff' }, // 主色
            shape: { type: 'circle' },
            opacity: { value: 0.3, random: true },
            size: { value: 3, random: true },
            line_linked: { 
                enable: true, 
                distance: 150, 
                color: '#00f3ff', 
                opacity: 0.15, // 连线更淡
                width: 1 
            },
            move: { 
                enable: true, 
                speed: 1.5, // 速度放慢，更优雅
                direction: 'none', 
                random: true, 
                out_mode: 'out' 
            }
        },
        interactivity: {
            detect_on: 'window',
            events: { 
                onhover: { enable: true, mode: 'grab' }, // 鼠标悬停连线
                onclick: { enable: true, mode: 'push' } 
            },
            modes: {
                grab: { distance: 200, line_linked: { opacity: 0.5 } },
                push: { particles_nb: 4 }
            }
        },
        retina_detect: true
    });
}

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
            setTimeout(type, 50); // 打字速度
        }
    }
    setTimeout(type, 200);
}