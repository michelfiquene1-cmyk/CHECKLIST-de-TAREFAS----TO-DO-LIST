
const API_URL = "https://vizioon-todoist-java-backend.onrender.com/api/tarefa";

let tarefas = [];

const listaE1 = document.getElementById("lista-tarefas");
const contadorE1 = document.getElementById("contador");
const statusE1 = document.getElementById("status-api");
const formularioE1 = document.getElementById("formulario-tarefa");
const campoE1 = document.getElementById("campo-tarefa");
const botaoE1 = document.getElementById("botao-adicionar");


async function buscarTarefas() {

    statusE1.textContent = "Carregando tarefas...";
    statusE1.classList = "carregando";

    try {

        const response = await fetch(API_URL);

        if (!response.ok) {
            throw new Error("Erro ao buscar tarefas");
        }

        const data = await response.json();

        tarefas = data.map(item => ({
            id: item.id,
            nome: item.nome,
            concluida: item.concluida
        }));

        statusE1.textContent = "Tarefas carregadas com sucesso!";

        renderizarTarefas();

    } catch (error) {

        statusE1.textContent = "Erro ao conectar com a API.";
        statusE1.classList = "erro";

        console.error(error);

    }
}


function renderizarTarefas() {

    listaE1.innerHTML = "";

    if (tarefas.length === 0) {

        listaE1.innerHTML = "<li>Nenhuma tarefa encontrada.</li>";

    }

    tarefas.forEach(tarefa => {

        const itemE1 = document.createElement("li");

        itemE1.innerHTML = `
            <span class="checkbox ${tarefa.concluida ? "marcado" : ""}">
                ${tarefa.concluida ? "✓" : ""}
            </span>

            <span class="texto-tarefa">
                ${tarefa.concluida ? `<s>${tarefa.nome}</s>` : tarefa.nome}
            </span>

            <button class="botao-excluir" type="button">
                X
            </button>
        `;


        itemE1
            .querySelector(".checkbox")
            .addEventListener("click", () => {
                alterarTarefa(tarefa.id);
            });


        itemE1
            .querySelector(".botao-excluir")
            .addEventListener("click", () => {
                excluirTarefa(tarefa.id);
            });


        listaE1.appendChild(itemE1);

    });


    const feitas = tarefas.filter(tarefa => tarefa.concluida).length;

    contadorE1.textContent =
        `${feitas} de ${tarefas.length} feitas`;
}


async function excluirTarefa(id) {

    try {

        const response = await fetch(`${API_URL}/${id}`, {
            method: "DELETE"
        });

        if (!response.ok) {
            throw new Error("Erro ao excluir tarefa");
        }

        tarefas = tarefas.filter(tarefa => tarefa.id !== id);

        renderizarTarefas();

    } catch (error) {

        console.error(error);

    }
}


async function criarTarefa(texto) {

    botaoE1.disabled = true;

    try {

        const response = await fetch(API_URL, {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                nome: texto,
                descricao: ""
            })
        });


        if (!response.ok) {
            throw new Error("Erro ao criar tarefa");
        }


        const tarefaCriada = await response.json();


        tarefas.unshift({
            id: tarefaCriada.id,
            nome: tarefaCriada.nome,
            concluida: false
        });


        renderizarTarefas();

   } catch (error) {

    console.error(error);

    statusE1.textContent = "Erro ao adicionar tarefa.";

} finally {

        botaoE1.disabled = false;

    }
}


async function alterarTarefa(id) {

    const tarefa = tarefas.find(tarefa => tarefa.id === id);

    if (!tarefa) {
        return;
    }

    try {

        const response = await fetch(`${API_URL}/${id}`, {
            method: "PUT",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                nome: tarefa.nome,
                descricao: "",
                concluida: !tarefa.concluida
            })
        });


        if (!response.ok) {
            throw new Error("Erro ao alterar tarefa");
        }


        tarefa.concluida = !tarefa.concluida;

        renderizarTarefas();

    } catch (error) {

        console.error(error);

    }
}

formularioE1.addEventListener("submit", async (event) => {

    event.preventDefault();

    const texto = campoE1.value.trim();

    if (texto === "") {
        return;
    }

    await criarTarefa(texto);

    campoE1.value = "";

    campoE1.focus();

});




buscarTarefas();
