// Elementy DOM
const uploadArea = document.getElementById('uploadArea');
const imageInput = document.getElementById('imageInput');
const translateBtn = document.getElementById('translateBtn');
const originalImage = document.getElementById('originalImage');
const translationResult = document.getElementById('translationResult');
const translatedImage = document.getElementById('translatedImage');
const copyTextBtn = document.getElementById('copyTextBtn');
const editTextBtn = document.getElementById('editTextBtn');
const downloadBtn = document.getElementById('downloadBtn');
const apiKeyInput = document.getElementById('apiKey');
const apiUrlSelect = document.getElementById('apiUrl');

// Zmienne globalne
let currentImage = null;
let extractedText = '';
let translatedText = '';

// Nasłuchiwanie zdarzeń
uploadArea.addEventListener('click', () => {
    imageInput.click();
});

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    if (e.dataTransfer.files.length) {
        handleImageUpload(e.dataTransfer.files[0]);
    }
});

imageInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        handleImageUpload(e.target.files[0]);
    }
});

translateBtn.addEventListener('click', translateImage);
copyTextBtn.addEventListener('click', copyTranslatedText);
editTextBtn.addEventListener('click', editTranslatedText);
downloadBtn.addEventListener('click', downloadTranslatedImage);

// Funkcja obsługująca przesyłanie obrazu
function handleImageUpload(file) {
    // Sprawdzenie czy to obraz
    if (!file.type.match('image.*')) {
        alert('Proszę wybrać plik obrazu (JPG, PNG, GIF)');
        return;
    }
    
    // Wyświetlenie podglądu obrazu
    const reader = new FileReader();
    reader.onload = (e) => {
        originalImage.innerHTML = `<img src="${e.target.result}" alt="Przesłany obraz">`;
        translateBtn.disabled = false;
        currentImage = e.target.result;
    };
    reader.readAsDataURL(file);
}

// Główna funkcja tłumacząca obraz
async function translateImage() {
    if (!currentImage) {
        alert('Proszę najpierw przesłać obraz');
        return;
    }
    
    // Symulacja ładowania
    translationResult.innerHTML = '<p class="loading">Trwa rozpoznawanie tekstu... Proszę czekać.</p>';
    translateBtn.disabled = true;
    copyTextBtn.disabled = true;
    editTextBtn.disabled = true;
    downloadBtn.disabled = true;
    
    try {
        // 1. Ekstrakcja tekstu z obrazu przy użyciu Tesseract.js
        extractedText = await extractTextFromImage(currentImage);
        
        // 2. Tłumaczenie tekstu przy użyciu API
        translationResult.innerHTML = '<p class="loading">Trwa tłumaczenie tekstu... Proszę czekać.</p>';
        translatedText = await translateTextWithAPI(extractedText);
        
        // 3. Wyświetlenie przetłumaczonego tekstu
        displayTranslatedText(translatedText);
        
        // 4. Generowanie obrazu z przetłumaczonym tekstem
        createTranslatedImage(currentImage, translatedText);
        
        // 5. Aktywacja przycisków kontrolnych
        copyTextBtn.disabled = false;
        editTextBtn.disabled = false;
        downloadBtn.disabled = false;
        
    } catch (error) {
        console.error('Błąd podczas tłumaczenia:', error);
        translationResult.innerHTML = `<p class="error">Wystąpił błąd: ${error.message}</p>`;
    } finally {
        translateBtn.disabled = false;
    }
}

// Funkcja ekstrakcji tekstu z obrazu przy użyciu Tesseract.js
async function extractTextFromImage(imageSrc) {
    const { createWorker } = Tesseract;
    const worker = await createWorker('eng'); // Ustawienie języka angielskiego
    
    try {
        const { data: { text } } = await worker.recognize(imageSrc);
        await worker.terminate();
        
        if (!text || text.trim() === '') {
            throw new Error('Nie udało się rozpoznać tekstu na obrazie. Spróbuj z innym obrazem.');
        }
        
        return text.trim();
    } catch (error) {
        await worker.terminate();
        throw new Error('Błąd podczas rozpoznawania tekstu: ' + error.message);
    }
}

// Funkcja tłumaczenia tekstu przy użyciu API
async function translateTextWithAPI(text) {
    const apiUrl = apiUrlSelect.value;
    const apiKey = apiKeyInput.value.trim();
    
    // Sprawdzenie długości tekstu (LibreTranslate ma limit 1000 znaków)
    if (text.length > 1000 && apiUrl.includes('libretranslate')) {
        // Dla długich tekstów dzielimy na części
        return await translateLongText(text, apiUrl, apiKey);
    }
    
    const requestBody = {
        q: text,
        source: "en",
        target: "pl",
        format: "text"
    };
    
    // Dodanie klucza API jeśli został podany
    if (apiKey) {
        requestBody.api_key = apiKey;
    }
    
    try {
        const response = await fetch(apiUrl, {
            method: "POST",
            body: JSON.stringify(requestBody),
            headers: { "Content-Type": "application/json" }
        });
        
        if (!response.ok) {
            throw new Error(`Błąd API: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Obsługa różnych formatów odpowiedzi API
        if (data.translatedText) {
            return data.translatedText;
        } else if (data.responseData && data.responseData.translatedText) {
            return data.responseData.translatedText;
        } else {
            throw new Error('Nieprawidłowy format odpowiedzi API');
        }
    } catch (error) {
        throw new Error('Błąd podczas tłumaczenia: ' + error.message);
    }
}

// Funkcja do tłumaczenia długich tekstów (podział na części)
async function translateLongText(text, apiUrl, apiKey) {
    const sentences = text.split('. ');
    let translatedText = '';
    
    for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        if (sentence.trim() === '') continue;
        
        try {
            const translatedSentence = await translateTextWithAPI(sentence + '.');
            translatedText += translatedSentence + ' ';
        } catch (error) {
            console.error(`Błąd tłumaczenia zdania ${i+1}:`, error);
            translatedText += sentence + '. ';
        }
        
        // Aktualizacja postępu
        const progress = Math.round(((i + 1) / sentences.length) * 100);
        translationResult.innerHTML = `<p class="loading">Trwa tłumaczenie... ${progress}%</p>`;
    }
    
    return translatedText;
}

// Funkcja wyświetlająca przetłumaczony tekst
function displayTranslatedText(text) {
    translationResult.innerHTML = `
        <div class="translated-text">
            <h4>Przetłumaczony tekst:</h4>
            <p id="translatedTextContent">${text}</p>
        </div>
    `;
}

// Funkcja tworząca przetłumaczony obraz
function createTranslatedImage(src, translatedText) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const img = new Image();
    img.onload = function() {
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Rysowanie oryginalnego obrazu
        ctx.drawImage(img, 0, 0);
        
        // Przygotowanie tekstu do nałożenia
        const fontSize = Math.max(16, img.width / 30);
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.lineWidth = 2;
        ctx.textAlign = 'center';
        
        // Podział tekstu na linie
        const maxWidth = img.width * 0.8;
        const lines = wrapText(ctx, translatedText, maxWidth);
        
        // Rysowanie tekstu na obrazie
        const textY = img.height * 0.1;
        const lineHeight = fontSize * 1.2;
        
        lines.forEach((line, index) => {
            const y = textY + (index * lineHeight);
            
            // Rysowanie cienia/obrysu
            ctx.strokeText(line, img.width / 2, y);
            // Rysowanie tekstu
            ctx.fillText(line, img.width / 2, y);
        });
        
        // Wyświetlenie przetłumaczonego obrazu
        translatedImage.innerHTML = `<img src="${canvas.toDataURL()}" alt="Przetłumaczony obraz">`;
    };
    
    img.src = src;
}

// Funkcja pomocnicza do zawijania tekstu
function wrapText(context, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];
    
    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = context.measureText(currentLine + " " + word).width;
        if (width < maxWidth) {
            currentLine += " " + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
}

// Funkcja kopiująca przetłumaczony tekst do schowka
function copyTranslatedText() {
    const textContent = document.getElementById('translatedTextContent');
    if (!textContent) return;
    
    const textToCopy = textContent.textContent;
    
    navigator.clipboard.writeText(textToCopy)
        .then(() => {
            // Tymczasowa zmiana tekstu przycisku
            const originalText = copyTextBtn.textContent;
            copyTextBtn.textContent = 'Skopiowano!';
            setTimeout(() => {
                copyTextBtn.textContent = originalText;
            }, 2000);
        })
        .catch(err => {
            console.error('Błąd kopiowania: ', err);
            alert('Nie udało się skopiować tekstu');
        });
}

// Funkcja edycji przetłumaczonego tekstu
function editTranslatedText() {
    const textContent = document.getElementById('translatedTextContent');
    if (!textContent) return;
    
    const currentText = textContent.textContent;
    const textarea = document.createElement('textarea');
    textarea.value = currentText;
    textarea.style.width = '100%';
    textarea.style.height = '150px';
    textarea.style.padding = '10px';
    textarea.style.border = '1px solid #ddd';
    textarea.style.borderRadius = '5px';
    
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Zapisz zmiany';
    saveButton.className = 'control-btn';
    saveButton.style.marginTop = '10px';
    
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Anuluj';
    cancelButton.className = 'control-btn';
    cancelButton.style.marginTop = '10px';
    cancelButton.style.marginLeft = '10px';
    cancelButton.style.backgroundColor = '#e74c3c';
    
    // Zamiana zawartości
    textContent.parentNode.innerHTML = '';
    textContent.parentNode.appendChild(textarea);
    textContent.parentNode.appendChild(saveButton);
    textContent.parentNode.appendChild(cancelButton);
    
    // Obsługa zapisywania
    saveButton.addEventListener('click', () => {
        translatedText = textarea.value;
        displayTranslatedText(translatedText);
        createTranslatedImage(currentImage, translatedText);
        copyTextBtn.disabled = false;
        editTextBtn.disabled = false;
    });
    
    // Obsługa anulowania
    cancelButton.addEventListener('click', () => {
        displayTranslatedText(translatedText);
        copyTextBtn.disabled = false;
        editTextBtn.disabled = false;
    });
}

// Funkcja pobierania przetłumaczonego obrazu
function downloadTranslatedImage() {
    const img = translatedImage.querySelector('img');
    if (!img) return;
    
    const link = document.createElement('a');
    link.download = 'przetlumaczona_manga.png';
    link.href = img.src;
    link.click();
}

// Dodanie stylów dla komunikatu ładowania i błędów
const style = document.createElement('style');
style.textContent = `
    .loading {
        color: #3498db;
        font-style: italic;
    }
    
    .error {
        color: #e74c3c;
        font-weight: bold;
    }
    
    .translated-text {
        background-color: #f8f9fa;
        padding: 15px;
        border-radius: 5px;
        border-left: 4px solid #3498db;
    }
    
    .translated-text h4 {
        margin-bottom: 10px;
        color: #2c3e50;
    }
    
    .translated-text p {
        line-height: 1.6;
        white-space: pre-wrap;
    }
`;
document.head.appendChild(style);
