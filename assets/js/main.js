// 鼠标特效
document.addEventListener('mousemove', e => {
    document.querySelector('.cursor').style.left = e.clientX + 'px';
    document.querySelector('.cursor').style.top = e.clientY + 'px';
    document.querySelector('.cursor-follower').style.left = e.clientX + 'px';
    document.querySelector('.cursor-follower').style.top = e.clientY + 'px';
});

// 粒子背景超梦幻
particlesJS('particles-js', {
    particles: {
        number: { value: 120 },
        color: { value: ['#4fc3f7', '#ff9a9e', '#a18cd1', '#fad0c4'] },
        shape: { type: ['circle', 'triangle'] },
        opacity: { value: 0.8, random: true },
        size: { value: 4, random: true },
        line_linked: { enable: true, distance: 120, color: '#4fc3f7', opacity: 0.3, width: 1 },
        move: { enable: true, speed: 2 }
    },
    interactivity: {
        events: { onhover: { enable: true, mode: 'repulse' }, onclick: { enable: true, mode: 'push' } }
    }
});

// 加载消失
window.addEventListener('load', () => {
    setTimeout(() => {
        document.getElementById('preloader').style.opacity = '0';
        setTimeout(() => document.getElementById('preloader').remove(), 1000);
    }, 2000);
    AOS.init({ duration: 1200, once: true });
});

// 打字机效果（彩虹色）
const text = "用代码点亮梦想 < / >";
const typingEl = document.querySelector('.typing-text');
let i = 0;
const timer = setInterval(() => {
    typingEl.innerHTML += text[i] === ' ' ? '&nbsp;' : text[i];
    i++;
    if (i === text.length) clearInterval(timer);
}, 100);

// 文章加载保持你原来的逻辑...

// 文章加载 + 3D卡片
const postFiles = ['welcome.md'];
async function loadPosts() {
    const container = document.getElementById('post-container');
    for (const file of postFiles) {
        try {
            const resp = await fetch(`posts/${file}`);
            const md = await resp.text();
            const title = md.match(/^#\s+(.*)/)?.[1] || file.replace('.md','');
            const date = md.match(/<!--\s*(.*?)\s*-->/)?.[1] || new Date().toLocaleDateString('zh-CN');
            const preview = marked.parse(md.split('---')[0] || md).replace(/<[^>]*>/g, '').slice(0, 150) + '...';

            const card = document.createElement('div');
            card.className = 'card';
            card.setAttribute('data-aos', 'flip-up');
            card.innerHTML = `
                <div class="card-inner">
                    <div class="card-front">
                        <div class="date">${date}</div>
                        <h3>${title}</h3>
                        <p>${preview}</p>
                        <br><br><small>点击查看全文 →</small>
                    </div>
                    <div class="card-back">
                        <h3>${title}</h3>
                        <p>点我进入文章<br><i class="fas fa-arrow-right" style="font-size:2rem;margin-top:20px;"></i></p>
                    </div>
                </div>
            `;
            card.onclick = () => {
                document.body.style.transform = 'scale(0.95)';
                setTimeout(() => location.href = `posts/${file.replace('.md','.html')}`, 300);
            };
            container.appendChild(card);
        } catch(e) { console.log(e); }
    }
}
loadPosts();