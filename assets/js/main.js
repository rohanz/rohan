// Global variables
let currentPreviewAudio = null;
let previewTimeout = null;
let currentOpenProject = null;
let testimonialInterval;

// Load music from Google Sheets
function loadMusic() {
    const SHEET_ID = '1et5adrpulwSRzli18GykZl8XCPwB81_LLfskspjhSLo';
    const MUSIC_SHEET_NAME = 'music';
    
    const SHEETS_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&tq=SELECT%20*&sheet=${MUSIC_SHEET_NAME}`;
    const PROXY_URL = 'https://api.allorigins.win/get?url=';
    const FULL_URL = PROXY_URL + encodeURIComponent(SHEETS_URL);
    
    console.log('🔍 Fetching music from sheet:', MUSIC_SHEET_NAME);
    
    fetch(FULL_URL)
        .then(response => response.json())
        .then(data => {
            console.log('✅ Music API response received');
            const jsonpText = data.contents;
            
            const jsonStart = jsonpText.indexOf('(') + 1;
            const jsonEnd = jsonpText.lastIndexOf(')');
            const jsonString = jsonpText.substring(jsonStart, jsonEnd);
            const sheetsData = JSON.parse(jsonString);
            
            console.log('🔍 Parsed sheets data for music:', sheetsData);
            
            const musicTracks = parseMusicData(sheetsData);
            console.log('🎵 Parsed music tracks:', musicTracks);
            displayMusic(musicTracks);
        })
        .catch(error => {
            console.error('❌ Error loading music:', error);
            showMusicErrorMessage();
        });
}

// Parse music data from Google Sheets
function parseMusicData(data) {
    const tracks = [];
    
    if (!data.table || !data.table.rows) {
        return tracks;
    }
    
    const rows = data.table.rows;
    
    // Expected columns: Title, Artist, Spotify, YouTube, Apple Music, Summary, Video URL
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.c && row.c.length >= 1) {
            const track = {
                title: row.c[0] ? (row.c[0].v || '').toString().trim() : '',
                artist: row.c[1] ? (row.c[1].v || '').toString().trim() : '',
                spotifyUrl: row.c[2] ? (row.c[2].v || '').toString().trim() : '',
                youtubeUrl: row.c[3] ? (row.c[3].v || '').toString().trim() : '',
                appleMusicUrl: row.c[4] ? (row.c[4].v || '').toString().trim() : '',
                summary: row.c[5] ? (row.c[5].v || '').toString().trim() : '',
                videoUrl: row.c[6] ? (row.c[6].v || '').toString().trim() : ''
            };
            
            if (track.title && track.title.trim()) {
                tracks.push(track);
            }
        }
    }
    
    return tracks;
}

// Display music
function displayMusic(tracks) {
    const musicList = document.querySelector('.music-list');
    
    if (tracks.length === 0) {
        musicList.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No music found. Add some tracks to your Google Sheet!</div>';
        return;
    }

    let musicHTML = '';
    
    tracks.forEach((track, index) => {
        const links = [];
        if (track.spotifyUrl) {
            links.push(`<a href="${track.spotifyUrl}" class="music-link" target="_blank">
                <i class="fab fa-spotify"></i> Spotify
            </a>`);
        }
        if (track.appleMusicUrl) {
            links.push(`<a href="${track.appleMusicUrl}" class="music-link" target="_blank">
                <i class="fab fa-apple"></i> Apple Music
            </a>`);
        }
        if (track.youtubeUrl) {
            links.push(`<a href="${track.youtubeUrl}" class="music-link" target="_blank">
                <i class="fab fa-youtube"></i> YouTube
            </a>`);
        }

        musicHTML += `
            <div class="music-item">
                <div class="music-content">
                    <div class="music-header">
                        <h3 class="music-title">${track.title}</h3>
                        ${track.artist ? `<p class="music-artist">${track.artist}</p>` : ''}
                        ${track.summary ? `<p class="music-summary">${track.summary}</p>` : ''}
                    </div>
                    ${links.length > 0 ? `
                        <div class="music-links">
                            ${links.join('')}
                        </div>
                    ` : ''}
                </div>
                ${track.videoUrl ? `
                    <video class="music-preview"
                           src="${track.videoUrl}"
                           muted loop preload="metadata">
                    </video>
                ` : ''}
            </div>
        `;

        if (index < tracks.length - 1) {
            musicHTML += '<div class="music-divider"></div>';
        }
    });

    musicHTML += '<div class="music-divider"></div>';
    musicList.innerHTML = musicHTML;
    
    document.querySelectorAll('.music-item').forEach(item => {
        const video = item.querySelector('.music-preview');
        if (video) {
            item.addEventListener('mouseenter', () => {
                video.play().catch(() => {});
            });
            item.addEventListener('mouseleave', () => {
                video.pause();
                video.currentTime = 0;
            });
        }
    });
}

function showMusicErrorMessage() {
    const musicList = document.querySelector('.music-list');
    musicList.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
            <p>Unable to load music from Google Sheets.</p>
            <p style="font-size: 0.9em; margin-top: 0.5rem;">Make sure your Google Sheet is published to the web</p>
        </div>`;
}

// Simple front-matter parser using js-yaml
function parseFrontMatter(text) {
  if (!text.startsWith('---')) {
    return { data: {}, content: text };
  }
  const fmEndMarker = '\n---';
  const fmEndIndex = text.indexOf(fmEndMarker, 3);
  if (fmEndIndex === -1) {
    return { data: {}, content: text };
  }
  const fmText = text.slice(3, fmEndIndex).trim();
  const content = text.slice(fmEndIndex + fmEndMarker.length).trimStart();
  let data = {};
  try {
    data = jsyaml.load(fmText) || {};
  } catch (e) {
    console.error('Error parsing front matter:', e);
  }
  return { data, content };
}

// Load projects from Markdown files
function loadProjects() {
    fetch('/projects/index.json')
        .then(res => res.json())
        .then(files => Promise.all(files.map(file => fetch(`/projects/${file}`).then(r => r.text()))))
        .then(markdownContents => {
            const projects = markdownContents.map(text => {
                const { data, content } = parseFrontMatter(text);
                return {
                    title: data.title || '',
                    summary: data.summary || '',
                    image: data.image || '',
                    technologies: data.technologies || '',
                    descriptionHTML: marked.parse ? marked.parse(content) : marked(content)
                };
            });
            displayProjects(projects);
        })
        .catch(error => {
            console.error('❌ Error loading projects:', error);
            showErrorMessage();
        });
}

// Display projects parsed from Markdown
function displayProjects(projects) {
    const projectsList = document.querySelector('.projects-list');
    if (projects.length === 0) {
        projectsList.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No projects found.</div>';
        return;
    }

    let projectsHTML = '';
    projects.forEach((project, index) => {
        const projectId = `project${index}`;
        const imageUrl = project.image || `https://placehold.co/800x400/6D4C41/FFF8E1?text=${encodeURIComponent(project.title)}`;
        
        // Simplified HTML structure for the new grid layout
        projectsHTML += `
            <div class="project-item" id="${projectId}" onclick="toggleProject('${projectId}')">
                <h3 class="project-title">${project.title}</h3>
                ${project.summary ? `<p class="project-summary">${project.summary}</p>` : ''}
                
                <div class="project-details-inline">
                    <img src="${imageUrl}" alt="${project.title}" class="project-image">
                    <div class="project-description">
                        ${project.descriptionHTML}
                        ${project.technologies ? `<div class="project-technologies" style="margin-top: 2rem;"><strong>Technologies:</strong> ${project.technologies}</div>` : ''}
                    </div>
                </div>
            </div>
            <div class="project-divider"></div>
        `;
    });
    
    projectsList.innerHTML = projectsHTML;
}

function showErrorMessage() {
    document.querySelector('.projects-list').innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
            <p>Unable to load projects.</p>
        </div>`;
}

// Load testimonials
function loadTestimonials() {
    console.log('🎯 Loading testimonials from Google Sheets...');
    const SHEET_ID = '1et5adrpulwSRzli18GykZl8XCPwB81_LLfskspjhSLo';
    const QUOTES_GID = '404494035';
    
    const SHEETS_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&tq=SELECT%20*&gid=${QUOTES_GID}`;
    const PROXY_URL = 'https://api.allorigins.win/get?url=';
    const FULL_URL = PROXY_URL + encodeURIComponent(SHEETS_URL);
    
    fetch(FULL_URL)
        .then(response => response.json())
        .then(data => {
            console.log('✅ Testimonials API response received');
            const jsonpText = data.contents;
            
            const jsonStart = jsonpText.indexOf('(') + 1;
            const jsonEnd = jsonpText.lastIndexOf(')');
            const jsonString = jsonpText.substring(jsonStart, jsonEnd);
            const sheetsData = JSON.parse(jsonString);
            
            const testimonials = parseTestimonialsData(sheetsData);
            console.log('📝 Parsed testimonials:', testimonials);
            displayTestimonials(testimonials);
        })
        .catch(error => {
            console.error('❌ Error loading testimonials:', error);
        });
}

// Parse testimonials data
function parseTestimonialsData(data) {
    const testimonials = [];
    
    if (!data.table || !data.table.rows) {
        return testimonials;
    }
    
    const rows = data.table.rows;
    
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.c && row.c.length >= 1) {
            const testimonial = {
                quote: row.c[0] ? (row.c[0].v || '').toString() : '',
                author: row.c[1] ? (row.c[1].v || '').toString() : '',
                title: row.c[2] ? (row.c[2].v || '').toString() : ''
            };
            
            if (testimonial.quote && testimonial.author) {
                testimonials.push(testimonial);
            }
        }
    }
    
    return testimonials;
}

// Display testimonials
function displayTestimonials(testimonials) {
    const container = document.querySelector('.testimonials-scroll-container');
    if (!container) return;
    
    if (testimonials.length === 0) {
        container.innerHTML = '<div class="scroll-testimonial"><div class="scroll-quote">No testimonials found. Add some to your Google Sheet!</div><div class="scroll-author">— System</div></div>';
        return;
    }
    
    let testimonialsHTML = '';
    
    const copiesPerSet = 8;
    const totalTestimonials = copiesPerSet * testimonials.length * 2;
    
    const speedPerTestimonial = 4;
    const totalDuration = totalTestimonials * speedPerTestimonial;
    
    // First set
    for (let copy = 0; copy < copiesPerSet; copy++) {
        testimonials.forEach(testimonial => {
            const authorText = testimonial.title ? 
                `— ${testimonial.author}, ${testimonial.title}` : 
                `— ${testimonial.author}`;
            
            testimonialsHTML += `
                <div class="scroll-testimonial">
                    <div class="scroll-quote">"${testimonial.quote}"</div>
                    <div class="scroll-author">${authorText}</div>
                </div>
            `;
        });
    }
    
    // Second set
    for (let copy = 0; copy < copiesPerSet; copy++) {
        testimonials.forEach(testimonial => {
            const authorText = testimonial.title ? 
                `— ${testimonial.author}, ${testimonial.title}` : 
                `— ${testimonial.author}`;
            
            testimonialsHTML += `
                <div class="scroll-testimonial">
                    <div class="scroll-quote">"${testimonial.quote}"</div>
                    <div class="scroll-author">${authorText}</div>
                </div>
            `;
        });
    }
    
    container.innerHTML = testimonialsHTML;
    container.style.animationDuration = `${totalDuration}s`;
}

// Animation sequence function with logo integration
function triggerHomepageAnimation() {
    const name = document.querySelector('.homepage-name');
    const shadow = document.querySelector('.homepage-name-shadow');
    const menu = document.querySelector('.homepage-menu');
    const logo = document.querySelector('.homepage-logo');
    
    name.classList.remove('animate');
    shadow.classList.remove('animate');
    menu.classList.remove('animate');
    logo.classList.remove('animate', 'fade-to-amber');
    
    name.style.opacity = '0';
    name.style.transform = 'translateY(10px)';
    shadow.style.opacity = '0';
    shadow.style.visibility = 'hidden';
    menu.style.opacity = '0';
    menu.style.transform = 'translateY(10px)';
    logo.style.opacity = '0';
    logo.style.transform = 'translateY(10px)';
    
    name.offsetHeight;
    shadow.offsetHeight;
    menu.offsetHeight;
    logo.offsetHeight;
    
    setTimeout(() => {
        name.style.opacity = '';
        name.style.transform = '';
        menu.style.opacity = '';
        menu.style.transform = '';
        logo.style.opacity = '';
        logo.style.transform = '';
        
        setTimeout(() => {
            name.classList.add('animate');
            logo.classList.add('animate');
        }, 300);
        
        setTimeout(() => {
            menu.classList.add('animate');
        }, 700);
        
        setTimeout(() => {
            shadow.style.opacity = '';
            shadow.style.visibility = '';
            shadow.classList.add('animate');
            logo.classList.add('fade-to-amber');
        }, 1100);
    }, 100);
}

// Go back to homepage
function goToHomepage() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    const homepage = document.getElementById('homepage');
    const shadow = document.querySelector('.homepage-name-shadow');
    const name = document.querySelector('.homepage-name');
    const menu = document.querySelector('.homepage-menu');
    const logo = document.querySelector('.homepage-logo');
    
    name.style.transition = 'none';
    shadow.style.transition = 'none';
    menu.style.transition = 'none';
    logo.style.transition = 'none';
    
    name.classList.remove('animate');
    shadow.classList.remove('animate');
    menu.classList.remove('animate');
    logo.classList.remove('animate', 'fade-to-amber');
    
    name.style.opacity = '0';
    name.style.transform = 'translateY(10px)';
    shadow.style.opacity = '0';
    shadow.style.visibility = 'hidden';
    menu.style.opacity = '0';
    menu.style.transform = 'translateY(10px)';
    logo.style.opacity = '0';
    logo.style.transform = 'translateY(10px)';
    
    name.offsetHeight;
    shadow.offsetHeight;
    menu.offsetHeight;
    logo.offsetHeight;
    
    setTimeout(() => {
        name.style.transition = '';
        shadow.style.transition = '';
        menu.style.transition = '';
        logo.style.transition = '';
    }, 50);
    
    sidebar.classList.remove('show');
    mainContent.classList.add('homepage-active');
    mainContent.classList.remove('nav-visible');
    homepage.classList.remove('nav-visible');
    
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
    
    homepage.classList.add('active');
    
    setTimeout(() => {
        triggerHomepageAnimation();
    }, 100);
    
    hideProject();
    updateFloatingContactVisibility();
}

// Show section
function showSection(sectionName) {
    const homepage = document.getElementById('homepage');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    
    homepage.classList.remove('active');
    sidebar.classList.add('show');
    mainContent.classList.remove('homepage-active');
    
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    
    const activeLink = document.querySelector(`[data-section="${sectionName}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
    
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    const targetSection = document.getElementById(sectionName);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    hideProject();
    updateFloatingContactVisibility();
    
    if (sectionName === 'about') {
        loadTestimonials();
        setTimeout(startTestimonialTracking, 800);
    } else if (sectionName === 'projects') {
        loadProjects();
        stopTestimonialTracking();
    } else if (sectionName === 'music') {
        loadMusic();
        stopTestimonialTracking();
    } else {
        stopTestimonialTracking();
    }
}

// Project toggle functionality
function toggleProject(projectId) {
    const projectItem = document.getElementById(projectId);
    if (!projectItem) return;

    const details = projectItem.querySelector('.project-details-inline');

    // If another project is open, close it first.
    if (currentOpenProject && currentOpenProject !== projectId) {
        const lastOpenProject = document.getElementById(currentOpenProject);
        if(lastOpenProject) {
            lastOpenProject.classList.remove('open');
            const lastOpenDetails = lastOpenProject.querySelector('.project-details-inline');
            lastOpenDetails.style.maxHeight = '0';
        }
    }

    // Toggle the clicked project
    if (projectItem.classList.contains('open')) {
        // Close it
        projectItem.classList.remove('open');
        details.style.maxHeight = '0';
        currentOpenProject = null;
    } else {
        // Open it
        projectItem.classList.add('open');
        details.style.maxHeight = details.scrollHeight + "px";
        currentOpenProject = projectId;
    }
}

function hideProject() {
    if (currentOpenProject) {
        toggleProject(currentOpenProject); // Use the toggle function to properly close it
    }
}

// Floating contact functionality
function updateFloatingContactVisibility() {
    const homepage = document.getElementById('homepage');
    const floatingContact = document.getElementById('floatingContact');
    const isHomepage = homepage.classList.contains('active');
    
    if (isHomepage) {
        floatingContact.classList.add('homepage-active');
    } else {
        floatingContact.classList.remove('homepage-active');
        setTimeout(() => {
            floatingContact.classList.add('show');
        }, 300);
    }
}

// Testimonial tracking
function updateCenterTestimonial() {
    const scrollingSection = document.querySelector('.scrolling-testimonials');
    const testimonials = document.querySelectorAll('.scroll-testimonial');
    
    if (!scrollingSection || testimonials.length === 0) return;
    
    const sectionRect = scrollingSection.getBoundingClientRect();
    const centerY = sectionRect.top + (sectionRect.height * 0.3);

    let closestTestimonial = null;
    let closestDistance = Infinity;

    testimonials.forEach(testimonial => {
        testimonial.classList.remove('center');
        const rect = testimonial.getBoundingClientRect();
        const testimonialCenterY = rect.top + rect.height / 2;
        const distance = Math.abs(centerY - testimonialCenterY);

        if (rect.bottom > sectionRect.top && rect.top < sectionRect.bottom) {
            if (distance < closestDistance) {
                closestDistance = distance;
                closestTestimonial = testimonial;
            }
        }
    });

    if (closestTestimonial) {
        closestTestimonial.classList.add('center');
        if (!closestTestimonial.hasAttribute('data-logged')) {
            console.log('Center testimonial:', closestTestimonial.querySelector('.scroll-quote').textContent.substring(0, 30) + '...');
            testimonials.forEach(t => t.removeAttribute('data-logged'));
            closestTestimonial.setAttribute('data-logged', 'true');
        }
    }
}

function startTestimonialTracking() {
    if (testimonialInterval) clearInterval(testimonialInterval);
    testimonialInterval = setInterval(updateCenterTestimonial, 100);
    setTimeout(updateCenterTestimonial, 100);
}

function stopTestimonialTracking() {
    if (testimonialInterval) {
        clearInterval(testimonialInterval);
        testimonialInterval = null;
    }
    document.querySelectorAll('.scroll-testimonial').forEach(t => t.classList.remove('center'));
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Handle homepage menu clicks
    document.querySelectorAll('.homepage-menu-item').forEach(item => {
        item.addEventListener('click', function(e) {
            const section = this.getAttribute('data-section');
            showSection(section);
        });
    });

    // Handle sidebar navigation clicks  
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            const section = this.getAttribute('data-section');
            showSection(section);
        });
    });

    // Load projects and trigger animation
    loadProjects();
    setTimeout(() => {
        triggerHomepageAnimation();
    }, 500);
});e