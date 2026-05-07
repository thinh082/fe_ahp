      // =========================================================
      // AHP PIPELINE — Logic 3 Bước (Nhúng vào home.html)
      // Dùng apiFetch từ api.js, id = ahp-* để tránh xung đột
      // =========================================================

      const ahpCriteria = [
        "Tiềm năng doanh thu",
        "Khả năng tiếp cận",
        "Chi phí thuê",
        "Cạnh tranh",
        "Rủi ro",
      ];

      const ahpCriteriaDesc = [
        "Mức độ tiềm năng sinh lời của khu vực",
        "Mức độ thuận tiện di chuyển, giao thông",
        "Chi phí thuê mặt bằng hàng tháng",
        "Mật độ đối thủ cạnh tranh trong khu vực",
        "Mức độ rủi ro kinh doanh tại địa điểm",
      ];

      const ahpMatrix = Array.from({ length: ahpCriteria.length }, () =>
        Array(ahpCriteria.length).fill(1),
      );

      let ahpRawMatrix = null;
      let ahpRes1 = null;
      let ahpWeights = null;
      let ahpAiAssistMode = false;
      let ahpAiLastPrompt = "";
      let ahpAiGeneratedMatrix = null;
      const ahpAIPromptTemplates = [
        "Mình có 5 tiêu chí AHP, hãy tạo bảng ma trận so sánh cặp 5x5 (thang 1-9) để nhập Bước 1 và giúp CR ở Bước 2 dễ < 0.1.",
        "Mình có 5 tiêu chí, hãy gợi ý cách điền Bước 1 để tránh sai và giảm CR ở Bước 2.",
        "Hãy đề xuất ma trận AHP 5x5 theo mức ưu tiên doanh thu > tiếp cận > chi phí > cạnh tranh > rủi ro, định dạng dạng bảng để mình nhập trực tiếp.",
        "Hãy tạo một ma trận so sánh cặp AHP 5 tiêu chí cân bằng, hạn chế chênh lệch quá lớn để CR thấp, trả về dạng bảng 5x5 rõ ràng.",
        "Giả sử mình ưu tiên lợi nhuận và an toàn dài hạn, hãy sinh bảng ma trận AHP 5x5 cụ thể để mình điền vào Bước 1 rồi kiểm tra CR ở Bước 2.",
      ];

      function ahpFormatRecip(v) {
        return v === 1 ? "1" : `1/${v}`;
      }

      function ahpRenderMatrix() {
        const listEl = document.getElementById("ahp-criteriaList");
        if (!listEl) return;

        if (ahpAiAssistMode) {
          renderAIAssistComposer(listEl);
          return;
        }

        const n = ahpCriteria.length;
        const legendHTML = ahpCriteria
          .map(
            (c, i) =>
              `<div class="flex items-center gap-2 text-xs mb-1">
       <span class="inline-block w-6 h-6 rounded bg-primary/10 text-primary font-bold flex items-center justify-center flex-shrink-0">C${i + 1}</span>
       <span class="font-semibold text-slate-700">${c}</span>
       <span class="text-slate-400">— ${ahpCriteriaDesc[i]}</span>
     </div>`,
          )
          .join("");

        let thead = `<tr><th class="text-left px-3 py-2 text-xs font-bold text-slate-500 bg-slate-50 whitespace-nowrap">Tiêu chí</th>`;
        ahpCriteria.forEach((_, i) => {
          thead += `<th class="px-3 py-2 text-xs font-bold text-slate-500 bg-slate-50">C${i + 1}</th>`;
        });
        thead += `</tr>`;

        let tbody = "";
        for (let i = 0; i < n; i++) {
          tbody += `<tr>`;
          tbody += `<td class="px-3 py-2 font-bold text-xs text-slate-600 whitespace-nowrap bg-slate-50">C${i + 1}</td>`;
          for (let j = 0; j < n; j++) {
            if (i === j) {
              tbody += `<td class="px-3 py-2 text-center text-slate-400 bg-slate-50 font-bold">1</td>`;
            } else if (j > i) {
              tbody += `<td class="px-1 py-1 text-center"><input type="number" min="1" max="9" step="1" value="${ahpMatrix[i][j]}" data-i="${i}" data-j="${j}" class="ahp-inp w-14 text-center border border-slate-200 rounded-lg py-1.5 text-sm font-bold text-primary focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none" /></td>`;
            } else {
              tbody += `<td id="ahp-recip-${i}-${j}" class="px-3 py-2 text-center text-xs text-slate-400 font-semibold">${ahpFormatRecip(ahpMatrix[j][i])}</td>`;
            }
          }
          tbody += `</tr>`;
        }

        listEl.innerHTML = `
    <div class="mb-4 p-3 bg-blue-50 rounded-xl border border-blue-100">${legendHTML}</div>
    <div class="overflow-x-auto">
      <table class="w-full border-collapse text-sm">
        <thead>${thead}</thead>
        <tbody id="ahpTbody">${tbody}</tbody>
      </table>
    </div>`;

        // Gắn sự kiện input
        listEl.querySelectorAll(".ahp-inp").forEach((inp) => {
          inp.addEventListener("input", () => {
            const i = +inp.dataset.i,
              j = +inp.dataset.j;
            let v = parseInt(inp.value, 10);
            if (isNaN(v)) return;
            if (v > 9) {
              v = 9;
              inp.value = v;
            }
            if (v < 1) {
              v = 1;
              inp.value = v;
            }
            ahpMatrix[i][j] = v;
            ahpMatrix[j][i] = 1 / v;
            const recipCell = document.getElementById(`ahp-recip-${j}-${i}`);
            if (recipCell) recipCell.textContent = ahpFormatRecip(v);
          });
          inp.addEventListener("blur", () => {
            let v = parseInt(inp.value, 10);
            if (isNaN(v) || v < 1) v = 1;
            if (v > 9) v = 9;
            inp.value = v;
          });
        });
      }

      function formatMatrixCellForDisplay(value) {
        const num = Number(value);
        if (!Number.isFinite(num)) return "-";
        if (Math.abs(num - 1) < 1e-9) return "1";
        if (num > 1) return String(Math.round(num));
        const recip = Math.round(1 / num);
        return recip > 1 ? `1/${recip}` : "1";
      }

      function buildAIMatrixPreviewHTML(matrix) {
        const n = ahpCriteria.length;
        let thead = `<tr><th class="text-left px-3 py-2 text-xs font-bold text-slate-500 bg-slate-50 whitespace-nowrap">Tiêu chí</th>`;
        for (let i = 0; i < n; i++) {
          thead += `<th class="px-3 py-2 text-xs font-bold text-slate-500 bg-slate-50">C${i + 1}</th>`;
        }
        thead += "</tr>";

        let tbody = "";
        for (let i = 0; i < n; i++) {
          tbody += `<tr><td class="px-3 py-2 font-bold text-xs text-slate-600 whitespace-nowrap bg-slate-50">C${i + 1}</td>`;
          for (let j = 0; j < n; j++) {
            const val = formatMatrixCellForDisplay(matrix[i][j]);
            const cellClass =
              i === j
                ? "text-slate-400 bg-slate-50 font-bold"
                : j > i
                  ? "text-primary font-bold bg-blue-50/40"
                  : "text-slate-500";
            tbody += `<td class="px-3 py-2 text-center text-xs ${cellClass}">${val}</td>`;
          }
          tbody += "</tr>";
        }

        return `
      <div class="mt-3 p-4 bg-white rounded-xl border border-slate-200">
        <div class="text-sm font-bold text-slate-700 mb-3">Ma trận AI đề xuất</div>
        <div class="overflow-x-auto">
          <table class="w-full border-collapse text-sm min-w-[520px]">
            <thead>${thead}</thead>
            <tbody>${tbody}</tbody>
          </table>
        </div>
        <div class="mt-3 flex justify-end">
          <button type="button" id="ahp-ai-apply-matrix" class="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:opacity-90 transition">
            <span class="material-symbols-outlined text-[18px]">check_circle</span>
            Dùng ma trận này
          </button>
        </div>
      </div>`;
      }

      function renderAIAssistComposer(listEl) {
        const samplesHtml = ahpAIPromptTemplates
          .map(
            (text, idx) =>
              `<button type="button" class="ahp-ai-sample px-3 py-1.5 rounded-lg bg-white border border-primary/20 text-primary text-xs font-semibold hover:bg-primary/5 transition" data-value="${text.replace(/"/g, "&quot;")}">Mẫu ${idx + 1}</button>`,
          )
          .join("");

        const previewHtml = ahpAiGeneratedMatrix
          ? buildAIMatrixPreviewHTML(ahpAiGeneratedMatrix)
          : "";

        listEl.innerHTML = `
    <div class="mb-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
      <div class="text-xs font-bold text-slate-600 mb-2">Prompt mẫu (chọn nhanh):</div>
      <div class="flex flex-wrap gap-2">${samplesHtml}</div>
    </div>
    <div class="p-4 bg-white rounded-xl border border-slate-200">
      <label for="ahp-ai-prompt-input" class="block text-sm font-semibold text-slate-700 mb-2">Mô tả vấn đề bạn cần AI hỗ trợ (Bước 1-2)</label>
      <textarea id="ahp-ai-prompt-input" rows="5" class="w-full rounded-xl border border-slate-200 focus:border-primary focus:ring-primary text-sm" placeholder="Ví dụ: Mình mở quán cà phê ở Quận 4, chưa rõ cách điền ma trận để CR &lt; 0.1. Hãy hướng dẫn mình nhập từng cặp tiêu chí."></textarea>
      <div class="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <button type="button" id="ahp-ai-back-matrix" class="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition">
          <span class="material-symbols-outlined text-[18px]">grid_view</span>
          Quay về nhập ma trận
        </button>
        <button type="button" id="ahp-ai-send-prompt" class="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-bold hover:opacity-90 transition">
          <span class="material-symbols-outlined text-[18px]">send</span>
          Gửi prompt cho AI
        </button>
      </div>
    </div>
    ${previewHtml}`;

        const input = document.getElementById("ahp-ai-prompt-input");
        if (input) {
          input.value = ahpAiLastPrompt;
          input.addEventListener("input", () => {
            ahpAiLastPrompt = input.value;
          });
        }
        listEl.querySelectorAll(".ahp-ai-sample").forEach((sampleBtn) => {
          sampleBtn.addEventListener("click", () => {
            if (!input) return;
            input.value = sampleBtn.dataset.value || "";
            ahpAiLastPrompt = input.value;
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
          });
        });

        listEl.querySelector("#ahp-ai-back-matrix")?.addEventListener("click", () => {
          setAIAssistMode(false);
        });

        listEl.querySelector("#ahp-ai-send-prompt")?.addEventListener("click", async () => {
          const prompt = input?.value?.trim() || "";
          if (!prompt) {
            window.notify?.("Vui lòng nhập mô tả trước khi gửi cho AI.", "warning");
            return;
          }
          ahpAiLastPrompt = prompt;
          await requestAhpMatrixFromAI(prompt);
        });

        listEl.querySelector("#ahp-ai-apply-matrix")?.addEventListener("click", () => {
          setAIAssistMode(false);
          window.notify?.("Đã chuyển về bảng nhập ma trận với dữ liệu AI.", "success");
        });
      }

      function applyGeneratedAhpMatrix(matrix) {
        const n = ahpCriteria.length;
        if (!Array.isArray(matrix) || matrix.length !== n) {
          throw new Error("Ma trận AI trả về không đúng kích thước.");
        }

        for (let i = 0; i < n; i++) {
          if (!Array.isArray(matrix[i]) || matrix[i].length !== n) {
            throw new Error("Dữ liệu ma trận không hợp lệ.");
          }
        }

        for (let i = 0; i < n; i++) {
          ahpMatrix[i][i] = 1;
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

            ahpMatrix[i][j] = upper;
            ahpMatrix[j][i] = 1 / upper;
          }
        }

        ahpRawMatrix = null;
        ahpRes1 = null;
        ahpWeights = null;

        const step1Body = document.getElementById("ahp-step1Body");
        if (step1Body) {
          step1Body.innerHTML = "";
        }
        const step1Btn = document.getElementById("ahp-step1Btn");
        if (step1Btn) {
          step1Btn.disabled = false;
          step1Btn.classList.remove("opacity-60", "cursor-not-allowed");
          step1Btn.innerHTML =
            'Xây dựng ma trận &amp; Tính tổng cột <span class="material-symbols-outlined text-base">arrow_forward</span>';
          step1Btn.onclick = null;
        }
      }

      function sendPromptToChatInput(prompt) {
        const chatWindow = document.getElementById("chatbot-window");
        const chatToggleBtn = document.getElementById("chatbot-toggle");
        const inputField = document.getElementById("chatbot-input");
        const sendBtn = document.getElementById("chatbot-send");

        if (chatWindow?.classList.contains("hidden")) {
          chatToggleBtn?.click();
        }
        if (!inputField) {
          window.notify?.("Không tìm thấy hộp chat để gửi prompt.", "error");
          return;
        }

        inputField.value = prompt;
        inputField.focus();
        inputField.setSelectionRange(prompt.length, prompt.length);

        if (sendBtn) {
          sendBtn.click();
          return;
        }
        inputField.dispatchEvent(
          new KeyboardEvent("keypress", { key: "Enter", bubbles: true }),
        );
      }

      async function requestAhpMatrixFromAI(prompt) {
        const sendBtn = document.getElementById("ahp-ai-send-prompt");
        const originalLabel = sendBtn?.innerHTML;
        if (sendBtn) {
          sendBtn.disabled = true;
          sendBtn.innerHTML =
            '<span class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span> AI đang tạo ma trận...';
        }

        try {
          const requestFn = window.chatbotApi?.requestAhpMatrixFromPrompt;
          if (typeof requestFn !== "function") {
            throw new Error("Chưa có kết nối AI Matrix. Đang chuyển sang chat thường.");
          }

          const matrix = await requestFn(prompt);
          applyGeneratedAhpMatrix(matrix);
          ahpAiGeneratedMatrix = ahpBuildRawMatrix();
          ahpRenderMatrix();
          window.notify?.("AI đã tạo ma trận. Xem bảng bên dưới và bấm 'Dùng ma trận này' nếu phù hợp.", "success");
        } catch (err) {
          window.notify?.(
            "Không tạo được ma trận AHP tự động: " + (err.message || "Không xác định"),
            "error",
          );
          sendPromptToChatInput(prompt);
        } finally {
          if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.innerHTML = originalLabel || "Gửi prompt cho AI";
          }
        }
      }

      function setAIAssistMode(enabled) {
        ahpAiAssistMode = Boolean(enabled);

        const assistBtn = document.getElementById("ahp-ai-assist-btn");
        const assistLabel = assistBtn?.querySelector("[data-ahp-ai-label]");
        const step1Btn = document.getElementById("ahp-step1Btn");

        if (assistLabel) {
          assistLabel.textContent = ahpAiAssistMode
            ? "Quay về nhập ma trận"
            : "AI hỗ trợ Bước 1-2";
        }
        if (assistBtn) {
          assistBtn.classList.toggle("bg-primary", ahpAiAssistMode);
          assistBtn.classList.toggle("text-white", ahpAiAssistMode);
          assistBtn.classList.toggle("border-primary", ahpAiAssistMode);
        }

        if (step1Btn) {
          step1Btn.disabled = ahpAiAssistMode;
          step1Btn.classList.toggle("opacity-60", ahpAiAssistMode);
          step1Btn.classList.toggle("cursor-not-allowed", ahpAiAssistMode);
          step1Btn.title = ahpAiAssistMode
            ? "Đang ở chế độ AI. Vui lòng quay về nhập ma trận để chạy Bước 1."
            : "";
        }

        ahpRenderMatrix();
      }

      function ahpBuildRawMatrix() {
        return Array.from({ length: ahpCriteria.length }, (_, i) =>
          Array.from({ length: ahpCriteria.length }, (__, j) => {
            if (i === j) return 1;
            // Keep higher precision to avoid numeric drift that can push CR slightly below 0.
            return Number(ahpMatrix[i][j].toFixed(6));
          }),
        );
      }

      function ahpGoToStep(n) {
        [1, 2, 3, 4].forEach((s) => {
          const panel = document.getElementById(`ahp-step${s}`);
          const track = document.getElementById(`ahp-track${s}`);
          const circle = document.getElementById(`ahp-track${s}-circle`);
          if (!panel || !track || !circle) return;
          if (s === n) {
            panel.classList.remove("hidden");
            track.classList.remove("opacity-40");
            circle.className =
              "w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm shadow-[0_4px_10px_rgba(0,87,205,0.3)] transition-all";
          } else if (s < n) {
            panel.classList.add("hidden");
            track.classList.remove("opacity-40");
            circle.className =
              "w-9 h-9 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-sm transition-all";
          } else {
            panel.classList.add("hidden");
            track.classList.add("opacity-40");
            circle.className =
              "w-9 h-9 rounded-full bg-slate-300 text-slate-600 flex items-center justify-center font-bold text-sm transition-all";
          }
        });
      }

      function ahpResultBox(type, title, desc) {
        const colors = {
          success: "bg-green-50 border-green-200 text-green-800",
          error: "bg-red-50 border-red-200 text-red-800",
          warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
          info: "bg-blue-50 border-blue-100 text-blue-800",
        };
        return `<div class="p-4 rounded-xl border ${colors[type] || colors.info} mb-3">
    <div class="font-bold text-sm mb-1">${title}</div>
    ${desc ? `<div class="text-xs leading-relaxed">${desc}</div>` : ""}
  </div>`;
      }

      function openAIAhpHelper() {
        setAIAssistMode(!ahpAiAssistMode);
      }

      async function ahpRunStep1() {
        const btn = document.getElementById("ahp-step1Btn");
        const body = document.getElementById("ahp-step1Body");
        btn.disabled = true;
        btn.innerHTML = `<span class="material-symbols-outlined text-base animate-spin">progress_activity</span> Đang tính toán...`;
        body.innerHTML = `<div class="text-sm text-slate-400 italic">⏳ Đang gọi API tính toán...</div>`;

        ahpRawMatrix = ahpBuildRawMatrix();

        try {
          // Bước 1a: Tổng cột
          const res1 = await apiFetch("/api/ahp/calculate/column-sums", {
            method: "POST",
            body: JSON.stringify({ criteriaMatrix: ahpRawMatrix }),
          });

          // Hiển thị hàng tổng cột trong bảng
          const tfoot = document
            .querySelector("#ahpTbody")
            ?.closest("table")
            ?.querySelector("tfoot");
          if (tfoot) tfoot.remove();
          const table = document.querySelector("#ahpTbody")?.closest("table");
          if (table && res1.column_sums) {
            const tf = document.createElement("tfoot");
            tf.innerHTML = `<tr class="bg-blue-50 font-bold">
        <td class="px-3 py-2 text-xs text-slate-600">Σ Tổng</td>
        ${res1.column_sums.map((s) => `<td class="px-3 py-2 text-center text-xs text-primary">${Number(s).toFixed(4)}</td>`).join("")}
      </tr>`;
            table.appendChild(tf);
          }

          // Bước 1b: Chuẩn hóa ma trận
          const res2 = await apiFetch("/api/ahp/calculate/normalize-matrix", {
            method: "POST",
            body: JSON.stringify({ criteriaMatrix: ahpRawMatrix }),
          });
          ahpRes1 = res2;

          // Render bảng chuẩn hóa
          const nm = res2.normalized_matrix || [];
          const nmRows = nm
            .map(
              (row, i) =>
                `<tr><td class="px-3 py-2 font-bold text-xs text-slate-600 bg-slate-50">C${i + 1}</td>${row.map((v) => `<td class="px-3 py-2 text-center text-xs">${Number(v).toFixed(4)}</td>`).join("")}</tr>`,
            )
            .join("");
          const nmHead = `<tr><th class="px-3 py-2 text-xs font-bold text-slate-500 bg-slate-50 text-left">Tiêu chí</th>${ahpCriteria.map((_, i) => `<th class="px-3 py-2 text-center text-xs font-bold text-slate-500 bg-slate-50">C${i + 1}</th>`).join("")}</tr>`;

          body.innerHTML =
            ahpResultBox(
              "success",
              "✅ Hoàn thành Bước 1",
              "Đã tính tổng cột và chuẩn hóa ma trận. Chuyển sang Bước 2 để kiểm tra CR.",
            ) +
            `<div class="overflow-x-auto mt-2"><table class="w-full border-collapse text-sm"><thead>${nmHead}</thead><tbody>${nmRows}</tbody></table></div>` +
            `<p class="text-xs text-slate-400 mt-2">Mỗi cột tổng ≈ 1.0 sau chuẩn hóa.</p>`;

          btn.disabled = false;
          btn.innerHTML = `Tiếp theo: Kiểm tra CR <span class="material-symbols-outlined text-base">arrow_forward</span>`;
          btn.onclick = () => ahpGoToStep(2);
        } catch (err) {
          body.innerHTML = ahpResultBox("error", "❌ Lỗi Bước 1", err.message);
          btn.disabled = false;
          btn.innerHTML = `Thử lại <span class="material-symbols-outlined text-base">refresh</span>`;
          btn.onclick = ahpRunStep1;
        }
      }

      async function refreshStep1DataForCurrentMatrix() {
        ahpRawMatrix = ahpBuildRawMatrix();
        const res2 = await apiFetch("/api/ahp/calculate/normalize-matrix", {
          method: "POST",
          body: JSON.stringify({ criteriaMatrix: ahpRawMatrix }),
        });
        ahpRes1 = res2;
      }

      async function autoFixCRWithAI(currentCR) {
        const body = document.getElementById("ahp-step2Body");
        const btn = document.getElementById("ahp-step2Btn");
        const autoBtn = document.getElementById("ahp-auto-fix-cr-btn");
        const originalAutoBtnHTML = autoBtn?.innerHTML;

        if (autoBtn) {
          autoBtn.disabled = true;
          autoBtn.innerHTML =
            '<span class="material-symbols-outlined text-base animate-spin">progress_activity</span> Đang auto-fix...';
        }
        if (btn) btn.disabled = true;

        try {
          const fixFn = window.chatbotApi?.requestAhpMatrixAutoFix;
          if (typeof fixFn !== "function") {
            throw new Error("Chưa kết nối được API auto-fix ma trận.");
          }

          const fixedMatrix = await fixFn(ahpBuildRawMatrix(), currentCR);
          applyGeneratedAhpMatrix(fixedMatrix);
          await refreshStep1DataForCurrentMatrix();
          ahpRenderMatrix();

          if (body) {
            body.innerHTML =
              ahpResultBox(
                "info",
                "🤖 Đã auto-fix ma trận",
                "Hệ thống đã cập nhật ma trận mới. Đang tính lại CR...",
              );
          }

          await ahpRunStep2();
        } catch (err) {
          if (body) {
            body.innerHTML += ahpResultBox(
              "error",
              "❌ Auto-fix thất bại",
              err.message || "Không xác định",
            );
          }
          window.notify?.("Auto-fix CR thất bại: " + (err.message || "Không xác định"), "error");
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = `Tính lại CR <span class="material-symbols-outlined text-base">refresh</span>`;
            btn.onclick = ahpRunStep2;
          }
        } finally {
          if (autoBtn) {
            autoBtn.disabled = false;
            autoBtn.innerHTML =
              originalAutoBtnHTML ||
              '<span class="material-symbols-outlined text-base">auto_fix_high</span> Auto-fix CR bằng AI';
          }
        }
      }

      async function ahpRunStep2() {
        const btn = document.getElementById("ahp-step2Btn");
        const body = document.getElementById("ahp-step2Body");

        if (!ahpRawMatrix || !ahpRes1) {
          body.innerHTML = ahpResultBox(
            "warning",
            "⚠️ Chưa hoàn thành Bước 1",
            "Hãy quay lại Bước 1 và chạy tính toán trước.",
          );
          return;
        }

        btn.disabled = true;
        btn.innerHTML = `<span class="material-symbols-outlined text-base animate-spin">progress_activity</span> Đang tính CR...`;
        body.innerHTML = `<div class="text-sm text-slate-400 italic">⏳ Đang kiểm tra tính nhất quán...</div>`;

        try {
          const res = await apiFetch(
            "/api/ahp/calculate/priority-vector-and-cr",
            {
              method: "POST",
              body: JSON.stringify({
                raw_matrix: ahpRawMatrix,
                normalized_matrix: ahpRes1.normalized_matrix,
              }),
            },
          );

          const weights = res.weights || {};
          const crRaw = Number(res.consistency_ratio || 0);
          const cr =
            Number.isFinite(crRaw) && crRaw < 0 && crRaw > -0.01 ? 0 : crRaw;
          const isValid = res.is_valid;
          ahpWeights = isValid ? Object.values(weights) : null;

          const weightHTML = Object.keys(weights)
            .map(
              (k) =>
                `<div class="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
         <span class="text-sm font-semibold text-slate-700">${k.replace(/_/g, " ")}</span>
         <span class="font-bold text-sm ${isValid ? "text-primary" : "text-slate-400"}">${(Number(weights[k]) * 100).toFixed(2)}%</span>
       </div>`,
            )
            .join("");

          body.innerHTML =
            ahpResultBox(
              isValid ? "success" : "error",
              isValid
                ? `✅ Ma trận hợp lệ (CR = ${cr.toFixed(4)})`
                : `⚠️ Chưa nhất quán (CR = ${cr.toFixed(4)})`,
              res.message || "",
            ) +
            `<div class="mt-3">${weightHTML}</div>` +
            (!isValid
              ? ahpResultBox(
                  "warning",
                  "",
                  "💡 Vui lòng quay lại Bước 1 và điều chỉnh lại bảng so sánh để CR &lt; 0.1.",
                ) +
                `<div class="mt-3 flex justify-end">
                  <button id="ahp-auto-fix-cr-btn" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:opacity-90 transition">
                    <span class="material-symbols-outlined text-base">auto_fix_high</span>
                    Auto-fix CR bằng AI
                  </button>
                </div>`
              : "");

          if (!isValid) {
            document
              .getElementById("ahp-auto-fix-cr-btn")
              ?.addEventListener("click", () => autoFixCRWithAI(cr));
          }

          btn.disabled = false;
          if (isValid) {
            // Lưu weights vào localStorage để Bước 3 dùng
            const distEl = document.getElementById("ahp-district");
            const wardEl = document.getElementById("ahp-ward");
            const streetEl = document.getElementById("ahp-street");
            const filters = {};
            if (distEl?.value)
              filters.district = removeVietnameseTones(distEl.value);
            if (wardEl?.value)
              filters.ward = removeVietnameseTones(wardEl.value);
            if (streetEl?.value?.trim())
              filters.street = removeVietnameseTones(streetEl.value.trim());
            localStorage.setItem(
              "ahp:lastRequest",
              JSON.stringify({ weights: ahpWeights, filters }),
            );

            btn.innerHTML = `Tiếp theo: Đánh giá tiêu chí <span class="material-symbols-outlined text-base">arrow_forward</span>`;
            btn.onclick = () => ahpGoToStep(3);
          } else {
            btn.innerHTML = `Tính lại CR <span class="material-symbols-outlined text-base">refresh</span>`;
            btn.onclick = ahpRunStep2;
          }
        } catch (err) {
          body.innerHTML = ahpResultBox("error", "❌ Lỗi Bước 2", err.message);
          btn.disabled = false;
          btn.innerHTML = `Thử lại <span class="material-symbols-outlined text-base">refresh</span>`;
          btn.onclick = ahpRunStep2;
        }
      }

      // Bước 3: Gọi API criteria-evaluation và render Tab + Matrix Panel
      async function ahpRunStep3() {
        const btn = document.getElementById("ahp-step3Btn");
        const body = document.getElementById("ahp-step3Body");
        const tabsEl = document.getElementById("ahp-criteriaTabs");
        const panelEl = document.getElementById("ahp-criteriaPanel");

        if (!ahpWeights || ahpWeights.length === 0) {
          body.innerHTML = ahpResultBox(
            "warning",
            "⚠️ Cần hoàn thành Bước 2 (CR hợp lệ) trước.",
          );
          return;
        }

        btn.disabled = true;
        btn.innerHTML = `<span class="material-symbols-outlined text-base animate-spin">progress_activity</span> Đang tải...`;
        body.innerHTML = `<div class="text-sm text-slate-400 italic">⏳ Đang gọi API criteria-evaluation...</div>`;
        tabsEl.classList.add("hidden");
        panelEl.classList.add("hidden");

        const lastRequestStr = localStorage.getItem("ahp:lastRequest");
        if (!lastRequestStr) {
          body.innerHTML = ahpResultBox(
            "warning",
            "⚠️ Chưa có dữ liệu",
            "Vui lòng quay lại Bước 2 và tính CR.",
          );
          btn.disabled = false;
          btn.innerHTML = `<span class="material-symbols-outlined text-base">analytics</span> Đánh giá tiêu chí`;
          return;
        }

        try {
          const req = JSON.parse(lastRequestStr);
          const payload = { weights: req.weights, filters: req.filters || {} };

          const data = await apiFetch("/api/locations/criteria-evaluation", {
            method: "POST",
            body: JSON.stringify(payload),
          });

          if (
            !data ||
            !data.success ||
            !Array.isArray(data.tabs) ||
            data.tabs.length === 0
          ) {
            body.innerHTML = ahpResultBox(
              "error",
              "❌ Không có dữ liệu",
              "Server không trả về ma trận. Có thể không tìm thấy địa điểm phù hợp.",
            );
            btn.disabled = false;
            btn.innerHTML = `<span class="material-symbols-outlined text-base">analytics</span> Đánh giá tiêu chí`;
            return;
          }

          const tabs = data.tabs;
          const total = data.total_locations || 0;

          body.innerHTML = ahpResultBox(
            "success",
            `✅ Hoàn tất — ${total} địa điểm được phân tích theo ${tabs.length} tiêu chí`,
            `Trọng số: [${payload.weights.map((w) => (w * 100).toFixed(1) + "%").join(", ")}]`,
          );

          let activeTabIdx = 0;
          tabsEl.innerHTML = tabs
            .map(
              (tab, i) =>
                `<button class="ahp-ce-tab px-4 py-2 rounded-xl border text-sm font-bold transition ${
                  i === 0
                    ? "bg-primary text-white border-transparent shadow-[0_4px_12px_rgba(0,87,205,0.3)]"
                    : "bg-white text-slate-600 border-slate-200 hover:border-primary/40 hover:text-primary"
                }" data-tab="${i}">${tab.criteria_id} · ${tab.criteria_name}</button>`,
            )
            .join("");
          tabsEl.classList.remove("hidden");

          function renderCEPanel(idx) {
            const tab = tabs[idx];
            const n = tab.locations_header.length;
            const cr = Number(tab.cr || 0);
            const crColor =
              cr < 0.1
                ? "text-green-700 bg-green-50 border-green-200"
                : "text-red-700 bg-red-50 border-red-200";
            const headerCols = tab.locations_header
              .map((loc) => {
                const label = typeof loc === "object" ? loc.name : loc;
                return `<th class="px-3 py-2 text-xs font-bold text-slate-500 bg-slate-50 border border-slate-200 whitespace-nowrap" title="${label}">${label.length > 18 ? label.slice(0, 16) + "..." : label}</th>`;
              })
              .join("");
            const bodyRows = Array.from({ length: n }, (_, i) => {
              const rowLoc =
                typeof tab.locations_header[i] === "object"
                  ? tab.locations_header[i].name
                  : tab.locations_header[i];
              const wPct =
                tab.local_weights[i] !== undefined
                  ? (tab.local_weights[i] * 100).toFixed(2) + "%"
                  : "-";
              const cells = Array.from({ length: n }, (__, j) => {
                const val =
                  tab.matrix_rows[i] && tab.matrix_rows[i][j]
                    ? tab.matrix_rows[i][j]
                    : "-";
                const cls =
                  val === "1"
                    ? "text-slate-400"
                    : String(val).includes("/")
                      ? "text-red-600 font-bold"
                      : "text-green-700 font-bold";
                return `<td class="px-3 py-2 text-center text-xs border border-slate-100 ${cls}">${val}</td>`;
              }).join("");
              return `<tr>
          <td class="px-3 py-2 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 whitespace-nowrap" title="${rowLoc}">${rowLoc.length > 20 ? rowLoc.slice(0, 18) + "..." : rowLoc}</td>
          ${cells}
          <td class="px-3 py-2 text-center text-xs font-bold text-primary bg-blue-50 border border-blue-100">${wPct}</td>
        </tr>`;
            }).join("");
            panelEl.innerHTML = `
        <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div class="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50/60 to-white flex items-start justify-between flex-wrap gap-3">
            <div>
              <span class="inline-block text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full mb-1">${tab.criteria_id}</span>
              <div class="font-bold text-base text-slate-900">${tab.criteria_name}</div>
              <div class="text-xs text-slate-400 mt-0.5">Ma trận ${n}x${n} địa điểm</div>
            </div>
            <span class="text-xs font-bold px-3 py-1.5 rounded-full border ${crColor}">CR = ${cr.toFixed(4)}</span>
          </div>
          <div class="overflow-x-auto p-4">
            <table class="w-full border-collapse text-sm min-w-max">
              <thead><tr>
                <th class="px-3 py-2 text-xs font-bold text-slate-500 bg-slate-50 border border-slate-200 text-left">Location</th>
                ${headerCols}
                <th class="px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100">Local Weight</th>
              </tr></thead>
              <tbody>${bodyRows}</tbody>
            </table>
          </div>
          <div class="flex gap-4 px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
            <span><span class="inline-block w-3 h-3 rounded bg-green-100 border border-green-300 mr-1"></span>Tốt hơn</span>
            <span><span class="inline-block w-3 h-3 rounded bg-red-50 border border-red-200 mr-1"></span>Kém hơn</span>
            <span><span class="inline-block w-3 h-3 rounded bg-white border border-slate-200 mr-1"></span>Bàng nhau</span>
          </div>
        </div>`;
            panelEl.classList.remove("hidden");
          }
          renderCEPanel(0);
          tabsEl.querySelectorAll(".ahp-ce-tab").forEach((tabBtn) => {
            tabBtn.addEventListener("click", () => {
              const idx = +tabBtn.dataset.tab;
              if (idx === activeTabIdx) return;
              tabsEl.querySelectorAll(".ahp-ce-tab").forEach((b) => {
                b.className =
                  "ahp-ce-tab px-4 py-2 rounded-xl border text-sm font-bold transition bg-white text-slate-600 border-slate-200 hover:border-primary/40 hover:text-primary";
              });
              tabBtn.className =
                "ahp-ce-tab px-4 py-2 rounded-xl border text-sm font-bold transition bg-primary text-white border-transparent shadow-[0_4px_12px_rgba(0,87,205,0.3)]";
              activeTabIdx = idx;
              panelEl.style.opacity = "0";
              panelEl.style.transition = "opacity 0.18s";
              setTimeout(() => {
                renderCEPanel(idx);
                panelEl.style.opacity = "1";
              }, 160);
            });
          });

          btn.disabled = false;
          btn.innerHTML = `Tiếp theo: Phân tích địa điểm <span class="material-symbols-outlined text-base">arrow_forward</span>`;
          btn.onclick = () => ahpGoToStep(4);
        } catch (err) {
          body.innerHTML = ahpResultBox(
            "error",
            "❌ Lỗi Bước 3 — Criteria Evaluation",
            err.message,
          );
          btn.disabled = false;
          btn.innerHTML = `<span class="material-symbols-outlined text-base">analytics</span> Đánh giá tiêu chí`;
          btn.onclick = ahpRunStep3;
        }
      }

      // Tiện ích bỏ dấu tiếng Việt để gửi DB
      function removeVietnameseTones(str) {
        if (!str) return "";
        str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
        str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
        str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
        str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
        str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
        str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
        str = str.replace(/đ/g, "d");
        str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
        str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
        str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
        str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
        str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
        str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
        str = str.replace(/Đ/g, "D");
        return str;
      }

      // Load dữ liệu Quận / Phường cho Form AHP
      let ahpDistrictsData = [];
      let ahpWardsData = [];

      async function ahpLoadLocations() {
        try {
          const [resQuan, resPhuong] = await Promise.all([
            fetch("js/data/Quan.json"),
            fetch("js/data/Phuong.json"),
          ]);
          if (!resQuan.ok || !resPhuong.ok)
            throw new Error("Không thể tải file dữ liệu");
          ahpDistrictsData = await resQuan.json();
          ahpWardsData = await resPhuong.json();

          // Render danh sách Quận (lọc TP Cần Thơ nếu cần, hoặc hiển thị tất cả, hiện tại hiển thị tất cả)
          const distEl = document.getElementById("ahp-district");
          const wardEl = document.getElementById("ahp-ward");
          if (!distEl || !wardEl) return;

          distEl.innerHTML =
            '<option value="" selected>Tất cả Quận / Huyện</option>' +
            ahpDistrictsData
              .map(
                (q) =>
                  `<option value="${q.ten}" data-id="${q.id}">${q.ten}</option>`,
              )
              .join("");

          // Xử lý khi chọn Quận -> hiển thị Phường tương ứng
          distEl.addEventListener("change", (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            const idQuan = selectedOption.getAttribute("data-id");

            wardEl.innerHTML =
              '<option value="" selected>Tất cả Phường / Xã</option>';
            if (idQuan) {
              const filteredWards = ahpWardsData.filter(
                (p) => p.idQuan === idQuan,
              );
              wardEl.innerHTML += filteredWards
                .map((p) => `<option value="${p.ten}">${p.ten}</option>`)
                .join("");
            }
          });
        } catch (err) {
          console.error("Lỗi tải dữ liệu Quận/Phường:", err);
        }
      }

      // Khởi động: render matrix và gắn sự kiện khi view-ahp được hiển
      document.addEventListener("DOMContentLoaded", () => {
        ahpRenderMatrix();
        ahpLoadLocations();

        document
          .getElementById("ahp-step1Btn")
          ?.addEventListener("click", ahpRunStep1);
        document
          .getElementById("ahp-step2BackBtn")
          ?.addEventListener("click", () => ahpGoToStep(1));
        document
          .getElementById("ahp-step2Btn")
          ?.addEventListener("click", ahpRunStep2);
        document
          .getElementById("ahp-step3BackBtn")
          ?.addEventListener("click", () => ahpGoToStep(2));
        document
          .getElementById("ahp-step3Btn")
          ?.addEventListener("click", ahpRunStep3);
        document
          .getElementById("ahp-step4BackBtn")
          ?.addEventListener("click", () => ahpGoToStep(3));
        document
          .getElementById("ahp-step4Btn")
          ?.addEventListener("click", ahpRunStep4);
        document
          .getElementById("ahp-ai-assist-btn")
          ?.addEventListener("click", openAIAhpHelper);
      });

      // Bước 4: Gọi API execute-final-analysis và chuyển sang result.html
      async function ahpRunStep4() {
        const btn = document.getElementById("ahp-step4Btn");
        const backBtn = document.getElementById("ahp-step4BackBtn");
        const body = document.getElementById("ahp-step4Body");

        if (!ahpWeights || ahpWeights.length === 0) {
          body.innerHTML = ahpResultBox(
            "warning",
            "⚠️ Cần hoàn thành Bước 2 (CR hợp lệ) trước.",
          );
          return;
        }

        // Kiểm tra user đã đăng nhập chưa
        let user = null;
        try {
          user = await authFetch("/api/XacThucTaiKhoan/me");
        } catch (e) {}

        if (user && !document.getElementById("createProjBtn")) {
          // Nếu đã đăng nhập thì hiện ra div tạo dự án
          btn.disabled = true;
          body.innerHTML = `
      <div class="bg-surface-container-low p-5 rounded-2xl border border-primary/20 mb-4 animate-fade-in">
        <h3 class="font-bold text-sm text-primary mb-3 flex items-center gap-2"><span class="material-symbols-outlined text-base">folder_special</span> Lưu kết quả thành Dự án mới</h3>
        <p class="text-xs text-slate-500 mb-4">Bạn đang đăng nhập. Có thể lưu phân tích này thành dự án để xem lại sau.</p>
        <div class="space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-500 mb-1">Nhập tên dự án <span class="text-red-500">*</span></label>
            <input type="text" id="projName" placeholder="VD: Dự án Khởi nghiệp Quán Cà Phê Quận 8" class="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-primary focus:border-primary transition outline-none" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-500 mb-1">Mô tả dự án</label>
            <input type="text" id="projDesc" placeholder="Tiềm năng mở quán cà phê mới..." class="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-primary focus:border-primary transition outline-none" />
          </div>
          <div class="flex justify-end gap-2 mt-2">
             <button id="skipProjBtn" class="px-4 py-2 bg-slate-200 text-slate-700 font-bold rounded-lg text-sm hover:bg-slate-300 transition">Bỏ qua (Chỉ phân tích)</button>
             <button id="createProjBtn" class="px-4 py-2 bg-primary text-white font-bold rounded-lg text-sm shadow cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition flex items-center gap-2">Tạo dự án</button>
          </div>
        </div>
      </div>
    `;

          document
            .getElementById("skipProjBtn")
            .addEventListener("click", proceedAnalysis);
          document
            .getElementById("createProjBtn")
            .addEventListener("click", async () => {
              const name = document.getElementById("projName").value.trim();
              const desc = document.getElementById("projDesc").value.trim();
              if (!name) return showToast("Vui lòng Nhập tên dự án", "warning");

              const createBtn = document.getElementById("createProjBtn");
              createBtn.disabled = true;
              createBtn.innerHTML =
                '<span class="material-symbols-outlined text-sm animate-spin">progress_activity</span> Đang tạo...';

              try {
                const res = await authFetch("/api/projects", {
                  method: "POST",
                  body: JSON.stringify({ name, description: desc }),
                });
                if (res && res.id) {
                  localStorage.setItem("ahp:projectId", res.id);
                }
                proceedAnalysis();
              } catch (err) {
                showToast(
                  "Lỗi tạo dự án: " + (err.message || "Không xác định"),
                  "error",
                );
                createBtn.disabled = false;
                createBtn.innerHTML = "Tạo dự án";
              }
            });
          return; // Dừng tại đây, chờ user tương tác trong div
        }

        // Nếu chưa đăng nhập thì thôi (chạy thẳng phân tích)
        proceedAnalysis();

        async function proceedAnalysis() {
          btn.disabled = true;
          if (backBtn) backBtn.disabled = true;
          btn.innerHTML = `<span class="material-symbols-outlined text-base animate-spin">progress_activity</span> Đang phân tích...`;
          body.innerHTML = `<div class="text-sm text-slate-400 italic">🗺️ Đang phân tích địa điểm và chuẩn bị bản đồ...</div>`;

          try {
            const distEl = document.getElementById("ahp-district");
            const wardEl = document.getElementById("ahp-ward");
            const streetEl = document.getElementById("ahp-street");
            const filters = { limit: 50 };
            if (distEl?.value)
              filters.district = removeVietnameseTones(distEl.value);
            if (wardEl?.value)
              filters.ward = removeVietnameseTones(wardEl.value);
            if (streetEl?.value?.trim())
              filters.street = removeVietnameseTones(streetEl.value.trim());

            const result = await apiFetch(
              "/api/locations/execute-final-analysis",
              {
                method: "POST",
                body: JSON.stringify({ weights: ahpWeights, filters }),
              },
            );

            localStorage.setItem(
              "ahp:lastRequest",
              JSON.stringify({ weights: ahpWeights, filters }),
            );
            localStorage.setItem("ahp:lastResponse", JSON.stringify(result));

            body.innerHTML = ahpResultBox(
              "success",
              "✅ Phân tích hoàn tất!",
              "Đang chuyển đến bản đồ kết quả...",
            );
            window.location.href = "result.html";
          } catch (err) {
            body.innerHTML = ahpResultBox(
              "error",
              "❌ Lỗi Bước 4",
              err.message,
            );
            btn.disabled = false;
            if (backBtn) backBtn.disabled = false;
            btn.innerHTML = `<span class="material-symbols-outlined text-base">rocket_launch</span> Phân tích &amp; Xem bản đồ`;
            btn.onclick = ahpRunStep4;
          }
        }
      }
    
