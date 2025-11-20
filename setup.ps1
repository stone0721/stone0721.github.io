# setup-project.ps1
# Create directories
New-Item -ItemType Directory -Path assets\css -Force
New-Item -ItemType Directory -Path assets\js -Force
New-Item -ItemType Directory -Path assets\img -Force
New-Item -ItemType Directory -Path posts -Force

# Create essential files (we'll fill them later)
New-Item -Path index.html -ItemType File -Force
New-Item -Path assets\css\styles.css -ItemType File -Force
New-Item -Path assets\js\script.js -ItemType File -Force
New-Item -Path README.md -ItemType File -Force  # If not already there

# Add a sample post (Markdown for blog articles)
New-Item -Path posts\welcome.md -ItemType File -Force

Write-Output "Project structure created successfully!"