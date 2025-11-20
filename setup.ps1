New-Item -ItemType Directory -Path assets\css, assets\js, assets\img, posts -Force

New-Item -Path index.html, about.html -ItemType File -Force
New-Item -Path assets\css\style.css -ItemType File -Force
New-Item -Path assets\js\main.js -ItemType File -Force
New-Item -Path posts\welcome.md -ItemType File -Force