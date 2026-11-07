import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile, readdir, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from '../tools/serve.mjs';
import '../tools/build.mjs';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const publishRoot = path.join(projectRoot, 'dist');

test('Publicação: somente arquivos públicos e caminhos relativos válidos', async () => {
    assert.deepEqual((await readdir(publishRoot)).sort(), ['index.html', 'script.js', 'style.css']);
    for (const name of ['index.html', 'script.js', 'style.css']) {
        assert.deepEqual(await readFile(path.join(publishRoot, name)), await readFile(path.join(projectRoot, name)));
    }
    const html = await readFile(path.join(publishRoot, 'index.html'), 'utf8');
    assert.match(html, /href="style\.css"/);
    assert.match(html, /src="script\.js"/);
});

test('Checklist: fluxos reais no navegador, persistência, segurança e API simulada', { timeout: 90000 }, async t => {
    const executable = process.env.CHROME_PATH || [
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
        '/usr/bin/google-chrome', '/usr/bin/chromium'
    ].find(existsSync);
    assert.ok(executable, 'Instale Chrome/Edge ou defina CHROME_PATH');
    const profile = await mkdtemp(path.join(os.tmpdir(), 'checklist-browser-'));
    // Exercitar o mesmo conjunto de arquivos que será publicado no Netlify.
    const server = createServer(publishRoot);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const resource of ['/', '/style.css', '/script.js']) {
        assert.equal((await fetch(`${origin}${resource}`)).status, 200);
    }
    const browser = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run',
        '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'],
    { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let socket;
    t.after(async () => {
        socket?.close();
        browser.kill();
        await new Promise(resolve => server.close(resolve));
        // Chrome pode ainda estar finalizando arquivos do perfil temporário.
        await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => {});
    });
    const endpoint = await new Promise((resolve, reject) => {
        let output = '';
        const timeout = setTimeout(() => reject(new Error('Chrome não iniciou em 20s')), 20000);
        browser.on('error', reject);
        browser.stderr.on('data', data => {
            output += data;
            const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
            if (match) { clearTimeout(timeout); resolve(match[1]); }
        });
    });
    const tabs = await (await fetch(`http://${new URL(endpoint).host}/json/list`)).json();
    socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let serial = 0;
    const pending = new Map();
    socket.onmessage = event => {
        const data = JSON.parse(event.data);
        if (data.id) {
            const callback = pending.get(data.id);
            pending.delete(data.id);
            if (data.error) callback.reject(new Error(data.error.message));
            else callback.resolve(data.result);
        }
    };
    const cdp = (method, params = {}) => new Promise((resolve, reject) => {
        const id = ++serial;
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
    });
    const run = async expression => {
        const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
        return result.result.value;
    };
    const wait = async expression => {
        for (let i = 0; i < 150; i++) {
            if (await run(expression)) return;
            await new Promise(resolve => setTimeout(resolve, 30));
        }
        throw new Error(`Condição não alcançada: ${expression}`);
    };
    await cdp('Page.enable');
    // Bloquear a API antes de executar o app, inclusive após recarregar a página.
    await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `
        window.localFetchCalls = 0;
        window.fetch = async () => { window.localFetchCalls++; throw new Error('API bloqueada no teste local'); };
    ` });
    await cdp('Page.navigate', { url: origin });
    await wait('typeof criarTarefa === "function" && document.querySelector(".vazio") !== null');
    await run(`window.add = async text => {
        document.getElementById('campo-tarefa').value = text;
        document.getElementById('formulario-tarefa').requestSubmit();
        while (ocupado) await new Promise(r => setTimeout(r, 5));
    }; window.click = selector => document.querySelector(selector).click();`);
    await run('add("   ")');
    assert.equal(await run('tarefas.length'), 0);
    assert.match(await run('mensagem.textContent'), /Digite/);
    await run('add("  Estudar JavaScript  ")');
    assert.equal(await run('tarefas[0].nome'), 'Estudar JavaScript');
    assert.equal(await run('campo.value'), '');
    await run('click(".botao-editar"); document.querySelector(".edicao input").value = "Revisar CSS"; document.querySelector(".edicao").requestSubmit()');
    await wait('!ocupado');
    assert.equal(await run('tarefas[0].nome'), 'Revisar CSS');
    await run('document.querySelector(".botao-editar").click(); document.querySelector(".edicao input").value="Revisar por teclado"');
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', windowsVirtualKeyCode: 13 });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await wait('!ocupado && tarefas[0].nome === "Revisar por teclado"');
    await run('alterarTarefa(tarefas[0].id, {nome:"Revisar CSS"})');
    await run('click(".botao-editar"); document.querySelector(".edicao input").value = " "; document.querySelector(".edicao").requestSubmit()');
    assert.equal(await run('tarefas[0].nome'), 'Revisar CSS');
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
    assert.equal(await run('document.querySelector(".edicao")'), null);
    await run('click(".checkbox")');
    await wait('!ocupado');
    assert.equal(await run('tarefas[0].concluida'), true);
    assert.equal(await run('porId("contador").textContent'), '1 de 1 feitas');
    await run('click("[data-filtro=pendentes]")');
    assert.equal(await run('lista.querySelectorAll(".checkbox").length'), 0);
    await run('click("[data-filtro=concluidas]")');
    assert.equal(await run('lista.querySelectorAll(".checkbox").length'), 1);
    await run('click(".checkbox")');
    await wait('!ocupado');
    assert.equal(await run('tarefas[0].concluida'), false);
    await run('click("[data-filtro=todas]"); add("<img src=x onerror=alert(1)>")');
    assert.equal(await run('lista.querySelector("img")'), null);
    assert.ok(await run('lista.textContent.includes("<img src=x onerror=alert(1)>")'));
    await cdp('Page.reload');
    await wait('typeof tarefas !== "undefined" && tarefas.length === 2');
    assert.equal(await run('tarefas[1].nome'), 'Revisar CSS');
    await run('document.querySelector(".botao-excluir").click()');
    await wait('!ocupado');
    assert.equal(await run('tarefas.length'), 1);
    await run(`window.originalSet = Storage.prototype.setItem;
        Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); };
        campo.value = 'Preservar texto'; porId('formulario-tarefa').requestSubmit();`);
    await wait('!ocupado');
    assert.equal(await run('tarefas.length'), 1);
    assert.equal(await run('campo.value'), 'Preservar texto');
    assert.ok(await run('mensagem.classList.contains("erro")'));
    await run('Storage.prototype.setItem = originalSet');
    assert.equal(await run('window.localFetchCalls'), 0, 'Modo local não depende da API');
    // Simulação local: nenhuma chamada de escrita alcança a API real.
    await run(`window.calls = []; window.remote = [{id: 7, nome: 'Remota', descricao: 'Preservar', concluida: false}];
        window.fetch = async (url, options = {}) => {
            calls.push({url, ...options});
            if (!options.method) return {ok: true, json: async () => remote};
            if (options.method === 'POST') return {ok: true, json: async () => ({id: 8, ...JSON.parse(options.body), concluida: false})};
            return {ok: true};
        };
        seletorModo.value = 'api'; seletorModo.dispatchEvent(new Event('change'));`);
    await wait('!ocupado && apiDisponivel');
    assert.equal(await run('tarefas[0].nome'), 'Remota');
    await run('campo.value = "Nova remota"; porId("formulario-tarefa").requestSubmit()');
    await wait('!ocupado');
    await run('alterarTarefa(7, {nome: "Editada", concluida: true})');
    assert.equal(await run('JSON.parse(calls.find(c => c.method === "PUT").body).descricao'), 'Preservar');
    await run('excluirTarefa(8)');
    assert.deepEqual(await run('calls.map(c => c.method || "GET")'), ['GET', 'POST', 'PUT', 'DELETE']);
    await run('window.fetch = async () => {throw new Error("offline")}; campo.value="Não perder"; porId("formulario-tarefa").requestSubmit()');
    await wait('!ocupado');
    assert.equal(await run('campo.value'), 'Não perder');
    assert.equal(await run('tarefas.length'), 1);
    assert.equal(await run('apiDisponivel'), false);
    await run('recarregar.click()');
    await wait('!ocupado');
    assert.match(await run('status.textContent'), /indisponível/);
    await run('seletorModo.value="local"; seletorModo.dispatchEvent(new Event("change"))');
    assert.equal(await run('tarefas[0].nome'), 'Revisar CSS');
    await run('criarTarefa("a".repeat(200))');
    assert.equal(await run('criarTarefa("a".repeat(201))'), false);
    for (const width of [320, 375, 768, 1440]) {
        await cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 });
        assert.ok(await run('document.documentElement.scrollWidth <= innerWidth'), `Sem transbordamento em ${width}px`);
        await run('document.querySelector(".botao-editar").click()');
        assert.ok(await run('document.documentElement.scrollWidth <= innerWidth'), `Edição sem transbordamento em ${width}px`);
        await run('document.querySelector(".secundario").click()');
        if (width === 375) {
            const mobile = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
            await writeFile(path.join(os.tmpdir(), 'checklist-mobile.png'), Buffer.from(mobile.data, 'base64'));
        }
    }
    const screenshot = await cdp('Page.captureScreenshot', { format: 'png' });
    const screenshotPath = path.join(os.tmpdir(), 'checklist-desktop.png');
    await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'));
    t.diagnostic(`Screenshot: ${screenshotPath}`);
    await run('localStorage.setItem(STORAGE_KEY, "{inválido"); carregarLocal()');
    assert.match(await run('status.textContent'), /inválidos/);
    assert.equal(await run('localStorage.getItem(STORAGE_KEY)'), '{inválido');
    t.diagnostic('CRUD local/remoto simulado, filtros, contador, recarga, XSS, armazenamento, teclado e 4 larguras verificados.');
});
