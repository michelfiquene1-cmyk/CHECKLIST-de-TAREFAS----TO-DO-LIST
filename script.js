"use strict";

const API_URL = "https://vizioon-todoist-java-backend.onrender.com/api/tarefa";
const STORAGE_KEY = "checklist.tarefas.v1";
const LIMITE = 200;
let tarefas = [];
let filtro = "todas";
let modo = "local";
let ocupado = false;
let apiDisponivel = false;
let editando = null;
const porId = id => document.getElementById(id);
const lista = porId("lista-tarefas");
const campo = porId("campo-tarefa");
const mensagem = porId("mensagem");
const status = porId("status-api");
const seletorModo = porId("modo");
const recarregar = porId("recarregar");

function informar(texto, erro = false) {
    mensagem.textContent = texto;
    mensagem.classList.toggle("erro", erro);
}

function validar(dados) {
    if (!Array.isArray(dados)) throw new Error("Lista inválida");
    const ids = new Set();
    return dados.map(t => {
        if (!t || !["string", "number"].includes(typeof t.id) || !String(t.id).trim() ||
            (typeof t.id === "number" && !Number.isFinite(t.id)) || ids.has(String(t.id)) ||
            typeof t.nome !== "string" || !t.nome.trim() || t.nome.trim().length > LIMITE ||
            typeof t.concluida !== "boolean") throw new Error("Tarefa inválida");
        ids.add(String(t.id));
        return { id: t.id, nome: t.nome.trim(), concluida: t.concluida,
            descricao: typeof t.descricao === "string" ? t.descricao : "" };
    });
}

function carregarLocal() {
    tarefas = [];
    try {
        const dados = localStorage.getItem(STORAGE_KEY);
        tarefas = dados === null ? [] : validar(JSON.parse(dados));
        status.textContent = "Tarefas salvas apenas neste navegador e neste endereço.";
    } catch {
        status.textContent = "Armazenamento indisponível ou com dados inválidos.";
        informar("Não foi possível ler as tarefas. Os dados existentes foram preservados. Verifique o armazenamento do navegador.", true);
    }
    renderizar();
}

async function requisitar(caminho = "", opcoes = {}) {
    const controle = new AbortController();
    const timer = setTimeout(() => controle.abort(), 15000);
    try {
        const resposta = await fetch(`${API_URL}${caminho}`, { ...opcoes, signal: controle.signal });
        if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
        return resposta;
    } finally { clearTimeout(timer); }
}

function bloquear(valor) {
    ocupado = valor;
    seletorModo.disabled = valor;
    recarregar.disabled = valor;
    porId("botao-adicionar").disabled = valor || (modo === "api" && !apiDisponivel);
    lista.setAttribute("aria-busy", String(valor));
    lista.querySelectorAll("button, input").forEach(el => { el.disabled = valor || (modo === "api" && !apiDisponivel); });
    document.querySelectorAll("[data-filtro]").forEach(el => { el.disabled = valor; });
}

async function buscarTarefas() {
    bloquear(true);
    status.textContent = "Carregando API… O servidor pode demorar para iniciar.";
    try {
        tarefas = validar(await (await requisitar()).json());
        apiDisponivel = true;
        status.textContent = "Modo API: dados do servidor, possivelmente compartilhados. Evite informações pessoais.";
        informar("Tarefas carregadas.");
    } catch {
        apiDisponivel = false;
        status.textContent = "API indisponível. Recarregue ou selecione Neste navegador.";
        informar("Não foi possível carregar a API. Nenhum dado local foi enviado.", true);
    } finally { renderizar(); bloquear(false); }
}

function botao(texto, classe, acao) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = classe;
    el.textContent = texto;
    el.addEventListener("click", acao);
    return el;
}

function focar(id, seletor = ".checkbox") {
    const linha = [...lista.children].find(el => el.dataset.id === String(id));
    (linha?.querySelector(seletor) || campo).focus();
}

function renderizar() {
    // Nunca interpretar nomes vindos do usuário ou da API como HTML.
    lista.replaceChildren();
    porId("contador").textContent = `${tarefas.filter(t => t.concluida).length} de ${tarefas.length} feitas`;
    const visiveis = tarefas.filter(t => filtro === "todas" || (filtro === "concluidas" ? t.concluida : !t.concluida));
    if (!visiveis.length) {
        const vazio = document.createElement("li");
        vazio.className = "vazio";
        vazio.textContent = modo === "api" && !apiDisponivel ? "Aguardando conexão com a API." :
            tarefas.length ? "Nenhuma tarefa neste filtro." : "Sua lista está livre. Adicione a primeira tarefa!";
        lista.append(vazio);
    }
    visiveis.forEach(t => {
        const item = document.createElement("li");
        item.dataset.id = String(t.id);
        if (editando === t.id) {
            const form = document.createElement("form");
            form.className = "edicao";
            const entrada = document.createElement("input");
            entrada.value = t.nome;
            entrada.maxLength = LIMITE;
            entrada.setAttribute("aria-label", "Editar nome da tarefa");
            entrada.setAttribute("aria-describedby", "mensagem");
            const salvar = document.createElement("button");
            salvar.type = "submit";
            salvar.textContent = "Salvar";
            const cancelar = () => { editando = null; renderizar(); focar(t.id, ".botao-editar"); };
            form.append(entrada, salvar, botao("Cancelar", "secundario", cancelar));
            form.addEventListener("submit", async event => {
                event.preventDefault();
                if (await alterarTarefa(t.id, { nome: entrada.value.trim() })) focar(t.id, ".botao-editar");
                else entrada.focus();
            });
            entrada.addEventListener("keydown", event => { if (event.key === "Escape") cancelar(); });
            item.append(form);
        } else {
            const check = document.createElement("input");
            check.type = "checkbox";
            check.className = "checkbox";
            check.checked = t.concluida;
            check.setAttribute("aria-label", `Marcar como ${t.concluida ? "pendente" : "concluída"}: ${t.nome}`);
            check.addEventListener("change", async () => {
                await alterarTarefa(t.id, { concluida: check.checked });
                check.checked = t.concluida;
                focar(t.id);
            });
            const texto = document.createElement("span");
            texto.className = `texto-tarefa${t.concluida ? " concluida" : ""}`;
            texto.textContent = t.nome;
            const editar = botao("Editar", "botao-editar", () => {
                editando = t.id;
                renderizar();
                const entrada = lista.querySelector(".edicao input");
                entrada.focus();
                entrada.select();
            });
            editar.setAttribute("aria-label", `Editar: ${t.nome}`);
            const excluir = botao("Excluir", "botao-excluir", async () => {
                const indice = visiveis.indexOf(t);
                const proxima = visiveis[indice + 1] || visiveis[indice - 1];
                if (await excluirTarefa(t.id)) focar(proxima?.id);
            });
            excluir.setAttribute("aria-label", `Excluir: ${t.nome}`);
            item.append(check, texto, editar, excluir);
        }
        lista.append(item);
    });
    bloquear(ocupado);
}

function salvarLocal(novas) {
    // Só confirmar a mudança na interface se a gravação funcionar.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(novas));
    tarefas = novas;
}

async function executar(acao, sucesso) {
    if (ocupado || (modo === "api" && !apiDisponivel)) return false;
    bloquear(true);
    try {
        await acao();
        editando = null;
        renderizar();
        informar(sucesso);
        return true;
    } catch {
        informar(modo === "local" ? "Não foi possível salvar. A alteração não foi aplicada. Verifique o armazenamento do navegador." :
            "Não foi possível confirmar a alteração na API. Recarregue a lista antes de tentar novamente.", true);
        if (modo === "api") apiDisponivel = false;
        return false;
    } finally { bloquear(false); }
}

function nomeValido(nome) {
    if (!nome || nome.length > LIMITE) {
        informar(`Digite uma tarefa com 1 a ${LIMITE} caracteres.`, true);
        return false;
    }
    return true;
}

async function criarTarefa(nome) {
    if (!nomeValido(nome)) return false;
    return executar(async () => {
        if (modo === "api") {
            const resposta = await requisitar("", { method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nome, descricao: "" }) });
            tarefas = validar([await resposta.json(), ...tarefas]);
        } else salvarLocal([{ id: crypto.randomUUID(), nome, concluida: false, descricao: "" }, ...tarefas]);
    }, filtro === "concluidas" ? "Tarefa adicionada. Veja em Pendentes ou Todas." : "Tarefa adicionada.");
}

async function alterarTarefa(id, alteracoes) {
    if ("nome" in alteracoes && !nomeValido(alteracoes.nome)) return false;
    const tarefa = tarefas.find(t => t.id === id);
    if (!tarefa) return false;
    return executar(async () => {
        const atualizada = { ...tarefa, ...alteracoes };
        if (modo === "api") await requisitar(`/${encodeURIComponent(id)}`, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome: atualizada.nome, descricao: atualizada.descricao, concluida: atualizada.concluida })
        });
        const novas = tarefas.map(t => t.id === id ? atualizada : t);
        if (modo === "local") salvarLocal(novas);
        else tarefas = novas;
    }, "Tarefa atualizada.");
}

async function excluirTarefa(id) {
    return executar(async () => {
        if (modo === "api") await requisitar(`/${encodeURIComponent(id)}`, { method: "DELETE" });
        const novas = tarefas.filter(t => t.id !== id);
        if (modo === "local") salvarLocal(novas);
        else tarefas = novas;
    }, "Tarefa excluída.");
}

porId("formulario-tarefa").addEventListener("submit", async event => {
    event.preventDefault();
    const original = campo.value;
    campo.setAttribute("aria-invalid", String(!original.trim()));
    if (await criarTarefa(original.trim())) {
        if (campo.value === original) campo.value = "";
        campo.setAttribute("aria-invalid", "false");
    }
    campo.focus();
});
campo.addEventListener("input", () => campo.removeAttribute("aria-invalid"));
document.querySelectorAll("[data-filtro]").forEach(el => {
    el.addEventListener("click", () => {
        filtro = el.dataset.filtro;
        editando = null;
        document.querySelectorAll("[data-filtro]").forEach(b => b.setAttribute("aria-pressed", String(b === el)));
        renderizar();
    });
});
seletorModo.addEventListener("change", async () => {
    modo = seletorModo.value;
    editando = null;
    tarefas = [];
    apiDisponivel = false;
    recarregar.hidden = modo !== "api";
    informar("");
    renderizar();
    if (modo === "api") await buscarTarefas();
    else carregarLocal();
});
recarregar.addEventListener("click", buscarTarefas);
window.addEventListener("storage", event => {
    if (modo === "local" && (event.key === STORAGE_KEY || event.key === null)) {
        editando = null;
        informar("Lista atualizada por outra aba.");
        carregarLocal();
    }
});
carregarLocal();
