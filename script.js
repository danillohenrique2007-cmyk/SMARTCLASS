(() => {
    "use strict";

    // ==========================================
    // CONFIGURAÇÕES
    // ==========================================

    const API_URL = "http://127.0.0.1:5000/api";
    const INTERVALO_ATUALIZACAO = 2000;

    const state = {
        mode: "demo",
        temperature: 22.0,
        humidity: 48,
        people: 12,
        lightOn: true,
        acOn: false,
        setpoint: 22,
        history: [],
        labels: ["08h", "09h", "10h", "11h", "12h", "13h", "14h"],
        temperatures: [21.2, 21.7, 22.1, 22.4, 22.0, 22.6, 22.0],
        humidities: [51, 50, 49, 47, 49, 46, 48],
        apiConnected: false,
        arduinoConnected: false
    };

    const $ = id => document.getElementById(id);

    let environmentChart = null;
    let sensorChart = null;
    let toastTimer = null;
    let updateTimer = null;

    // ==========================================
    // NOTIFICAÇÕES
    // ==========================================

    function showToast(message) {
        const toast = $("toast");
        if (!toast) return;

        toast.textContent = message;
        toast.classList.add("show");

        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toast.classList.remove("show");
        }, 3000);
    }

    // ==========================================
    // HISTÓRICO
    // ==========================================

    function addHistory(title, detail, symbol = "•") {
        state.history.unshift({
            title,
            detail,
            symbol,
            time: new Date().toLocaleTimeString("pt-BR")
        });

        state.history = state.history.slice(0, 30);
        renderHistory();
    }

    function renderHistory() {
        const count = $("historyCount");
        const list = $("historyList");
        if (!count || !list) return;

        count.textContent = `${state.history.length} registro(s)`;

        if (!state.history.length) {
            list.innerHTML = '<div class="empty-state">Nenhum registro disponível.</div>';
            return;
        }

        list.innerHTML = state.history.map(item => `
            <div class="history-item">
                <span class="history-symbol">${item.symbol}</span>
                <div class="history-copy">
                    <strong>${item.title}</strong>
                    <small>${item.detail}</small>
                </div>
                <span class="history-time">${item.time}</span>
            </div>
        `).join("");
    }

    // ==========================================
    // INTERFACE
    // ==========================================

    function renderValues() {
        const temp = Number(state.temperature).toFixed(1).replace(".", ",");

        $("temperatureValue").innerHTML = `${temp}<small>°C</small>`;
        $("humidityValue").innerHTML = `${state.humidity}<small>%</small>`;
        $("peopleValue").innerHTML = `${state.people}<small> pessoas</small>`;

        $("sensorTemperature").innerHTML = `${temp}<small>°C</small>`;
        $("sensorHumidity").innerHTML = `${state.humidity}<small>%</small>`;
        $("sensorPeople").innerHTML = `${state.people}<small> pessoas</small>`;

        $("occupancyNumber").textContent = state.people;

        const percentage = Math.min(100, Math.max(0, (state.people / 30) * 100));
        $("capacityBar").style.width = `${percentage}%`;
        $("occupancyBar").style.width = `${percentage}%`;

        const occupancyBadge = document.querySelector(".occupancy-badge");
        if (occupancyBadge) {
            occupancyBadge.textContent = `${Math.round(percentage)}% da capacidade`;
        }

        $("lightValue").textContent = state.lightOn ? "Ligada" : "Desligada";
        $("lightStatus").textContent = state.lightOn ? "● Ativa" : "● Inativa";
        $("lightDescription").textContent = state.lightOn ? "Luzes ligadas" : "Luzes desligadas";

        $("lightToggle").checked = state.lightOn;
        $("acToggle").checked = state.acOn;

        $("acDescription").textContent = state.acOn
            ? `Ligado · Ajustado em ${state.setpoint} °C`
            : "Desligado";

        $("setpointValue").textContent = state.setpoint;
        $("setpoint").value = state.setpoint;

        $("lastUpdated").textContent = "Atualizado às " + new Date().toLocaleTimeString("pt-BR");

        updateSystemStatus();
    }

    function setRowStatus(iconId, textId, active, text) {
        const icon = $(iconId);
        const label = $(textId);
        if (!icon || !label) return;

        icon.className = active ? "status-check" : "status-pending";
        icon.textContent = active ? "✓" : "○";
        label.className = active ? "" : "pending-text";
        label.textContent = text;
    }

    function updateSystemStatus() {
        const dot = $("connectionDot");

        if (state.mode === "demo") {
            $("connectionLabel").textContent = "Modo demonstração";
            $("connectionDetail").textContent = "Sensores simulados";
            if (dot) dot.className = "connection-dot";

            setRowStatus("sensorSourceIcon", "sensorSourceStatus", true, "Simulação ativa");
            $("sensorSourceLabel").textContent = "Simulação dos sensores";
            setRowStatus("apiStatusIcon", "apiStatusText", false, "Modo demo");
            setRowStatus("arduinoStatusIcon", "arduinoStatusText", false, "Modo demo");
            return;
        }

        $("connectionLabel").textContent = state.apiConnected ? "API conectada" : "API desconectada";
        $("connectionDetail").textContent = state.arduinoConnected
            ? "Arduino conectado"
            : state.apiConnected
                ? "API ativa · Arduino desconectado"
                : "Verifique o servidor Python";

        if (dot) {
            dot.className = "connection-dot " + (state.apiConnected ? "online" : "offline");
        }

        $("sensorSourceLabel").textContent = "Leitura em tempo real";
        setRowStatus("sensorSourceIcon", "sensorSourceStatus", state.apiConnected, state.apiConnected ? "Ativa" : "Aguardando");
        setRowStatus("apiStatusIcon", "apiStatusText", state.apiConnected, state.apiConnected ? "Conectada" : "Desconectada");
        setRowStatus("arduinoStatusIcon", "arduinoStatusText", state.arduinoConnected, state.arduinoConnected ? "Conectado" : "Desconectado");
    }

    // ==========================================
    // SELETOR DE MODO
    // ==========================================

    function createModeSelector() {
        const actions = document.querySelector(".topbar-actions");
        if (!actions || $("modeSelector")) return;

        const wrapper = document.createElement("div");
        wrapper.style.display = "flex";
        wrapper.style.alignItems = "center";
        wrapper.style.gap = "8px";

        const selector = document.createElement("select");
        selector.id = "modeSelector";
        selector.setAttribute("aria-label", "Modo de funcionamento");
        selector.innerHTML = `
            <option value="demo">Demonstração</option>
            <option value="connected">Conectado</option>
        `;

        selector.style.background = "#10243a";
        selector.style.color = "#ffffff";
        selector.style.border = "1px solid #29415b";
        selector.style.borderRadius = "8px";
        selector.style.padding = "8px 10px";
        selector.style.fontSize = "12px";
        selector.style.cursor = "pointer";
        selector.value = state.mode;

        selector.addEventListener("change", async () => {
            await changeMode(selector.value);
        });

        wrapper.appendChild(selector);
        actions.insertBefore(wrapper, actions.firstChild);
    }

    async function changeMode(mode) {
        if (mode !== "demo" && mode !== "connected") return;

        state.mode = mode;
        clearInterval(updateTimer);

        const noteText = $("demoNoteText");

        if (mode === "demo") {
            state.apiConnected = false;
            state.arduinoConnected = false;

            if (noteText) {
                noteText.textContent = "Os comandos estão funcionando em modo de demonstração.";
            }

            addHistory("Modo demonstração ativado", "Dados e controles simulados.", "✓");
            renderValues();
            showToast("Modo demonstração ativado.");

            simulateEnvironment();
            updateTimer = setInterval(simulateEnvironment, INTERVALO_ATUALIZACAO);
        } else {
            if (noteText) {
                noteText.textContent = "Os comandos serão enviados para a API Python (127.0.0.1:5000).";
            }

            addHistory("Modo conectado selecionado", "Conectando à API Python...", "•");

            const connected = await loadFromAPI();
            if (connected) {
                showToast("Conexão com a API estabelecida.");
            } else {
                showToast("API indisponível. Rode o servidor Python.");
            }

            updateTimer = setInterval(loadFromAPI, INTERVALO_ATUALIZACAO);
        }

        $("modeSelector").value = mode;
    }

    // ==========================================
// GRÁFICOS
// ==========================================

function chartOptions(legend = false) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 800, // Duração da animação inicial
            easing: 'easeInOutCubic'
        },
        interaction: {
            mode: "index",
            intersect: false
        },
        plugins: {
            legend: {
                display: legend,
                labels: {
                    color: "#91a8c1",
                    usePointStyle: true,
                    font: { size: 10 }
                }
            },
            tooltip: {
                backgroundColor: '#08172b', // Fundo do tooltip profissional
                titleColor: '#fff',
                bodyColor: '#fff',
                borderColor: '#19314b',
                borderWidth: 1,
                padding: 10,
                displayColors: true,
                usePointStyle: true,
                callbacks: {
                    // Formata o tooltip idêntico ao print
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += context.parsed.y.toFixed(context.dataset.yAxisID === 'y' ? 1 : 0);
                            label += context.dataset.yAxisID === 'y' ? ' °C' : '%';
                        }
                        return label;
                    }
                }
            }
        },
        scales: {
            x: {
                grid: { color: "#1a3048", display: false }, // Remove grid X p/ clean
                ticks: { color: "#7089a4", font: { size: 10 } }
            },
            y: {
                grid: { color: "#1a3048", display: false }, // Remove grid Y p/ clean
                ticks: { color: "#7089a4", font: { size: 10 } }
            }
        }
    };
}

function createCharts() {
    if (typeof Chart === "undefined") {
        console.error("Chart.js não foi carregado.");
        return;
    }

    // Gráfico Visão Geral (Cores Exatas do Print)
    environmentChart = new Chart($("environmentChart"), {
        type: "line",
        data: {
            labels: state.labels,
            datasets: [
                {
                    label: "Temperatura (°C)",
                    data: state.temperatures,
                    borderColor: "#22d3ee", // Ciano exato do print
                    backgroundColor: "rgba(34, 211, 238, 0.1)",
                    tension: 0.4,
                    pointRadius: 3,
                    pointBackgroundColor: '#fff',
                    fill: true,
                    yAxisID: "y",
                    cubicInterpolationMode: 'monotone' // <-- LINHA ARREDONDADA IGUAL PRINT
                },
                {
                    label: "Umidade (%)",
                    data: state.humidities,
                    borderColor: "#a78bfa", // Violeta exato do print
                    tension: 0.4,
                    pointRadius: 0, // Pontos de umidade menores ou zero no print
                    fill: false,
                    yAxisID: "y1",
                    cubicInterpolationMode: 'monotone' // <-- LINHA ARREDONDADA IGUAL PRINT
                }
            ]
        },
        options: {
            ...chartOptions(),
            scales: {
                x: chartOptions().scales.x,
                y: {
                    ...chartOptions().scales.y,
                    position: "left",
                    // Escala automática para temperatura (ex: 19 a 26)
                },
                y1: {
                    ...chartOptions().scales.y,
                    position: "right",
                    min: 0, // <-- EIXO Y UMIDADE FIXO 0 A 100
                    max: 100, 
                    grid: { drawOnChartArea: false },
                    ticks: {
                        callback: function(value) { return value + '%'; }
                    }
                }
            }
        }
    });

    // Gráfico Aba Sensores (Mantive o seu, apenas adicionei a linha suave)
    sensorChart = new Chart($("sensorChart"), {
        type: "line",
        data: {
            labels: state.labels,
            datasets: [
                {
                    label: "Temperatura (°C)",
                    data: state.temperatures,
                    borderColor: "#22d3ee",
                    tension: 0.4,
                    cubicInterpolationMode: 'monotone'
                },
                {
                    label: "Umidade (%)",
                    data: state.humidities,
                    borderColor: "#a78bfa",
                    tension: 0.4,
                    cubicInterpolationMode: 'monotone'
                }
            ]
        },
        options: chartOptions(true)
    });
}
// ... resto do seu script.js (renderValues, updateGraphValues, etc.)

    function updateCharts() {
        [environmentChart, sensorChart].forEach(chart => {
            if (!chart) return;
            chart.data.labels = [...state.labels];
            chart.data.datasets[0].data = [...state.temperatures];
            chart.data.datasets[1].data = [...state.humidities];
            chart.update();
        });
    }

    function updateGraphValues() {
        state.labels.push(
            new Date().toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
            })
        );

        state.temperatures.push(Number(state.temperature.toFixed(1)));
        state.humidities.push(state.humidity);

        if (state.labels.length > 10) {
            state.labels.shift();
            state.temperatures.shift();
            state.humidities.shift();
        }

        updateCharts();
    }

    // ==========================================
    // MODO DEMONSTRAÇÃO
    // ==========================================

    function simulateEnvironment() {
        if (state.mode !== "demo") return;

        state.temperature += (Math.random() - 0.5) * 0.5;
        state.temperature = Math.max(19, Math.min(28, state.temperature));

        state.humidity += Math.round((Math.random() - 0.5) * 3);
        state.humidity = Math.max(35, Math.min(65, state.humidity));

        state.people += Math.round((Math.random() - 0.5) * 2);
        state.people = Math.max(0, Math.min(30, state.people));

        if (state.acOn) {
            state.temperature += (state.setpoint - state.temperature) * 0.08;
        }

        renderValues();
        updateGraphValues();
    }

    function simulateControl(dispositivo, dados) {
        if (dispositivo === "iluminacao") {
            state.lightOn = dados.ligado;
            addHistory("Iluminação alterada", state.lightOn ? "Luzes ligadas." : "Luzes desligadas.", "✓");
        }

        if (dispositivo === "ar_condicionado") {
            state.acOn = dados.ligado;
            addHistory("Ar-condicionado alterado", state.acOn ? "Equipamento ligado." : "Equipamento desligado.", "✓");
        }

        if (dispositivo === "temperatura") {
            state.setpoint = dados.valor;
            addHistory("Temperatura ajustada", `Nova temperatura desejada: ${state.setpoint} °C.`, "✓");
        }

        renderValues();
        showToast("Comando simulado com sucesso.");
    }

    // ==========================================
    // API PYTHON
    // ==========================================

    async function apiRequest(endpoint, options = {}) {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...options.headers
            }
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.mensagem || result.erro || "Erro na API.");
        }

        return result;
    }

    async function loadFromAPI() {
        if (state.mode !== "connected") return false;

        try {
            const data = await apiRequest("/status");

            state.temperature = Number(data.temperatura);
            state.humidity = Number(data.umidade);
            state.people = Number(data.pessoas);
            state.lightOn = Boolean(data.iluminacao);
            state.acOn = Boolean(data.ar_condicionado);
            state.setpoint = Number(data.temperatura_desejada);

            state.apiConnected = true;
            state.arduinoConnected = Boolean(data.arduino_conectado);

            renderValues();
            updateGraphValues();
            return true;
        } catch (error) {
            state.apiConnected = false;
            state.arduinoConnected = false;
            updateSystemStatus();
            console.error("Erro na API:", error);
            return false;
        }
    }

    async function sendControl(dispositivo, dados) {
        if (state.mode === "demo") {
            simulateControl(dispositivo, dados);
            return true;
        }

        try {
            const result = await apiRequest("/controle", {
                method: "POST",
                body: JSON.stringify({ dispositivo, ...dados })
            });

            addHistory("Comando enviado", result.mensagem || "Comando enviado à API.", "✓");
            await loadFromAPI();
            showToast(result.mensagem || "Comando enviado.");
            return true;
        } catch (error) {
            showToast(error.message);
            await loadFromAPI();
            return false;
        }
    }

    // ==========================================
    // CONTROLES
    // ==========================================

    function setupControls() {
        $("lightToggle").addEventListener("change", async event => {
            const toggle = event.target;
            const ligado = toggle.checked;

            if (state.mode === "connected") toggle.disabled = true;

            const success = await sendControl("iluminacao", { ligado });
            toggle.disabled = false;

            if (!success) toggle.checked = state.lightOn;
        });

        $("acToggle").addEventListener("change", async event => {
            const toggle = event.target;
            const ligado = toggle.checked;

            if (state.mode === "connected") toggle.disabled = true;

            const success = await sendControl("ar_condicionado", { ligado });
            toggle.disabled = false;

            if (!success) toggle.checked = state.acOn;
        });

        $("setpoint").addEventListener("input", event => {
            $("setpointValue").textContent = event.target.value;
        });

        $("setpoint").addEventListener("change", async event => {
            const valor = Number(event.target.value);
            await sendControl("temperatura", { valor });
        });
    }

    // ==========================================
    // NAVEGAÇÃO
    // ==========================================

    function setupNavigation() {
        const links = document.querySelectorAll(".nav-link");

        links.forEach(link => {
            link.addEventListener("click", event => {
                event.preventDefault();
                const page = link.dataset.page;

                document.querySelectorAll(".secondary-section").forEach(section => {
                    section.classList.remove("visible");
                });

                $("inicio").style.display =
                    page === "inicio" || page === "equipamentos" ? "block" : "none";

                if (page === "sensores") $("sensores").classList.add("visible");
                if (page === "historico") $("historico").classList.add("visible");

                if (page === "equipamentos") {
                    setTimeout(() => {
                        $("equipamentos").scrollIntoView({ behavior: "smooth", block: "center" });
                    }, 50);
                } else {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                }

                links.forEach(item => item.classList.toggle("active", item === link));

                $("pageTitle").textContent = {
                    inicio: "Visão geral",
                    sensores: "Sensores",
                    equipamentos: "Equipamentos",
                    historico: "Histórico"
                }[page];

                $("sidebar").classList.remove("open");
            });
        });
    }

    // ==========================================
    // INICIALIZAÇÃO
    // ==========================================

    async function initialize() {
        createCharts();
        createModeSelector();
        setupNavigation();
        setupControls();

        $("menuButton").addEventListener("click", () => {
            $("sidebar").classList.toggle("open");
        });

        $("refreshButton").addEventListener("click", async () => {
            if (state.mode === "demo") {
                simulateEnvironment();
                showToast("Dados demonstrativos atualizados.");
                return;
            }

            const success = await loadFromAPI();
            showToast(success ? "Dados atualizados." : "Não foi possível conectar à API.");
        });

        addHistory("Sistema iniciado", "SMARTCLASS iniciado em modo demonstração.", "✓");
        renderValues();

        updateTimer = setInterval(simulateEnvironment, INTERVALO_ATUALIZACAO);
    }

    document.addEventListener("DOMContentLoaded", initialize);
})();
