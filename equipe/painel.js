(function () {
  "use strict";

  // Na versão online (site/equipe) o online.js define window.PAINEL_API (Supabase);
  // aqui no computador o painel fala com o servidor.py pelo token.
  var META_TOKEN = document.querySelector('meta[name="painel-token"]');
  var TOKEN = META_TOKEN ? META_TOKEN.content : "";
  var DADOS = { certificados: [], clientes: [], hoje: "" };
  var EDITANDO = null;      // certificado em edição (ou null = novo)
  var AVISANDO = null;      // certificado do diálogo de aviso
  var $ = function (id) { return document.getElementById(id); };

  // ------------------------------------------------------------ utilidades
  function api(caminho, corpo) {
    if (window.PAINEL_API) return window.PAINEL_API(caminho, corpo);
    var op ={ headers: { "X-Painel-Token": TOKEN } };
    if (corpo) {
      op.method = "POST";
      op.headers["Content-Type"] = "application/json";
      op.body = JSON.stringify(corpo);
    }
    return fetch(caminho, op).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.erro || "não foi possível falar com o painel");
        return j;
      });
    }, function () {
      throw new Error("o painel foi fechado. Abra de novo pelo atalho ABRIR-PAINEL-CERTIFICADOS");
    });
  }

  function el(tag, attrs, filhos) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "texto") e.textContent = attrs[k];
      else if (k === "classe") e.className = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (filhos || []).forEach(function (f) { if (f) e.appendChild(typeof f === "string" ? document.createTextNode(f) : f); });
    return e;
  }

  function semAcento(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  function dataBr(iso) {
    if (!iso) return "";
    var p = iso.split("-");
    return p[2] + "/" + p[1] + "/" + p[0];
  }

  function diasAte(iso) {
    var a = Date.parse(DADOS.hoje + "T00:00:00Z");
    var b = Date.parse(iso + "T00:00:00Z");
    return Math.round((b - a) / 86400000);
  }

  function situacao(c) {
    if (c.nao_cad) return "nao_cad";
    if (c.acompanhamento === "nao_renova") return "nao_renova";
    if (c.acompanhamento === "sem_certificado") return "sem_cert";
    var d = diasAte(c.vence_em);
    if (d < 0) return "vencido";
    if (d <= 7) return "urgente";
    if (d <= 30) return "atencao";
    return "ok";
  }

  function textoSituacao(c) {
    var d = diasAte(c.vence_em);
    if (c.nao_cad) return "Não cadastrado";
    if (c.acompanhamento === "nao_renova") return "Não vai renovar";
    if (c.acompanhamento === "sem_certificado") return "Sem certificado · emitir";
    if (d < 0) return d === -1 ? "Venceu ontem" : "Venceu há " + (-d) + " dias";
    if (d === 0) return "Vence hoje";
    if (d === 1) return "Vence amanhã";
    return "Faltam " + d + " dias";
  }

  var toastTimer;
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 3500);
  }

  function erroGeral(msg) {
    var e = $("erro-geral");
    e.textContent = msg || "";
    e.hidden = !msg;
  }

  // ------------------------------------------------------------ carregar
  function carregar() {
    return api("/api/dados").then(function (j) {
      DADOS = j;
      erroGeral("");
      preencherListas();
      render();
    }).catch(function (e) { erroGeral("Erro: " + e.message + "."); });
  }

  function preencherListas() {
    var dl = $("lista-clientes");
    dl.textContent = "";
    DADOS.clientes.forEach(function (c) {
      dl.appendChild(el("option", { value: c.nome, label: c.codigo ? "código " + c.codigo : "sem código" }));
    });
    var resp = {};
    ["Arquimedes", "Bárbara", "Carol", "Cris", "Hugo", "Ítalo", "Yuana"].forEach(function (n) { resp[n] = 1; });
    DADOS.certificados.forEach(function (c) { if (c.responsavel) resp[c.responsavel] = 1; });
    var dr = $("lista-resp");
    dr.textContent = "";
    Object.keys(resp).sort().forEach(function (n) { dr.appendChild(el("option", { value: n })); });
  }

  // ------------------------------------------------------------ lista
  // Empresas do escritório (lista do Drive 1CLIENTES) que ainda não têm certificado na lista
  function naoCadastrados() {
    var codigos = {}, nomes = {};
    DADOS.certificados.forEach(function (c) {
      if (c.codigo) codigos[c.codigo] = 1;
      nomes[semAcento(c.cliente).trim()] = 1;
      if (c.titular) nomes[semAcento(c.titular).trim()] = 1;
    });
    var vistos = {};
    return (DADOS.clientes || []).filter(function (e) {
      var n = semAcento(e.nome).trim();
      if (!n || vistos[n] || (e.codigo && codigos[e.codigo]) || nomes[n]) return false;
      vistos[n] = 1;
      return true;
    }).map(function (e) {
      return { id: "", nao_cad: true, cliente: e.nome, codigo: e.codigo || "", tipo: "", vence_em: "", avisado_em: "", acompanhamento: "" };
    });
  }
  function todas() { return DADOS.certificados.concat(naoCadastrados()); }

  function filtrados() {
    var busca = semAcento($("busca").value).trim();
    var buscaDig = busca.replace(/\D/g, "");
    var sit = $("f-sit").value, tipo = $("f-tipo").value, aviso = $("f-aviso").value;
    return todas().filter(function (c) {
      if (sit && situacao(c) !== sit) return false;
      if (tipo && c.tipo !== tipo) return false;
      if (aviso === "sim" && !c.avisado_em) return false;
      if (aviso === "nao" && c.avisado_em) return false;
      if (busca) {
        var alvo = semAcento([c.cliente, c.titular, c.codigo, c.ac, c.responsavel].join(" "));
        var ok = alvo.indexOf(busca) >= 0;
        if (!ok && buscaDig.length >= 3) ok = (c.documento || "").replace(/\D/g, "").indexOf(buscaDig) >= 0 || c.codigo === buscaDig;
        if (!ok) return false;
      }
      return true;
    }).sort(function (a, b) {
      var ordem = { vencido: 0, urgente: 1, sem_cert: 2, atencao: 3, ok: 4, nao_renova: 5, nao_cad: 6 };
      var oa = ordem[situacao(a)], ob = ordem[situacao(b)];
      if (oa !== ob) return oa - ob;
      if (oa === 6) return a.cliente.localeCompare(b.cliente, "pt-BR");
      return a.vence_em < b.vence_em ? -1 : a.vence_em > b.vence_em ? 1 : a.cliente.localeCompare(b.cliente, "pt-BR");
    });
  }

  var enviosTimer = null;
  function renderEnvios() {
    var av = $("avisos-venc"), pendente = false;
    av.textContent = "";
    (DADOS.envios || []).forEach(function (e) {
      var dias = (Date.now() - Date.parse(e.enviado_em)) / 86400000;
      if (e.status === "pendente") {
        pendente = true;
        av.appendChild(el("p", { classe: "aviso-amarelo", texto: "Certificado de " + e.rotulo + " enviado: o computador do escritório instala em alguns minutos." }));
      } else if (e.status === "erro" && dias < 7) {
        av.appendChild(el("p", { classe: "aviso-erro", texto: "Não deu para instalar o certificado de " + e.rotulo + ": " + e.resposta + ". Confira o arquivo e a senha e envie de novo." }));
      }
    });
    clearTimeout(enviosTimer);
    if (pendente) enviosTimer = setTimeout(carregar, 60000);
  }

  function render() {
    renderEnvios();
    var cont = { vencido: 0, urgente: 0, atencao: 0, ok: 0, sem_cert: 0, nao_cad: 0 };
    var tudo = todas();
    tudo.forEach(function (c) { var s = situacao(c); if (s in cont) cont[s]++; });
    Object.keys(cont).forEach(function (k) { $("n-" + k).textContent = cont[k]; });

    var sit = $("f-sit").value;
    document.querySelectorAll("[data-filtro-sit]").forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-filtro-sit") === sit ? "true" : "false");
    });
    var temFiltro = !!($("busca").value || sit || $("f-tipo").value || $("f-aviso").value);
    $("limpar").hidden = !temFiltro;

    var lista = filtrados();
    var tb = $("linhas");
    tb.textContent = "";
    lista.forEach(function (c) { tb.appendChild(linha(c)); });

    var total = tudo.length;
    $("tabela").hidden = lista.length === 0;
    $("vazio").hidden = lista.length !== 0;
    $("vazio-txt").textContent = total ? "Nenhuma empresa com esses filtros." : "Nenhum certificado cadastrado ainda.";
    $("btn-novo-2").hidden = total > 0;
    $("contagem").textContent = total
      ? (temFiltro ? "Mostrando " + lista.length + " de " + total + " empresas" : total + " empresas · " + DADOS.certificados.length + " com certificado") + " · ordenadas pelo vencimento"
      : "";
  }

  function linha(c) {
    var s = situacao(c);
    if (s === "nao_cad") {
      var bCad = el("button", { type: "button", classe: "btn btn-acao principal", "data-acao": "cadastrar", "data-nome": c.cliente, "data-codigo": c.codigo, texto: "Cadastrar" });
      bCad.setAttribute("aria-label", "Cadastrar o certificado de " + c.cliente);
      return el("tr", null, [
        el("td", { "data-rotulo": "Situação" }, [el("span", { classe: "selo nao_cad", texto: "Não cadastrado" })]),
        el("td", { "data-rotulo": "Cliente" }, [
          el("span", { classe: "cli-nome", texto: c.cliente }),
          el("span", { classe: "mini", texto: c.codigo ? "Código " + c.codigo : "Sem código" })
        ]),
        el("td", { "data-rotulo": "Certificado" }, [el("span", { classe: "mini", texto: "—" })]),
        el("td", { "data-rotulo": "Vence em", classe: "data", texto: "" }),
        el("td", { "data-rotulo": "Aviso ao cliente" }, [el("span", { classe: "aviso-status mini", texto: "—" })]),
        el("td", null, [el("div", { classe: "acoes" }, [bCad])])
      ]);
    }
    var precisaAviso = (s === "vencido" || s === "urgente" || s === "atencao" || s === "sem_cert") && !c.avisado_em;

    var avisoTxt;
    if (c.avisado_em) {
      avisoTxt = el("span", { classe: "aviso-status" }, [
        "Avisado em " + dataBr(c.avisado_em),
        c.acompanhamento === "renovando" ? el("span", { classe: "mini", texto: "Renovação em andamento" }) : null
      ]);
    } else if (c.acompanhamento === "renovando") {
      avisoTxt = el("span", { classe: "aviso-status", texto: "Renovação em andamento" });
    } else if (precisaAviso) {
      avisoTxt = el("span", { classe: "aviso-status pendente", texto: "Falta avisar" });
    } else {
      avisoTxt = el("span", { classe: "aviso-status mini", texto: "—" });
    }

    var cert = [c.tipo];
    var det = [c.titular, c.documento].filter(Boolean).join(" · ");

    var bAvisar = el("button", { type: "button", classe: "btn btn-acao" + (precisaAviso ? " principal" : ""), "data-acao": "avisar", "data-id": c.id, texto: "Avisar" });
    var bEditar = el("button", { type: "button", classe: "btn btn-acao", "data-acao": "editar", "data-id": c.id, texto: "Editar" });
    var bExcluir = el("button", { type: "button", classe: "btn btn-acao", "data-acao": "excluir", "data-id": c.id, texto: "Excluir" });
    bAvisar.setAttribute("aria-label", "Avisar " + c.cliente);
    bEditar.setAttribute("aria-label", "Editar " + c.cliente);
    bExcluir.setAttribute("aria-label", "Excluir " + c.cliente);

    return el("tr", null, [
      el("td", { "data-rotulo": "Situação" }, [el("span", { classe: "selo " + s, texto: textoSituacao(c) })]),
      el("td", { "data-rotulo": "Cliente" }, [
        el("span", { classe: "cli-nome", texto: c.cliente }),
        el("span", { classe: "mini", texto: (c.codigo ? "Código " + c.codigo : "Sem código") + (c.responsavel ? " · " + c.responsavel : "") })
      ]),
      el("td", { "data-rotulo": "Certificado" }, [
        cert.join(""),
        det ? el("span", { classe: "mini", texto: det }) : null,
        c.ac ? el("span", { classe: "mini", texto: c.ac }) : null
      ]),
      el("td", { "data-rotulo": "Vence em", classe: "data", texto: dataBr(c.vence_em) }),
      el("td", { "data-rotulo": "Aviso ao cliente" }, [avisoTxt]),
      el("td", null, [el("div", { classe: "acoes" }, [bAvisar, bEditar, bExcluir])])
    ]);
  }

  // ------------------------------------------------------------ cadastro
  var CAMPOS = {
    cliente: "c-cliente", codigo: "c-codigo", tipo: "c-tipo", titular: "c-titular",
    documento: "c-documento", ac: "c-ac", emitido_em: "c-emitido", vence_em: "c-vence",
    responsavel: "c-resp", whatsapp: "c-whats", email: "c-email",
    acompanhamento: "c-acomp", avisado_em: "c-avisado", obs: "c-obs"
  };

  function abrirCadastro(c) {
    EDITANDO = c && c.id ? c : null;      // sem id = empresa da lista ainda sem certificado (só preenche)
    $("dlg-cert-tit").textContent = EDITANDO ? "Editar certificado" : "Cadastrar certificado";
    $("pfx-instalar").checked = true;
    Object.keys(CAMPOS).forEach(function (k) {
      var v = c ? (c[k] || "") : "";
      if (k === "tipo" && !v) v = "e-CNPJ A1";
      if (k === "whatsapp" && v) v = formatarFone(v);
      $(CAMPOS[k]).value = v;
    });
    $("pfx-arquivo").value = "";
    $("pfx-senha").value = "";
    msgPfx("", "");
    erroForm("");
    $("dlg-cert").showModal();
    $(EDITANDO ? "c-cliente" : "pfx-arquivo").focus();
  }

  function formatarFone(d) {
    d = String(d).replace(/\D/g, "");
    if (d.indexOf("55") === 0 && d.length >= 12) d = d.slice(2);
    if (d.length === 11) return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
    if (d.length === 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
    return d;
  }

  function msgPfx(txt, tipo) {
    var m = $("pfx-msg");
    m.textContent = txt;
    m.className = "msg-pfx" + (tipo ? " " + tipo : "");
  }

  function erroForm(txt) {
    $("erro-form").textContent = txt;
    $("erro-form").hidden = !txt;
  }

  // Preenche código e nome quando o cliente vem da lista do Drive
  $("c-cliente").addEventListener("change", function () {
    var v = semAcento(this.value).trim();
    var achou = DADOS.clientes.filter(function (c) { return semAcento(c.nome) === v; })[0];
    if (achou && achou.codigo && !$("c-codigo").value) $("c-codigo").value = achou.codigo;
  });

  function lerArquivo(arq) {
    return new Promise(function (ok, falha) {
      if (arq.size > 100000) { falha(new Error("esse arquivo é grande demais para ser um certificado")); return; }
      var leitor = new FileReader();
      leitor.onload = function () {
        var bytes = new Uint8Array(leitor.result), bin = "";
        for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        ok(btoa(bin));
      };
      leitor.onerror = function () { falha(new Error("não foi possível abrir o arquivo")); };
      leitor.readAsArrayBuffer(arq);
    });
  }

  $("pfx-ler").addEventListener("click", function () {
    var arq = $("pfx-arquivo").files[0];
    var senha = $("pfx-senha").value;
    if (!arq) { msgPfx("Escolha o arquivo .pfx ou .p12.", "erro"); $("pfx-arquivo").focus(); return; }
    var botao = this;
    botao.setAttribute("aria-disabled", "true");
    msgPfx("Lendo o certificado…", "");
    lerArquivo(arq).then(function (b64) {
      return api("/api/ler-pfx", { arquivo: b64, senha: senha }).then(function (r) {
        $("c-titular").value = r.titular || "";
        $("c-documento").value = r.documento || "";
        $("c-ac").value = r.ac || "";
        $("c-emitido").value = r.emitido_em || "";
        $("c-vence").value = r.vence_em || "";
        if (r.tipo && r.tipo !== "Outro") $("c-tipo").value = r.tipo;
        if (!$("c-cliente").value && r.titular) {
          var t = semAcento(r.titular);
          var achou = DADOS.clientes.filter(function (c) { return semAcento(c.nome) === t || t.indexOf(semAcento(c.nome)) === 0; })[0];
          $("c-cliente").value = achou ? achou.nome : r.titular;
          if (achou && achou.codigo) $("c-codigo").value = achou.codigo;
        }
        msgPfx("Pronto: vence em " + dataBr(r.vence_em) + ". Confira os campos e clique em Salvar" +
          ($("pfx-instalar").checked ? " (o certificado será instalado para o robô)." : "."), "ok");
      });
    }).catch(function (e) {
      msgPfx(e.message.charAt(0).toUpperCase() + e.message.slice(1) + ".", "erro");
    }).then(function () { botao.removeAttribute("aria-disabled"); });
  });

  // Salvar com arquivo + senha: o certificado vai para o computador do escritório
  // (instala no Windows e guarda cópia cifrada para o robô), como o cadastro da Domínio.
  function enviarPfx(item) {
    var arq = $("pfx-arquivo").files[0], senha = $("pfx-senha").value;
    if (!senha) { erroForm("Digite a senha do certificado."); $("pfx-senha").focus(); return; }
    $("btn-salvar").setAttribute("aria-disabled", "true");
    lerArquivo(arq).then(function (b64) {
      return api("/api/enviar-pfx", { arquivo: b64, senha: senha, item: item });
    }).then(function (r) {
      $("dlg-cert").close();
      toast(r.instalado
        ? "Certificado instalado para o robô" + (r.item && r.item.vence_em ? ": vence em " + dataBr(r.item.vence_em) : "") + "."
        : "Certificado enviado com segurança. Em até 5 minutos o computador do escritório instala e ele aparece na lista com a validade.");
      return carregar();
    }).catch(function (e) {
      erroForm(e.message.charAt(0).toUpperCase() + e.message.slice(1) + ".");
    }).then(function () { $("btn-salvar").removeAttribute("aria-disabled"); });
  }

  $("form-cert").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var item = {};
    Object.keys(CAMPOS).forEach(function (k) { item[k] = $(CAMPOS[k]).value.trim(); });
    if (EDITANDO) item.id = EDITANDO.id;
    if ($("pfx-arquivo").files[0] && $("pfx-instalar").checked) { enviarPfx(item); return; }
    if (!item.cliente) { erroForm("Informe o cliente."); $("c-cliente").focus(); return; }
    if (!item.vence_em && item.acompanhamento !== "sem_certificado") { erroForm("Informe a data de vencimento (ou leia o arquivo .pfx)."); $("c-vence").focus(); return; }
    var zerou = false;
    if (EDITANDO) {
      item.id = EDITANDO.id;
      // certificado renovado: data nova e longe → começa um novo ciclo de aviso
      if (item.vence_em !== EDITANDO.vence_em && diasAte(item.vence_em) > 30 &&
          item.avisado_em === (EDITANDO.avisado_em || "") && item.acompanhamento === (EDITANDO.acompanhamento || "") &&
          (item.avisado_em || item.acompanhamento)) {
        item.avisado_em = ""; item.acompanhamento = ""; zerou = true;
      }
    }
    if (item.avisado_em && !item.acompanhamento) item.acompanhamento = "avisado";
    // certificado emitido: tinha "sem certificado" e agora tem data → sai da pendência
    if (item.acompanhamento === "sem_certificado" && item.vence_em && diasAte(item.vence_em) >= 0 && EDITANDO && !EDITANDO.vence_em) {
      item.acompanhamento = ""; item.avisado_em = "";
    }
    $("btn-salvar").setAttribute("aria-disabled", "true");
    api("/api/salvar", { item: item }).then(function () {
      $("dlg-cert").close();
      toast(zerou ? "Salvo. Como o certificado foi renovado, o aviso voltou a zero." : "Certificado salvo.");
      return carregar();
    }).catch(function (e) {
      erroForm(e.message.charAt(0).toUpperCase() + e.message.slice(1) + ".");
    }).then(function () { $("btn-salvar").removeAttribute("aria-disabled"); });
  });

  // ------------------------------------------------------------ aviso
  function mensagem(c) {
    if (c.acompanhamento === "sem_certificado") {
      return "Olá! Aqui é da Staff Contabilidade.\n\n" +
        "A " + c.cliente + " ainda não tem certificado digital (e-CNPJ) cadastrado com a gente.\n\n" +
        "Com o certificado, conseguimos baixar automaticamente as notas fiscais de compra e venda da empresa direto da SEFAZ, além de acessar o e-CAC e enviar as obrigações sem depender de procuração.\n\n" +
        "Podemos ajudar com a emissão? É só responder esta mensagem que combinamos os próximos passos.\n\n" +
        "Staff Contabilidade";
    }
    var d = diasAte(c.vence_em);
    var quem = c.cliente;
    var oque = "o certificado digital " + c.tipo.replace(/ A[13]$/, "") + (c.tipo.indexOf("CPF") >= 0 && c.titular ? " de " + c.titular : "");
    var quando;
    if (d < 0) quando = "venceu em " + dataBr(c.vence_em);
    else if (d === 0) quando = "vence hoje (" + dataBr(c.vence_em) + ")";
    else quando = "vence em " + dataBr(c.vence_em) + " (faltam " + d + (d === 1 ? " dia" : " dias") + ")";
    return "Olá! Aqui é da Staff Contabilidade.\n\n" +
      "Passando para avisar que " + oque + " da " + quem + " " + quando + ".\n\n" +
      "Sem o certificado válido ficam parados a emissão de notas fiscais, o acesso ao e-CAC e o envio de obrigações da empresa." +
      (d < 0 ? " É importante renovar o quanto antes." : "") + "\n\n" +
      "Podemos ajudar com a renovação? É só responder esta mensagem que combinamos os próximos passos.\n\n" +
      "Staff Contabilidade";
  }

  function abrirAviso(c) {
    AVISANDO = c;
    $("aviso-quem").textContent = c.cliente + " · " + c.tipo + " · " + textoSituacao(c).toLowerCase() +
      (c.avisado_em ? " · já avisado em " + dataBr(c.avisado_em) : "");
    $("aviso-texto").value = mensagem(c);
    $("aviso-msg").textContent = "";
    atualizarLinksAviso();
    $("dlg-aviso").showModal();
    $("aviso-texto").focus();
  }

  function atualizarLinksAviso() {
    var c = AVISANDO, txt = $("aviso-texto").value;
    var w = $("aviso-whats");
    var numero = String(c.whatsapp || "").replace(/\D/g, "").slice(0, 15);   // só dígitos: nada estranho entra no link
    w.href = "https://wa.me/" + numero + "?text=" + encodeURIComponent(txt);
    w.textContent = numero ? "Abrir no WhatsApp" : "WhatsApp (escolher contato)";
    var m = $("aviso-email");
    if (c.email) {
      m.href = "mailto:" + encodeURIComponent(c.email).replace(/%40/g, "@") +
        "?subject=" + encodeURIComponent("Certificado digital " + (c.acompanhamento === "sem_certificado" ? "para emitir" : diasAte(c.vence_em) < 0 ? "vencido" : "perto do vencimento") + " - " + c.cliente) +
        "&body=" + encodeURIComponent(txt);
      m.removeAttribute("aria-disabled");
      m.textContent = "Abrir e-mail";
    } else {
      m.removeAttribute("href");
      m.setAttribute("aria-disabled", "true");
      m.textContent = "Sem e-mail cadastrado";
    }
  }

  $("aviso-texto").addEventListener("input", atualizarLinksAviso);

  $("aviso-copiar").addEventListener("click", function () {
    var txt = $("aviso-texto").value;
    var fim = function () { $("aviso-msg").textContent = "Texto copiado. Cole no WhatsApp ou no e-mail do cliente."; $("aviso-msg").className = "msg-pfx ok"; };
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(fim, function () { $("aviso-texto").select(); document.execCommand("copy"); fim(); });
    else { $("aviso-texto").select(); document.execCommand("copy"); fim(); }
  });

  $("aviso-marcar").addEventListener("click", function () {
    var c = Object.assign({}, AVISANDO, { avisado_em: DADOS.hoje });
    if (!c.acompanhamento) c.acompanhamento = "avisado";
    api("/api/salvar", { item: c }).then(function () {
      $("dlg-aviso").close();
      toast("Marcado: " + c.cliente + " avisado hoje.");
      return carregar();
    }).catch(function (e) { $("aviso-msg").textContent = "Erro: " + e.message + "."; $("aviso-msg").className = "msg-pfx erro"; });
  });

  // ------------------------------------------------------------ eventos gerais
  function porId(id) { return DADOS.certificados.filter(function (c) { return c.id === id; })[0]; }

  $("linhas").addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-acao]");
    if (!b) return;
    if (b.getAttribute("data-acao") === "cadastrar") {
      abrirCadastro({ cliente: b.getAttribute("data-nome"), codigo: b.getAttribute("data-codigo") || "", tipo: "e-CNPJ A1" });
      return;
    }
    var c = porId(b.getAttribute("data-id"));
    if (!c) return;
    var acao = b.getAttribute("data-acao");
    if (acao === "editar") abrirCadastro(c);
    else if (acao === "avisar") abrirAviso(c);
    else if (acao === "excluir") {
      if (!confirm("Excluir o certificado de " + c.cliente + " (" + c.tipo + ", vence " + dataBr(c.vence_em) + ")?\n\nUma cópia da lista anterior fica em dados\\certificados.json.bak.")) return;
      api("/api/excluir", { id: c.id }).then(function () { toast("Certificado excluído."); return carregar(); })
        .catch(function (e) { erroGeral("Erro: " + e.message + "."); });
    }
  });

  document.querySelectorAll("[data-filtro-sit]").forEach(function (b) {
    b.addEventListener("click", function () {
      var v = b.getAttribute("data-filtro-sit");
      $("f-sit").value = $("f-sit").value === v ? "" : v;
      render();
    });
  });
  ["busca", "f-sit", "f-tipo", "f-aviso"].forEach(function (id) {
    $(id).addEventListener(id === "busca" ? "input" : "change", render);
  });
  $("limpar").addEventListener("click", function () {
    $("busca").value = ""; $("f-sit").value = ""; $("f-tipo").value = ""; $("f-aviso").value = "";
    render();
    $("busca").focus();
  });
  $("btn-novo").addEventListener("click", function () { abrirCadastro(null); });
  $("btn-novo-2").addEventListener("click", function () { abrirCadastro(null); });
  document.querySelectorAll("[data-fechar]").forEach(function (b) {
    b.addEventListener("click", function () { b.closest("dialog").close(); });
  });
  // fechar o diálogo de cadastro limpa a senha, por garantia
  $("dlg-cert").addEventListener("close", function () { $("pfx-senha").value = ""; $("pfx-arquivo").value = ""; });

  // ------------------------------------------------------------ abas
  var ABA = "venc";
  function abasVisiveis() {
    return Array.prototype.filter.call(document.querySelectorAll(".abas-in [role=tab]"), function (t) { return !t.hidden; })
      .map(function (t) { return t.id.slice(4); });
  }
  function mostrarAba(qual, foco) {
    ABA = qual;
    Array.prototype.forEach.call(document.querySelectorAll(".abas-in [role=tab]"), function (t) {
      var k = t.id.slice(4), sel = k === qual;
      t.setAttribute("aria-selected", sel ? "true" : "false");
      t.tabIndex = sel ? 0 : -1;
      $("aba-" + k).hidden = !sel;
    });
    $("btn-novo").hidden = qual !== "venc";
    if (foco) $("tab-" + qual).focus();
    if (qual === "robo") carregarRobo();
    document.dispatchEvent(new CustomEvent("painel:aba", { detail: qual }));
  }
  Array.prototype.forEach.call(document.querySelectorAll(".abas-in [role=tab]"), function (t) {
    t.addEventListener("click", function () { mostrarAba(t.id.slice(4)); });
  });
  document.querySelector(".abas-in").addEventListener("keydown", function (ev) {
    if (ev.key !== "ArrowRight" && ev.key !== "ArrowLeft") return;
    ev.preventDefault();
    var abas = abasVisiveis(), i = abas.indexOf(ABA);
    mostrarAba(abas[(i + (ev.key === "ArrowRight" ? 1 : abas.length - 1)) % abas.length], true);
  });

  $("btn-importar").addEventListener("click", function () {
    if (!confirm("Trazer para a lista os certificados e-CNPJ instalados neste Windows?\n\nSó entram os que ainda não estão na lista (mesmo CNPJ e mesma data de vencimento). Depois confira o nome e o código de cada um.")) return;
    api("/api/importar-windows", {}).then(function (r) {
      toast(r.novos ? r.novos + " certificado(s) trazido(s) do Windows." : "Nenhum certificado novo: todos já estavam na lista.");
      return carregar();
    }).catch(function (e) { erroGeral("Erro: " + e.message + "."); });
  });

  // ------------------------------------------------------------ robô de notas
  var ROBO = { empresas: [] }, roboTimer = null;

  function carregarRobo() {
    return api("/api/robo").then(function (j) {
      ROBO = j;
      erroGeral("");
      renderRobo();
      clearTimeout(roboTimer);
      if (j.rodando && ABA === "robo") roboTimer = setTimeout(carregarRobo, window.PAINEL_INTERVALO_ROBO || 4000);
    }).catch(function (e) { erroGeral("Erro: " + e.message + "."); });
  }

  function dataHoraBr(iso) {
    if (!iso) return "";
    return dataBr(iso.slice(0, 10)) + " " + iso.slice(11, 16);
  }
  function cnpjFmt(d) { return String(d || "").replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5"); }
  function temErro(est) {
    return ["nfe", "cte", "nfse"].some(function (k) { return est[k] && est[k].erro; }) || (est.drive && est.drive.erro);
  }

  function robosFiltrados() {
    var busca = semAcento($("robo-busca").value).trim(), dig = busca.replace(/\D/g, "");
    var f = $("robo-filtro").value;
    return ROBO.empresas.filter(function (e) {
      var cfg = e.config || {}, est = e.estado || {};
      if (f === "ativas" && !cfg.ativo) return false;
      if (f === "inativas" && cfg.ativo) return false;
      if (f === "erro" && !(cfg.ativo && temErro(est))) return false;
      if (f === "vencido" && !(e.sem_certificado || (e.vence_em && diasAte(e.vence_em) < 0))) return false;
      if (busca) {
        var ok = semAcento([cfg.cliente, e.titular, cfg.codigo].join(" ")).indexOf(busca) >= 0;
        if (!ok && dig.length >= 3) ok = e.cnpj.indexOf(dig) >= 0 || cfg.codigo === dig;
        if (!ok) return false;
      }
      return true;
    }).sort(function (a, b) {
      var aa = a.config.ativo ? 0 : 1, bb = b.config.ativo ? 0 : 1;
      if (aa !== bb) return aa - bb;
      return String(a.config.cliente).localeCompare(String(b.config.cliente), "pt-BR");
    });
  }

  function renderRobo() {
    // captura semanal (tarefa do Windows)
    var ag = ROBO.agenda || {};
    var selo = $("agenda-selo");
    selo.textContent = ag.ligada ? "Ligada" : "Desligada";
    selo.className = "selo " + (ag.ligada ? "ok" : "nao_renova");
    $("agenda-info").textContent = ag.ligada
      ? (ag.proxima ? "Próxima: " + dataHoraBr(ag.proxima) + (ag.ultima ? " · última: " + dataHoraBr(ag.ultima) : "") : "Toda segunda-feira e todo dia 1º, às 9h")
      : (ag.erro ? "Não consegui ler o agendamento do Windows." : "Nada roda sozinho enquanto estiver desligada.");
    $("agenda-botao").textContent = ag.ligada ? "Desligar captura semanal" : "Ligar captura semanal";
    $("agenda-botao").className = "btn " + (ag.ligada ? "btn-sec" : "btn-laranja");

    var st = $("robo-status"), r = ROBO.rodada || {};
    if (ROBO.rodando) {
      st.textContent = "Capturando agora… (começou " + dataHoraBr(r.inicio) + ")";
      st.className = "robo-status rodando";
    } else {
      st.textContent = r.fim ? "Última captura: " + dataHoraBr(r.fim) : "Ainda não houve captura.";
      st.className = "robo-status";
    }
    var ativas = ROBO.empresas.filter(function (e) { return e.config && e.config.ativo; }).length;
    var b = $("robo-rodar");
    b.textContent = ROBO.rodando ? "Capturando…" : "Capturar agora (" + ativas + (ativas === 1 ? " empresa)" : " empresas)");
    if (ROBO.rodando || !ativas) b.setAttribute("aria-disabled", "true"); else b.removeAttribute("aria-disabled");

    // avisos importantes
    var av = $("avisos-robo");
    av.textContent = "";
    if (ROBO.empresas.length && !ROBO.drive_ok) av.appendChild(el("p", { classe: "aviso-amarelo" }, [el("strong", { texto: "Google Drive fechado: " }), "não encontrei " + ROBO.drive + ". Abra o Google Drive para computador. Enquanto isso, os XML ficam em " + ROBO.pasta_xml + " e vão para o Drive na próxima captura."]));
    (ROBO.avisos_online || []).forEach(function (t) { av.appendChild(el("p", { classe: "aviso-amarelo", texto: t })); });
    var semPfx = ROBO.empresas.filter(function (e) { return e.config && e.config.ativo && !e.pfx && "pfx" in e; });
    if (semPfx.length) av.appendChild(el("p", { classe: "aviso-amarelo" }, [
      el("strong", { texto: "NFS-e: " }),
      "para buscar a NFS-e, cadastre o arquivo .pfx com a senha (aba Certificados > Editar ou Cadastrar) de " +
      (semPfx.length === 1 ? "1 empresa" : semPfx.length + " empresas") + " com a captura ligada: " +
      semPfx.map(function (e) { return e.config.cliente + (e.config.codigo ? " (" + e.config.codigo + ")" : ""); }).join(", ") + "."
    ]));

    // certificado do escritório
    var sel = $("robo-escritorio"), atual = ROBO.cnpj_escritorio || "";
    if (document.activeElement !== sel) {
      sel.textContent = "";
      sel.appendChild(el("option", { value: "", texto: "Não usar (sem notas de saída)" }));
      ROBO.empresas.filter(function (e) { return !e.sem_certificado; }).forEach(function (e) {
        var o = el("option", { value: e.cnpj, texto: (e.config.cliente || e.titular) + " · " + cnpjFmt(e.cnpj) });
        if (e.cnpj === atual) o.selected = true;
        sel.appendChild(o);
      });
    }
    var ee = ROBO.escritorio_estado || {}, nt = ee.nfe_terceiros || {};
    $("escritorio-status").textContent = atual
      ? (nt.mensagem ? "Última consulta do escritório: " + (nt.ultima ? dataHoraBr(nt.ultima) + " · " : "") + nt.mensagem + (nt.baixados_total ? " · " + nt.baixados_total + " notas recebidas no total" : "") : "Ainda não consultou.")
      : "";

    var lista = robosFiltrados(), tb = $("robo-linhas");
    tb.textContent = "";
    lista.forEach(function (e) { tb.appendChild(linhaRobo(e)); });
    $("robo-tabela").hidden = !lista.length;
    $("robo-vazio").hidden = !!lista.length || !!ROBO.empresas.length;
    $("robo-contagem").textContent = ROBO.empresas.length
      ? lista.length + " de " + ROBO.empresas.length + " empresas · " + ativas + " com a captura ligada"
      : "";
    renderRelatorio();
  }

  // ------------------------------------------------------------ relatório do mês
  var REL_COLS = [["saida", "NF-e emitidas"], ["entrada", "NF-e recebidas"], ["nfce", "NFC-e"], ["cte", "CT-e"],
    ["nfse_prestadas", "NFS-e prestadas"], ["nfse_tomadas", "NFS-e tomadas"]];
  function mesBr(m) { return m.slice(5, 7) + "/" + m.slice(0, 4); }
  function linhasRelatorio(mes) {
    return ROBO.empresas.filter(function (e) {
      var ms = (e.estado || {}).meses || {};
      return ms[mes] || (e.config && e.config.ativo);
    }).map(function (e) {
      var q = (((e.estado || {}).meses || {})[mes]) || {};
      var r = { nome: e.config.cliente || e.titular, codigo: e.config.codigo || "", so_resumo: q.so_resumo || 0, total: 0 };
      REL_COLS.forEach(function (c) { r[c[0]] = q[c[0]] || 0; r.total += r[c[0]]; });
      return r;
    }).sort(function (a, b) { return a.nome.localeCompare(b.nome, "pt-BR"); });
  }
  function renderRelatorio() {
    var meses = {};
    ROBO.empresas.forEach(function (e) { Object.keys((e.estado || {}).meses || {}).forEach(function (m) { meses[m] = 1; }); });
    var lista = Object.keys(meses).sort().reverse(), sel = $("rel-mes"), atual = sel.value;
    if (!atual || lista.indexOf(atual) < 0) {
      var d = DADOS.hoje ? new Date(Date.parse(DADOS.hoje + "T12:00:00Z")) : new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1);
      var anterior = d.toISOString().slice(0, 7);
      atual = lista.indexOf(anterior) >= 0 ? anterior : (lista[0] || "");
    }
    sel.textContent = "";
    lista.forEach(function (m) { var o = el("option", { value: m, texto: mesBr(m) }); if (m === atual) o.selected = true; sel.appendChild(o); });
    var tb = $("rel-linhas"), tf = $("rel-total");
    tb.textContent = ""; tf.textContent = "";
    $("rel-vazio").hidden = !!lista.length;
    $("rel-tabela").hidden = !lista.length;
    $("rel-baixar").hidden = !lista.length;
    if (!atual) return;
    var soma = { total: 0 };
    linhasRelatorio(atual).forEach(function (r) {
      var tds = [el("td", { "data-rotulo": "Empresa" }, [el("span", { classe: "cli-nome", texto: r.nome }), el("span", { classe: "mini", texto: r.codigo ? "Código " + r.codigo : "Sem código" })])];
      REL_COLS.forEach(function (c) {
        soma[c[0]] = (soma[c[0]] || 0) + r[c[0]];
        var filhos = [String(r[c[0]])];
        if (c[0] === "entrada" && r.so_resumo) filhos.push(el("span", { classe: "mini", texto: "+" + r.so_resumo + " só resumo" }));
        tds.push(el("td", { "data-rotulo": c[1], classe: "num" }, filhos));
      });
      soma.total += r.total;
      tds.push(el("td", { "data-rotulo": "Total", classe: "num" }, [el("strong", { texto: String(r.total) })]));
      tb.appendChild(el("tr", null, tds));
    });
    var tot = [el("td", { "data-rotulo": "Empresa", texto: "Total de " + mesBr(atual) })];
    REL_COLS.forEach(function (c) { tot.push(el("td", { "data-rotulo": c[1], classe: "num", texto: String(soma[c[0]] || 0) })); });
    tot.push(el("td", { "data-rotulo": "Total", classe: "num", texto: String(soma.total) }));
    tf.appendChild(el("tr", null, tot));
  }
  $("rel-mes").addEventListener("change", renderRelatorio);
  $("rel-baixar").addEventListener("click", function () {
    var mes = $("rel-mes").value;
    if (!mes) return;
    var cel = function (v) { v = String(v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var linhas = [["Empresa", "Código"].concat(REL_COLS.map(function (c) { return c[1]; })).concat(["NF-e recebidas só resumo", "Total"]).join(";")];
    linhasRelatorio(mes).forEach(function (r) {
      linhas.push([cel(r.nome), r.codigo].concat(REL_COLS.map(function (c) { return r[c[0]]; })).concat([r.so_resumo, r.total]).join(";"));
    });
    var blob = new Blob(["﻿" + linhas.join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" });
    var a = el("a", { href: URL.createObjectURL(blob), download: "relatorio-notas-" + mes + ".csv" });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  });

  function linhaRobo(e) {
    var cfg = e.config || {}, est = e.estado || {};
    var venc = e.vence_em ? diasAte(e.vence_em) : null;
    var certTd;
    if (e.sem_certificado) certTd = [el("span", { classe: "selo vencido", texto: "Não instalado" })];
    else certTd = [
      el("span", { classe: "selo " + (venc < 0 ? "vencido" : venc <= 7 ? "urgente" : venc <= 30 ? "atencao" : "ok"), texto: venc < 0 ? "Vencido" : "Vence " + dataBr(e.vence_em) }),
      e.ac ? el("span", { classe: "mini", texto: e.ac }) : null
    ];

    var cod = el("input", { type: "text", classe: "cod-input", inputmode: "numeric", maxlength: "10", placeholder: "código", "data-robo": "codigo", "data-cnpj": e.cnpj, "aria-label": "Código Domínio de " + cfg.cliente });
    cod.value = cfg.codigo || "";

    var botao = el("button", { type: "button", classe: "botao-captura", "data-robo": "ativo", "data-cnpj": e.cnpj, "aria-pressed": cfg.ativo ? "true" : "false", "aria-label": "Captura de " + cfg.cliente });
    botao.appendChild(el("span", { classe: "trilho", "aria-hidden": "true" }));
    botao.appendChild(document.createTextNode(cfg.ativo ? "Ligada" : "Desligada"));

    var linhas = [];
    [["nfe", "NF-e"], ["cte", "CT-e"], ["nfse", "NFS-e"]].forEach(function (p) {
      var s = est[p[0]];
      if (!s || !s.mensagem) return;
      linhas.push(el("span", { classe: "mini" + (s.erro ? " msg-erro" : ""), texto: p[1] + ": " + s.mensagem }));
    });
    if (e.pendente) linhas.unshift(el("span", { classe: "mini msg-erro", texto: "Mudança enviada: o computador do escritório aplica em alguns minutos." }));
    if (est.drive && est.drive.mensagem) linhas.push(el("span", { classe: "mini" + (est.drive.erro ? " msg-erro" : " msg-ok"), texto: "Drive: " + est.drive.mensagem }));
    var ultTd = est.ultima_rodada
      ? [dataHoraBr(est.ultima_rodada)].concat(linhas)
      : [el("span", { classe: "mini", texto: cfg.ativo ? "Ainda não capturou" : "—" })];

    var notas = [];
    [["nfe", "NF-e"], ["cte", "CT-e"], ["nfse", "NFS-e"]].forEach(function (p) {
      var s = est[p[0]];
      if (s && s.baixados_total) notas.push(el("span", { classe: "mini", texto: p[1] + ": " + s.baixados_total + (s.baixados_ultima ? " (+" + s.baixados_ultima + " na última)" : "") }));
    });
    if (est.ciencia_ok || est.ciencia_pendentes) notas.push(el("span", { classe: "mini", texto: "Ciência: " + (est.ciencia_ok || 0) + " feitas, " + (est.ciencia_pendentes || 0) + " na fila" }));
    if (est.ciencia_fora) notas.push(el("span", { classe: "mini", texto: est.ciencia_fora + " só em resumo (mais de 10 dias, fora do prazo da ciência)" }));
    if (!notas.length) notas.push(el("span", { classe: "mini", texto: "—" }));

    var fech = [], fe = est.fechamento || {};
    [["anterior", "Mês passado"], ["atual", "Este mês"]].forEach(function (p) {
      var f = fe[p[0]];
      if (!f || !f.mes) return;
      var partes = [];
      partes.push((f.entrada || 0) + " entrada" + (f.entrada === 1 ? "" : "s") + " completa" + (f.entrada === 1 ? "" : "s"));
      if (f.saida) partes.push(f.saida + " saída" + (f.saida === 1 ? "" : "s"));
      if (f.cte) partes.push(f.cte + " CT-e");
      if (f.nfse_prestadas || f.nfse_tomadas) partes.push(((f.nfse_prestadas || 0) + (f.nfse_tomadas || 0)) + " NFS-e");
      fech.push(el("span", { classe: "mini" }, [el("strong", { texto: p[1] + " (" + f.mes.slice(5) + "/" + f.mes.slice(0, 4) + "): " }), partes.join(" · ")]));
      if (f.so_resumo) fech.push(el("span", { classe: "mini msg-erro", texto: f.so_resumo + " só em resumo" + (f.so_resumo_fora ? " (" + f.so_resumo_fora + " fora do prazo da ciência: pedir o XML ao fornecedor)" : " (o XML completo ainda vai chegar)") }));
    });
    if (!fech.length) fech.push(el("span", { classe: "mini", texto: "—" }));

    return el("tr", null, [
      el("td", { "data-rotulo": "Empresa" }, [
        el("span", { classe: "cli-nome", texto: cfg.cliente || e.titular }),
        el("span", { classe: "mini", texto: "CNPJ " + cnpjFmt(e.cnpj) }),
        cod
      ]),
      el("td", { "data-rotulo": "Certificado" }, certTd),
      el("td", { "data-rotulo": "Captura" }, [botao]),
      el("td", { "data-rotulo": "Última captura" }, ultTd),
      el("td", { "data-rotulo": "Notas baixadas" }, notas),
      el("td", { "data-rotulo": "Fechamento do mês" }, fech)
    ]);
  }

  function empresaRobo(cnpj) { return ROBO.empresas.filter(function (x) { return x.cnpj === cnpj; })[0]; }

  function salvarRobo(cnpj, mudanca, alvo) {
    var e = empresaRobo(cnpj);
    if (!e) return;
    var cfg = Object.assign({}, e.config, mudanca);
    api("/api/robo/salvar", Object.assign({ cnpj: cnpj }, cfg)).then(function () {
      e.config = cfg;
      if ("ativo" in mudanca) toast((cfg.ativo ? "Captura ligada para " : "Captura desligada para ") + cfg.cliente + ".");
      else toast("Código salvo.");
      renderRobo();
      var b = document.querySelector('.botao-captura[data-cnpj="' + cnpj + '"]');
      if (b && alvo && alvo.classList.contains("botao-captura")) b.focus();
    }).catch(function (err) { erroGeral("Erro: " + err.message + "."); });
  }

  $("robo-linhas").addEventListener("click", function (ev) {
    var b = ev.target.closest(".botao-captura");
    if (!b) return;
    var cnpj = b.getAttribute("data-cnpj"), e = empresaRobo(cnpj);
    var ligar = b.getAttribute("aria-pressed") !== "true";
    if (ligar && (e.sem_certificado || (e.vence_em && diasAte(e.vence_em) < 0))) {
      alert("O certificado desta empresa está vencido ou não está instalado no Windows. Instale o certificado novo antes de ligar a captura.");
      return;
    }
    if (ligar && !e.config.codigo) {
      if (!confirm("Esta empresa está sem código Domínio, então o robô não vai saber em qual pasta do Drive salvar (os XML ficam só neste computador).\n\nLigar mesmo assim? (Você pode informar o código depois.)")) return;
    }
    salvarRobo(cnpj, { ativo: ligar }, b);
  });
  $("robo-linhas").addEventListener("change", function (ev) {
    var t = ev.target;
    if (t.getAttribute("data-robo") !== "codigo") return;
    salvarRobo(t.getAttribute("data-cnpj"), { codigo: t.value.replace(/\D/g, "") }, t);
  });
  $("robo-busca").addEventListener("input", renderRobo);
  $("robo-filtro").addEventListener("change", renderRobo);

  $("robo-ligar-todas").addEventListener("click", function () {
    var n = ROBO.empresas.filter(function (e) { return !e.config.ativo && !e.sem_certificado && e.vence_em && diasAte(e.vence_em) >= 0; }).length;
    if (!n) { toast("Todas as empresas com certificado válido já estão com a captura ligada."); return; }
    if (!confirm("Ligar a captura de " + n + " empresa(s) com certificado válido?\n\nIsso inclui a ciência da operação automática das NF-e de entrada, em nome de cada cliente.")) return;
    api("/api/robo/ligar-todas", { ligar: true }).then(function (r) {
      toast("Captura ligada para " + r.mudadas + " empresa(s).");
      return carregarRobo();
    }).catch(function (e) { erroGeral("Erro: " + e.message + "."); });
  });

  $("robo-escritorio").addEventListener("change", function () {
    var v = this.value;
    api("/api/robo/escritorio", { cnpj: v }).then(function () {
      ROBO.cnpj_escritorio = v;
      toast(v ? "Certificado do escritório salvo." : "Notas de saída desligadas.");
      renderRobo();
    }).catch(function (e) { erroGeral("Erro: " + e.message + "."); });
  });

  $("agenda-botao").addEventListener("click", function () {
    var ligar = !(ROBO.agenda && ROBO.agenda.ligada);
    if (ligar && !confirm("Ligar a captura semanal?\n\nToda segunda-feira e todo dia 1º, às 9h (e de novo às 11h, 13h, 15h e 17h para terminar) o robô busca as notas das empresas com a captura ligada e salva no Google Drive.")) return;
    if (!ligar && !confirm("Desligar a captura semanal? O robô para de rodar sozinho (o botão Capturar agora continua funcionando).")) return;
    var b = this;
    b.setAttribute("aria-disabled", "true");
    api("/api/robo/agenda", { ligar: ligar }).then(function (r) {
      ROBO.agenda = r.agenda;
      toast(ligar ? "Captura ligada: toda segunda e todo dia 1º, às 9h." : "Captura semanal desligada.");
      renderRobo();
    }).catch(function (e) { erroGeral("Erro: " + e.message + "."); })
      .then(function () { b.removeAttribute("aria-disabled"); });
  });

  $("robo-rodar").addEventListener("click", function () {
    if (this.getAttribute("aria-disabled")) return;
    api("/api/robo/rodar", {}).then(function () {
      toast("Captura iniciada. Pode continuar usando o painel.");
      setTimeout(carregarRobo, 1200);
    }).catch(function (e) { erroGeral("Erro: " + e.message + "."); });
  });

  window.PAINEL = { carregar: carregar, carregarRobo: carregarRobo, toast: toast, erroGeral: erroGeral };
  carregar();
})();
