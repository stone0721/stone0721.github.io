// 鼠标光斑跟随
document.addEventListener('mousemove', e => {
    const cursor = document.querySelector('.cursor');
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
});

// 粒子背景（更梦幻）
particlesJS('particles-js', {
    particles: {
        number: { value: 80 },
        color: { value: ['#4fc3f7', '#ff9a9e', '#a18cd1', '#fad0c4'] },
        shape: { type: ['circle', 'triangle', 'star'] },
        opacity: { value: 0.8, random: true },
        size: { value: 5, random: true },
        line_linked: { enable: true, distance: 150, color: '#4fc3f7', opacity: 0.4, width: 1 },
        move: { enable: true, speed: 3, direction: 'none', random: false }
    },
    interactivity: {
        events: {
            onhover: { enable: true, mode: 'repulse' },
            onclick: { enable: true, mode: 'push' }
        }
    },
    retina_detect: true
});

// 加载动画
window.addEventListener('load', () => {
    setTimeout(() => {
        document.getElementById('preloader').style.opacity = '0';
        setTimeout(() => document.getElementById('preloader').remove(), 1000);
    }, 1500);
    AOS.init({ duration: 1200, easing: 'ease-out-cubic', once: true });
});

// 打字效果
const typing = document.querySelector('.typing');
if (typing) {
    const text = typing.innerText;
    typing.innerText = '';
    let i = 0;
    const timer = setInterval(() => {
        typing.innerText += text[i];
        if (++i === text.length) clearInterval(timer);
    }, 100);
}

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