import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

// ---------- Conexão com o Firestore ----------
const chave = JSON.parse(readFileSync("./serviceAccountKey.json", "utf8"));
initializeApp({ credential: cert(chave) });
const db = getFirestore();
const alunos = db.collection("alunos");

const rl = readline.createInterface({ input, output });
const DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// ---------- Funções auxiliares ----------
async function perguntarData(texto, obrigatoria = true) {
  while (true) {
    const valor = (await rl.question(texto)).trim();
    if (!obrigatoria && valor === "") return "";
    if (DATA_REGEX.test(valor)) return valor;
    console.log("Data inválida. Use o formato AAAA-MM-DD.");
  }
}

function mostrar(doc) {
  const a = doc.data();
  console.log(
    `ID: ${doc.id} | Nome: ${a.nome} | Turma: ${a.turma} | ` +
      `Nascimento: ${a.dataNascimento} | Ativo: ${a.ativo ? "Sim" : "Não"}`
  );
}

function mostrarLista(snapshot) {
  if (snapshot.empty) {
    console.log("Nenhum aluno encontrado.");
    return;
  }
  snapshot.forEach(mostrar);
  console.log(`Total: ${snapshot.size}`);
}

// ---------- CREATE ----------
async function cadastrar() {
  const nome = (await rl.question("Nome: ")).trim();
  const turma = (await rl.question("Turma: ")).trim();
  const dataNascimento = await perguntarData("Data de nascimento (AAAA-MM-DD): ");
  const ativo = (await rl.question("Ativo? (s/n): ")).trim().toLowerCase() === "s";

  if (!nome || !turma) {
    console.log("Nome e turma são obrigatórios.");
    return;
  }

  const ref = await alunos.add({ nome, turma, dataNascimento, ativo });
  console.log(`Aluno cadastrado com ID: ${ref.id}`);
}

// ---------- READ ----------
async function listar() {
  mostrarLista(await alunos.orderBy("nome").get());
}

// ---------- UPDATE ----------
async function atualizar() {
  const id = (await rl.question("ID do aluno: ")).trim();
  const ref = alunos.doc(id);
  const doc = await ref.get();

  if (!doc.exists) {
    console.log("Aluno não encontrado.");
    return;
  }

  const atual = doc.data();
  console.log("Deixe em branco para manter o valor atual.");

  const nome = (await rl.question(`Nome [${atual.nome}]: `)).trim();
  const turma = (await rl.question(`Turma [${atual.turma}]: `)).trim();
  const data = await perguntarData(`Nascimento [${atual.dataNascimento}]: `, false);
  const ativoTxt = (await rl.question(`Ativo (s/n) [${atual.ativo ? "s" : "n"}]: `))
    .trim()
    .toLowerCase();

  const novos = {};
  if (nome) novos.nome = nome;
  if (turma) novos.turma = turma;
  if (data) novos.dataNascimento = data;
  if (ativoTxt === "s" || ativoTxt === "n") novos.ativo = ativoTxt === "s";

  if (Object.keys(novos).length === 0) {
    console.log("Nada para atualizar.");
    return;
  }

  await ref.update(novos);
  console.log("Aluno atualizado com sucesso.");
}

// ---------- DELETE ----------
async function excluir() {
  const id = (await rl.question("ID do aluno: ")).trim();
  const ref = alunos.doc(id);
  const doc = await ref.get();

  if (!doc.exists) {
    console.log("Aluno não encontrado.");
    return;
  }

  const confirma = (await rl.question(`Excluir "${doc.data().nome}"? (s/n): `))
    .trim()
    .toLowerCase();

  if (confirma === "s") {
    await ref.delete();
    console.log("Aluno excluído.");
  } else {
    console.log("Operação cancelada.");
  }
}

// ---------- CONSULTAS ----------
async function consultarPorTurma() {
  const turma = (await rl.question("Turma: ")).trim();
  mostrarLista(await alunos.where("turma", "==", turma).get());
}

async function consultarPorData() {
  console.log("1 - Data exata");
  console.log("2 - Nascidos a partir de uma data");
  console.log("3 - Intervalo de datas");
  const tipo = (await rl.question("Escolha: ")).trim();

  let consulta = alunos;

  if (tipo === "1") {
    const d = await perguntarData("Data (AAAA-MM-DD): ");
    consulta = consulta.where("dataNascimento", "==", d);
  } else if (tipo === "2") {
    const d = await perguntarData("A partir de (AAAA-MM-DD): ");
    consulta = consulta.where("dataNascimento", ">=", d).orderBy("dataNascimento");
  } else if (tipo === "3") {
    const ini = await perguntarData("Data inicial (AAAA-MM-DD): ");
    const fim = await perguntarData("Data final (AAAA-MM-DD): ");
    consulta = consulta
      .where("dataNascimento", ">=", ini)
      .where("dataNascimento", "<=", fim)
      .orderBy("dataNascimento");
  } else {
    console.log("Opção inválida.");
    return;
  }

  mostrarLista(await consulta.get());
}

// ---------- Menu ----------
async function menu() {
  while (true) {
    console.log(`
===== CRUD DE ALUNOS (Firestore) =====
1 - Cadastrar aluno
2 - Listar alunos
3 - Atualizar aluno
4 - Excluir aluno
5 - Consultar por turma
6 - Consultar por data de nascimento
0 - Sair`);

    const opcao = (await rl.question("Escolha: ")).trim();

    try {
      switch (opcao) {
        case "1": await cadastrar(); break;
        case "2": await listar(); break;
        case "3": await atualizar(); break;
        case "4": await excluir(); break;
        case "5": await consultarPorTurma(); break;
        case "6": await consultarPorData(); break;
        case "0":
          rl.close();
          return;
        default:
          console.log("Opção inválida.");
      }
    } catch (erro) {
      console.error("Erro:", erro.message);
    }
  }
}

await menu();
