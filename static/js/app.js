// Translation Dictionary
const translations = {
    ar: {
        langName: 'EN',
        logoTitle: 'منصة بيان',
        uploadNew: 'رفع مستند جديد',
        welcome: 'مرحباً بك في منصة بيان',
        desc: 'الحل الأسهل والأسرع لتحويل المستندات والملفات الممسوحة ضوئياً (PDF والصور) إلى نصوص رقمية قابلة للتعديل والنسخ بدقة فائقة باستخدام تقنيات الذكاء الاصطناعي.',
        goalsTitle: 'أهداف المنصة:',
        goal1: 'رقمنة الخطابات والمستندات الورقية وتسهيل نسخها والتعديل عليها.',
        goal2: 'استخراج الجداول المعقدة وتنسيقها تلقائياً كجداول رقمية متطابقة.',
        goal3: 'توفير الوقت عبر النسخ الفوري للنصوص دون أي هوامش أو شروح زائدة.',
        dragDrop: 'قم بسحب وإفلات ملف الـ PDF أو الصور هنا',
        formats: 'يدعم المستندات بصيغة PDF، PNG، JPEG، WebP',
        chooseFile: 'اختر ملفاً',
        notProcessed: 'هذه الصفحة لم تتم معالجتها بعد',
        startOcr: 'بدء المعالجة (OCR)',
        processing: 'جاري المعالجة...',
        copy: 'نسخ',
        copied: 'تم النسخ!',
        confirmTitle: 'تأكيد الإجراء',
        confirmDesc: 'هل أنت متأكد من رغبتك في رفع مستند جديد؟ سيتم فقدان العمل الحالي.',
        confirmYes: 'حسناً',
        confirmNo: 'إلغاء',
        toastUploading: 'جاري رفع المستند ومعالجته...',
        toastUploadSuccess: 'تم رفع المستند بنجاح!',
        toastCopySuccess: 'تم نسخ النص إلى الحافظة بنجاح.',
        toastCopyError: 'فشل نسخ النص.',
        toastInvalidFile: 'صيغة الملف غير مدعومة. يرجى رفع ملف PDF أو صورة.',
        ocrError: 'فشل معالجة الصفحة باستخدام الذكاء الاصطناعي.',
        pageLabel: 'صفحة',
        pageOf: 'من'
    },
    en: {
        langName: 'العربية',
        logoTitle: 'Bayan Platform',
        uploadNew: 'Upload New Document',
        welcome: 'Welcome to Bayan Platform',
        desc: 'The easiest and fastest solution to convert scanned documents (PDFs and images) into editable and copyable digital text with high precision using artificial intelligence.',
        goalsTitle: 'Platform Goals:',
        goal1: 'Digitizing letters and paper documents, making them easy to copy and edit.',
        goal2: 'Extracting complex tables and automatically formatting them as matching digital tables.',
        goal3: 'Saving time through instant text copying without any headers or extra commentary.',
        dragDrop: 'Drag and drop PDF file or images here',
        formats: 'Supports PDF, PNG, JPEG, WebP files',
        chooseFile: 'Choose File',
        notProcessed: 'This page has not been processed yet',
        startOcr: 'Start Processing (OCR)',
        processing: 'Processing...',
        copy: 'Copy',
        copied: 'Copied!',
        confirmTitle: 'Confirm Action',
        confirmDesc: 'Are you sure you want to upload a new document? Current work will be lost.',
        confirmYes: 'OK',
        confirmNo: 'Cancel',
        toastUploading: 'Uploading and processing document...',
        toastUploadSuccess: 'Document uploaded successfully!',
        toastCopySuccess: 'Text copied to clipboard successfully.',
        toastCopyError: 'Failed to copy text.',
        toastInvalidFile: 'Unsupported file type. Please upload a PDF or an image.',
        ocrError: 'Failed to process page using AI.',
        pageLabel: 'Page',
        pageOf: 'of'
    }
};

// Application State
let state = {
    docId: null,
    filename: '',
    pages: [],
    currentPageIndex: 0,
    zoom: 1.0,
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    lang: 'ar',
    ocrData: {} // Client cache: { pageIndex_model: { text, tokens, duration } }
};

// UI Elements
const uploadView = document.getElementById('upload-view');
const workspaceView = document.getElementById('workspace-view');
const fileInput = document.getElementById('file-input');
const uploadCard = document.querySelector('.upload-card');
const uploadNewBtn = document.getElementById('upload-new-btn');
const langToggleBtn = document.getElementById('lang-toggle-btn');

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
        lang: state.lang,
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
        showToast(translations[state.lang].toastInvalidFile, true);
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    showToast(translations[state.lang].toastUploading);
    
    fetch('api/upload', {
        method: 'POST',
        body: formData
    })
    .then(res => {
        if (!res.ok) {
            return res.json().then(err => { throw new Error(err.error || (state.lang === 'ar' ? 'فشل رفع الملف' : 'Failed to upload file')) });
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
        
        showToast(translations[state.lang].toastUploadSuccess);
        setupWorkspace();
    })
    .catch(err => {
        console.error(err);
        showToast(err.message || (state.lang === 'ar' ? 'حدث خطأ أثناء الرفع.' : 'An error occurred during upload.'), true);
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
    
    // Update Page indicators using selected language
    const t = translations[state.lang];
    pageIndicator.textContent = `${t.pageLabel} ${state.currentPageIndex + 1} ${t.pageOf} ${state.pages.length}`;
    pageTitle.textContent = `${t.pageLabel} ${state.currentPageIndex + 1}`;
    
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
    
    fetch('api/process', {
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
            return res.json().then(err => { throw new Error(err.error || (state.lang === 'ar' ? 'فشل تشغيل OCR' : 'Failed to run OCR')) });
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
        showToast(err.message || translations[state.lang].ocrError, true);
        
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
            btnText.textContent = translations[state.lang].copied;
            
            showToast(translations[state.lang].toastCopySuccess);
            
            setTimeout(() => {
                copyIcon.style.display = 'inline-block';
                checkIcon.style.display = 'none';
                btnText.textContent = translations[state.lang].copy;
            }, 2000);
        })
        .catch(err => {
            console.error('Could not copy text: ', err);
            showToast(translations[state.lang].toastCopyError, true);
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

// Apply Selected Language translations to the page
function applyLanguage() {
    const lang = state.lang;
    const t = translations[lang];
    
    // Set document direction and language code
    if (lang === 'ar') {
        document.documentElement.dir = 'rtl';
        document.documentElement.lang = 'ar';
    } else {
        document.documentElement.dir = 'ltr';
        document.documentElement.lang = 'en';
    }
    
    // Header
    langToggleBtn.querySelector('span').textContent = t.langName;
    document.querySelector('.header-logo h1').textContent = t.logoTitle;
    document.getElementById('upload-new-btn').querySelector('span').textContent = t.uploadNew;
    
    // Landing Info
    const welcomeEl = document.querySelector('.landing-info h2');
    if (welcomeEl) welcomeEl.textContent = t.welcome;
    
    const descEl = document.querySelector('.landing-desc');
    if (descEl) descEl.textContent = t.desc;
    
    const goalsTitleEl = document.querySelector('.landing-goals h3');
    if (goalsTitleEl) goalsTitleEl.textContent = t.goalsTitle;
    
    const goalItems = document.querySelectorAll('.landing-goals li span');
    if (goalItems.length >= 3) {
        goalItems[0].textContent = t.goal1;
        goalItems[1].textContent = t.goal2;
        goalItems[2].textContent = t.goal3;
    }
    
    // Upload Card
    const uploadDragEl = document.querySelector('.upload-card h2');
    if (uploadDragEl) uploadDragEl.textContent = t.dragDrop;
    
    const uploadFormatsEl = document.querySelector('.upload-card p');
    if (uploadFormatsEl) uploadFormatsEl.textContent = t.formats;
    
    const uploadBtnEl = document.querySelector('.upload-card button');
    if (uploadBtnEl) uploadBtnEl.textContent = t.chooseFile;
    
    // Workspace View
    document.querySelector('.processing-text').textContent = t.processing;
    document.querySelector('.run-ocr-container h3').textContent = t.notProcessed;
    document.getElementById('trigger-ocr-btn').textContent = t.startOcr;
    
    const copyBtnSpan = document.getElementById('copy-btn').querySelector('span');
    if (copyBtnSpan) copyBtnSpan.textContent = t.copy;
    
    // Confirm Modal
    document.querySelector('.modal-card h3').textContent = t.confirmTitle;
    document.querySelector('.modal-card p').textContent = t.confirmDesc;
    document.getElementById('confirm-yes-btn').textContent = t.confirmYes;
    document.getElementById('confirm-no-btn').textContent = t.confirmNo;
    
    // Render current page state to update dynamic page label translations
    if (state.docId) {
        renderCurrentPageState();
    }
}

// Initialization on DOM Content Load
document.addEventListener('DOMContentLoaded', () => {
    // Add language toggle click listener
    langToggleBtn.addEventListener('click', () => {
        state.lang = state.lang === 'ar' ? 'en' : 'ar';
        applyLanguage();
    });
    
    // Apply default language
    applyLanguage();
});
