// 你最喜欢的白色粒子动画
particlesJS('particles-js', {
    particles: {
        number: { value: 80, density: { enable: true, value_area: 800 } },
        color: { value: '#ffffff' },
        shape: { type: 'circle' },
        opacity: { value: 0.5, random: false },
        size: { value: 3, random: true },
        line_linked: { enable: true, distance: 150, color: '#ffffff', opacity: 0.4, width: 1 },
        move: { enable: true, speed: 6, direction: 'none', random: false, straight: false, out_mode: 'out', bounce: false }
    },
    interactivity: {
        detect_on: 'canvas',
        events: { onhover: { enable: true, mode: 'repulse' }, onclick: { enable: true, mode: 'push' }, resize: true },
        modes: { repulse: { distance: 100, duration: 0.4 }, push: { particles_nb: 4 } }
    },
    retina_detect: true
});

// 预加载消失
window.addEventListener('load', () => {
    const preloader = document.getElementById('preloader');
    setTimeout(() => {
        preloader.style.opacity = '0';
        setTimeout(() => preloader.style.display = 'none', 800);
    }, 600);
    AOS.init({ duration: 1200, once: true });
});

// 加载文章
const postFiles = ['welcome.md'];

async function loadPosts() {
    const container = document.querySelector('.post-list');
    for (const file of postFiles) {
        try {
            const resp = await fetch(`posts/${file}`);
            const md = await resp.text();
            const title = md.match(/^#\s+(.*)/)?.[1] || file.replace('.md','');
            const date = md.match(/<!--\s*(.*?)\s*-->/)?.[1] || '2025';
            const preview = marked.parse(md.split('---')[0] || md).replace(/<[^>]*>/g, '').slice(0, 130) + '...';

            const card = document.createElement('div');
            card.className = 'post-preview';
            card.setAttribute('data-aos', 'fade-up');
            card.innerHTML = `<small>${date}</small><h3>${title}</h3><p>${preview}</p>`;
            card.onclick = () => {
                document.body.style.opacity = 0;
                setTimeout(() => location.href = `posts/${file.replace('.md','.html')}`, 400);
            };
            container.appendChild(card);
        } catch (e) { console.error('加载失败:', file); }
    }
}
loadPosts();