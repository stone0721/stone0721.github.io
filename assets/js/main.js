// 粒子背景（梦幻配色）
particlesJS('particles-js', {
    particles: {
        number: { value: 100 },
        color: { value: ['#4fc3f7', '#ff9a9e', '#fad0c4', '#a18cd1'] },
        shape: { type: 'circle' },
        opacity: { value: 0.6, random: true },
        size: { value: 4, random: true },
        line_linked: { enable: true, distance: 140, color: '#ffffff', opacity: 0.3, width: 1 },
        move: { enable: true, speed: 3 }
    },
    interactivity: {
        events: { onhover: { enable: true, mode: 'repulse' }, onclick: { enable: true, mode: 'push' } }
    },
    retina_detect: true
});

// 预加载消失
window.addEventListener('load', () => {
    const preloader = document.getElementById('preloader');
    preloader.style.opacity = '0';
    setTimeout(() => preloader.remove(), 800);
});

// AOS
AOS.init({ duration: 1000, once: true });

// 加载文章（保持你原来的逻辑）
const postFiles = ['welcome.md' /* 加你的文章 */];

async function loadPosts() {
    const container = document.getElementById('post-container');
    for (const file of postFiles) {
        try {
            const resp = await fetch(`posts/${file}`);
            const md = await resp.text();
            const title = md.match(/^#\s+(.*)/)?.[1] || file.replace('.md','');
            const dateMatch = md.match(/<!--\s*(.*?)\s*-->/);
            const date = dateMatch ? dateMatch[1] : new Date().toLocaleDateString('zh-CN');
            const preview = marked.parse(md.split('---')[0] || md).replace(/<[^>]*>/g, '').slice(0, 120) + '...';

            const card = document.createElement('div');
            card.className = 'card';
            card.setAttribute('data-aos', 'fade-up');
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