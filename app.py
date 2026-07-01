import os
import uuid
import base64
import time
import json
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
import fitz  # PyMuPDF
from dotenv import load_dotenv
from groq import Groq

# Load environment variables
load_dotenv()

app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app)

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Initialize Groq client
api_key = os.environ.get("GROQ_API_KEY")
groq_client = None
if api_key:
    groq_client = Groq(api_key=api_key)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part in the request'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected for uploading'}), 400

    # Create a unique ID for this upload session
    doc_id = str(uuid.uuid4())
    doc_dir = os.path.join(UPLOAD_FOLDER, doc_id)
    pages_dir = os.path.join(doc_dir, 'pages')
    os.makedirs(pages_dir, exist_ok=True)

    filename = file.filename
    file_ext = os.path.splitext(filename)[1].lower()
    
    # Save the original file
    original_file_path = os.path.join(doc_dir, f"document{file_ext}")
    file.save(original_file_path)

    pages = []
    
    try:
        if file_ext == '.pdf':
            # Open PDF with PyMuPDF
            doc = fitz.open(original_file_path)
            total_pages = len(doc)
            
            for page_num in range(total_pages):
                page = doc.load_page(page_num)
                # Render page to image (150 DPI is a good balance of quality and size)
                pix = page.get_pixmap(dpi=150)
                page_filename = f"page_{page_num}.png"
                page_path = os.path.join(pages_dir, page_filename)
                pix.save(page_path)
                
                # Add to pages list
                pages.append({
                    'index': page_num,
                    'url': f"/uploads/{doc_id}/pages/{page_filename}"
                })
            doc.close()
        elif file_ext in ['.png', '.jpg', '.jpeg', '.webp']:
            # Single image file
            page_filename = "page_0.png"
            page_path = os.path.join(pages_dir, page_filename)
            
            # Re-save using PIL to ensure standard PNG format
            from PIL import Image
            img = Image.open(original_file_path)
            img.save(page_path, 'PNG')
            
            pages.append({
                'index': 0,
                'url': f"/uploads/{doc_id}/pages/{page_filename}"
            })
            total_pages = 1
        else:
            return jsonify({'error': f'Unsupported file type: {file_ext}'}), 400

        # Initialize cache file
        cache_path = os.path.join(doc_dir, 'cache.json')
        with open(cache_path, 'w', encoding='utf-8') as f:
            json.dump({}, f)

        return jsonify({
            'doc_id': doc_id,
            'filename': filename,
            'total_pages': total_pages,
            'pages': pages
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Failed to process file: {str(e)}'}), 500

@app.route('/uploads/<doc_id>/pages/<filename>')
def serve_page_image(doc_id, filename):
    page_dir = os.path.join(UPLOAD_FOLDER, doc_id, 'pages')
    return send_from_directory(page_dir, filename)

@app.route('/api/process', methods=['POST'])
def process_page():
    if not groq_client:
        return jsonify({'error': 'Groq API Key is not configured on the server.'}), 500

    data = request.json
    if not data or 'doc_id' not in data or 'page_index' not in data:
        return jsonify({'error': 'Missing doc_id or page_index'}), 400

    doc_id = data['doc_id']
    page_index = int(data['page_index'])
    model_name = data.get('model', 'meta-llama/llama-4-scout-17b-16e-instruct')

    doc_dir = os.path.join(UPLOAD_FOLDER, doc_id)
    cache_path = os.path.join(doc_dir, 'cache.json')
    page_filename = f"page_{page_index}.png"
    page_path = os.path.join(doc_dir, 'pages', page_filename)

    if not os.path.exists(page_path):
        return jsonify({'error': f'Page image {page_filename} not found.'}), 404

    # Check cache first
    cache = {}
    if os.path.exists(cache_path):
        try:
            with open(cache_path, 'r', encoding='utf-8') as f:
                cache = json.load(f)
        except Exception:
            pass

    cache_key = f"{page_index}_{model_name}"
    if cache_key in cache:
        return jsonify(cache[cache_key])

    # Perform OCR using Groq Vision API
    try:
        # Encode image to base64
        with open(page_path, "rb") as img_file:
            base64_image = base64.b64encode(img_file.read()).decode('utf-8')

        start_time = time.time()
        
        # System prompt tailored for layout-preserving OCR transcription
        system_prompt = (
            "You are a high-fidelity OCR transcriber. Your task is to extract all text from the image and format it to match the original document's layout exactly. "
            "Follow these rules strictly:\n"
            "1. Output ONLY the final transcribed text. Do NOT write any introduction, commentary, conversational filler, reasoning, or labels describing the images/sections (do NOT write things like 'Image 1 Transcription', 'Section 1:', 'Header:', 'Footer:', etc.).\n"
            "2. Match the document's structure: If there is a table, you MUST transcribe it as a clean Markdown table (using | separators and headers). Do NOT list table cells vertically; transcribe them line-by-line, preserving the rows and columns.\n"
            "3. If there is a letter, announcement, or paragraph of text, transcribe it as formatted paragraphs of text.\n"
            "4. Do NOT explain or describe icons, logos, or shapes. Just transcribe the text accompanying them.\n"
            "5. Keep the original language exactly (e.g. Arabic for Arabic text, English for English text).\n"
            "6. Output the transcription directly. Do not wrap it in code blocks."
        )

        response = groq_client.chat.completions.create(
            model=model_name,
            messages=[
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Transcribe this image exactly. If there is a table, format it as a markdown table. If there is a letter or announcement, format it as text paragraphs. Output only the transcription, with no conversational text or section labels."
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            temperature=0.1,
            max_tokens=4000,
        )

        duration = time.time() - start_time
        ocr_text = response.choices[0].message.content
        
        # Extract token counts
        usage = response.usage
        tokens_processed = usage.total_tokens if usage else 0

        result = {
            'text': ocr_text,
            'tokens_processed': tokens_processed,
            'duration': round(duration, 2),
            'model': model_name
        }

        # Cache the result
        cache[cache_key] = result
        with open(cache_path, 'w', encoding='utf-8') as f:
            json.dump(cache, f, ensure_ascii=False, indent=2)

        return jsonify(result)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Groq API error: {str(e)}'}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
