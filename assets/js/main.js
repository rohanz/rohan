// Global variables

let audioPlayer = null;
let audioContext = null;
let currentOpenProject = null;
let testimonialInterval;

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

// Show section (Updated to call the new music function)
function showSection(sectionName) {
    // Add the class to the body to block hover effects immediately.
    document.body.classList.add('is-transitioning');

    document.getElementById('sidebar').classList.add('show');
    document.getElementById('mainContent').classList.remove('homepage-active');

    const homepage = document.getElementById('homepage');
    if (homepage) homepage.classList.remove('active');

    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelector(`[data-section="${sectionName}"]`)?.classList.add('active');

    document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));

    const activeSection = document.getElementById(sectionName);

    if (activeSection) {
        // --- The New, More Reliable Fix ---
        
        // 1. Define what to do when the animation ends.
        const onAnimationEnd = () => {
            // Remove the blocking class now that the animation is truly complete.
            document.body.classList.remove('is-transitioning');
        };

        // 2. Listen for the 'animationend' event on the section that will be animated.
        //    We use { once: true } so the listener automatically removes itself after firing once.
        activeSection.addEventListener('animationend', onAnimationEnd, { once: true });

        // 3. Now, add the 'active' class to start the animation.
        activeSection.classList.add('active');
    }

    hideProject();
    updateFloatingContactVisibility();

    if (sectionName === 'about') {
        loadTestimonials();
        setTimeout(startTestimonialTracking, 800);
    } else {
        stopTestimonialTracking();
        if (sectionName === 'projects') loadProjects();
        if (sectionName === 'music') initializeMusicSection();
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
    // Initialize the audio player and context
    audioPlayer = document.getElementById('audio-player');
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.error("Web Audio API is not supported in this browser.");
    }

    // Handle clicks for homepage and sidebar navigation
    document.querySelectorAll('.homepage-menu-item, .nav-link').forEach(item => {
        item.addEventListener('click', function() {
            const section = this.getAttribute('data-section');
            if (section) showSection(section);
        });
    });
    
    // Handle click for the main logo to go home
    const logoLink = document.querySelector('.logo-link');
    if(logoLink) logoLink.addEventListener('click', goToHomepage);

    // Initial setup calls
    loadProjects();
    
    const homepage = document.getElementById('homepage');
    if(homepage && homepage.classList.contains('active')) {
      triggerHomepageAnimation();
    }
});
