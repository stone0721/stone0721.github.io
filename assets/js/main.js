// 粒子背景（梦幻中文配色）
particlesJS('particles-js', {
    particles: {
        number: { value: 100 },
        color: { value: ['#4fc3f7', '#ff9a9e', '#fad0c4', '#a18cd1'] },
        shape: { type: 'circle' },
        opacity: { value: 0.6, random: true },
        size: { value: 4, random: true },
        line_linked: { enable: true, distance: 140, color: '#ffffff', opacity: 0.3, width: 1 },
        move: { enable: true, speed: 4 }
    },
    interactivity: {
        events: { onhover: { enable: true, mode: 'repulse' }, onclick: { enable: true, mode: 'push' } }
    },
    retina_detect: true
});

// 加载完成动画
window.addEventListener('load', () => {
    const preloader = document.getElementById('preloader');
    preloader.style.opacity = '0';
    setTimeout(() => preloader.remove(), 800);
});

// AOS 初始化
AOS.init({ duration: 1000, once: true });

// 自动加载文章（只需在 posts 文件夹放 .md 文件并在这里添加文件名即可）
const postFiles = [
    'welcome.md',
    // '第二篇文章.md',
    // '2025-总结.md'
];

async function loadPosts() {
    const container = document.getElementById('post-container');
    
    for (const file of postFiles) {
        try {
            const resp = await fetch(`posts/${file}`);
            const md = await resp.text();
            
            // 提取标题（第一行 # 标题）和日期（第二行 <!-- 2025-11-20 -->）
            const title = md.match(/^#\s+(.*)/)?.[1] || file.replace('.md','');
            const dateMatch = md.match(/<!--\s*(.*?)\s*-->/);
            const date = dateMatch ? dateMatch[1] : new Date().toLocaleDateString('zh-CN');
            const preview = marked.parse(md.split('---')[0] || md).replace(/<[^>]*>/g, '').slice(0, 120) + '...';

            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <div class="date">${date}</div>
                <h3>${title}</h3>
                <p>${preview}</p>
            `;
            card.onclick = () => {
                document.body.style.opacity = 0;
                setTimeout(() => location.href = `posts/${file.replace('.md','.html')}`, 300);
            };
            container.appendChild(card);
        } catch (e) { console.log('加载文章失败:', file); }
    }
}

loadPosts();