/*
 * Monkey Block - Chrome Extension
 * Copyright (c) 2025
 * All rights reserved.
 * 
 * This code is proprietary and confidential.
 * Unauthorized copying or distribution is prohibited.
 */

// Two-Step Feedback Implementation with Web3Forms and Amplitude Analytics
const WEB3FORMS_ACCESS_KEY = '533613f5-b3b1-4ca4-9240-dda0a4087686';

// Initialize Amplitude Analytics
let amplitudeTracker = null;
let step1QuickFeedbackTimer = null;
const STEP1_QUICK_FEEDBACK_DELAY_MS = 2 * 60 * 1000;

async function initAmplitude() {
    amplitudeTracker = new window.AmplitudeFeedback();
    await amplitudeTracker.init();
    
    // Track that the feedback page was opened
    await amplitudeTracker.track('Uninstall - Feedback Opened', {
        source: 'uninstall',
        page_type: 'two_step_feedback'
    });
}

let selectedReason = null;
let feedbackData = {
    stage: 'started',
    reasons: [],
    step2Reached: false,
    version: new URLSearchParams(window.location.search).get('v') || 'unknown'
};

// Initialize
document.addEventListener('DOMContentLoaded', async function() {
    // Track Reddit Pixel event immediately - user reached uninstall page means they uninstalled
    if (typeof rdt !== 'undefined') {
        // Only track Extension_Uninstalled - no redundant PageVisit or Started events
        rdt('track', 'Custom', {
            customEventName: 'Extension_Uninstalled',
            value: 1,
            currency: 'USD'
        });
        console.log('[Reddit] Tracked Extension_Uninstalled event on page load');
    }
    
    // Initialize Amplitude first
    await initAmplitude();
    
    setupReasonCards();
    setupFormHandlers();
    setupEmailRevealControl();

    prefillEmailFromQuery();
    
    // Track that user at least opened the form
    sendTelemetry('form_opened');
    
    // Set up auto-send for abandoned forms
    setupAutoSendDraft();
    
    // Restore any existing draft
    restoreDraft();
    
});

// Step 1: Reason Selection
function setupReasonCards() {
    const cards = document.querySelectorAll('.reason-card');
    const reasonsGrid = document.querySelector('.reasons-grid');
    const missingFeatureInput = document.getElementById('missingFeatureInput');
    const confusingInput = document.getElementById('confusingInput');
    const somethingElseInput = document.getElementById('somethingElseInput');
    const technicalIssueInput = document.getElementById('technicalIssueInput');
    const betterAlternativeInput = document.getElementById('betterAlternativeInput');
    const quickFeatureField = document.getElementById('quickFeature');
    const quickConfusingField = document.getElementById('quickConfusing');
    const quickOtherField = document.getElementById('quickOther');
    const quickIssueField = document.getElementById('quickIssue');
    const quickAlternativeField = document.getElementById('quickAlternative');
    
    // Button references
    const featureBtn = document.getElementById('featureSkipBtn');
    const confusingBtn = document.getElementById('confusingSkipBtn');
    const issueBtn = document.getElementById('issueSkipBtn');
    const alternativeBtn = document.getElementById('alternativeSkipBtn');
    const otherBtn = document.getElementById('otherSkipBtn');
    
    // Setup input listeners for button transformation
    setupInputButton(quickFeatureField, featureBtn, 'feature');
    setupInputButton(quickConfusingField, confusingBtn, 'confusing');
    setupInputButton(quickIssueField, issueBtn, 'issue');
    setupInputButton(quickAlternativeField, alternativeBtn, 'alternative');
    setupInputButton(quickOtherField, otherBtn, 'other');
    
    cards.forEach(card => {
        card.addEventListener('click', function() {
            // Remove previous selection
            cards.forEach(c => c.classList.remove('selected'));
            
            // Add selection
            this.classList.add('selected');
            selectedReason = this.dataset.reason;

            if (reasonsGrid) {
                reasonsGrid.classList.add('focus-mode');
            }
            
            // Hide all inputs first
            missingFeatureInput.style.display = 'none';
            confusingInput.style.display = 'none';
            somethingElseInput.style.display = 'none';
            technicalIssueInput.style.display = 'none';
            betterAlternativeInput.style.display = 'none';

            [missingFeatureInput, confusingInput, somethingElseInput, technicalIssueInput, betterAlternativeInput].forEach(input => {
                input.classList.remove('active');
            });
            
            // Reset all buttons to disabled Continue
            [featureBtn, confusingBtn, issueBtn, alternativeBtn, otherBtn].forEach(btn => {
                resetQuickActionButton(btn);
            });
            
            // Show/hide specific inputs
            if (selectedReason === 'missing-feature') {
                missingFeatureInput.style.display = 'flex';
                missingFeatureInput.classList.add('active');
                quickFeatureField.focus();
                quickFeatureField.value = feedbackData.missingFeature || '';
                if (quickFeatureField.value) {
                    transformToSendButton(featureBtn);
                }
            } else if (selectedReason === 'confusing') {
                confusingInput.style.display = 'flex';
                confusingInput.classList.add('active');
                quickConfusingField.focus();
                quickConfusingField.value = feedbackData.confusingReason || '';
                if (quickConfusingField.value) {
                    transformToSendButton(confusingBtn);
                }
            } else if (selectedReason === 'something-else') {
                somethingElseInput.style.display = 'flex';
                somethingElseInput.classList.add('active');
                quickOtherField.focus();
                quickOtherField.value = feedbackData.otherReason || '';
                if (quickOtherField.value) {
                    transformToSendButton(otherBtn);
                }
            } else if (selectedReason === 'bugs') {
                technicalIssueInput.style.display = 'flex';
                technicalIssueInput.classList.add('active');
                quickIssueField.focus();
                quickIssueField.value = feedbackData.technicalIssue || '';
                if (quickIssueField.value) {
                    transformToSendButton(issueBtn);
                }
            } else if (selectedReason === 'better-alternative') {
                betterAlternativeInput.style.display = 'flex';
                betterAlternativeInput.classList.add('active');
                quickAlternativeField.focus();
                quickAlternativeField.value = feedbackData.betterAlternativeReason || '';
                if (quickAlternativeField.value) {
                    transformToSendButton(alternativeBtn);
                }
            } else {
                setTimeout(() => goToStep2(), 300);
            }
            
            // Animate monkey
            document.getElementById('monkeyIcon').classList.remove('sad');
            document.getElementById('monkeyIcon').classList.add('happy');
            
            // Store reason immediately (in case user leaves)
            feedbackData.stage = 'step1';
            feedbackData.step2Reached = false;
            feedbackData.reasons = [selectedReason];
            saveDraft();
            sendTelemetry('reason_selected', { reason: selectedReason });
            
            if (amplitudeTracker) {
                amplitudeTracker.track('Uninstall - Reason Selected', {
                    reason: selectedReason,
                    step: 1
                });
            }
        });
    });
}

function resetQuickActionButton(button) {
    button.textContent = 'Send';
    button.className = 'input-btn send-btn disabled';
    button.disabled = true;
    button.onclick = null;
}

// Setup input field with button transformation
function setupInputButton(inputField, button, type) {
    let hasTrackedQuickSubmit = false; // Track only once per input
    
    inputField.addEventListener('input', function() {
        if (this.value.trim().length > 0) {
            transformToSendButton(button);
            
            // Save data
            if (type === 'feature') {
                feedbackData.missingFeature = this.value;
            } else if (type === 'confusing') {
                feedbackData.confusingReason = this.value;
            } else if (type === 'issue') {
                feedbackData.technicalIssue = this.value;
            } else if (type === 'alternative') {
                feedbackData.betterAlternativeReason = this.value;
            } else if (type === 'other') {
                feedbackData.otherReason = this.value;
            }
            
            saveDraft();
        } else {
            resetQuickActionButton(button);
            hasTrackedQuickSubmit = false; // Reset tracking flag
        }
    });
    
    // Also track when user finishes typing (on blur or enter)
    inputField.addEventListener('blur', function() {
        trackQuickSubmitIfNeeded(this.value, type);
    });
    
    inputField.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && this.value.trim().length > 0) {
            trackQuickSubmitIfNeeded(this.value, type);
            goToStep2();
        }
    });
    
    function trackQuickSubmitIfNeeded(value, inputType) {
        if (value.trim().length > 0 && !hasTrackedQuickSubmit && amplitudeTracker) {
            hasTrackedQuickSubmit = true;
            amplitudeTracker.track('Uninstall - Reason - Quick Submitted', {
                reason: selectedReason,
                input_type: inputType,
                input_text: value,
                input_length: value.length
            });
        }
    }
}

// Transform button to Send
function transformToSendButton(button) {
    button.textContent = 'Send';
    button.className = 'input-btn send-btn';
    button.disabled = false;
    button.onclick = function() {
        saveDraft();
        goToStep2();
    };
}

// Go to Step 2
function goToStep2() {
    if (!selectedReason) return;

    const reasonsGrid = document.querySelector('.reasons-grid');
    const header = document.querySelector('.header');
    if (reasonsGrid) {
        reasonsGrid.classList.remove('focus-mode');
    }
    if (header) {
        header.style.display = 'none';
    }

    clearStep1QuickFeedbackTimer();
    feedbackData.stage = 'step2';
    feedbackData.step2Reached = true;
    saveDraft();

    // Track in Amplitude
    if (amplitudeTracker) {
        amplitudeTracker.track('Uninstall - Feedback Step 2', {
            reason: selectedReason,
            has_missing_feature: !!feedbackData.missingFeature,
            has_technical_issue: !!feedbackData.technicalIssue,
            has_other_reason: !!feedbackData.otherReason
        });
    }
    
    // Update UI
    document.getElementById('step1').style.display = 'none';
    document.getElementById('step2').style.display = 'block';
    updateStep2Messaging();
    
    // Focus on textarea
    document.getElementById('feedback').focus();
}

// Skip directly to step 2
function skipToStep2() {
    // Track skip action in Amplitude
    if (amplitudeTracker) {
        amplitudeTracker.track('Uninstall - Feedback Input Skipped', {
            reason: selectedReason,
            skipped_field: selectedReason === 'missing-feature' ? 'feature' :
                          selectedReason === 'bugs' ? 'issue' :
                          selectedReason === 'something-else' ? 'other' : 'none'
        });
    }
    goToStep2();
}

// Show thank you
function showThankYou() {
    const header = document.querySelector('.header');

    if (header) {
        header.style.display = 'none';
    }

    document.getElementById('step1').style.display = 'none';
    document.getElementById('step2').style.display = 'none';
    document.getElementById('thankYou').style.display = 'block';
    
    // Track completion in Amplitude
    if (amplitudeTracker) {
        amplitudeTracker.track('Uninstall - Feedback Submitted', {
            reason: selectedReason,
            has_detailed_feedback: !!feedbackData.feedback,
            has_email: !!feedbackData.email,
            feedback_length: feedbackData.feedback ? feedbackData.feedback.length : 0,
            detailed_feedback: feedbackData.feedback || null
        });
    }
    
    // Reddit Pixel event already tracked on page load - no need to track again
    
    // Confetti effect (optional)
    if (typeof confetti !== 'undefined') {
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });
    }
    
    // Close after 5 seconds
    setTimeout(() => {
        if (window.close) {
            window.close();
        }
    }, 5000);
}

function prefillEmailFromQuery() {
    const emailField = document.getElementById('email');
    if (!emailField) return;

    const urlParams = new URLSearchParams(window.location.search);
    const accountEmail = (urlParams.get('account_email') || '').trim();
    if (!accountEmail) return;

    emailField.value = accountEmail;
    feedbackData.email = accountEmail;
    showEmailField(false);
    saveDraft();
}

function showEmailField(shouldFocus = false) {
    const emailGroup = document.getElementById('emailGroup');
    const emailRevealBtn = document.getElementById('emailRevealBtn');
    const replyYesBtn = document.getElementById('replyYesBtn');
    const replyNoBtn = document.getElementById('replyNoBtn');
    const emailField = document.getElementById('email');

    if (emailGroup) {
        emailGroup.classList.add('visible');
    }

    if (emailRevealBtn) {
        emailRevealBtn.style.display = 'none';
    }

    if (replyYesBtn) {
        replyYesBtn.classList.add('active');
    }

    if (replyNoBtn) {
        replyNoBtn.classList.remove('active');
    }

    if (shouldFocus && emailField) {
        emailField.focus();
    }
}

function hideEmailReplyPrompt() {
    const emailRevealBtn = document.getElementById('emailRevealBtn');
    if (emailRevealBtn) {
        emailRevealBtn.style.display = 'none';
    }
}

function markNoReplyPreference() {
    const replyYesBtn = document.getElementById('replyYesBtn');
    const replyNoBtn = document.getElementById('replyNoBtn');
    const emailGroup = document.getElementById('emailGroup');
    const emailField = document.getElementById('email');

    if (replyNoBtn) {
        replyNoBtn.classList.add('active');
    }

    if (replyYesBtn) {
        replyYesBtn.classList.remove('active');
    }

    if (emailGroup) {
        emailGroup.classList.remove('visible');
    }

    if (emailField && !new URLSearchParams(window.location.search).get('account_email')) {
        emailField.value = '';
        feedbackData.email = '';
        saveDraft();
    }
}

function updateStep2Messaging() {
    const title = document.getElementById('step2Title');
    const description = document.getElementById('step2Description');
    const textarea = document.getElementById('feedback');

    const copy = {
        'missing-feature': {
            title: 'Anything else about that feature?',
            description: 'One short detail helps us prioritize the right improvement.'
        },
        'confusing': {
            title: 'What felt hardest to use?',
            description: 'A short note helps us simplify the right part.'
        },
        'bugs': {
            title: 'What happened?',
            description: 'One short detail helps us find the bug faster.'
        },
        'better-alternative': {
            title: 'What did the other app do better?',
            description: 'A short comparison helps us understand what mattered most.'
        },
        'something-else': {
            title: 'Anything else we should know?',
            description: 'A short note gives us the missing context.'
        }
    };

    const nextCopy = copy[selectedReason] || copy['something-else'];
    if (title) title.textContent = nextCopy.title;
    if (description) description.textContent = nextCopy.description;
    if (textarea) textarea.placeholder = '';
}

function setupEmailRevealControl() {
    const emailRevealBtn = document.getElementById('emailRevealBtn');
    const replyYesBtn = document.getElementById('replyYesBtn');
    const replyNoBtn = document.getElementById('replyNoBtn');
    const feedbackField = document.getElementById('feedback');
    const emailField = document.getElementById('email');

    if (replyYesBtn) {
        replyYesBtn.addEventListener('click', () => {
            showEmailField(true);
        });
    }

    if (replyNoBtn) {
        replyNoBtn.addEventListener('click', () => {
            markNoReplyPreference();
        });
    }

    if (emailRevealBtn && feedbackData.email) {
        hideEmailReplyPrompt();
    }

    if (feedbackField) {
        feedbackField.addEventListener('focus', () => {
            if (feedbackField.value.trim()) {
                showEmailField(false);
            }
        });

        feedbackField.addEventListener('input', () => {
            if (feedbackField.value.trim()) {
                showEmailField(false);
            }
        });
    }

    if (emailField) {
        emailField.addEventListener('input', () => {
            feedbackData.email = emailField.value;
            if (emailField.value.trim()) {
                showEmailField(false);
            }
            saveDraft();
        });
    }
}

function clearStep1QuickFeedbackTimer() {
    if (step1QuickFeedbackTimer) {
        clearTimeout(step1QuickFeedbackTimer);
        step1QuickFeedbackTimer = null;
    }
}

function scheduleStep1QuickFeedback() {
    clearStep1QuickFeedbackTimer();

    if (!selectedReason || feedbackData.sent || feedbackData.stage !== 'step1') {
        return;
    }

    step1QuickFeedbackTimer = setTimeout(() => {
        const draft = localStorage.getItem('feedback-draft');
        if (!draft || feedbackData.sent) {
            return;
        }

        const draftData = JSON.parse(draft);
        if (draftData.reason && !draftData.step2Reached) {
            sendAbandonedDraft(draftData, 'step1');
            localStorage.removeItem('feedback-draft');
        }
    }, STEP1_QUICK_FEEDBACK_DELAY_MS);
}

function buildSystemSummary(browserInfo, osInfo, screenResolution) {
    return [browserInfo, osInfo, screenResolution].filter(Boolean).join(' | ');
}

function buildLocaleSummary(language, location) {
    return [language, location].filter(Boolean).join(' | ');
}

function addOptionalField(target, key, value) {
    if (value === undefined || value === null) return;
    const normalized = typeof value === 'string' ? value.trim() : value;
    if (normalized === '') return;
    target[key] = normalized;
}

function sendWeb3FormsPayload(payload, useKeepalive = false) {
    const requestBody = JSON.stringify(payload);

    if (useKeepalive && navigator.sendBeacon) {
        try {
            const blob = new Blob([requestBody], { type: 'application/json' });
            const sent = navigator.sendBeacon('https://api.web3forms.com/submit', blob);
            if (sent) {
                return Promise.resolve({ ok: true });
            }
        } catch (error) {
        }
    }

    return fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
        keepalive: useKeepalive
    });
}

// Step 2: Form submission
function setupFormHandlers() {
    const form = document.getElementById('detailsForm');
    const feedbackTextarea = document.getElementById('feedback');
    const emailField = document.getElementById('email');
    
    // Track text input in Step 2
    let step2TextTimer;
    feedbackTextarea.addEventListener('input', function() {
        clearTimeout(step2TextTimer);
        feedbackData.feedback = this.value;
        saveDraft();
        
        // Debounce to avoid too many saves
        step2TextTimer = setTimeout(() => {
            saveDraft();
        }, 1000);
    });
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';
        clearStep1QuickFeedbackTimer();
        
        // Collect all data
        feedbackData.feedback = form.feedback.value;
        feedbackData.email = form.email.value;
        feedbackData.stage = 'completed';
        
        try {
            await sendFullFeedback();
            
            // Track uninstall in Amplitude with full details
            if (amplitudeTracker) {
                const uninstallDetails = {
                    missing_feature: feedbackData.missingFeature || null,
                    confusing_reason: feedbackData.confusingReason || null,
                    technical_issue: feedbackData.technicalIssue || null, 
                    better_alternative_reason: feedbackData.betterAlternativeReason || null,
                    other_reason: feedbackData.otherReason || null,
                    detailed_feedback: feedbackData.feedback || null,
                    has_email: !!feedbackData.email
                };
                
                await amplitudeTracker.trackUninstall(selectedReason, uninstallDetails);
            }
            
            showThankYou();
        } catch (error) {
            console.error('Error:', error);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send Feedback';
            alert('Sorry, there was an error. Please try again.');
        }
    });

    if (emailField) {
        emailField.addEventListener('focus', () => showEmailField(false));
    }
}

// Send full feedback
async function sendFullFeedback() {
    const missingFeature = document.getElementById('quickFeature')?.value || feedbackData.missingFeature;
    const confusingReason = document.getElementById('quickConfusing')?.value || feedbackData.confusingReason;
    const otherReason = document.getElementById('quickOther')?.value || feedbackData.otherReason;
    const technicalIssue = document.getElementById('quickIssue')?.value || feedbackData.technicalIssue;
    const betterAlternativeReason = document.getElementById('quickAlternative')?.value || feedbackData.betterAlternativeReason;

    // Get system information
    const language = navigator.language || 'Unknown';
    const screenResolution = `${screen.width}x${screen.height}`;

    // Parse user agent for better readability
    const ua = navigator.userAgent;
    let browserInfo = 'Unknown Browser';
    let osInfo = 'Unknown OS';

    // Detect browser
    if (ua.includes('Chrome') && !ua.includes('Edg')) {
        const chromeVersion = ua.match(/Chrome\/([\d.]+)/)?.[1] || '';
        browserInfo = `Chrome ${chromeVersion}`;
    } else if (ua.includes('Edg')) {
        const edgeVersion = ua.match(/Edg\/([\d.]+)/)?.[1] || '';
        browserInfo = `Edge ${edgeVersion}`;
    } else if (ua.includes('Firefox')) {
        const firefoxVersion = ua.match(/Firefox\/([\d.]+)/)?.[1] || '';
        browserInfo = `Firefox ${firefoxVersion}`;
    } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
        const safariVersion = ua.match(/Version\/([\d.]+)/)?.[1] || '';
        browserInfo = `Safari ${safariVersion}`;
    }

    // Detect OS
    if (ua.includes('Windows')) {
        osInfo = 'Windows';
        if (ua.includes('Windows NT 10.0')) osInfo = 'Windows 10/11';
    } else if (ua.includes('Mac')) {
        osInfo = 'macOS';
    } else if (ua.includes('Linux')) {
        osInfo = 'Linux';
    } else if (ua.includes('Android')) {
        osInfo = 'Android';
    } else if (ua.includes('iOS')) {
        osInfo = 'iOS';
    }

    // Try to get location data (non-blocking)
    let locationData = { country: 'Unknown', city: 'Unknown', region: '' };
    try {
        const geoResponse = await fetch('https://ipapi.co/json/');
        if (geoResponse.ok) {
            const geoData = await geoResponse.json();
            locationData = {
                country: geoData.country_name || 'Unknown',
                city: geoData.city || 'Unknown',
                region: geoData.region || ''
            };
        }
    } catch (geoError) {
        console.log('Could not fetch location data');
    }

    // Get days used from Amplitude tracker if available
    let timeSinceInstallFormatted = 'Unknown';
    if (amplitudeTracker) {
        timeSinceInstallFormatted = amplitudeTracker.timeSinceInstallFormatted || 'Unknown';
    }

    const cleanedLocation = `${locationData.city}, ${locationData.country}`;
    const systemSummary = buildSystemSummary(browserInfo, osInfo, screenResolution);
    const localeSummary = buildLocaleSummary(language, cleanedLocation);

    const data = {
        access_key: WEB3FORMS_ACCESS_KEY,
        subject: 'Monkey Block - Complete Uninstall Feedback',
        from_name: 'Monkey Block User',

        time_since_install: timeSinceInstallFormatted,
        reason: selectedReason,
        version: feedbackData.version,
        system: systemSummary,
        locale: localeSummary
    };

    addOptionalField(data, 'user_email', feedbackData.email || '');
    addOptionalField(data, 'missing_feature', missingFeature || '');
    addOptionalField(data, 'confusing_reason', confusingReason || '');
    addOptionalField(data, 'technical_issue', technicalIssue || '');
    addOptionalField(data, 'better_alternative_reason', betterAlternativeReason || '');
    addOptionalField(data, 'other_reason', otherReason || '');
    addOptionalField(data, 'detailed_feedback', feedbackData.feedback || '');

    const response = await sendWeb3FormsPayload(data);

    if (!response.ok) {
        throw new Error('Failed to send feedback');
    }

    // Mark as sent and clear draft
    feedbackData.sent = true;
    localStorage.removeItem('feedback-draft');
}

// Analytics telemetry (optional - for tracking completion rates)
function sendTelemetry(event, data = {}) {
    // You could send this to Google Analytics, Mixpanel, etc.
    console.log('Telemetry:', event, data);
    
    // Example with GA4 (if implemented):
    // gtag('event', event, data);
}

// Auto-save draft functionality
function saveDraft() {
    const draftData = {
        stage: feedbackData.stage || 'step1',
        step2Reached: !!feedbackData.step2Reached,
        reason: selectedReason,
        missingFeature: feedbackData.missingFeature || '',
        confusingReason: feedbackData.confusingReason || '',
        otherReason: feedbackData.otherReason || '',
        technicalIssue: feedbackData.technicalIssue || '',
        betterAlternativeReason: feedbackData.betterAlternativeReason || '',
        feedback: document.getElementById('feedback')?.value || '',
        email: document.getElementById('email')?.value || '',
        timestamp: Date.now(),
        version: feedbackData.version
    };
    
    localStorage.setItem('feedback-draft', JSON.stringify(draftData));

    if ((draftData.stage || 'step1') === 'step1') {
        scheduleStep1QuickFeedback();
    } else {
        clearStep1QuickFeedbackTimer();
    }
}

// Setup auto-send for abandoned drafts
function setupAutoSendDraft() {
    // Check every 30 seconds if there's an abandoned draft
    setInterval(() => {
        const draft = localStorage.getItem('feedback-draft');
        if (draft) {
            const data = JSON.parse(draft);
            const thresholdMs = data.step2Reached ? 10 * 60 * 1000 : STEP1_QUICK_FEEDBACK_DELAY_MS;
            if (Date.now() - data.timestamp > thresholdMs && data.reason) {
                sendAbandonedDraft(data, getCurrentAbandonmentStage());
                localStorage.removeItem('feedback-draft');
            }
        }
    }, 30000);
    
    window.addEventListener('beforeunload', () => {
        const draft = localStorage.getItem('feedback-draft');
        if (draft && !feedbackData.sent) {
            const data = JSON.parse(draft);
            const isStep1Ready = !data.step2Reached && (Date.now() - data.timestamp >= STEP1_QUICK_FEEDBACK_DELAY_MS);
            if (data.reason && (data.step2Reached || isStep1Ready)) {
                sendAbandonedDraft(data, getCurrentAbandonmentStage(), true);
                localStorage.removeItem('feedback-draft');
            }
        }
    });
}

function getCurrentAbandonmentStage() {
    const step2 = document.getElementById('step2');
    return step2 && step2.style.display !== 'none' ? 'step2' : 'step1';
}

// Restore draft on load
function restoreDraft() {
    const draft = localStorage.getItem('feedback-draft');
    if (draft) {
        const data = JSON.parse(draft);
        const queryEmail = (new URLSearchParams(window.location.search).get('account_email') || '').trim();
        // Only restore if less than 1 hour old
        if (Date.now() - data.timestamp < 3600000) {
            feedbackData = { ...feedbackData, ...data };
            if (document.getElementById('feedback')) {
                document.getElementById('feedback').value = data.feedback || '';
            }
            if (document.getElementById('email')) {
                document.getElementById('email').value = queryEmail || data.email || '';
            }
            feedbackData.email = queryEmail || data.email || '';
            if (feedbackData.email) {
                showEmailField(false);
                hideEmailReplyPrompt();
            }
            if ((data.stage || 'step1') === 'step1' && data.reason) {
                scheduleStep1QuickFeedback();
            }
        }
    }
}

// Send abandoned draft
async function sendAbandonedDraft(draftData, abandonmentStage = 'step1', useKeepalive = false) {
    // Get system information
    const language = navigator.language || 'Unknown';
    const screenResolution = `${screen.width}x${screen.height}`;

    // Parse user agent for better readability
    const ua = navigator.userAgent;
    let browserInfo = 'Unknown Browser';
    let osInfo = 'Unknown OS';

    // Detect browser
    if (ua.includes('Chrome') && !ua.includes('Edg')) {
        const chromeVersion = ua.match(/Chrome\/([\d.]+)/)?.[1] || '';
        browserInfo = `Chrome ${chromeVersion}`;
    } else if (ua.includes('Edg')) {
        const edgeVersion = ua.match(/Edg\/([\d.]+)/)?.[1] || '';
        browserInfo = `Edge ${edgeVersion}`;
    } else if (ua.includes('Firefox')) {
        const firefoxVersion = ua.match(/Firefox\/([\d.]+)/)?.[1] || '';
        browserInfo = `Firefox ${firefoxVersion}`;
    } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
        const safariVersion = ua.match(/Version\/([\d.]+)/)?.[1] || '';
        browserInfo = `Safari ${safariVersion}`;
    }

    // Detect OS
    if (ua.includes('Windows')) {
        osInfo = 'Windows';
        if (ua.includes('Windows NT 10.0')) osInfo = 'Windows 10/11';
    } else if (ua.includes('Mac')) {
        osInfo = 'macOS';
    } else if (ua.includes('Linux')) {
        osInfo = 'Linux';
    } else if (ua.includes('Android')) {
        osInfo = 'Android';
    } else if (ua.includes('iOS')) {
        osInfo = 'iOS';
    }

    // Try to get location data (non-blocking)
    let locationData = { country: 'Unknown', city: 'Unknown', region: '' };
    try {
        const geoResponse = await fetch('https://ipapi.co/json/');
        if (geoResponse.ok) {
            const geoData = await geoResponse.json();
            locationData = {
                country: geoData.country_name || 'Unknown',
                city: geoData.city || 'Unknown',
                region: geoData.region || ''
            };
        }
    } catch (geoError) {
        console.log('Could not fetch location data for abandoned draft');
    }

    // Get time since install from Amplitude tracker if available
    let timeSinceInstallFormatted = 'Unknown';
    if (amplitudeTracker) {
        timeSinceInstallFormatted = amplitudeTracker.timeSinceInstallFormatted || 'Unknown';
    }

    const cleanedLocation = `${locationData.city}, ${locationData.country}`;
    const systemSummary = buildSystemSummary(browserInfo, osInfo, screenResolution);
    const localeSummary = buildLocaleSummary(language, cleanedLocation);

    const payload = {
        access_key: WEB3FORMS_ACCESS_KEY,
        subject: abandonmentStage === 'step1' ? 'Monkey Block - Quick Uninstall Feedback' : 'Monkey Block - Abandoned Uninstall Feedback',
        from_name: 'Monkey Block User',

        time_since_install: timeSinceInstallFormatted,
        reason: draftData.reason || 'not selected',
        abandonment_stage: abandonmentStage,
        draft_age_minutes: Math.floor((Date.now() - draftData.timestamp) / 60000),
        version: draftData.version,
        system: systemSummary,
        locale: localeSummary
    };

    addOptionalField(payload, 'user_email', draftData.email || '');
    addOptionalField(payload, 'missing_feature', draftData.missingFeature || '');
    addOptionalField(payload, 'confusing_reason', draftData.confusingReason || '');
    addOptionalField(payload, 'technical_issue', draftData.technicalIssue || '');
    addOptionalField(payload, 'better_alternative_reason', draftData.betterAlternativeReason || '');
    addOptionalField(payload, 'other_reason', draftData.otherReason || '');
    addOptionalField(payload, 'detailed_feedback', draftData.feedback || '');

    if (amplitudeTracker) {
        amplitudeTracker.track(`Uninstall - Abandonment ${abandonmentStage === 'step2' ? 'Step 2' : 'Step 1'}`, {
            reason: draftData.reason || 'not selected',
            has_missing_feature: !!draftData.missingFeature,
            has_confusing_reason: !!draftData.confusingReason,
            has_technical_issue: !!draftData.technicalIssue,
            has_better_alternative_reason: !!draftData.betterAlternativeReason,
            has_other_reason: !!draftData.otherReason,
            has_detailed_feedback: !!draftData.feedback,
            has_email: !!draftData.email
        });
    }

    sendWeb3FormsPayload(payload, useKeepalive).catch(() => {});
}
