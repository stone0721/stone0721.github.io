// 初始化粒子背景 (参数优化版)
if(document.getElementById('particles-js')) {
    particlesJS('particles-js', {
        particles: {
            number: { value: 80, density: { enable: true, value_area: 800 } },
            color: { value: '#00f3ff' },
            shape: { type: 'circle' },
            opacity: { value: 0.5, random: true, anim: { enable: true, speed: 1, opacity_min: 0.1, sync: false } },
            size: { value: 3, random: true, anim: { enable: false, speed: 40, size_min: 0.1, sync: false } },
            line_linked: { 
                enable: true, 
                distance: 150, 
                color: '#00f3ff', 
                opacity: 0.3, /* 提高连线可见度 */
                width: 1 
            },
            move: { 
                enable: true, 
                speed: 2, /* 稍微加快速度 */
                direction: 'none', 
                random: false, 
                straight: false, 
                out_mode: 'out', 
                bounce: false, 
            }
        },
        interactivity: {
            detect_on: 'window', /* 关键：改为 window 检测，范围更广 */
            events: { 
                onhover: { enable: true, mode: 'grab' }, /* 改为 grab 抓取模式，更酷 */
                onclick: { enable: true, mode: 'push' }, 
                resize: true 
            },
            modes: { 
                grab: { distance: 200, line_linked: { opacity: 0.8 } }, /* 抓取连线变亮 */
                push: { particles_nb: 4 } 
            }
        },
        retina_detect: true
    });
}

// 打字机效果 (新增)
const subtitleElement = document.querySelector('.typewriter-text');
if(subtitleElement) {
    const text = "专注于逆向工程、Web安全";
    let index = 0;
    function typeWriter() {
        if (index < text.length) {
            subtitleElement.innerHTML += text.charAt(index);
            index++;
            setTimeout(typeWriter, 1000); // 打字速度
        }
    }
    // 延迟一点开始打字
    setTimeout(typeWriter, 200);
}

// 初始化动画库
if(typeof AOS !== 'undefined') {
    AOS.init({ once: true, duration: 1000, offset: 120, easing: 'ease-out-cubic' });
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
    if (!container) return;

    try {
        const res = await fetch('posts/index.json?t=' + Date.now());
        if (!res.ok) throw new Error('索引文件丢失');
        
        const { posts = [] } = await res.json();
        
        if (posts.length === 0) {
            container.innerHTML = '<div style="color:#888; font-size:1.2rem; padding:40px;">>> 文章列表为空 <<</div>';
            return;
        }

        const articles = [];

        await Promise.all(posts.map(async (filename) => {
            try {
                const url = `posts/${encodeURIComponent(filename)}`;
                const r = await fetch(url);
                if (!r.ok) return;
                
                const text = await r.text();
                const { title, date, categories, tags, content } = parseFrontMatter(text);
                
                const plain = marked.parse(content).replace(/<[^>]+>/g, '');
                const excerpt = plain.slice(0, 120) + '...'; // 摘要稍长一点
                
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

        articles.sort((a, b) => new Date(b.date) - new Date(a.date));
        container.innerHTML = '';

        articles.forEach((post, index) => {
            const card = document.createElement('div');
            card.className = 'post-preview';
            card.setAttribute('data-aos', 'fade-up');
            card.setAttribute('data-aos-delay', index * 100); // 增加延迟差距，动画更有层次
            
            const tagHtml = [...post.categories, ...post.tags]
                .map(t => `<span class="tag">#${t}</span>`).join('');

            card.innerHTML = `
                <div class="card-content">
                    <h3>${post.title}</h3>
                    <div class="meta">
                        <span class="date" style="color:var(--primary)">[ ${post.date} ]</span>
                        ${tagHtml}
                    </div>
                    <p>${post.excerpt}</p>
                    <div class="read-more"> 阅读全文>></div>
                </div>
            `;

            card.addEventListener('click', () => {
                location.href = `article.html?post=${encodeURIComponent(post.file)}`;
            });

            container.appendChild(card);
        });

    } catch (err) {
        console.error(err);
        container.innerHTML = `<div style="color:red">ERROR: SYSTEM FAILURE - ${err.message}</div>`;
    }
}

// ================= 详情页文章渲染逻辑 =================
async function loadArticle(filename) {
    const container = document.getElementById('article-content');
    if(!container) return; // 如果页面上没有这个ID（比如在首页），就不执行

    try {
        // 1. 获取文章内容
        // 注意：这里假设你的文件在 posts 文件夹下
        const url = `posts/${filename}`; 
        const res = await fetch(url);
        
        if(!res.ok) throw new Error('文章未找到或无法加载 (404)');
        
        const text = await res.text();
        
        // 2. 解析 Front Matter
        const { title, date, content } = parseFrontMatter(text);

        // 3. 设置浏览器标签页标题
        document.title = title;

        // 4. 渲染 Markdown 为 HTML
        const htmlContent = marked.parse(content);

        // 5. 注入 HTML
        // 使用了新的 CSS 类名结构：article-header 和 markdown-content
        container.innerHTML = `
            <div class="article-header" data-aos="fade-down">
                <h1>${title}</h1>
                <div class="article-meta">
                    <span>发布于 ${date}</span>
                </div>
            </div>
            
            <div class="markdown-content" data-aos="fade-up" data-aos-delay="200">
                ${htmlContent}
            </div>
        `;

        // 6. 启用代码高亮
        if(typeof hljs !== 'undefined') {
            hljs.highlightAll();
        }

    } catch (err) {
        console.error(err);
        container.innerHTML = `
            <div style="text-align:center; margin-top:100px;">
                <h2 style="color:#ff4444; margin-bottom:20px;">载入失败</h2>
                <p style="color:#888;">无法读取文章内容：${err.message}</p>
                <br>
                <a href="index.html" style="color:var(--primary); border-bottom:1px solid var(--primary);">点击返回主页</a>
            </div>
        `;
    }
}


if(document.getElementById('postList')) {
    loadPosts();
}
