// Global variables

let audioPlayer = null;
let audioContext = null;
let testimonialInterval;

// Dynamically update mobile nav height CSS variable
function updateMobileNavHeight() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar && window.innerWidth <= 768) {
        const height = sidebar.offsetHeight;
        document.documentElement.style.setProperty('--mobile-nav-height', height + 'px');
    }
}

// Update on resize (debounced)
let resizeTimeout;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(updateMobileNavHeight, 100);
});

// --- NEW: Local Music Data ---
// All music data is now managed here. Edit or add new objects to this array.
const musicData = [
    {
        title: "call me back",
        artist: "rohan.jk and kairi",
        summary: "feng kai and i tried writing a fun indie pop song with groovy bass and an upbeat tempo",
        spotifyUrl: "https://open.spotify.com/track/3m1PQRxlKQh1tzxFP1C0ZY?si=642929c16c284e61", // Replace with your actual Spotify link
        youtubeUrl: "https://www.youtube.com/watch?v=iXYprE6T5ec", // Replace with your actual YouTube link
        appleMusicUrl: "https://music.apple.com/sg/album/call-me-back/1756849369?i=1756849370", // Replace with your actual Apple Music link
        videoUrl: "assets/video/callmeback_profile.mp4", // IMPORTANT: Update this path
        audioSnippetUrl: "assets/audio/snippets/callmeback.wav", // The local audio filename
        audioDelay: 350
    },
    {
        title: "where have u been?",
        artist: "rohan.jk, tristan and hannah",
        summary: "chill rnb/pop song with a smooth feel",
        spotifyUrl: "https://open.spotify.com/track/0CqWJMqXpq2CqtyCfPWigj?si=0ad5ddf4f7c449ee", // Replace with your actual Spotify link
        youtubeUrl: "https://www.youtube.com/watch?v=XUDQDO6qpQA", // Replace with your actual YouTube link
        appleMusicUrl: "https://music.apple.com/sg/album/where-have-u-been-feat-trxstan-hannah-single/1727956658", // Replace with your actual Apple Music link
        videoUrl: "assets/video/wherehaveubeen_profile.mp4", // IMPORTANT: Update this path
        audioSnippetUrl: "assets/audio/snippets/wherehaveubeen.wav", // The local audio filename
        audioDelay: 100
    }
];

// --- NEW: Function to display music from the local `musicData` array ---
function initializeMusicSection() {
    displayMusic(musicData);
}


function displayMusic(tracks) {
    const musicList = document.querySelector('.music-list');
    if (!musicList) {
        console.error('Music list container not found');
        return;
    }
    if (!tracks || tracks.length === 0) {
        musicList.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No music found.</div>';
        return;
    }

    // Clear the list before we begin
    musicList.innerHTML = '';

    // We will now create each item individually
    tracks.forEach((track, index) => {
        
        // This function contains all the logic to create and set up one item
        const createAndSetupItem = () => {
            const links = [];
            if (track.spotifyUrl && track.spotifyUrl !== "#") links.push(`<a href="${track.spotifyUrl}" class="music-link" target="_blank"><i class="fab fa-spotify"></i> Spotify</a>`);
            if (track.appleMusicUrl && track.appleMusicUrl !== "#") links.push(`<a href="${track.appleMusicUrl}" class="music-link" target="_blank"><i class="fab fa-apple"></i> Apple Music</a>`);
            if (track.youtubeUrl && track.youtubeUrl !== "#") links.push(`<a href="${track.youtubeUrl}" class="music-link" target="_blank"><i class="fab fa-youtube"></i> YouTube</a>`);

            const itemHTML = `
                <div class="music-item">
                    <div class="music-content">
                        <div class="music-header">
                            <h3 class="music-title">${track.title}</h3>
                            ${track.artist ? `<p class="music-artist">${track.artist}</p>` : ''}
                            ${track.summary ? `<p class="music-summary">${track.summary}</p>` : ''}
                        </div>
                        ${links.length > 0 ? `<div class="music-links">${links.join('')}</div>` : ''}
                    </div>
                    ${track.videoUrl ? `
                        <div class="music-preview-container" 
                            ${track.audioSnippetUrl ? `data-audio-url="${track.audioSnippetUrl}"` : ''} 
                            ${track.audioDelay ? `data-audio-delay="${track.audioDelay}"` : ''}>
                            <video class="music-preview" src="${track.videoUrl}" muted playsinline preload="auto"></video>
                            ${track.audioSnippetUrl ? `<p class="snippet-text"><i class="fas fa-volume-up"></i> click to play a snippet</p>` : ''}
                        </div>
                    ` : ''}
                </div>
                <div class="music-divider"></div>
            `;
            
            // Create the DOM nodes from the HTML string
            const tempContainer = document.createElement('div');
            tempContainer.innerHTML = itemHTML;
            const itemElement = tempContainer.firstElementChild;
            const dividerElement = tempContainer.lastElementChild;
            
            // Append the new elements to the actual list in the document
            musicList.appendChild(itemElement);
            musicList.appendChild(dividerElement);
            
            // --- Attach Event Listeners to the item we just created ---
            const video = itemElement.querySelector('.music-preview');
            if (video) {
                // Declare variables FIRST, before any event listeners
                let isPlaying = false;
                let audioInitialized = false;
                
                // Force the video to start loading with a small delay to ensure DOM is ready
                setTimeout(() => {
                    video.load();

                    // Handle video end - reset to beginning and pause
                    video.addEventListener('ended', () => {
                        // Only reset if we're currently playing
                        if (isPlaying) {
                            // Reset both video and audio to beginning
                            video.currentTime = 0;
                            
                            // Stop audio properly if it's playing
                            if (!audioPlayer.paused) {
                                audioPlayer.pause();
                            }
                            audioPlayer.currentTime = 0;
                            
                            // Reset ALL state so next click starts fresh
                            isPlaying = false;
                            audioInitialized = false; // Reset so next play starts from beginning
                            
                            // Update text back to "click to listen"
                            const snippetText = itemElement.querySelector('.snippet-text');
                            if (snippetText) {
                                snippetText.innerHTML = '<i class="fas fa-volume-up"></i> click to play a snippet';
                            }
                            
                            // Ensure video shows first frame
                            video.pause();
                        }
                    });
                }, 50);
                
                const handleMouseEnter = () => {
                    const snippetText = itemElement.querySelector('.snippet-text');
                    
                    // Check if video is ready before trying to show
                    if (video.readyState >= 2) {
                        video.style.opacity = '0.75';
                        if (snippetText) {
                            snippetText.style.opacity = '1';
                            snippetText.innerHTML = '<i class="fas fa-volume-up"></i> click to play a snippet';
                        }
                        // Show first frame but don't play
                        video.currentTime = 0;
                        isPlaying = false;
                    } else {
                        // If not ready, force load and wait
                        video.load();
                        const waitForLoad = () => {
                            if (video.readyState >= 2) {
                                video.style.opacity = '0.75';
                                if (snippetText) {
                                    snippetText.style.opacity = '1';
                                    snippetText.innerHTML = '<i class="fas fa-volume-up"></i> click to play a snippet';
                                }
                                video.currentTime = 0;
                                isPlaying = false;
                            } else {
                                // Keep checking every 100ms until ready
                                setTimeout(waitForLoad, 100);
                            }
                        };
                        waitForLoad();
                    }
                };
                
                const handleMouseLeave = () => {
                    const snippetText = itemElement.querySelector('.snippet-text');
                    
                    video.style.opacity = '0';
                    if (snippetText) snippetText.style.opacity = '0';
                    
                    // Stop both video and audio with fade out, reset to beginning
                    if (isPlaying && !audioPlayer.paused) {
                        fadeOut(audioPlayer, 150, true); // Pause after fade on mouse leave
                    } else {
                        audioPlayer.pause();
                    }
                    video.pause();
                    video.currentTime = 0;
                    audioInitialized = false; // Reset so it starts fresh next time
                    isPlaying = false;
                };
                
                // Attach click handler to the entire music item
                let clickTimeout = null;
                let fadeInterval = null;
                
                const fadeIn = (audio, targetVolume = 0.5, duration = 150) => {
                    if (fadeInterval) clearInterval(fadeInterval);
                    audio.volume = 0;
                    const steps = 30;
                    const stepTime = duration / steps;
                    const volumeStep = targetVolume / steps;
                    let currentStep = 0;
                    
                    fadeInterval = setInterval(() => {
                        currentStep++;
                        audio.volume = Math.min(volumeStep * currentStep, targetVolume);
                        if (currentStep >= steps) {
                            clearInterval(fadeInterval);
                            fadeInterval = null;
                        }
                    }, stepTime);
                };
                
                const fadeOut = (audio, duration = 200, shouldPause = true) => {
                    if (fadeInterval) clearInterval(fadeInterval);
                    const startVolume = audio.volume;
                    const steps = 20;
                    const stepTime = duration / steps;
                    const volumeStep = startVolume / steps;
                    let currentStep = 0;
                    
                    fadeInterval = setInterval(() => {
                        currentStep++;
                        audio.volume = Math.max(startVolume - (volumeStep * currentStep), 0);
                        if (currentStep >= steps) {
                            clearInterval(fadeInterval);
                            fadeInterval = null;
                            if (shouldPause) {
                                audio.pause();
                            }
                        }
                    }, stepTime);
                };
                
                const handleClick = function(event) {
                    // Debounce rapid clicks
                    if (clickTimeout) return;
                    clickTimeout = setTimeout(() => { clickTimeout = null; }, 200);
                    
                    // Check if we clicked on the preview container area
                    const previewContainer = event.target.closest('.music-preview-container');
                    if (!previewContainer) return;
                    
                    const audioPath = previewContainer.dataset.audioUrl;
                    const snippetTextElement = previewContainer.querySelector('.snippet-text');
                    
                    if (!audioPath) return;
                    
                    if (audioContext && audioContext.state === 'suspended') audioContext.resume();
                    
                    // Toggle play/pause for both video and audio
                    if (isPlaying) {
                        // Currently playing - fade out and pause both
                        fadeOut(audioPlayer, 200, true); // Pause after fade
                        video.pause();
                        isPlaying = false;
                        if (snippetTextElement) {
                            snippetTextElement.innerHTML = '<i class="fas fa-volume-up"></i> click to play a snippet';
                        }
                    } else {
                        // Currently paused - play both
                        // Only set new src and reset times if this is a completely new session
                        if (!audioInitialized) {
                            audioPlayer.src = audioPath;
                            audioPlayer.currentTime = 0;
                            video.currentTime = 0;
                            audioInitialized = true;
                        }
                        
                        // Get the audio delay for this track
                        const audioDelay = parseInt(previewContainer.dataset.audioDelay) || 0;
                        
                        // Start video immediately
                        const videoPlayPromise = video.play();
                        
                        // Start audio AND fade-in together after the delay
                        let audioPlayPromise;
                        if (audioDelay > 0) {
                            audioPlayPromise = new Promise((resolve, reject) => {
                                setTimeout(() => {
                                    // Start both audio and fade-in at the same time
                                    audioPlayer.play().then(() => {
                                        fadeIn(audioPlayer, 0.5, 150);
                                        resolve();
                                    }).catch(reject);
                                }, audioDelay);
                            });
                        } else {
                            audioPlayPromise = audioPlayer.play().then(() => {
                                fadeIn(audioPlayer, 0.5, 150);
                            });
                        }
                        
                        Promise.all([
                            videoPlayPromise.catch(() => {}),
                            audioPlayPromise.catch(() => {})
                        ]).then(() => {
                            // Both are now playing
                            isPlaying = true;
                            if (snippetTextElement) {
                                snippetTextElement.innerHTML = '<i class="fas fa-pause"></i> click to pause snippet';
                            }
                        }).catch(() => {
                            // If either fails, make sure both are stopped
                            video.pause();
                            audioPlayer.pause();
                            isPlaying = false;
                        });
                    }
                };
                
                // Attach click to the entire item, not just the container
                itemElement.addEventListener('click', handleClick);
                itemElement.addEventListener('mouseenter', handleMouseEnter);
                itemElement.addEventListener('mouseleave', handleMouseLeave);
            }

        
        };

        // --- THE KEY CHANGE ---
        // Create the first item immediately, but delay the second one slightly.
        createAndSetupItem();

    });
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

// Extract headers from markdown content and return TOC data
function extractHeaders(markdown) {
    const headers = [];
    const lines = markdown.split('\n');
    lines.forEach((line) => {
        const match = line.match(/^(#{2,3})\s+(.+)$/);
        if (match) {
            const level = match[1].length; // 2 for ##, 3 for ###
            const text = match[2].trim();
            const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            headers.push({ level, text, id });
        }
    });
    return headers;
}

// Remove headers from HTML content (we'll show them in TOC instead)
function stripHeadersFromHTML(html) {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    temp.querySelectorAll('h2, h3').forEach(header => {
        // Add an anchor point before removing
        // Always use consistent ID generation (same as extractHeaders)
        const anchor = document.createElement('div');
        const headerText = header.textContent.trim();
        anchor.id = headerText.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        anchor.className = 'toc-anchor';
        header.parentNode.insertBefore(anchor, header);
        header.remove();
    });
    return temp.innerHTML;
}

// Load projects from Markdown files
function loadProjects() {
    fetch('/projects/index.json')
        .then(res => res.json())
        .then(files => Promise.all(files.map(file => fetch(`/projects/${file}`).then(r => r.text()))))
        .then(markdownContents => {
            const projects = markdownContents.map(text => {
                const { data, content } = parseFrontMatter(text);
                const headers = extractHeaders(content);
                const rawHTML = marked.parse ? marked.parse(content) : marked(content);
                return {
                    title: data.title || '',
                    summary: data.summary || '',
                    image: data.image || '',
                    technologies: data.technologies || '',
                    descriptionHTML: rawHTML,
                    headers: headers
                };
            });
            displayProjects(projects);
        })
        .catch(error => {
            console.error('❌ Error loading projects:', error);
            showErrorMessage();
        });
}

// Display projects parsed from Markdown - overview + detail views
function displayProjects(projects) {
    const projectsList = document.querySelector('.projects-list');
    if (!projectsList) {
        console.error('Projects list container not found');
        return;
    }
    if (projects.length === 0) {
        projectsList.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No projects found.</div>';
        return;
    }

    // Store projects globally for navigation
    window.projectsData = projects;

    // Generate overview cards
    let overviewHTML = '<div class="projects-overview active">';
    projects.forEach((project, index) => {
        const imageUrl = project.image || `https://placehold.co/400x200/6D4C41/FFF8E1?text=${encodeURIComponent(project.title)}`;
        overviewHTML += `
            <div class="project-card" data-index="${index}">
                <img src="${imageUrl}" alt="${project.title}" class="project-card-image" loading="lazy">
                <div class="project-card-content">
                    <h3 class="project-card-title">${DOMPurify.sanitize(project.title)}</h3>
                    ${project.summary ? `<p class="project-card-summary">${DOMPurify.sanitize(project.summary)}</p>` : ''}
                </div>
            </div>
        `;
    });
    overviewHTML += '</div>';

    // Generate detail views
    let detailsHTML = '';
    projects.forEach((project, index) => {
        const projectId = `project${index}`;
        const imageUrl = project.image || `https://placehold.co/800x400/6D4C41/FFF8E1?text=${encodeURIComponent(project.title)}`;

        // Generate TOC HTML from headers with parent tracking
        let tocHTML = '';
        if (project.headers && project.headers.length > 0) {
            tocHTML = '<nav class="project-toc"><ul class="toc-list">';
            let currentParentIndex = -1;

            // First pass: identify h2s that have children
            const h2HasChildren = new Set();
            project.headers.forEach((header, idx) => {
                if (header.level === 2) {
                    currentParentIndex = idx;
                } else if (header.level === 3 && currentParentIndex >= 0) {
                    h2HasChildren.add(currentParentIndex);
                }
            });

            // Second pass: generate HTML
            currentParentIndex = -1;
            project.headers.forEach((header, idx) => {
                const levelClass = header.level === 2 ? 'toc-h2' : 'toc-h3';
                const activeClass = idx === 0 ? ' active' : '';
                const hasChildrenClass = header.level === 2 && h2HasChildren.has(idx) ? ' has-children' : '';

                if (header.level === 2) {
                    currentParentIndex = idx;
                }
                const parentAttr = header.level === 3 && currentParentIndex >= 0
                    ? ` data-parent-index="${currentParentIndex}"`
                    : '';

                tocHTML += `<li class="toc-item ${levelClass}${hasChildrenClass}${activeClass}" data-target="${header.id}"${parentAttr}>${DOMPurify.sanitize(header.text)}</li>`;
            });
            tocHTML += '</ul></nav>';
        }

        const strippedHTML = stripHeadersFromHTML(project.descriptionHTML);

        // Navigation for this project (in left column under TOC)
        const navHTML = `
            <div class="projects-nav">
                <a class="projects-nav-link projects-nav-prev" data-direction="prev">
                    <span class="nav-arrow">&lt;</span>
                    <span class="nav-label">previous</span>
                </a>
                <a class="projects-nav-link projects-nav-next" data-direction="next">
                    <span class="nav-label">next</span>
                    <span class="nav-arrow">&gt;</span>
                </a>
                <a class="projects-nav-link projects-nav-all">
                    all projects
                </a>
            </div>
        `;

        detailsHTML += `
            <div class="project-item" id="${projectId}" data-project-id="${projectId}" data-index="${index}">
                <div class="project-header-column">
                    ${tocHTML}
                    ${navHTML}
                </div>
                <div class="project-content-column">
                    <h3 class="project-title">${DOMPurify.sanitize(project.title)}</h3>
                    <div class="project-details">
                        <img src="${imageUrl}" alt="${project.title} project screenshot" class="project-image" loading="lazy">
                        ${project.summary ? `<p class="project-summary">${DOMPurify.sanitize(project.summary)}</p>` : ''}
                        <div class="project-description">
                            ${DOMPurify.sanitize(strippedHTML)}
                            ${project.technologies ? `<p class="project-technologies"><strong>Technologies:</strong> ${DOMPurify.sanitize(Array.isArray(project.technologies) ? project.technologies.join(', ') : project.technologies)}</p>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    projectsList.innerHTML = overviewHTML + detailsHTML;

    // Handle image load errors
    projectsList.querySelectorAll('.project-image, .project-card-image').forEach(img => {
        img.addEventListener('error', function() {
            this.style.display = 'none';
            console.warn('Project image failed to load:', this.src);
        });
    });

    // Initialize handlers
    initProjectCardHandlers();
    initTocHandlers();
    initProjectNavHandlers();
}

// Show project detail view
function showProjectDetail(index) {
    const projects = window.projectsData;
    if (!projects) return;

    const overview = document.querySelector('.projects-overview');

    // Fade out overview, then show project detail
    if (overview && overview.classList.contains('active')) {
        overview.classList.add('fade-out');

        // After fade-out animation, hide overview and show project
        setTimeout(() => {
            overview.classList.remove('active', 'fade-out');

            // Show selected project with fade-in animation
            document.querySelectorAll('.project-item').forEach((item, idx) => {
                item.classList.remove('active', 'fade-in', 'slide-in-from-right', 'slide-in-from-left', 'slide-out-to-left', 'slide-out-to-right');
                if (idx === index) {
                    item.classList.add('active', 'fade-in');
                }
            });

            // Update navigation state for the active project
            updateProjectNav(index, projects);

            // Start scroll tracking
            const activeProject = document.querySelector('.project-item.active');
            if (activeProject) {
                setTimeout(() => {
                    observeProjectAnchors(activeProject);
                }, 300);
            }
        }, 300);
    } else {
        // Overview not active, just show project directly
        document.querySelectorAll('.project-item').forEach((item, idx) => {
            item.classList.remove('active', 'fade-in', 'slide-in-from-right', 'slide-in-from-left', 'slide-out-to-left', 'slide-out-to-right');
            if (idx === index) {
                item.classList.add('active', 'fade-in');
            }
        });
        updateProjectNav(index, projects);
    }

    // Scroll to top
    const mainContent = document.getElementById('mainContent');
    if (mainContent) {
        mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// Show projects overview
function showProjectsOverview() {
    const overview = document.querySelector('.projects-overview');
    const currentProject = document.querySelector('.project-item.active');

    if (currentProject) {
        // Clear any existing animation classes
        currentProject.classList.remove('fade-in', 'slide-in-from-right', 'slide-in-from-left', 'slide-out-to-left', 'slide-out-to-right');

        // Add fade-out animation class
        currentProject.classList.add('fade-out');

        // After fade-out, switch to overview
        setTimeout(() => {
            currentProject.classList.remove('active', 'fade-out');

            // Show overview with fade-in
            if (overview) {
                overview.classList.add('active', 'fade-in');
            }

            // Scroll to top
            const mainContent = document.getElementById('mainContent');
            if (mainContent) {
                mainContent.scrollTo({ top: 0, behavior: 'instant' });
            }
        }, 300);
    } else {
        // No current project, just show overview
        if (overview) overview.classList.add('active');

        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            mainContent.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }
}

// Initialize project card click handlers
function initProjectCardHandlers() {
    document.querySelectorAll('.project-card').forEach(card => {
        card.addEventListener('click', function() {
            const index = parseInt(this.dataset.index, 10);
            showProjectDetail(index);
        });
    });
}

// Update the navigation bar state for the active project
function updateProjectNav(currentIndex, projects) {
    const activeProject = document.querySelector('.project-item.active');
    if (!activeProject) return;

    const prevLink = activeProject.querySelector('.projects-nav-prev');
    const nextLink = activeProject.querySelector('.projects-nav-next');

    if (!prevLink || !nextLink) return;

    // Update previous link
    if (currentIndex > 0) {
        prevLink.classList.remove('disabled');
    } else {
        prevLink.classList.add('disabled');
    }

    // Update next link
    if (currentIndex < projects.length - 1) {
        nextLink.classList.remove('disabled');
    } else {
        nextLink.classList.add('disabled');
    }
}

// Navigate to a specific project
function navigateToProject(direction) {
    const projects = window.projectsData;
    if (!projects) return;

    const currentProject = document.querySelector('.project-item.active');
    if (!currentProject) return;

    const currentIndex = parseInt(currentProject.dataset.index, 10);
    let newIndex;

    if (direction === 'prev' && currentIndex > 0) {
        newIndex = currentIndex - 1;
    } else if (direction === 'next' && currentIndex < projects.length - 1) {
        newIndex = currentIndex + 1;
    } else {
        return; // Can't navigate
    }

    const newProject = document.getElementById(`project${newIndex}`);
    if (!newProject) return;

    // Clear any existing animation classes from all projects
    document.querySelectorAll('.project-item').forEach(item => {
        item.classList.remove('fade-in', 'slide-in-from-right', 'slide-in-from-left', 'slide-out-to-left', 'slide-out-to-right');
    });

    // Determine animation direction
    const slideOutClass = direction === 'next' ? 'slide-out-to-left' : 'slide-out-to-right';
    const slideInClass = direction === 'next' ? 'slide-in-from-right' : 'slide-in-from-left';

    // Animate out the current project
    currentProject.classList.add(slideOutClass);

    // After the out animation, switch projects
    setTimeout(() => {
        currentProject.classList.remove('active', slideOutClass);

        // Show and animate in the new project
        newProject.classList.add('active', slideInClass);

        // Reset TOC to first item
        const tocItems = newProject.querySelectorAll('.toc-item');
        tocItems.forEach((item, idx) => {
            item.classList.remove('active', 'parent-active');
            if (idx === 0) {
                item.classList.add('active');
            }
        });

        // Update navigation
        updateProjectNav(newIndex, projects);

        // Scroll to top of projects section
        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            mainContent.scrollTo({ top: 0, behavior: 'instant' });
        }

        // Update scroll tracking
        setTimeout(() => {
            observeProjectAnchors(newProject);
        }, 300);
    }, 300); // Match the slide-out animation duration
}

// Initialize project navigation handlers
function initProjectNavHandlers() {
    // Previous/Next handlers
    document.querySelectorAll('.projects-nav-prev, .projects-nav-next').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const direction = this.dataset.direction;
            if (direction && !this.classList.contains('disabled')) {
                navigateToProject(direction);
            }
        });
    });

    // All projects handler - use querySelectorAll to attach to ALL "all projects" links
    document.querySelectorAll('.projects-nav-all').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            showProjectsOverview();
        });
    });

    // Swipe gesture support for mobile
    initSwipeGestures();
}

// Initialize swipe gestures for project navigation
function initSwipeGestures() {
    let touchStartX = 0;
    let touchEndX = 0;
    const minSwipeDistance = 50;

    const projectsSection = document.getElementById('projects');
    if (!projectsSection) return;

    projectsSection.addEventListener('touchstart', function(e) {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    projectsSection.addEventListener('touchend', function(e) {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });

    function handleSwipe() {
        const swipeDistance = touchEndX - touchStartX;

        // Only handle swipe if we're in a project detail view (not overview)
        const activeProject = document.querySelector('.project-item.active');
        if (!activeProject) return;

        if (Math.abs(swipeDistance) < minSwipeDistance) return;

        if (swipeDistance > 0) {
            // Swipe right = previous project
            const prevLink = activeProject.querySelector('.projects-nav-prev');
            if (prevLink && !prevLink.classList.contains('disabled')) {
                navigateToProject('prev');
            }
        } else {
            // Swipe left = next project
            const nextLink = activeProject.querySelector('.projects-nav-next');
            if (nextLink && !nextLink.classList.contains('disabled')) {
                navigateToProject('next');
            }
        }
    }
}

// Initialize swipe gestures for section navigation (mobile)
function initSectionSwipeGestures() {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let lockedAxis = null; // 'horizontal', 'vertical', or null
    const minSwipeDistance = 50;
    const axisLockThreshold = 10; // Pixels before locking to an axis
    const sections = ['music', 'projects', 'about'];

    const mainContent = document.getElementById('mainContent');
    if (!mainContent) return;

    mainContent.addEventListener('touchstart', function(e) {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
        touchEndX = touchStartX;
        lockedAxis = null; // Reset axis lock
    }, { passive: true });

    mainContent.addEventListener('touchmove', function(e) {
        const currentX = e.changedTouches[0].screenX;
        const currentY = e.changedTouches[0].screenY;
        const deltaX = Math.abs(currentX - touchStartX);
        const deltaY = Math.abs(currentY - touchStartY);

        // Determine axis lock once threshold is reached
        if (!lockedAxis && (deltaX > axisLockThreshold || deltaY > axisLockThreshold)) {
            lockedAxis = deltaX > deltaY ? 'horizontal' : 'vertical';
        }

        // Update end position for horizontal swipes
        if (lockedAxis === 'horizontal') {
            touchEndX = currentX;
        }
    }, { passive: true });

    mainContent.addEventListener('touchend', function(e) {
        // Only handle section swipe if locked to horizontal
        if (lockedAxis === 'horizontal') {
            handleSectionSwipe();
        }
        lockedAxis = null;
    }, { passive: true });

    function handleSectionSwipe() {
        const swipeDistance = touchEndX - touchStartX;
        if (Math.abs(swipeDistance) < minSwipeDistance) return;

        // Don't handle section swipe if we're in a project detail view
        const activeProject = document.querySelector('.project-item.active');
        if (activeProject) return;

        // Find current active section
        const activeSection = document.querySelector('.section.active');
        if (!activeSection) return;

        const currentId = activeSection.id;

        // Skip if on homepage
        if (currentId === 'homepage') return;

        const currentIndex = sections.indexOf(currentId);
        if (currentIndex === -1) return;

        let newIndex;
        if (swipeDistance > 0) {
            // Swipe right = previous section
            newIndex = currentIndex - 1;
        } else {
            // Swipe left = next section
            newIndex = currentIndex + 1;
        }

        // Check bounds
        if (newIndex >= 0 && newIndex < sections.length) {
            showSection(sections[newIndex]);
        }
    }
}

// Initialize mobile tap flash effect
function initTapFlash() {
    // Only apply on touch devices
    if (!('ontouchstart' in window)) return;

    // Selectors for tappable elements
    const tappableSelectors = [
        '.nav-link',
        '.homepage-menu-item',
        '.logo-link',
        '.project-card',
        '.projects-nav-link',
        '.music-link',
        '.social-link',
        '.toc-item'
    ];

    document.addEventListener('touchstart', function(e) {
        const target = e.target.closest(tappableSelectors.join(', '));
        if (target) {
            // Add flash class immediately
            target.classList.add('tap-flash');
        }
    }, { passive: true });

    document.addEventListener('touchend', function(e) {
        const target = e.target.closest(tappableSelectors.join(', '));
        if (target) {
            // After a brief moment, start the fade out
            setTimeout(() => {
                target.classList.remove('tap-flash');
                target.classList.add('tap-flash-out');

                // Remove the transition class after animation completes
                setTimeout(() => {
                    target.classList.remove('tap-flash-out');
                }, 400);
            }, 150);
        }
    }, { passive: true });
}

// Flag to prevent scroll tracking during click-initiated scrolls
let isClickScrolling = false;
let clickedTocItem = null;
let scrollEndTimer = null;

// Initialize TOC click handlers and scroll tracking
function initTocHandlers() {
    // Click handler for TOC items
    document.querySelectorAll('.toc-item').forEach((item) => {
        item.addEventListener('click', function(e) {
            e.stopPropagation();
            const projectItem = this.closest('.project-item');
            const allTocItems = projectItem.querySelectorAll('.toc-item');

            // If clicking an h2 with children, redirect to its first child
            let targetItem = this;
            let targetId = this.dataset.target;
            if (this.classList.contains('has-children')) {
                const myIndex = Array.from(allTocItems).indexOf(this);
                // Find the first child (next item with parentIndex pointing to this)
                for (let i = myIndex + 1; i < allTocItems.length; i++) {
                    if (allTocItems[i].dataset.parentIndex === String(myIndex)) {
                        targetItem = allTocItems[i];
                        targetId = targetItem.dataset.target;
                        break;
                    }
                }
            }

            const targetAnchor = projectItem.querySelector(`#${targetId}`);

            if (targetAnchor) {
                const isAlreadyActive = targetItem.classList.contains('active');

                // Disable scroll tracking during smooth scroll
                isClickScrolling = true;
                clickedTocItem = targetItem;
                currentVisibleAnchors.clear(); // Clear stale observer data

                // Only update if clicking a NEW item
                if (!isAlreadyActive) {
                    allTocItems.forEach(i => i.classList.remove('active', 'parent-active'));
                    targetItem.classList.add('active');
                }

                // Handle parent highlighting for h3 items
                const parentIndex = targetItem.dataset.parentIndex;
                if (parentIndex !== undefined) {
                    const parentItem = allTocItems[parseInt(parentIndex, 10)];
                    if (parentItem) {
                        parentItem.classList.add('parent-active');
                    }
                }

                // Check if this is the first or last TOC item
                const isFirstItem = targetItem === allTocItems[0];
                const isLastItem = targetItem === allTocItems[allTocItems.length - 1];
                const mainContent = document.getElementById('mainContent');

                if (isFirstItem) {
                    // For the first item, scroll to very top
                    mainContent.scrollTo({ top: 0, behavior: 'smooth' });
                } else if (isLastItem) {
                    // For the last item, scroll to bottom of article
                    mainContent.scrollTo({
                        top: mainContent.scrollHeight,
                        behavior: 'smooth'
                    });
                } else {
                    // Scroll so anchor lands at 50% from top (matching scroll tracking trigger)
                    const anchorRect = targetAnchor.getBoundingClientRect();
                    const containerRect = mainContent.getBoundingClientRect();
                    const offset = window.innerHeight * 0.5;
                    const scrollTop = mainContent.scrollTop + anchorRect.top - containerRect.top - offset;
                    mainContent.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' });
                }
            }
        });
    });

    // Set up scroll tracking
    setupScrollTracking();
}

// Intersection Observer for TOC scroll tracking (industry standard approach)
let tocObserver = null;
let currentVisibleAnchors = new Map();

function setupScrollTracking() {
    // Create observer with root as the scroll container
    const mainContent = document.getElementById('mainContent');

    // Observer only tracks visibility, doesn't trigger updates (prevents dual-system conflicts)
    tocObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const anchorId = entry.target.id;
            if (entry.isIntersecting) {
                currentVisibleAnchors.set(anchorId, entry.intersectionRatio);
            } else {
                currentVisibleAnchors.delete(anchorId);
            }
        });
        // Don't call updateActiveTocFromObserver - scroll listener handles all updates
    }, {
        root: mainContent,
        rootMargin: '-50% 0px -48% 0px',
        threshold: [0, 0.5, 1]
    });

    // Add scroll listener for fast scrolling - updates TOC directly
    let scrollTimeout;
    mainContent.addEventListener('scroll', () => {
        // Throttle to 60fps for performance
        if (!scrollTimeout) {
            scrollTimeout = requestAnimationFrame(() => {
                updateActiveTocFromScroll();
                scrollTimeout = null;
            });
        }

        // Scroll-end detection: re-enable tracking after scroll stops
        if (isClickScrolling) {
            clearTimeout(scrollEndTimer);
            scrollEndTimer = setTimeout(() => {
                isClickScrolling = false;
                clickedTocItem = null;
            }, 150); // 150ms after last scroll event = scroll ended
        }
    }, { passive: true });
}

function updateActiveTocFromScroll() {
    if (isClickScrolling) return; // Skip during click-initiated scrolls

    const activeProject = document.querySelector('.project-item.active');
    if (!activeProject) return;

    const toc = activeProject.querySelector('.project-toc');
    if (!toc) return;

    const tocItems = toc.querySelectorAll('.toc-item');
    const anchors = activeProject.querySelectorAll('.toc-anchor');

    if (tocItems.length === 0 || anchors.length === 0) return;

    // Find which section contains the reading position (2/3 trigger point)
    // A section is active if its anchor is above the trigger AND the next anchor is at/below it
    const triggerPoint = window.innerHeight * 0.5;
    let activeIndex = 0;

    for (let i = 0; i < anchors.length; i++) {
        const rect = anchors[i].getBoundingClientRect();
        if (rect.top <= triggerPoint) {
            activeIndex = i;
            // If this is the last anchor, or the next anchor is still below trigger, we're in this section
            if (i === anchors.length - 1) break;
            const nextRect = anchors[i + 1].getBoundingClientRect();
            if (nextRect.top > triggerPoint) break;
        } else {
            break; // This anchor is below trigger, use previous activeIndex
        }
    }

    // Check if active item has changed - skip update if same item is already active
    const currentActiveItem = toc.querySelector('.toc-item.active');
    const currentActiveIndex = currentActiveItem ? Array.from(tocItems).indexOf(currentActiveItem) : -1;

    if (currentActiveIndex === activeIndex) {
        return; // Same item already active, no update needed
    }

    // Update active state (only runs when changing to a new section)
    const newActiveItem = tocItems[activeIndex];
    tocItems.forEach((item) => {
        item.classList.remove('active', 'parent-active');
    });

    if (newActiveItem) {
        newActiveItem.classList.add('active');

        const parentIndex = newActiveItem.dataset.parentIndex;
        if (parentIndex !== undefined) {
            const parentItem = tocItems[parseInt(parentIndex, 10)];
            if (parentItem) {
                parentItem.classList.add('parent-active');
            }
        }
    }
}

function updateActiveTocFromObserver() {
    if (isClickScrolling) return; // Skip during click-initiated scrolls

    const activeProject = document.querySelector('.project-item.active');
    if (!activeProject) return;

    const toc = activeProject.querySelector('.project-toc');
    if (!toc) return;

    const tocItems = toc.querySelectorAll('.toc-item');
    const anchors = activeProject.querySelectorAll('.toc-anchor');

    if (tocItems.length === 0 || anchors.length === 0) return;

    // Find the first visible anchor (topmost in viewport)
    let activeIndex = 0;

    anchors.forEach((anchor, index) => {
        if (currentVisibleAnchors.has(anchor.id)) {
            activeIndex = index;
        }
    });

    // If no anchors visible, find which section contains the trigger point
    if (currentVisibleAnchors.size === 0) {
        const triggerPoint = window.innerHeight * 0.5;
        for (let i = 0; i < anchors.length; i++) {
            const rect = anchors[i].getBoundingClientRect();
            if (rect.top <= triggerPoint) {
                activeIndex = i;
                if (i === anchors.length - 1) break;
                const nextRect = anchors[i + 1].getBoundingClientRect();
                if (nextRect.top > triggerPoint) break;
            } else {
                break;
            }
        }
    }

    // Check if active item has changed - skip update if same item is already active
    const currentActiveItem = toc.querySelector('.toc-item.active');
    const currentActiveIndex = currentActiveItem ? Array.from(tocItems).indexOf(currentActiveItem) : -1;

    if (currentActiveIndex === activeIndex) {
        return; // Same item already active, no update needed
    }

    // Update active state (only runs when changing to a new section)
    const newActiveItem = tocItems[activeIndex];
    tocItems.forEach((item) => {
        item.classList.remove('active', 'parent-active');
    });

    if (newActiveItem) {
        newActiveItem.classList.add('active');

        // If this is an h3, also highlight its parent h2
        const parentIndex = newActiveItem.dataset.parentIndex;
        if (parentIndex !== undefined) {
            const parentItem = tocItems[parseInt(parentIndex, 10)];
            if (parentItem) {
                parentItem.classList.add('parent-active');
            }
        }
    }
}

function observeProjectAnchors(projectItem) {
    if (!tocObserver) setupScrollTracking();

    // Stop observing previous anchors
    if (tocObserver) {
        document.querySelectorAll('.toc-anchor').forEach(anchor => {
            tocObserver.unobserve(anchor);
        });
        currentVisibleAnchors.clear();
    }

    // Start observing new project's anchors
    if (projectItem) {
        const anchors = projectItem.querySelectorAll('.toc-anchor');
        anchors.forEach(anchor => {
            tocObserver.observe(anchor);
        });
    }
}

// Fallback update function for initial state
function updateActiveTocItem() {
    updateActiveTocFromObserver();
}

function showErrorMessage() {
    const projectsList = document.querySelector('.projects-list');
    if (projectsList) {
        projectsList.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                <p>Unable to load projects. Please refresh the page.</p>
            </div>`;
    }
}

// Load testimonials from markdown file
function loadTestimonials() {
    fetch('/testimonials.md')
        .then(res => res.text())
        .then(text => {
            const { data } = parseFrontMatter(text);
            const testimonials = data.testimonials || [];
            displayTestimonials(testimonials);
        })
        .catch(error => {
            console.error('Error loading testimonials:', error);
        });
}

// Display testimonials
function displayTestimonials(testimonials) {
    const container = document.querySelector('.testimonials-scroll-container');
    if (!container) {
        console.warn('Testimonials container not found - testimonials section may not be visible');
        return;
    }
    
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

    // Check if projects needs to fade out
    const projectsSection = document.getElementById('projects');
    const projectsOverview = document.querySelector('.projects-overview');
    const activeProjectDetail = document.querySelector('.project-item.active');
    const needsProjectsFadeOut = projectsSection && projectsSection.classList.contains('active') &&
                                  (projectsOverview?.classList.contains('active') || activeProjectDetail);

    const proceedToHomepage = () => {
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

        resetProjectsView();
        updateFloatingContactVisibility();
    };

    if (needsProjectsFadeOut) {
        // Fade out projects content first
        if (projectsOverview?.classList.contains('active')) {
            projectsOverview.classList.add('fade-out');
        }
        if (activeProjectDetail) {
            activeProjectDetail.classList.add('fade-out');
        }
        setTimeout(proceedToHomepage, 300);
    } else {
        proceedToHomepage();
    }
}

// Show section (Updated to call the new music function)
function showSection(sectionName) {
    // Add the class to the body to block hover effects immediately.
    document.body.classList.add('is-transitioning');

    const mainContent = document.getElementById('mainContent');

    document.getElementById('sidebar').classList.add('show');
    mainContent.classList.remove('homepage-active');
    mainContent.classList.add('nav-visible');

    // Update nav height after sidebar becomes visible
    setTimeout(updateMobileNavHeight, 50);

    const homepage = document.getElementById('homepage');
    if (homepage) homepage.classList.remove('active');

    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelector(`[data-section="${sectionName}"]`)?.classList.add('active');

    // Check if projects overview or detail needs to fade out
    const projectsSection = document.getElementById('projects');
    const projectsOverview = document.querySelector('.projects-overview');
    const activeProjectDetail = document.querySelector('.project-item.active');
    const needsProjectsFadeOut = projectsSection && projectsSection.classList.contains('active') &&
                                  sectionName !== 'projects' &&
                                  (projectsOverview?.classList.contains('active') || activeProjectDetail);

    const proceedWithSectionChange = () => {
        // Reset scroll position after fade-out, before showing new section
        if (mainContent) mainContent.scrollTop = 0;
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;

        document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));

        const activeSection = document.getElementById(sectionName);

        if (activeSection) {
            const onAnimationEnd = () => {
                document.body.classList.remove('is-transitioning');
            };
            activeSection.addEventListener('animationend', onAnimationEnd, { once: true });
            activeSection.classList.add('active');
        }

        resetProjectsView();
        updateFloatingContactVisibility();

        if (sectionName === 'about') {
            loadTestimonials();
            setTimeout(startTestimonialTracking, 800);
        } else {
            stopTestimonialTracking();
            if (sectionName === 'projects') loadProjects();
            if (sectionName === 'music') initializeMusicSection();
        }
    };

    if (needsProjectsFadeOut) {
        // Fade out projects content first
        if (projectsOverview?.classList.contains('active')) {
            projectsOverview.classList.add('fade-out');
        }
        if (activeProjectDetail) {
            activeProjectDetail.classList.add('fade-out');
        }
        setTimeout(proceedWithSectionChange, 300);
    } else {
        proceedWithSectionChange();
    }
}

// Reset projects view to overview
function resetProjectsView() {
    const overview = document.querySelector('.projects-overview');

    // Hide all project detail views
    document.querySelectorAll('.project-item').forEach(item => {
        item.classList.remove('active');
    });

    // Show overview
    if (overview) overview.classList.add('active');
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
    // Initialize the audio player and context
    audioPlayer = document.getElementById('audio-player');
    if (!audioPlayer) {
        console.error('Audio player element not found');
        return;
    }
    
    try {
        // Handle older browsers that use webkit prefix
        const AudioContextClass = window.AudioContext || 
                                 (window.webkitAudioContext && window.webkitAudioContext) || 
                                 null;
        if (AudioContextClass) {
            audioContext = new AudioContextClass();
        } else {
            throw new Error('AudioContext not supported');
        }
    } catch (e) {
        console.error("Web Audio API is not supported in this browser:", e);
        audioContext = null;
    }

    // Handle clicks for homepage and sidebar navigation
    document.querySelectorAll('.homepage-menu-item, .nav-link').forEach(item => {
        item.addEventListener('click', function() {
            const section = this.getAttribute('data-section');
            if (section) {
                // Special case: clicking "projects" while viewing a project detail
                // should behave like "all projects" (fade out and show overview)
                if (section === 'projects') {
                    const projectsSection = document.getElementById('projects');
                    const activeProjectDetail = document.querySelector('.project-item.active');
                    if (projectsSection && projectsSection.classList.contains('active') && activeProjectDetail) {
                        showProjectsOverview();
                        return;
                    }
                }
                showSection(section);
            }
        });
    });
    
    // Handle click for the main logo to go home
    const logoLink = document.querySelector('.logo-link');
    if(logoLink) logoLink.addEventListener('click', goToHomepage);

    // Initial setup calls
    loadProjects();
    initSectionSwipeGestures();
    initTapFlash();

    // Update mobile nav height after a brief delay to ensure sidebar is rendered
    setTimeout(updateMobileNavHeight, 100);

    const homepage = document.getElementById('homepage');
    if(homepage && homepage.classList.contains('active')) {
      triggerHomepageAnimation();
    }
});
