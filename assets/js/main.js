// 你最喜欢的粒子动画（白色经典版）
particlesJS('particles-js', {
    particles: {
        number: { value: 80, density: { enable: true, value_area: 800 } },
        color: { value: '#ffffff' },
        shape: { type: 'circle' },
        opacity: { value: 0.5, random: false },
        size: { value: 3, random: true },
        line_linked: { enable: true, distance: 150, color: '#ffffff', opacity: 0.4, width: 1 },
        move: { enable: true, speed: 6, direction: 'none', random: false, straight: false, out_mode: 'out' }
    },
    interactivity: {
        detect_on: 'canvas',
        events: { 
            onhover: { enable: true, mode: 'repulse' }, 
            onclick: { enable: true, mode: 'push' }, 
            resize: true 
        },
        modes: { 
            repulse: { distance: 100, duration: 0.4 }, 
            push: { particles_nb: 4 } 
        }
    },
    retina_detect: true
});

// 加载动画
window.addEventListener('load', () => {
    const preloader = document.getElementById('preloader');
    setTimeout(() => {
        preloader.style.opacity = '0';
        setTimeout(() => preloader.style.display = 'none', 1000);
    }, 800);
    AOS.init({ duration: 1200, once: true });
});

// 动态加载文章
async function loadPosts() {
    const postList = document.querySelector('.post-list');
    const postFiles = ['welcome.md']; // 在这里添加你的 md 文件名

    for (let file of postFiles) {
        try {
            const res = await fetch(`posts/${file}`);
            const md = await res.text();
            
            const title = md.match(/^#\s+(.+)/)?.[1] || file.replace('.md','');
            const date = md.match(/<!--\s*(.+?)\s*-->/)?.[1] || '2025';
            const preview = marked.parse(md.split('---')[0] || md).replace(/<[^>]+>/g, '').slice(0, 120) + '...';

            const div = document.createElement('div');
            div.className = 'post-preview';
            div.setAttribute('data-aos', 'fade-up');
            div.innerHTML = `<small>${date}</small><h3>${title}</h3><p>${preview}</p>`;
            div.onclick = () => {
                document.body.style.opacity = 0;
                setTimeout(() => location.href = `posts/${file.replace('.md','.html')}`, 400);
            };
            postList.appendChild(div);
        } catch(e) { console.log('加载失败:', file); }
    }
}
loadPosts();