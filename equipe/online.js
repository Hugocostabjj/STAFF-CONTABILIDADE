/*
  Área da equipe (versão online do painel de certificados e do robô de notas).
  - Login, cadastro, "esqueci a senha" e nova senha pelo Supabase Auth (sem biblioteca externa).
  - Define window.PAINEL_API: o painel.js (o mesmo do computador) chama /api/... e aqui
    cada chamada vira uma consulta ao banco. As permissões valem NO BANCO (RLS):
    esconder botões aqui é só conforto.
  - O robô e os certificados continuam no computador do escritório; o que se muda aqui
    vira um "pedido" que o computador executa em alguns minutos.
*/
(function () {
  "use strict";

  if (window.top !== window.self) { document.documentElement.textContent = ""; return; } // não abrir dentro de outro site

  var URL_BASE = (document.querySelector('meta[name="supabase-url"]') || {}).content || "";
  var CHAVE = (document.querySelector('meta[name="supabase-key"]') || {}).content || "";
  var CHAVE_SESSAO = "staff-equipe-sessao";
  var SESSAO = null, PAPEL = null, ULTIMO_ROBO = null;
  var liberar, PRONTO = new Promise(function (r) { liberar = r; });
  var $ = function (id) { return document.getElementById(id); };
  window.PAINEL_INTERVALO_ROBO = 30000;

  // ------------------------------------------------------------ utilidades
  function erroTraduzido(msg, codigo) {
    var m = String(msg || "").toLowerCase();
    if (m.indexOf("invalid login") >= 0) return "E-mail ou senha incorretos.";
    if (m.indexOf("email not confirmed") >= 0) return "Confirme o seu e-mail pelo link que enviamos antes de entrar.";
    if (m.indexOf("already registered") >= 0 || m.indexOf("already been registered") >= 0) return "Este e-mail já tem cadastro. Use Entrar ou Esqueci a senha.";
    if (m.indexOf("rate limit") >= 0 || m.indexOf("security purposes") >= 0 || codigo === 429) return "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.";
    if (m.indexOf("password") >= 0 && (m.indexOf("least") >= 0 || m.indexOf("weak") >= 0 || m.indexOf("characters") >= 0)) return "Senha fraca: use pelo menos 8 caracteres, com letras e números.";
    if (m.indexOf("same_password") >= 0 || m.indexOf("different from the old") >= 0) return "A nova senha precisa ser diferente da anterior.";
    if (m.indexOf("expired") >= 0 || m.indexOf("invalid") >= 0 && m.indexOf("token") >= 0) return "O link expirou. Peça outro em \"Esqueci a senha\".";
    if (m.indexOf("row-level security") >= 0 || codigo === 403) return "Você não tem permissão para fazer isso.";
    if (m.indexOf("violates check constraint") >= 0) return "Algum campo está fora do formato aceito. Confira e tente de novo.";
    return msg || "não foi possível falar com o servidor";
  }

  function chamar(caminho, op) {
    op = op || {};
    var h = { apikey: CHAVE, "Content-Type": "application/json" };
    if (op.token) h.Authorization = "Bearer " + op.token;
    if (op.prefer) h.Prefer = op.prefer;
    return fetch(URL_BASE + caminho, { method: op.metodo || "GET", headers: h, body: op.corpo === undefined ? undefined : JSON.stringify(op.corpo) })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null;
          try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; }
          if (!r.ok) {
            var msg = j && (j.msg || j.message || j.error_description || j.error) || ("erro " + r.status);
            var e = new Error(erroTraduzido(msg, r.status));
            e.status = r.status;
            throw e;
          }
          return j;
        });
      }, function () { throw new Error("sem conexão com a internet"); });
  }

  // ------------------------------------------------------------ sessão
  function guardarSessao(s) {
    SESSAO = s;
    try {
      if (s) localStorage.setItem(CHAVE_SESSAO, JSON.stringify(s));
      else localStorage.removeItem(CHAVE_SESSAO);
    } catch (e) { /* navegador sem armazenamento: vale só nesta aba */ }
  }

  function sessaoDe(j) {
    return {
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      expires_at: j.expires_at || (Math.floor(Date.now() / 1000) + (Number(j.expires_in) || 3600)),
      email: (j.user && j.user.email) || (SESSAO && SESSAO.email) || ""
    };
  }

  function renovar() {
    if (!SESSAO || !SESSAO.refresh_token) return Promise.reject(new Error("entre de novo"));
    return chamar("/auth/v1/token?grant_type=refresh_token", { metodo: "POST", corpo: { refresh_token: SESSAO.refresh_token } })
      .then(function (j) { guardarSessao(sessaoDe(j)); }, function (e) {
        if (e.status === 400 || e.status === 401) { guardarSessao(null); mostrarTela("login"); erroLogin("Sua sessão expirou. Entre de novo."); }
        throw e;
      });
  }

  function token() {
    if (!SESSAO) return Promise.reject(new Error("entre de novo"));
    if (SESSAO.expires_at - 60 > Date.now() / 1000) return Promise.resolve(SESSAO.access_token);
    return renovar().then(function () { return SESSAO.access_token; });
  }

  function rest(metodo, caminho, corpo, prefer) {
    return token().then(function (t) {
      return chamar("/rest/v1/" + caminho, { metodo: metodo, corpo: corpo, prefer: prefer, token: t });
    }).catch(function (e) {
      if (e.status !== 401) throw e;
      return renovar().then(function () { return chamar("/rest/v1/" + caminho, { metodo: metodo, corpo: corpo, prefer: prefer, token: SESSAO.access_token }); });
    });
  }

  // ------------------------------------------------------------ telas de acesso
  var TELAS = ["login", "cadastro", "esqueci", "nova-senha", "sem-acesso", "carregando"];
  function mostrarTela(qual) {
    document.body.classList.toggle("sem-login", qual !== "app");
    TELAS.forEach(function (t) { $("tela-" + t).hidden = t !== qual; });
    $("acesso").hidden = qual === "app";
    var foco = document.querySelector("#tela-" + qual + " input, #tela-" + qual + " button");
    if (foco && qual !== "carregando") foco.focus();
  }
  function msg(id, texto, ok) {
    var e = $(id);
    e.textContent = texto || "";
    e.hidden = !texto;
    e.className = ok ? "acesso-ok" : "aviso-erro";
  }
  function erroLogin(t) { msg("login-msg", t); }
  function ocupado(form, sim) {
    Array.prototype.forEach.call(form.querySelectorAll("button, input"), function (b) { b.disabled = !!sim; });
  }

  function entrarNoPainel() {
    mostrarTela("carregando");
    return rest("POST", "rpc/meu_papel", {}).then(function (papel) {
      PAPEL = papel || null;
      if (!PAPEL || PAPEL === "robo") {
        $("sem-acesso-email").textContent = SESSAO.email;
        mostrarTela("sem-acesso");
        return;
      }
      $("usuario-nome").textContent = SESSAO.email;
      $("usuario").hidden = false;
      document.body.classList.toggle("modo-leitura", PAPEL === "leitor");
      document.body.classList.toggle("modo-editor", PAPEL === "editor");
      $("tab-equipe").hidden = PAPEL !== "admin";
      rest("GET", "equipe?select=nome&email=eq." + encodeURIComponent(SESSAO.email)).then(function (l) {
        if (l && l[0] && l[0].nome) window.PAINEL_USUARIO = l[0].nome;
      }).catch(function () {});
      mostrarTela("app");
      liberar();
    }).catch(function (e) {
      if (!SESSAO) return;
      mostrarTela("login");
      erroLogin("Não foi possível abrir o painel: " + e.message + ".");
    });
  }

  $("form-login").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var f = this, email = $("login-email").value.trim().toLowerCase(), senha = $("login-senha").value;
    if (!email || !senha) { erroLogin("Preencha o e-mail e a senha."); return; }
    erroLogin("");
    ocupado(f, true);
    chamar("/auth/v1/token?grant_type=password", { metodo: "POST", corpo: { email: email, password: senha } })
      .then(function (j) { $("login-senha").value = ""; guardarSessao(sessaoDe(j)); return entrarNoPainel(); })
      .catch(function (e) { erroLogin(e.message); })
      .then(function () { ocupado(f, false); });
  });

  function enderecoVolta() { return location.origin + location.pathname; }

  $("form-cadastro").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var f = this, email = $("cad-email").value.trim().toLowerCase(), senha = $("cad-senha").value;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { msg("cad-msg", "Digite um e-mail válido."); return; }
    if (senha.length < 8 || !/[a-zA-Z]/.test(senha) || !/[0-9]/.test(senha)) { msg("cad-msg", "A senha precisa ter pelo menos 8 caracteres, com letras e números."); return; }
    ocupado(f, true);
    chamar("/auth/v1/signup?redirect_to=" + encodeURIComponent(enderecoVolta()), { metodo: "POST", corpo: { email: email, password: senha } })
      .then(function (j) {
        $("cad-senha").value = "";
        if (j && j.access_token) { guardarSessao(sessaoDe(j)); return entrarNoPainel(); }
        msg("cad-msg", "Pronto! Enviamos um e-mail para " + email + ". Clique no link do e-mail para confirmar e depois entre com a sua senha. Se não chegar, olhe o spam.", true);
      })
      .catch(function (e) { msg("cad-msg", e.message); })
      .then(function () { ocupado(f, false); });
  });

  $("form-esqueci").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var f = this, email = $("esq-email").value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { msg("esq-msg", "Digite um e-mail válido."); return; }
    ocupado(f, true);
    chamar("/auth/v1/recover?redirect_to=" + encodeURIComponent(enderecoVolta()), { metodo: "POST", corpo: { email: email } })
      .then(function () { msg("esq-msg", "Se este e-mail tiver cadastro, chega em instantes um link para criar uma senha nova. Olhe também o spam.", true); })
      .catch(function (e) { msg("esq-msg", e.message); })
      .then(function () { ocupado(f, false); });
  });

  $("form-nova-senha").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var f = this, senha = $("nova-senha").value;
    if (senha.length < 8 || !/[a-zA-Z]/.test(senha) || !/[0-9]/.test(senha)) { msg("nova-msg", "A senha precisa ter pelo menos 8 caracteres, com letras e números."); return; }
    ocupado(f, true);
    token().then(function (t) { return chamar("/auth/v1/user", { metodo: "PUT", token: t, corpo: { password: senha } }); })
      .then(function () { $("nova-senha").value = ""; return entrarNoPainel(); })
      .catch(function (e) { msg("nova-msg", e.message); })
      .then(function () { ocupado(f, false); });
  });

  Array.prototype.forEach.call(document.querySelectorAll("[data-ir]"), function (b) {
    b.addEventListener("click", function () {
      ["login-msg", "cad-msg", "esq-msg"].forEach(function (id) { msg(id, ""); });
      mostrarTela(b.getAttribute("data-ir"));
    });
  });

  function sair() {
    var t = SESSAO && SESSAO.access_token;
    guardarSessao(null);
    var fim = function () { location.replace(enderecoVolta()); };
    if (!t) return fim();
    chamar("/auth/v1/logout", { metodo: "POST", token: t }).then(fim, fim);
  }
  $("btn-sair").addEventListener("click", sair);
  $("sem-acesso-sair").addEventListener("click", sair);

  // ------------------------------------------------------------ validação (igual ao servidor.py)
  var TIPOS = ["e-CNPJ A1", "e-CNPJ A3", "e-CPF A1", "e-CPF A3", "Outro"];
  var ACOMP = ["", "avisado", "renovando", "nao_renova", "sem_certificado"];
  function digitos(s) { return String(s || "").replace(/\D/g, ""); }
  function texto(v, max) { return String(v || "").replace(/\r/g, " ").replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "").trim().slice(0, max); }
  function dataIso(v) {
    v = String(v || "").trim();
    if (!v) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(Date.parse(v + "T00:00:00Z"))) throw new Error("data inválida: use o calendário do campo");
    return v;
  }
  function mascararDoc(s) {
    s = String(s || "").trim();
    var d = digitos(s);
    if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
    if (d.length === 11) return "***." + d.slice(3, 6) + "." + d.slice(6, 9) + "-**";
    if (/^\*\*\*\.\d{3}\.\d{3}-\*\*$/.test(s)) return s;
    return "";
  }
  function novoId() {
    var b = new Uint8Array(8);
    crypto.getRandomValues(b);
    return Array.prototype.map.call(b, function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
  }
  function sanear(item) {
    if (!item || typeof item !== "object") throw new Error("pedido inválido");
    var id = /^[a-f0-9]{16}$/.test(String(item.id || "")) ? item.id : novoId();
    var email = texto(item.email, 120);
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("e-mail do cliente inválido");
    var whats = digitos(item.whatsapp).slice(0, 13);
    if (whats && (whats.length === 10 || whats.length === 11)) whats = "55" + whats;
    if (whats && whats.length < 12) throw new Error("WhatsApp do cliente incompleto (DDD + número)");
    var out = {
      id: id,
      cliente: texto(item.cliente, 150),
      codigo: digitos(item.codigo).slice(0, 10),
      tipo: TIPOS.indexOf(item.tipo) >= 0 ? item.tipo : "Outro",
      titular: texto(item.titular, 150),
      documento: mascararDoc(item.documento),
      ac: texto(item.ac, 100),
      emitido_em: dataIso(item.emitido_em),
      vence_em: dataIso(item.vence_em),
      responsavel: texto(item.responsavel, 60),
      whatsapp: whats,
      email: email,
      acompanhamento: ACOMP.indexOf(item.acompanhamento) >= 0 ? item.acompanhamento : "",
      avisado_em: dataIso(item.avisado_em),
      obs: texto(item.obs, 400),
      excluido: false
    };
    if (!out.cliente) throw new Error("informe o cliente");
    if (!out.vence_em && out.acompanhamento !== "sem_certificado") throw new Error("informe a data de vencimento (ou marque 'Sem certificado – precisa emitir')");
    return out;
  }
  function paraPainel(r) {
    var c = {};
    Object.keys(r).forEach(function (k) { c[k] = r[k] === null ? "" : r[k]; });
    return c;
  }
  function hoje() {
    var d = new Date();
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  function dataHora(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return "";
    return ("0" + d.getDate()).slice(-2) + "/" + ("0" + (d.getMonth() + 1)).slice(-2) + " às " + ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
  }
  // ---------- envio do .pfx + senha CIFRADO no navegador (só o computador do escritório abre)
  function b64ParaBytes(b64) {
    var bin = atob(b64), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function bytesParaB64(buf) {
    var u = new Uint8Array(buf), s = "";
    for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
    return btoa(s);
  }
  function cifrarParaComputador(chavePub, obj) {
    var conteudo = new TextEncoder().encode(JSON.stringify(obj));
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return Promise.all([
      crypto.subtle.importKey("spki", b64ParaBytes(chavePub), { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]),
      crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"])
    ]).then(function (k) {
      return Promise.all([
        crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, k[1], conteudo),
        crypto.subtle.exportKey("raw", k[1]).then(function (bruta) { return crypto.subtle.encrypt({ name: "RSA-OAEP" }, k[0], bruta); })
      ]);
    }).then(function (r) {
      conteudo = null;
      return { v: 1, iv: bytesParaB64(iv), c: bytesParaB64(r[0]), k: bytesParaB64(r[1]) };
    });
  }

  function soComputador() { return Promise.reject(new Error("isso só funciona no computador do escritório (onde ficam os certificados)")); }
  function pedir(tipo, dados) { return rest("POST", "robo_pedidos", { tipo: tipo, dados: dados || {} }, "return=minimal"); }

  // ------------------------------------------------------------ /api/... → banco
  function geral() {
    return rest("GET", "robo_geral?id=eq.1&select=dados,atualizado_em").then(function (l) {
      var g = l && l[0];
      return { dados: (g && g.dados) || {}, em: g && g.atualizado_em };
    });
  }

  function dadosRobo() {
    return Promise.all([
      geral(),
      rest("GET", "robo_situacao?select=dados"),
      rest("GET", "robo_pedidos?status=eq.pendente&select=tipo,dados&order=id")
    ]).then(function (r) {
      var g = r[0], obj = {};
      Object.keys(g.dados).forEach(function (k) { if (k !== "clientes") obj[k] = g.dados[k]; });
      obj.empresas = (r[1] || []).map(function (x) { return x.dados; }).filter(function (e) { return e && e.cnpj && e.config; });
      if (!obj.agenda) obj.agenda = {};
      var porCnpj = {};
      obj.empresas.forEach(function (e) { porCnpj[e.cnpj] = e; });
      (r[2] || []).forEach(function (p) {
        var d = p.dados || {};
        if (p.tipo === "salvar" && porCnpj[d.cnpj]) {
          var e = porCnpj[d.cnpj];
          e.config = Object.assign({}, e.config, { ativo: !!d.ativo, codigo: d.codigo || "", cliente: d.cliente || e.config.cliente, nfse_acesso: d.nfse_acesso || e.config.nfse_acesso });
          e.pendente = true;
        } else if (p.tipo === "ligar_todas") {
          obj.empresas.forEach(function (e) {
            if (!e.sem_certificado && e.vence_em && e.vence_em >= hoje() && !e.config.ativo) { e.config = Object.assign({}, e.config, { ativo: true }); e.pendente = true; }
          });
        } else if (p.tipo === "escritorio") obj.cnpj_escritorio = d.cnpj || "";
        else if (p.tipo === "agenda") obj.agenda = { ligada: !!d.ligar, proxima: "", pendente: true };
        else if (p.tipo === "rodar") obj.pedido_rodar = true;
        else if (p.tipo === "competencia") obj.pedido_competencia = true;
      });
      // conexão do computador do escritório
      var avisos = [];
      if (!g.em) avisos.push("O computador do escritório ainda não se conectou. Os dados do robô aparecem depois da primeira sincronização.");
      else {
        var min = (Date.now() - Date.parse(g.em)) / 60000;
        if (min > 30) avisos.push("O computador do escritório não se conecta desde " + dataHora(g.em) + ". Confira se ele está ligado e com internet: enquanto isso, os pedidos feitos aqui ficam na fila.");
      }
      if (obj.pedido_rodar) avisos.push("Captura pedida: o computador do escritório começa em alguns minutos.");
      if (obj.agenda.pendente) avisos.push("Mudança na captura semanal enviada: o computador aplica em alguns minutos.");
      obj.avisos_online = avisos;
      obj.sincronizado_em = g.em || "";
      ULTIMO_ROBO = obj;
      return obj;
    });
  }

  var ROTAS = {
    "/api/dados": function () {
      return Promise.all([
        rest("GET", "certificados?excluido=eq.false&select=*&order=cliente"),
        geral(),
        rest("GET", "certificados_envio?select=rotulo,status,resposta,enviado_em,enviado_por&order=id.desc&limit=20").catch(function () { return []; }),
        rest("GET", "empresas?select=codigo,cnpj,nome,fiscal,contabil,pessoal,legal,ativo&order=codigo").catch(function () { return []; })
      ]).then(function (r) {
        return { certificados: (r[0] || []).map(paraPainel), clientes: r[1].dados.clientes || [], hoje: hoje(), envios: r[2] || [],
          empresas: r[3] || [] };
      });
    },
    "/api/salvar": function (b) {
      var item;
      try { item = sanear(b && b.item); } catch (e) { return Promise.reject(e); }
      return rest("POST", "certificados?on_conflict=id", item, "resolution=merge-duplicates,return=representation")
        .then(function (l) { return { ok: true, item: paraPainel((l && l[0]) || item) }; });
    },
    "/api/excluir": function (b) {
      var id = String((b && b.id) || "");
      if (!/^[a-f0-9]{16}$/.test(id)) return Promise.reject(new Error("certificado não encontrado"));
      return rest("PATCH", "certificados?id=eq." + id, { excluido: true }, "return=representation").then(function (l) {
        if (!l || !l.length) throw new Error("certificado não encontrado");
        return { ok: true };
      });
    },
    "/api/enviar-pfx": function (b) {
      b = b || {};
      var item = {};
      ["id", "cliente", "codigo", "responsavel", "whatsapp", "email", "acompanhamento", "avisado_em", "obs"].forEach(function (k) {
        if (b.item && b.item[k]) item[k] = texto(b.item[k], 400);
      });
      if (!b.arquivo || !b.senha) return Promise.reject(new Error("escolha o arquivo e digite a senha"));
      if (!window.crypto || !crypto.subtle) return Promise.reject(new Error("este navegador não consegue cifrar o envio; use o Chrome ou o Edge atualizados"));
      return geral().then(function (g) {
        if (!g.dados.chave_envio) throw new Error("o computador do escritório ainda não preparou o envio seguro; tente de novo em 5 minutos");
        return cifrarParaComputador(g.dados.chave_envio, { pfx: b.arquivo, senha: b.senha, item: item });
      }).then(function (env) {
        return rest("POST", "certificados_envio", { rotulo: texto(item.cliente || "certificado sem nome", 150), dados: env }, "return=minimal");
      }).then(function () { return { ok: true, instalado: false }; });
    },
    "/api/empresa/salvar": function (b) {
      var e = (b && b.empresa) || {};
      var item = {
        codigo: digitos(e.codigo).slice(0, 10), cnpj: digitos(e.cnpj).slice(0, 14), nome: texto(e.nome, 150),
        fiscal: texto(e.fiscal, 60), contabil: texto(e.contabil, 60), pessoal: texto(e.pessoal, 60), legal: texto(e.legal, 60), ativo: true
      };
      if (!item.codigo || !item.nome) return Promise.reject(new Error("informe o código e o nome"));
      if (item.cnpj && item.cnpj.length !== 11 && item.cnpj.length !== 14) return Promise.reject(new Error("CNPJ deve ter 14 números (ou CPF, 11)"));
      return rest("POST", "empresas?on_conflict=codigo", item, "resolution=merge-duplicates,return=minimal").then(function () { return { ok: true }; });
    },
    "/api/ler-pfx": soComputador,
    "/api/importar-windows": soComputador,
    "/api/robo": dadosRobo,
    "/api/robo/salvar": function (b) {
      var cnpj = digitos(b && b.cnpj);
      if (cnpj.length !== 14) return Promise.reject(new Error("CNPJ inválido"));
      return pedir("salvar", { cnpj: cnpj, ativo: !!b.ativo, codigo: digitos(b.codigo).slice(0, 10), cliente: texto(b.cliente, 150),
        nfse_acesso: b.nfse_acesso === "certificado" ? "certificado" : "procuracao" })
        .then(function () { return { ok: true }; });
    },
    "/api/robo/ligar-todas": function (b) {
      var n = ((ULTIMO_ROBO && ULTIMO_ROBO.empresas) || []).filter(function (e) {
        return !e.config.ativo && !e.sem_certificado && e.vence_em && e.vence_em >= hoje();
      }).length;
      return pedir("ligar_todas", { ligar: !!(b && b.ligar) }).then(function () { return { ok: true, mudadas: n }; });
    },
    "/api/robo/escritorio": function (b) {
      var cnpj = digitos(b && b.cnpj);
      if (cnpj && cnpj.length !== 14) return Promise.reject(new Error("CNPJ do escritório inválido"));
      return pedir("escritorio", { cnpj: cnpj }).then(function () { return { ok: true }; });
    },
    "/api/robo/agenda": function (b) {
      var ligar = !!(b && b.ligar);
      return pedir("agenda", { ligar: ligar }).then(function () { return { ok: true, agenda: { ligada: ligar, proxima: "", pendente: true } }; });
    },
    "/api/robo/competencia": function (b) {
      var m = String((b && b.competencia) || "");
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) return Promise.reject(new Error("competência inválida"));
      return pedir("competencia", { competencia: m }).then(function () { return { ok: true }; });
    },
    "/api/robo/rodar": function () {
      return pedir("rodar", {}).then(function () { return { ok: true }; });
    }
  };

  window.PAINEL_API = function (caminho, corpo) {
    return PRONTO.then(function () {
      var f = ROTAS[caminho];
      if (!f) throw new Error("função não disponível na versão online");
      return f(corpo);
    });
  };

  // ------------------------------------------------------------ aba Equipe (só admin)
  var PAPEIS = { admin: "Administrador", editor: "Pode editar", leitor: "Só ver", robo: "Computador do escritório" };
  function el(tag, attrs, filhos) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "texto") e.textContent = attrs[k];
      else if (k === "classe") e.className = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (filhos || []).forEach(function (f) { if (f) e.appendChild(typeof f === "string" ? document.createTextNode(f) : f); });
    return e;
  }
  function erroEquipe(t) { msg("equipe-msg", t); }

  function carregarEquipe() {
    if (PAPEL !== "admin") return;
    rest("GET", "equipe?select=email,nome,papel,ativo&order=papel,email").then(function (lista) {
      var tb = $("equipe-linhas");
      tb.textContent = "";
      (lista || []).forEach(function (p) {
        var eu = SESSAO && p.email === SESSAO.email, robo = p.papel === "robo";
        var sel = el("select", { "data-email": p.email, "data-campo": "papel", "aria-label": "Permissão de " + p.email });
        ["admin", "editor", "leitor"].forEach(function (k) {
          var o = el("option", { value: k, texto: PAPEIS[k] });
          if (p.papel === k) o.selected = true;
          sel.appendChild(o);
        });
        if (eu || robo) sel.disabled = true;
        var acoes = [];
        if (!eu && !robo) {
          acoes.push(el("button", { type: "button", classe: "btn btn-acao", "data-email": p.email, "data-acao": p.ativo ? "inativar" : "reativar", texto: p.ativo ? "Inativar" : "Reativar" }));
          acoes.push(el("button", { type: "button", classe: "btn btn-acao", "data-email": p.email, "data-acao": "excluir", texto: "Remover" }));
        }
        tb.appendChild(el("tr", null, [
          el("td", { "data-rotulo": "Pessoa" }, [el("span", { classe: "cli-nome", texto: p.nome || (robo ? PAPEIS.robo : "—") }), el("span", { classe: "mini", texto: p.email + (eu ? " (você)" : "") })]),
          el("td", { "data-rotulo": "Permissão" }, [robo ? el("span", { classe: "mini", texto: PAPEIS.robo }) : sel]),
          el("td", { "data-rotulo": "Situação" }, [el("span", { classe: "selo " + (p.ativo ? "ok" : "nao_renova"), texto: p.ativo ? "Ativo" : "Inativo" })]),
          el("td", { "data-rotulo": "Ações" }, acoes)
        ]));
      });
      erroEquipe("");
    }).catch(function (e) { erroEquipe("Erro: " + e.message); });
  }

  document.addEventListener("painel:aba", function (ev) { if (ev.detail === "equipe") carregarEquipe(); });

  $("form-equipe").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var f = this, email = $("eq-email").value.trim().toLowerCase();
    var nome = texto($("eq-nome").value, 80), papel = $("eq-papel").value;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { erroEquipe("Digite um e-mail válido."); return; }
    ocupado(f, true);
    rest("POST", "equipe", { email: email, nome: nome, papel: papel, ativo: true }, "return=minimal").then(function () {
      f.reset();
      window.PAINEL.toast(email + " liberado. Agora a pessoa entra nesta página e clica em \"Primeiro acesso\".");
      carregarEquipe();
    }).catch(function (e) {
      erroEquipe(/duplicate|23505|conflict/i.test(e.message) || e.status === 409 ? "Este e-mail já está na lista." : "Erro: " + e.message);
    }).then(function () { ocupado(f, false); });
  });

  $("equipe-linhas").addEventListener("change", function (ev) {
    var t = ev.target;
    if (t.getAttribute("data-campo") !== "papel") return;
    rest("PATCH", "equipe?email=eq." + encodeURIComponent(t.getAttribute("data-email")), { papel: t.value }, "return=minimal")
      .then(function () { window.PAINEL.toast("Permissão alterada."); })
      .catch(function (e) { erroEquipe("Erro: " + e.message); carregarEquipe(); });
  });

  $("equipe-linhas").addEventListener("click", function (ev) {
    var b = ev.target.closest("button[data-acao]");
    if (!b) return;
    var email = b.getAttribute("data-email"), acao = b.getAttribute("data-acao");
    var filtro = "equipe?email=eq." + encodeURIComponent(email), p;
    if (acao === "excluir") {
      if (!confirm("Remover " + email + " da equipe? A pessoa perde o acesso na hora.")) return;
      p = rest("DELETE", filtro, undefined, "return=minimal");
    } else {
      p = rest("PATCH", filtro, { ativo: acao === "reativar" }, "return=minimal");
    }
    p.then(function () {
      window.PAINEL.toast(acao === "excluir" ? "Removido." : acao === "inativar" ? "Acesso inativado." : "Acesso reativado.");
      carregarEquipe();
    }).catch(function (e) { erroEquipe("Erro: " + e.message); });
  });

  // ------------------------------------------------------------ início
  function iniciar() {
    if (!URL_BASE || !CHAVE || URL_BASE.indexOf("__") >= 0) {
      mostrarTela("login");
      erroLogin("A área da equipe ainda não foi configurada (falta o endereço do banco).");
      return;
    }
    // volta do link do e-mail (confirmação de cadastro ou senha nova)
    var h = new URLSearchParams(location.hash.slice(1));
    if (h.get("error_description")) {
      history.replaceState(null, "", enderecoVolta());
      mostrarTela("login");
      erroLogin(erroTraduzido(h.get("error_description").replace(/\+/g, " ")));
      return;
    }
    if (h.get("access_token")) {
      var tipo = h.get("type");
      guardarSessao(sessaoDe({ access_token: h.get("access_token"), refresh_token: h.get("refresh_token"), expires_at: Number(h.get("expires_at")) || 0, expires_in: h.get("expires_in") }));
      history.replaceState(null, "", enderecoVolta());
      chamar("/auth/v1/user", { token: SESSAO.access_token }).then(function (u) {
        SESSAO.email = (u && u.email) || "";
        guardarSessao(SESSAO);
        if (tipo === "recovery") mostrarTela("nova-senha");
        else entrarNoPainel();
      }).catch(function () { guardarSessao(null); mostrarTela("login"); erroLogin("O link expirou. Entre com a sua senha ou peça outro."); });
      return;
    }
    try { SESSAO = JSON.parse(localStorage.getItem(CHAVE_SESSAO) || "null"); } catch (e) { SESSAO = null; }
    if (SESSAO && SESSAO.access_token) entrarNoPainel();
    else mostrarTela("login");
  }
  iniciar();
})();
