// 全局变量存储文章数据
let allPostsData = [];

// ================= 初始化逻辑 =================
document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    
    if(document.getElementById('postList')) {
        initHomePage();
    }

    const urlParams = new URLSearchParams(window.location.search);
    const postFile = urlParams.get('post');
    if(postFile && document.getElementById('article-content')) {
        loadArticle(postFile);
    }
});

// ================= 导航栏功能 =================
function initNavbar() {
    const navbar = document.getElementById('navbar');
    const navbarToggle = document.getElementById('navbarToggle');
    const navbarLinks = document.getElementById('navbarLinks');
    
    // 滚动效果
    window.addEventListener('scroll', () => {
        if (window.scrollY > 10) {
            navbar?.classList.add('scrolled');
        } else {
            navbar?.classList.remove('scrolled');
        }
    });
    
    // 移动端菜单切换
    navbarToggle?.addEventListener('click', () => {
        navbarLinks?.classList.toggle('active');
    });
    
    // 点击导航链接时关闭移动端菜单
    document.querySelectorAll('.navbar-link').forEach(link => {
        link.addEventListener('click', () => {
            navbarLinks?.classList.remove('active');
        });
    });
    
    // 点击页面其他地方关闭菜单
    document.addEventListener('click', (e) => {
        if (!navbar?.contains(e.target) && navbarLinks?.classList.contains('active')) {
            navbarLinks?.classList.remove('active');
        }
    });
}

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
                    excerpt = meta.content.slice(0, 150) + '...';
                }
                excerpt = excerpt.replace(/[#*`$!\[\]]/g, '').replace(/\n/g, ' ').trim();

                return { file, ...meta, excerpt };
            } catch(e) { return null; }
        }));

        allPostsData = loadedPosts.filter(p => p).sort((a, b) => new Date(b.date) - new Date(a.date));

        renderCategories(allPostsData, categoryContainer);
        renderPosts(allPostsData, container);

        searchInput.addEventListener('input', debounce((e) => {
            const keyword = e.target.value.toLowerCase();
            const filtered = allPostsData.filter(p => 
                (p.title || '').toLowerCase().includes(keyword) || 
                (p.content || '').toLowerCase().includes(keyword) ||
                (p.categories || []).some(c => c.toLowerCase().includes(keyword)) ||
                (p.tags || []).some(t => t.toLowerCase().includes(keyword))
            );
            renderPosts(filtered, container);
        }, 200));

    } catch (err) {
        container.innerHTML = '<div style="color:#64748b; text-align:center; padding:40px;">暂无文章数据</div>';
    }
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function renderPosts(posts, container) {
    container.innerHTML = '';
    if(posts.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:#64748b; grid-column:1/-1; padding:40px;">未找到相关文章</div>';
        return;
    }

    posts.forEach((post) => {
        const card = document.createElement('div');
        card.className = 'post-preview';

        const allTags = new Set([...(post.categories || []), ...(post.tags || [])]);
        const tagsHtml = Array.from(allTags).map(t => 
            `<span class="tag-item">#${t}</span>`
        ).join('');

        card.innerHTML = `
            <h3>${post.title}</h3>
            <div class="meta">
                <span>${post.date || '未知日期'}</span>
                <span style="margin: 0 8px; color:#cbd5e1;">|</span>
                ${tagsHtml} 
            </div>
            <p>${post.excerpt}</p>
            <a href="article.html?post=${encodeURIComponent(post.file)}" class="read-more-btn">
                阅读全文
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

    let html = `<button class="cat-btn active" onclick="filterCat('all', this)">全部</button>`;
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
                <div>更新时间: ${date}</div>
            </div>
            <div class="markdown-content">
                ${marked.parse(content)}
            </div>
        `;

        // 处理代码块
        processCodeBlocks(container);
        
        // 处理图片
        processImages(container);
        
        // 生成目录
        generateTOC(container, tocContainer);

    } catch (err) {
        console.error(err);
        container.innerHTML = `<div style="padding:50px; text-align:center; color:#64748b;">文章加载失败</div>`;
    }
}

// ================= 代码块处理 =================
function processCodeBlocks(container) {
    if(typeof hljs !== 'undefined') {
        container.querySelectorAll('pre code').forEach((block) => {
            const pre = block.parentElement;
            
            let hasLang = false;
            let lang = 'TEXT';
            block.classList.forEach(cls => {
                if(cls.startsWith('language-')) {
                    const detected = cls.replace('language-', '');
                    if(detected) {
                        lang = detected.toUpperCase();
                        hasLang = true;
                    }
                }
            });
            
            if(hasLang) {
                hljs.highlightElement(block);
            }
            
            pre.setAttribute('data-lang', lang);
            addCopyButton(pre, block);
        });
    }
}

function addCopyButton(pre, block) {
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.innerHTML = '复制';
    
    btn.addEventListener('click', () => {
        const codeText = block.innerText; 
        
        navigator.clipboard.writeText(codeText).then(() => {
            btn.innerHTML = '✓ 已复制';
            btn.classList.add('copied');
            
            setTimeout(() => {
                btn.innerHTML = '复制';
                btn.classList.remove('copied');
            }, 2000);
        }).catch(err => {
            console.error('复制失败:', err);
            btn.innerHTML = '错误';
        });
    });

    pre.appendChild(btn);
}

// ================= 图片处理 =================
function processImages(container) {
    container.querySelectorAll('img').forEach(img => {
        if (img.complete && img.naturalWidth > 0) {
            img.style.opacity = '1';
        } else {
            img.style.opacity = '0';
            img.style.transition = 'opacity 300ms ease';
            
            img.addEventListener('load', () => {
                img.style.opacity = '1';
            });
        }
        
        img.addEventListener('error', () => {
            img.classList.add('error');
            img.alt = '图片加载失败';
            img.style.opacity = '1';
        });

        img.addEventListener('click', () => {
            openLightbox(img.src, img.alt);
        });
    });
}

function openLightbox(src, alt) {
    const overlay = document.createElement('div');
    overlay.className = 'image-lightbox';
    
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt || '';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'image-lightbox-close';
    closeBtn.setAttribute('aria-label', '关闭');
    
    overlay.appendChild(closeBtn);
    overlay.appendChild(img);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    
    requestAnimationFrame(() => {
        overlay.classList.add('active');
    });
    
    const closeLightbox = () => {
        overlay.classList.remove('active');
        setTimeout(() => {
            overlay.remove();
            document.body.style.overflow = '';
        }, 200);
    };
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target === closeBtn) {
            closeLightbox();
        }
    });
    
    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') {
            closeLightbox();
            document.removeEventListener('keydown', escHandler);
        }
    });
}

// ================= 目录生成 =================
function generateTOC(articleElement, tocElement) {
    // 支持 h1-h6 所有标题
    const headers = articleElement.querySelectorAll('h1, h2, h3, h4, h5, h6');
    if (!tocElement) return;

    if (headers.length === 0) {
        return;
    }

    const mainUl = document.createElement('ul');
    mainUl.className = 'toc-list';

    // 跟踪当前的层次结构
    const stack = [mainUl];
    const levelMap = {
        'h1': 0,
        'h2': 0,
        'h3': 1,
        'h4': 2,
        'h5': 3,
        'h6': 4
    };

    headers.forEach((header, index) => {
        const id = 'header-' + index;
        header.setAttribute('id', id);

        const tagName = header.tagName.toLowerCase();
        const level = levelMap[tagName] || 0;

        // 调整stack，确保当前level的父元素在栈顶
        while (stack.length > level + 1) {
            stack.pop();
        }

        // 创建新的li和a元素
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = '#' + id;
        a.textContent = header.textContent;

        // 设置class
        if (level === 1) {
            li.className = 'toc-sub';
        } else if (level === 2) {
            li.className = 'toc-sub-2';
        } else if (level === 3) {
            li.className = 'toc-sub-3';
        } else if (level >= 4) {
            li.className = 'toc-sub-4';
        }

        a.addEventListener('click', (e) => {
            e.preventDefault();
            header.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            // 高亮当前目录
            document.querySelectorAll('.toc-list a').forEach(l => l.classList.remove('active'));
            a.classList.add('active');
        });

        li.appendChild(a);
        stack[stack.length - 1].appendChild(li);

        // 如果不是最高层级，创建新的ul作为子级
        if (level < 4) {
            const newUl = document.createElement('ul');
            newUl.className = 'toc-list';
            li.appendChild(newUl);
            stack.push(newUl);
        }
    });

    tocElement.innerHTML = '<div class="toc-title">目录</div>';
    tocElement.appendChild(mainUl);

    // 滚动高亮
    const observerOptions = {
        rootMargin: '-20% 0px -70% 0px',
        threshold: 0
    };

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                const link = tocElement.querySelector(`a[href="#${id}"]`);
                if (link) {
                    document.querySelectorAll('.toc-list a').forEach(l => l.classList.remove('active'));
                    link.classList.add('active');
                }
            }
        });
    }, observerOptions);

    headers.forEach(h => observer.observe(h));
}

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

// ================= 趣味动态元素 =================

// 滚动进度指示器
function initScrollProgress() {
    const progressBar = document.createElement('div');
    progressBar.className = 'scroll-progress';
    document.body.appendChild(progressBar);
    
    window.addEventListener('scroll', () => {
        const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (winScroll / height) * 100;
        progressBar.style.width = scrolled + '%';
    });
}

// 浮动图标装饰
function initFloatingIcons() {
    const iconCount = 8;
    for (let i = 0; i < iconCount; i++) {
        const icon = document.createElement('div');
        icon.className = 'floating-icon';
        icon.style.left = Math.random() * 100 + 'vw';
        icon.style.top = Math.random() * 100 + 'vh';
        icon.style.animationDelay = Math.random() * 8 + 's';
        icon.style.opacity = Math.random() * 0.3 + 0.1;
        icon.style.width = (Math.random() * 6 + 4) + 'px';
        icon.style.height = icon.style.width;
        document.body.appendChild(icon);
    }
}

// 鼠标跟随装饰
function initCursorFollower() {
    const follower = document.createElement('div');
    follower.className = 'cursor-follower';
    document.body.appendChild(follower);
    
    let mouseX = 0;
    let mouseY = 0;
    let followerX = 0;
    let followerY = 0;
    
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        follower.classList.add('visible');
    });
    
    document.addEventListener('mouseleave', () => {
        follower.classList.remove('visible');
    });
    
    // 为可交互元素添加激活状态
    const interactiveElements = document.querySelectorAll('a, button, .cat-btn, .nav-link, .read-more-btn');
    interactiveElements.forEach(el => {
        el.addEventListener('mouseenter', () => follower.classList.add('active'));
        el.addEventListener('mouseleave', () => follower.classList.remove('active'));
    });
    
    // 平滑跟随
    function animate() {
        followerX += (mouseX - followerX) * 0.15;
        followerY += (mouseY - followerY) * 0.15;
        
        follower.style.left = (followerX - 10) + 'px';
        follower.style.top = (followerY - 10) + 'px';
        
        requestAnimationFrame(animate);
    }
    animate();
}

// 初始化趣味动态元素
document.addEventListener('DOMContentLoaded', () => {
    initScrollProgress();
    initFloatingIcons();
    // initCursorFollower(); // 可选：鼠标跟随效果
    
    // 为侧边目录添加显示逻辑
    const tocSidebar = document.querySelector('.toc-sidebar');
    if (tocSidebar && window.innerWidth >= 1024) {
        tocSidebar.style.display = 'block';
    }
});

// 窗口大小变化时更新侧边目录显示
window.addEventListener('resize', () => {
    const tocSidebar = document.querySelector('.toc-sidebar');
    if (tocSidebar) {
        if (window.innerWidth >= 1024) {
            tocSidebar.style.display = 'block';
        } else {
            tocSidebar.style.display = 'none';
        }
    }
});

