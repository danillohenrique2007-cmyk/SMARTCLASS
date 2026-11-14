
(() => {
    "use strict";

    // ======================================
    // CONFIGURAÇÕES
    // ======================================

    const API_URL = "http://127.0.0.1:5000/api";

    const state = {
        temperature: 22,
        humidity: 48,
        people: 12,
        lightOn: true,
        acOn: false,
        setpoint: 22,
        history: [],
        labels: ["08h", "09h", "10h", "11h", "12h", "13h", "14h"],
        temperatures: [21.2, 21.7, 22.1, 22.4, 22, 22.6, 22],
        humidities: [51, 50, 49, 47, 49, 46, 48]
    };

    const $ = id => document.getElementById(id);

    let environmentChart = null;
    let sensorChart = null;
    let toastTimer = null;

    // ======================================
    // NOTIFICAÇÕES
    // ======================================

    function showToast(message) {
        const toast = $("toast");

        toast.textContent = message;
        toast.classList.add("show");

        clearTimeout(toastTimer);

        toastTimer = setTimeout(() => {
            toast.classList.remove("show");
        }, 3000);
    }

    // ======================================
    // HISTÓRICO
    // ======================================

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

        $("historyCount").textContent =
            `${state.history.length} registro(s)`;

        if (!state.history.length) {
            $("historyList").innerHTML =
                '<div class="empty-state">Nenhum registro disponível.</div>';
            return;
        }

        $("historyList").innerHTML = state.history.map(item => `
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

    // ======================================
    // ATUALIZAR INTERFACE
    // ======================================

    function renderValues() {

        const temp = Number(state.temperature)
            .toFixed(1)
            .replace(".", ",");

        $("temperatureValue").innerHTML =
            `${temp}<small>°C</small>`;

        $("humidityValue").innerHTML =
            `${state.humidity}<small>%</small>`;

        $("peopleValue").innerHTML =
            `${state.people}<small> pessoas</small>`;

        $("sensorTemperature").innerHTML =
            `${temp}<small>°C</small>`;

        $("sensorHumidity").innerHTML =
            `${state.humidity}<small>%</small>`;

        $("sensorPeople").innerHTML =
            `${state.people}<small> pessoas</small>`;

        $("occupancyNumber").textContent = state.people;

        const percentage = Math.min(
            100,
            Math.max(0, state.people / 30 * 100)
        );

        $("capacityBar").style.width = `${percentage}%`;
        $("occupancyBar").style.width = `${percentage}%`;

        document.querySelector(".occupancy-badge").textContent =
            `${Math.round(percentage)}% da capacidade`;

        $("lightValue").textContent =
            state.lightOn ? "Ligada" : "Desligada";

        $("lightStatus").textContent =
            state.lightOn ? "● Ativa" : "● Inativa";

        $("lightDescription").textContent =
            state.lightOn ? "Luzes ligadas" : "Luzes desligadas";

        $("lightToggle").checked = state.lightOn;
        $("acToggle").checked = state.acOn;

        $("acDescription").textContent =
            state.acOn
                ? `Ligado · Ajustado em ${state.setpoint} °C`
                : "Desligado";

        $("setpointValue").textContent = state.setpoint;
        $("setpoint").value = state.setpoint;

        $("lastUpdated").textContent =
            "Atualizado às " + new Date().toLocaleTimeString("pt-BR");
    }

    // ======================================
    // GRÁFICOS
    // ======================================

    function chartOptions(legend = false) {

        return {
            responsive: true,
            maintainAspectRatio: false,

            interaction: {
                mode: "index",
                intersect: false
            },

            plugins: {
                legend: {
                    display: legend,
                    labels: {
                        color: "#91a8c1",
                        usePointStyle: true
                    }
                }
            },

            scales: {
                x: {
                    grid: { color: "#1a3048" },
                    ticks: { color: "#7089a4" }
                },

                y: {
                    grid: { color: "#1a3048" },
                    ticks: { color: "#7089a4" }
                }
            }
        };
    }

    function createCharts() {

        if (typeof Chart === "undefined") {
            console.error("Chart.js não foi carregado.");
            return;
        }

        environmentChart = new Chart(
            $("environmentChart"),
            {
                type: "line",

                data: {
                    labels: state.labels,

                    datasets: [
                        {
                            label: "Temperatura (°C)",
                            data: state.temperatures,
                            borderColor: "#28b5ff",
                            backgroundColor: "#28b5ff18",
                            tension: 0.4,
                            fill: true,
                            yAxisID: "y"
                        },
                        {
                            label: "Umidade (%)",
                            data: state.humidities,
                            borderColor: "#a78bfa",
                            tension: 0.4,
                            yAxisID: "y1"
                        }
                    ]
                },

                options: {
                    ...chartOptions(),

                    scales: {
                        x: chartOptions().scales.x,

                        y: {
                            position: "left",
                            grid: { color: "#1a3048" }
                        },

                        y1: {
                            position: "right",
                            min: 0,
                            max: 100,
                            grid: { drawOnChartArea: false }
                        }
                    }
                }
            }
        );

        sensorChart = new Chart(
            $("sensorChart"),
            {
                type: "line",

                data: {
                    labels: state.labels,

                    datasets: [
                        {
                            label: "Temperatura (°C)",
                            data: state.temperatures,
                            borderColor: "#28b5ff",
                            tension: 0.4
                        },
                        {
                            label: "Umidade (%)",
                            data: state.humidities,
                            borderColor: "#a78bfa",
                            tension: 0.4
                        }
                    ]
                },

                options: chartOptions(true)
            }
        );
    }

    function updateCharts() {

        [environmentChart, sensorChart].forEach(chart => {

            if (!chart) return;

            chart.data.labels = state.labels;

            chart.data.datasets[0].data = state.temperatures;
            chart.data.datasets[1].data = state.humidities;

            chart.update();
        });
    }

    function updateGraphValues() {

        state.labels.push(
            new Date().toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit"
            })
        );

        state.temperatures.push(state.temperature);
        state.humidities.push(state.humidity);

        if (state.labels.length > 10) {
            state.labels.shift();
            state.temperatures.shift();
            state.humidities.shift();
        }

        updateCharts();
    }

    // ======================================
    // CONEXÃO COM A API PYTHON
    // ======================================

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

        try {

            const data = await apiRequest("/status");

            state.temperature = Number(data.temperatura);
            state.humidity = Number(data.umidade);
            state.people = Number(data.pessoas);

            state.lightOn = data.iluminacao;
            state.acOn = data.ar_condicionado;

            state.setpoint = Number(data.temperatura_desejada);

            renderValues();
            updateGraphValues();

            if (data.arduino_conectado) {

                $("connectionLabel").textContent =
                    "Arduino conectado";

                $("connectionDetail").textContent =
                    "Comunicação serial ativa";

            } else {

                $("connectionLabel").textContent =
                    "Arduino desconectado";

                $("connectionDetail").textContent =
                    "Verifique a conexão USB";
            }

            return true;

        } catch (error) {

            $("connectionLabel").textContent =
                "API desconectada";

            $("connectionDetail").textContent =
                "Verifique o servidor Python";

            console.error("Erro na API:", error);

            return false;
        }
    }

    // ======================================
    // ENVIAR COMANDOS PARA A API
    // ======================================

    async function sendControl(dispositivo, dados) {

        try {

            const result = await apiRequest("/controle", {
                method: "POST",

                body: JSON.stringify({
                    dispositivo,
                    ...dados
                })
            });

            addHistory(
                "Comando enviado",
                result.mensagem,
                "✓"
            );

            await loadFromAPI();

            showToast(result.mensagem);

            return true;

        } catch (error) {

            showToast(error.message);

            await loadFromAPI();

            return false;
        }
    }

    // ======================================
    // CONTROLES DE ILUMINAÇÃO
    // ======================================

    $("lightToggle").addEventListener("change", async event => {

        const ligado = event.target.checked;

        event.target.disabled = true;

        const sucesso = await sendControl(
            "iluminacao",
            { ligado }
        );

        event.target.disabled = false;

        if (!sucesso) {
            event.target.checked = state.lightOn;
        }
    });

    // ======================================
    // CONTROLES DO AR-CONDICIONADO
    // ======================================

    $("acToggle").addEventListener("change", async event => {

        const ligado = event.target.checked;

        event.target.disabled = true;

        const sucesso = await sendControl(
            "ar_condicionado",
            { ligado }
        );

        event.target.disabled = false;

        if (!sucesso) {
            event.target.checked = state.acOn;
        }
    });

    // ======================================
    // AJUSTE DE TEMPERATURA
    // ======================================

    $("setpoint").addEventListener("input", event => {

        $("setpointValue").textContent =
            event.target.value;

    });

    $("setpoint").addEventListener("change", async event => {

        const valor = Number(event.target.value);

        await sendControl(
            "temperatura",
            { valor }
        );
    });

    // ======================================
    // NAVEGAÇÃO
    // ======================================

    function setupNavigation() {

        const links = document.querySelectorAll(".nav-link");

        links.forEach(link => {

            link.addEventListener("click", event => {

                event.preventDefault();

                const page = link.dataset.page;

                document.querySelectorAll(".secondary-section")
                    .forEach(section => {
                        section.classList.remove("visible");
                    });

                $("inicio").style.display =
                    page === "inicio" || page === "equipamentos"
                        ? "block"
                        : "none";

                if (page === "sensores") {
                    $("sensores").classList.add("visible");
                }

                if (page === "historico") {
                    $("historico").classList.add("visible");
                }

                if (page === "equipamentos") {

                    setTimeout(() => {
                        $("equipamentos").scrollIntoView({
                            behavior: "smooth",
                            block: "center"
                        });
                    }, 50);

                } else {

                    window.scrollTo({
                        top: 0,
                        behavior: "smooth"
                    });
                }

                links.forEach(item => {
                    item.classList.toggle(
                        "active",
                        item === link
                    );
                });

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

    // ======================================
    // INICIALIZAÇÃO
    // ======================================

    async function initialize() {

        createCharts();

        setupNavigation();

        $("menuButton").addEventListener("click", () => {
            $("sidebar").classList.toggle("open");
        });

        $("refreshButton").addEventListener("click", async () => {

            const sucesso = await loadFromAPI();

            showToast(
                sucesso
                    ? "Dados atualizados."
                    : "Não foi possível atualizar os dados."
            );
        });

        addHistory(
            "Sistema iniciado",
            "SMARTCLASS conectado ao frontend.",
            "✓"
        );

        renderValues();

        // Primeira consulta.
        await loadFromAPI();

        // Atualizar dados a cada 2 segundos.
        setInterval(loadFromAPI, 2000);
    }

    document.addEventListener(
        "DOMContentLoaded",
        initialize
    );

})();
