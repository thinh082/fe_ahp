(function () {
    const chatbotHTML = `
        <div id="chatbot-container" class="chatbot-container">
            <div id="chatbot-window" class="chatbot-window hidden">
                <div class="chatbot-header">
                    <span>Tro ly ao</span>
                    <button id="chatbot-close" aria-label="Dong">&times;</button>
                </div>
                <div class="chatbot-messages" id="chatbot-messages"></div>
                <div class="chatbot-input-area">
                    <input type="text" id="chatbot-input" placeholder="Nhap tin nhan..." />
                    <button id="chatbot-send" aria-label="Gui">➤</button>
                </div>
            </div>
            <button id="chatbot-toggle" class="chatbot-toggle" aria-label="Mo chatbot">💬</button>
        </div>
    `;

    document.body.insertAdjacentHTML("beforeend", chatbotHTML);

    const toggleBtn = document.getElementById("chatbot-toggle");
    const closeBtn = document.getElementById("chatbot-close");
    const chatWindow = document.getElementById("chatbot-window");
    const inputField = document.getElementById("chatbot-input");
    const sendBtn = document.getElementById("chatbot-send");
    const messagesContainer = document.getElementById("chatbot-messages");

    let chatHistory = [];
    const GROQ_CFG = window.AI_CONFIG?.groq || {};
    const GROQ_API_KEY = GROQ_CFG.apiKey || "";
    const GROQ_CHAT_MODEL = GROQ_CFG.chatModel || "llama-3.3-70b-versatile";

    const GEMINI_CFG = window.AI_CONFIG?.gemini || {};
    const GEMINI_API_KEY = GEMINI_CFG.apiKey || "";
    const GEMINI_MATRIX_MODEL = GEMINI_CFG.matrixModel || GEMINI_CFG.chatModel || "gemini-2.5-flash";
    const GEMINI_AUTOFIX_MODEL = GEMINI_CFG.autoFixModel || GEMINI_CFG.chatModel || "gemini-2.5-flash";

    function toggleChat() {
        chatWindow.classList.toggle("hidden");
        if (!chatWindow.classList.contains("hidden")) {
            setTimeout(() => inputField.focus(), 120);
        }
    }

    toggleBtn.addEventListener("click", toggleChat);
    closeBtn.addEventListener("click", toggleChat);

    function escapeHtml(str) {
        return String(str || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function formatInline(text) {
        return text
            .replace(/`([^`]+)`/g, "<code>$1</code>")
            .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
            .replace(/\*([^*]+)\*/g, "<em>$1</em>");
    }

    function formatBotMessage(text) {
        const normalized = String(text || "").replace(/\r/g, "").trim();
        if (!normalized) return "<p>Khong co noi dung tra ve.</p>";

        const blocks = normalized
            .split(/\n{2,}/)
            .map((b) => b.trim())
            .filter(Boolean);

        const html = blocks
            .map((block) => {
                const lines = block
                    .split("\n")
                    .map((l) => l.trim())
                    .filter(Boolean);
                if (!lines.length) return "";

                if (lines.length === 1 && /^#{1,3}\s+/.test(lines[0])) {
                    const heading = lines[0].replace(/^#{1,3}\s+/, "");
                    return `<h4>${formatInline(escapeHtml(heading))}</h4>`;
                }

                if (lines.every((l) => /^[-*]\s+/.test(l))) {
                    const items = lines
                        .map((l) => l.replace(/^[-*]\s+/, ""))
                        .map((l) => `<li>${formatInline(escapeHtml(l))}</li>`)
                        .join("");
                    return `<ul>${items}</ul>`;
                }

                if (lines.every((l) => /^\d+\.\s+/.test(l))) {
                    const items = lines
                        .map((l) => l.replace(/^\d+\.\s+/, ""))
                        .map((l) => `<li>${formatInline(escapeHtml(l))}</li>`)
                        .join("");
                    return `<ol>${items}</ol>`;
                }

                const paragraph = lines
                    .map((l) => formatInline(escapeHtml(l)))
                    .join("<br>");
                return `<p>${paragraph}</p>`;
            })
            .join("");

        return html || `<p>${formatInline(escapeHtml(normalized))}</p>`;
    }

    function addMessage(text, sender, id = null, options = {}) {
        const { loading = false } = options;
        const msgDiv = document.createElement("div");
        msgDiv.className = `message ${sender}${loading ? " loading" : ""}`;
        if (id) msgDiv.id = id;

        const meta = document.createElement("div");
        meta.className = "message-meta";
        if (sender === "user") {
            meta.textContent = "Ban";
        } else if (loading) {
            meta.textContent = "Tro ly AI • dang soan";
        } else {
            meta.textContent = "Tro ly AI";
        }

        const content = document.createElement("div");
        content.className = "message-content";
        if (sender === "bot" && !loading) {
            content.innerHTML = formatBotMessage(text);
        } else {
            content.textContent = text;
        }

        msgDiv.appendChild(meta);
        msgDiv.appendChild(content);
        messagesContainer.appendChild(msgDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    const SYSTEM_PROMPT = `Ban la tro ly AI cho he thong DSS chon dia diem kinh doanh bang AHP.

Muc tieu:
- Tra loi tieng Viet, ro rang, khong dai dong.
- Khong bia dat du lieu.
- Neu thieu du lieu dau vao, yeu cau bo sung ro rang.
- Neu thao tac can dang nhap, hay nhac nguoi dung dang nhap.

Dinh dang cau tra loi bat buoc:
- Dung markdown nhe voi tieu de ###
- Dung danh sach - hoac 1.
- Uu tien 3 phan:
  ### Tong quan
  ### Phan tich nhanh
  ### Viec can lam tiep theo`;

    const AHP_MATRIX_SYSTEM_PROMPT = `Ban la tro ly AHP.
Nhiem vu: chuyen mo ta cua user thanh ma tran so sanh cap AHP 5x5 cho 5 tieu chi theo thu tu:
1) Tiem nang doanh thu
2) Kha nang tiep can
3) Chi phi thue
4) Canh tranh
5) Rui ro

Rang buoc bat buoc:
- Chi tra ve JSON hop le, khong markdown, khong giai thich.
- Dinh dang:
{"matrix":[[1,c12,c13,c14,c15],[1/c12,1,c23,c24,c25],[1/c13,1/c23,1,c34,c35],[1/c14,1/c24,1/c34,1,c45],[1/c15,1/c25,1/c35,1/c45,1]]}
- Gia tri c12..c45 la so nguyen tu 1 den 9.
- Ma tran phai doi xung nghich dao va duong cheo chinh bang 1.`;

    const AHP_AUTOFIX_SYSTEM_PROMPT = `Ban la tro ly AHP chuyen sua ma tran khi CR cao.
Nhiem vu: nhan vao ma tran AHP 5x5 va CR hien tai, sau do tra ve ma tran moi de CR de giam xuong duoi 0.1.

Rang buoc bat buoc:
- Chi tra ve JSON hop le, khong markdown, khong giai thich.
- Dinh dang:
{"matrix":[[1,c12,c13,c14,c15],[1/c12,1,c23,c24,c25],[1/c13,1/c23,1,c34,c35],[1/c14,1/c24,1/c34,1,c45],[1/c15,1/c25,1/c35,1/c45,1]]}
- c12..c45 la so nguyen 1..9.
- Ma tran doi xung nghich dao, duong cheo chinh bang 1.
- Uu tien thay doi nhe so voi ma tran cu nhung huong toi tinh nhat quan cao hon.`;

    const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

    async function requestGroq(payload) {
        if (!GROQ_API_KEY) {
            throw new Error("Thieu GROQ API key. Hay kiem tra js/api-key.js");
        }

        const response = await fetch(GROQ_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${GROQ_API_KEY}`,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            let errorMessage = `HTTP ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                if (errorData.error && errorData.error.message) {
                    errorMessage = errorData.error.message;
                }
            } catch (e) {
                console.warn("Failed to parse error response as JSON", e);
            }
            throw new Error(errorMessage);
        }

        return await response.json();
    }

    function extractGroqText(data) {
        const text = data?.choices?.[0]?.message?.content;
        if (typeof text === "string" && text.trim()) return text.trim();

        throw new Error("Du lieu tra ve tu API khong hop le.");
    }

    async function requestGemini({ model, systemPrompt, userText, temperature = 0.1 }) {
        if (!GEMINI_API_KEY) {
            throw new Error("Thieu GEMINI API key. Hay kiem tra js/api-key.js");
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${GEMINI_API_KEY}`;
        const payload = {
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: "user", parts: [{ text: userText }] }],
            generationConfig: {
                temperature,
                responseMimeType: "application/json",
            },
        };

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            let errorMessage = `HTTP ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                if (errorData.error && errorData.error.message) {
                    errorMessage = errorData.error.message;
                }
            } catch (e) {
                console.warn("Failed to parse Gemini error response as JSON", e);
            }
            throw new Error(errorMessage);
        }

        return await response.json();
    }

    function extractGeminiText(data) {
        const parts = data?.candidates?.[0]?.content?.parts;
        if (Array.isArray(parts) && parts.length > 0) {
            const text = parts
                .map((p) => (typeof p.text === "string" ? p.text : ""))
                .join("\n")
                .trim();
            if (text) return text;
        }
        throw new Error("Du lieu tra ve tu Gemini khong hop le.");
    }

    function contentsToMessages(contents) {
        return (contents || []).map((item) => ({
            role: item?.role === "model" ? "assistant" : "user",
            content: (item?.parts || [])
                .map((p) => (typeof p?.text === "string" ? p.text : ""))
                .join("\n")
                .trim(),
        }));
    }

    async function callChatAPI(history) {
        const payload = {
            model: GROQ_CHAT_MODEL,
            temperature: 0.7,
            max_tokens: 1024,
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                ...contentsToMessages(history),
            ],
        };

        const data = await requestGroq(payload);
        return extractGroqText(data);
    }

    function parseJSONLoose(text) {
        try {
            return JSON.parse(text);
        } catch (_) { }

        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");
        if (start >= 0 && end > start) {
            try {
                return JSON.parse(text.slice(start, end + 1));
            } catch (_) { }
        }
        return null;
    }

    function normalizeAhpMatrix(matrix) {
        const n = 5;
        if (!Array.isArray(matrix) || matrix.length !== n) {
            throw new Error("AI khong tra ve du ma tran 5x5.");
        }

        const result = Array.from({ length: n }, () => Array(n).fill(1));
        for (let i = 0; i < n; i++) {
            if (!Array.isArray(matrix[i]) || matrix[i].length !== n) {
                throw new Error("Dinh dang ma tran khong hop le.");
            }
        }

        for (let i = 0; i < n; i++) {
            result[i][i] = 1;
            for (let j = i + 1; j < n; j++) {
                let upper = Number(matrix[i][j]);
                const lower = Number(matrix[j][i]);

                if (!Number.isFinite(upper) || upper <= 0) {
                    if (Number.isFinite(lower) && lower > 0) {
                        upper = 1 / lower;
                    }
                }
                if (!Number.isFinite(upper) || upper <= 0) upper = 1;
                if (upper < 1) upper = 1 / upper;

                upper = Math.round(upper);
                if (upper < 1) upper = 1;
                if (upper > 9) upper = 9;

                result[i][j] = upper;
                result[j][i] = 1 / upper;
            }
        }

        return result;
    }

    async function requestAhpMatrixFromPrompt(userPrompt) {
        const data = await requestGemini({
            model: GEMINI_MATRIX_MODEL,
            systemPrompt: AHP_MATRIX_SYSTEM_PROMPT,
            userText: String(userPrompt || "").trim(),
            temperature: 0.1,
        });
        const rawText = extractGeminiText(data);
        const parsed = parseJSONLoose(rawText);
        if (!parsed || !parsed.matrix) {
            throw new Error("Khong doc duoc JSON ma tran tu AI.");
        }
        return normalizeAhpMatrix(parsed.matrix);
    }

    async function requestAhpMatrixAutoFix(currentMatrix, currentCR) {
        const data = await requestGemini({
            model: GEMINI_AUTOFIX_MODEL,
            systemPrompt: AHP_AUTOFIX_SYSTEM_PROMPT,
            userText: JSON.stringify({
                current_cr: Number(currentCR) || null,
                criteria: [
                    "tiem_nang_doanh_thu",
                    "kha_nang_tiep_can",
                    "chi_phi_thue",
                    "canh_tranh",
                    "rui_ro",
                ],
                matrix: currentMatrix,
            }),
            temperature: 0.1,
        });
        const rawText = extractGeminiText(data);
        const parsed = parseJSONLoose(rawText);
        if (!parsed || !parsed.matrix) {
            throw new Error("Khong doc duoc JSON ma tran auto-fix tu AI.");
        }
        return normalizeAhpMatrix(parsed.matrix);
    }

    window.chatbotApi = {
        ...(window.chatbotApi || {}),
        requestAhpMatrixFromPrompt,
        requestAhpMatrixAutoFix,
    };

    function getBotReply(text) {
        const t = String(text || "").toLowerCase();
        if (t.includes("xin chao") || t.includes("hello")) return "Xin chao! (Che do Offline) Ban dang quan tam khu vuc nao?";
        if (t.includes("gia") || t.includes("chi phi")) return "Thong tin chi phi thue dang o che do offline. Ban co the thu lai sau.";
        if (t.includes("quan 10")) return "Quan 10 co mat do dan cu cao va nhieu tiem nang kinh doanh.";
        return "Cam on ban. He thong dang o che do offline va se tiep tuc ho tro ban.";
    }

    async function sendMessage() {
        const text = inputField.value.trim();
        if (!text) return;

        addMessage(text, "user");
        inputField.value = "";

        const loadingId = "loading-" + Date.now();
        addMessage("Dang soan cau tra loi...", "bot", loadingId, { loading: true });

        try {
            const userMessage = { role: "user", parts: [{ text }] };
            const historyToSend = [...chatHistory, userMessage];

            const replyText = await callChatAPI(historyToSend);

            const loadingMsg = document.getElementById(loadingId);
            if (loadingMsg) loadingMsg.remove();

            addMessage(replyText, "bot");

            chatHistory.push(userMessage);
            chatHistory.push({ role: "model", parts: [{ text: replyText }] });
        } catch (error) {
            console.error("Groq API Error details:", error);
            const loadingMsg = document.getElementById(loadingId);
            if (loadingMsg) loadingMsg.remove();

            addMessage(`[API Error]: ${error.message}. Chuyen sang che do offline...`, "bot");
            addMessage(getBotReply(text), "bot");
        }
    }

    sendBtn.addEventListener("click", sendMessage);
    inputField.addEventListener("keypress", (e) => {
        if (e.key === "Enter") sendMessage();
    });

    addMessage(
        "Xin chao! Minh co the ho tro ban phan tich vi tri kinh doanh theo AHP. Ban dang quan tam khu vuc nao?",
        "bot",
    );

    const allowedPages = ["home.html", "map.html"];
    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    const isAllowedPage = allowedPages.some((p) => currentPage.includes(p));

    if (isAllowedPage) {
        const tooltip = document.createElement("div");
        tooltip.id = "selection-tooltip";
        tooltip.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Dan vao chatbot
        `;
        document.body.appendChild(tooltip);

        let hideTooltipTimer = null;

        function showTooltip(x, y) {
            tooltip.style.left = x + "px";
            tooltip.style.top = y + "px";
            tooltip.classList.add("active");
        }

        function hideTooltip() {
            tooltip.classList.remove("active");
        }

        document.addEventListener("mouseup", function (e) {
            if (e.target.closest("#selection-tooltip")) return;

            clearTimeout(hideTooltipTimer);

            setTimeout(() => {
                const selection = window.getSelection();
                const selectedText = selection ? selection.toString().trim() : "";

                if (selectedText.length > 0) {
                    const range = selection.getRangeAt(0);
                    const rect = range.getBoundingClientRect();

                    const tooltipX = rect.left + rect.width / 2 - 75;
                    const tooltipY = rect.top - 48;

                    const clampedX = Math.max(8, Math.min(tooltipX, window.innerWidth - 160));
                    const clampedY = Math.max(8, tooltipY);

                    showTooltip(clampedX, clampedY);
                } else {
                    hideTooltip();
                }
            }, 10);
        });

        document.addEventListener("mousedown", function (e) {
            if (!e.target.closest("#selection-tooltip")) {
                hideTooltipTimer = setTimeout(hideTooltip, 120);
            }
        });

        tooltip.addEventListener("mousedown", function (e) {
            e.preventDefault();
        });

        tooltip.addEventListener("click", function () {
            const selection = window.getSelection();
            const selectedText = selection ? selection.toString().trim() : "";

            if (!selectedText) return;

            if (chatWindow.classList.contains("hidden")) {
                chatWindow.classList.remove("hidden");
            }

            inputField.value = selectedText;
            inputField.focus();

            window.getSelection().removeAllRanges();
            hideTooltip();
        });
    }
})();
