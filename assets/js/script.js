// Initialize Particles
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
        modes: { repulse: { distance: 200, duration: 0.4 }, push: { particles_nb: 4 } }
    },
    retina_detect: true
});

// Preloader
window.addEventListener('load', () => {
    const preloader = document.getElementById('preloader');
    preloader.style.opacity = 0;
    setTimeout(() => { preloader.style.display = 'none'; }, 500);
});

// Initialize AOS
AOS.init({ duration: 1200, once: true });

// Dynamic Post Loading (example: fetch Markdown files)
async function loadPosts() {
    const postList = document.querySelector('.post-list');
    // Assume posts are in /posts/*.md – list them manually or use fetch if server allows directory listing (GitHub Pages doesn't, so hardcode for now)
    const postFiles = ['welcome.md']; // Add more as you create posts

    for (let file of postFiles) {
        const response = await fetch(`posts/${file}`);
        const mdText = await response.text();
        const html = marked.parse(mdText);
        
        const preview = document.createElement('div');
        preview.classList.add('post-preview');
        preview.innerHTML = `<h3>${file.replace('.md', '')}</h3><p>${html.substring(0, 100)}...</p>`;
        preview.addEventListener('click', () => {
            // Smooth transition to full post
            document.body.style.opacity = 0;
            setTimeout(() => {
                window.location.href = `posts/${file.replace('.md', '.html')}`; // Or render in-place
            }, 300);
        });
        postList.appendChild(preview);
    }
}

loadPosts();