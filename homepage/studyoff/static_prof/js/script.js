/* ==========================================================================
   Studiora AI Professor Dashboard - JavaScript (UI interactions)
   ========================================================================== */

document.addEventListener("DOMContentLoaded", function () {
    initThemeToggle();
    initSearchFilters();
    initChatInput();
    initProfileSave();
});

/* Theme toggle (UI only — no persistence) */
function initThemeToggle() {
    var toggle = document.getElementById("theme-toggle");
    if (!toggle) return;

    toggle.addEventListener("click", function () {
        toggle.classList.toggle("active");
    });
}

/* Client-side search filtering for tables and document lists */
function initSearchFilters() {
    var studentSearch = document.getElementById("student-search");
    if (studentSearch) {
        studentSearch.addEventListener("input", function () {
            filterTableRows("students-table", this.value);
        });
    }

    var documentSearch = document.getElementById("document-search");
    if (documentSearch) {
        documentSearch.addEventListener("input", function () {
            filterTableRows("documents-table", this.value);
        });
    }
}

function filterTableRows(tableId, query) {
    var table = document.getElementById(tableId);
    if (!table) return;

    var rows = table.querySelectorAll("tbody tr");
    var term = query.toLowerCase().trim();

    rows.forEach(function (row) {
        var text = row.textContent.toLowerCase();
        row.style.display = text.includes(term) ? "" : "none";
    });
}

/* Chat input — append user message on send (visual only) */
function initChatInput() {
    var input = document.getElementById("chat-input");
    var sendBtn = document.getElementById("chat-send");
    var chatArea = document.getElementById("chat-area");

    if (!input || !sendBtn || !chatArea) return;

    function sendMessage() {
        var text = input.value.trim();
        if (!text) return;

        var bubble = document.createElement("div");
        bubble.className = "user";
        bubble.textContent = text;
        chatArea.appendChild(bubble);
        input.value = "";
        chatArea.scrollTop = chatArea.scrollHeight;
    }

    sendBtn.addEventListener("click", sendMessage);

    input.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}

/* Profile save — visual feedback only */
function initProfileSave() {
    var saveBtn = document.getElementById("save-profile");
    if (!saveBtn) return;

    saveBtn.addEventListener("click", function () {
        var original = saveBtn.textContent;
        saveBtn.textContent = "Saved!";
        saveBtn.style.background = "#22c55e";

        setTimeout(function () {
            saveBtn.textContent = original;
            saveBtn.style.background = "";
        }, 2000);
    });
}
