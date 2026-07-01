// Application State
let state = {
    docId: null,
    filename: '',
    pages: [],
    currentPageIndex: 0,
    zoom: 1.0,
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    ocrData: {} // Client cache: { pageIndex_model: { text, tokens, duration } }
};

// UI Elements
const uploadView = document.getElementById('upload-view');
const workspaceView = document.getElementById('workspace-view');
const fileInput = document.getElementById('file-input');
const uploadCard = document.querySelector('.upload-card');
const uploadNewBtn = document.getElementById('upload-new-btn');

// Custom Modal Elements
const confirmModal = document.getElementById('confirm-modal');
const confirmYesBtn = document.getElementById('confirm-yes-btn');
const confirmNoBtn = document.getElementById('confirm-no-btn');

const prevPageBtn = document.getElementById('prev-page-btn');
const nextPageBtn = document.getElementById('next-page-btn');
const pageIndicator = document.getElementById('page-indicator');
const pageImage = document.getElementById('page-image');
const imageWrapper = document.getElementById('image-wrapper');

const zoomInBtn = document.getElementById('zoom-in-btn');
const zoomOutBtn = document.getElementById('zoom-out-btn');
const zoomIndicator = document.getElementById('zoom-indicator');

const pageTitle = document.getElementById('page-title');
const tokensCounter = document.getElementById('tokens-counter');
const durationCounter = document.getElementById('duration-counter');
const copyBtn = document.getElementById('copy-btn');
const ocrContent = document.getElementById('ocr-content');

const processingOverlay = document.getElementById('processing-overlay');
const runOcrOverlay = document.getElementById('run-ocr-overlay');
const triggerOcrBtn = document.getElementById('trigger-ocr-btn');
const toast = document.getElementById('toast');

// Initialize Marked Options for clean table rendering
marked.setOptions({
    breaks: true,
    gfm: true
});

// Event Listeners for File Upload
uploadCard.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadCard.classList.add('dragover');
});

uploadCard.addEventListener('dragleave', () => {
    uploadCard.classList.remove('dragover');
});

uploadCard.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadCard.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
        handleFileUpload(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileUpload(e.target.files[0]);
    }
});

uploadCard.querySelector('button').addEventListener('click', () => {
    fileInput.click();
});

// Modal Confirmation Dialog Setup
uploadNewBtn.addEventListener('click', () => {
    confirmModal.style.display = 'flex';
});

confirmYesBtn.addEventListener('click', () => {
    confirmModal.style.display = 'none';
    resetApp();
});

confirmNoBtn.addEventListener('click', () => {
    confirmModal.style.display = 'none';
});

// Page Navigation Events
prevPageBtn.addEventListener('click', () => {
    if (state.currentPageIndex > 0) {
        state.currentPageIndex--;
        renderCurrentPageState();
    }
});

nextPageBtn.addEventListener('click', () => {
    if (state.currentPageIndex < state.pages.length - 1) {
        state.currentPageIndex++;
        renderCurrentPageState();
    }
});

// Zoom Events
zoomInBtn.addEventListener('click', () => {
    if (state.zoom < 2.5) {
        state.zoom += 0.1;
        applyZoom();
    }
});

zoomOutBtn.addEventListener('click', () => {
    if (state.zoom > 0.5) {
        state.zoom -= 0.1;
        applyZoom();
    }
});

// OCR Trigger
triggerOcrBtn.addEventListener('click', runOCR);

// Copy to Clipboard
copyBtn.addEventListener('click', copyOcrText);

// Core Functions
function resetApp() {
    state = {
        docId: null,
        filename: '',
        pages: [],
        currentPageIndex: 0,
        zoom: 1.0,
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        ocrData: {}
    };
    fileInput.value = '';
    pageImage.src = '';
    ocrContent.innerHTML = '';
    
    // UI Toggles
    workspaceView.style.display = 'none';
    uploadView.style.display = 'flex';
    uploadNewBtn.style.display = 'none';
}

function handleFileUpload(file) {
    // Validate file type
    const validExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];
    const extension = file.name.split('.').pop().toLowerCase();
    
    if (!validExtensions.includes(extension)) {
        showToast('صيغة الملف غير مدعومة. يرجى رفع ملف PDF أو صورة.', true);
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    showToast('جاري رفع المستند ومعالجته...');
    
    fetch('/api/upload', {
        method: 'POST',
        body: formData
    })
    .then(res => {
        if (!res.ok) {
            return res.json().then(err => { throw new Error(err.error || 'فشل رفع الملف') });
        }
        return res.json();
    })
    .then(data => {
        state.docId = data.doc_id;
        state.filename = data.filename;
        state.pages = data.pages;
        state.currentPageIndex = 0;
        state.zoom = 1.0;
        state.ocrData = {}; // Clear previous cache
        
        showToast('تم رفع المستند بنجاح!');
        setupWorkspace();
    })
    .catch(err => {
        console.error(err);
        showToast(err.message || 'حدث خطأ أثناء الرفع.', true);
    });
}

function setupWorkspace() {
    uploadView.style.display = 'none';
    workspaceView.style.display = 'flex';
    uploadNewBtn.style.display = 'flex';
    
    renderCurrentPageState();
}

function renderCurrentPageState() {
    if (!state.pages || state.pages.length === 0) return;
    
    const page = state.pages[state.currentPageIndex];
    pageImage.src = page.url;
    
    // Update Page indicators
    pageIndicator.textContent = `صفحة ${state.currentPageIndex + 1} من ${state.pages.length}`;
    pageTitle.textContent = `الصفحة ${state.currentPageIndex + 1}`;
    
    // Enable/disable navigation buttons
    prevPageBtn.disabled = state.currentPageIndex === 0;
    nextPageBtn.disabled = state.currentPageIndex === state.pages.length - 1;
    
    // Reset zoom
    state.zoom = 1.0;
    applyZoom();
    
    // Check if we already have the OCR data for this page/model combo
    const cacheKey = `${state.currentPageIndex}_${state.model}`;
    const cachedOcr = state.ocrData[cacheKey];
    
    if (cachedOcr) {
        showOcrResult(cachedOcr);
    } else {
        // Not processed yet
        runOcrOverlay.style.display = 'flex';
        processingOverlay.style.display = 'none';
        ocrContent.style.display = 'none';
        
        // Hide badges/actions
        tokensCounter.style.display = 'none';
        durationCounter.style.display = 'none';
        copyBtn.style.display = 'none';
    }
}

function applyZoom() {
    imageWrapper.style.transform = `scale(${state.zoom})`;
    zoomIndicator.textContent = `${Math.round(state.zoom * 100)}%`;
}

function runOCR() {
    if (!state.docId) return;
    
    const pageIndex = state.currentPageIndex;
    const model = state.model;
    const cacheKey = `${pageIndex}_${model}`;
    
    // Show loading spinner
    runOcrOverlay.style.display = 'none';
    processingOverlay.style.display = 'flex';
    ocrContent.style.display = 'none';
    
    fetch('/api/process', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            doc_id: state.docId,
            page_index: pageIndex,
            model: model
        })
    })
    .then(res => {
        if (!res.ok) {
            return res.json().then(err => { throw new Error(err.error || 'فشل تشغيل OCR') });
        }
        return res.json();
    })
    .then(data => {
        // Cache locally
        state.ocrData[cacheKey] = data;
        
        // If the user hasn't switched pages during processing, render it
        if (state.currentPageIndex === pageIndex && state.model === model) {
            showOcrResult(data);
        }
    })
    .catch(err => {
        console.error(err);
        showToast(err.message || 'فشل معالجة الصفحة باستخدام الذكاء الاصطناعي.', true);
        
        // Reset to trigger overlay if not completed
        if (state.currentPageIndex === pageIndex && state.model === model) {
            runOcrOverlay.style.display = 'flex';
            processingOverlay.style.display = 'none';
        }
    });
}

function showOcrResult(ocrData) {
    runOcrOverlay.style.display = 'none';
    processingOverlay.style.display = 'none';
    ocrContent.style.display = 'block';
    
    // Render Markdown to HTML
    ocrContent.innerHTML = marked.parse(ocrData.text);
    
    // Update token badge
    tokensCounter.textContent = `${ocrData.tokens_processed} tokens processed`;
    tokensCounter.style.display = 'inline-block';
    
    // Update duration badge
    durationCounter.textContent = `${ocrData.duration}s`;
    durationCounter.style.display = 'inline-block';
    
    // Show copy button
    copyBtn.style.display = 'inline-flex';
}

function copyOcrText() {
    const cacheKey = `${state.currentPageIndex}_${state.model}`;
    const cachedOcr = state.ocrData[cacheKey];
    
    if (!cachedOcr || !cachedOcr.text) return;
    
    navigator.clipboard.writeText(cachedOcr.text)
        .then(() => {
            // Success feedback animation
            const copyIcon = copyBtn.querySelector('.copy-icon');
            const checkIcon = copyBtn.querySelector('.check-icon');
            const btnText = copyBtn.querySelector('span');
            
            copyIcon.style.display = 'none';
            checkIcon.style.display = 'inline-block';
            btnText.textContent = 'تم النسخ!';
            
            showToast('تم نسخ النص إلى الحافظة بنجاح.');
            
            setTimeout(() => {
                copyIcon.style.display = 'inline-block';
                checkIcon.style.display = 'none';
                btnText.textContent = 'نسخ';
            }, 2000);
        })
        .catch(err => {
            console.error('Could not copy text: ', err);
            showToast('فشل نسخ النص.', true);
        });
}

// Toast Notification Helper
function showToast(message, isError = false) {
    toast.textContent = message;
    
    if (isError) {
        toast.classList.add('error');
    } else {
        toast.classList.remove('error');
    }
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3500);
}
