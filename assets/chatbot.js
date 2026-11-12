// Assistente virtual: pergunta o serviço, coleta o básico e leva o cliente ao WhatsApp com a mensagem pronta.
// Para mudar as opções, perguntas ou textos, edite a lista SERVICOS abaixo.
(function () {
  var cfg = window.STAFF_CONFIG || {};
  var numero = String(cfg.WHATSAPP || cfg.TELEFONE || "").replace(/\D/g, "");
  if (!numero) return;
  if (numero.length <= 11) numero = "55" + numero;

  var SUFIXO = "\n(Atendimento iniciado pelo site)";

  // Cada serviço pode ter:
  //   msg        texto inicial da mensagem
  //   perguntas  lista de perguntas digitadas (rot = nome do campo na mensagem, opcional = permite pular)
  //   direto     true = abre o WhatsApp na hora, sem perguntas
  //   certificado true = fluxo especial de pessoa física/jurídica
  var SERVICOS = [
    { rotulo: "Certificado digital", certificado: true },
    {
      rotulo: "Abertura de empresa",
      msg: "Olá, tenho interesse em abrir uma empresa.",
      perguntas: [
        { rot: "Segmento", texto: "Qual será o segmento da empresa? (ex.: comércio de roupas, restaurante, clínica)", ph: "Digite o segmento" },
        { rot: "Cidade", texto: "Em qual cidade a empresa vai funcionar?", ph: "Digite a cidade" },
        { rot: "Estado", texto: "E em qual estado?", ph: "Ex.: PI" }
      ]
    },
    {
      rotulo: "Regularização de empresa",
      msg: "Olá, preciso de ajuda com a regularização da minha empresa.",
      perguntas: [
        { rot: "CNPJ ou nome da empresa", texto: "Qual é o CNPJ da empresa? Se não tiver à mão, pode digitar o nome dela.", ph: "CNPJ ou nome da empresa", cnpj: true },
        { rot: "Situação", texto: "Em poucas palavras, qual é a situação? (ex.: CNPJ baixado, pendências na Receita, dívidas, certidão negativa)", ph: "Descreva a situação", opcional: true }
      ]
    },
    { rotulo: "Departamento pessoal", msg: "Olá, tenho interesse nos serviços de departamento pessoal e recursos humanos." },
    { rotulo: "Assessoria tributária", msg: "Olá, tenho interesse em planejamento e assessoria tributária." },
    { rotulo: "Contabilidade geral", msg: "Olá, tenho interesse em contabilidade geral e financeira para minha empresa." },
    { rotulo: "Outro assunto", msg: "Olá, vim pelo site da Staff Assessoria Contábil e gostaria de atendimento.", direto: true }
  ];

  function preco(tipo) {
    var a = document.querySelector('[data-cert="' + tipo + '"]');
    var card = a && a.closest(".cert-card");
    var p = card && card.querySelector("[data-cert-preco]");
    return p ? p.textContent : "";
  }
  function msgCertificado(tipo, sigla) {
    var v = preco(tipo);
    return "Olá, tenho interesse em agendar o horário para fazer a emissão do certificado digital." +
      "\nTipo: " + tipo + " (" + sigla + ")" + (v ? "\nValor: R$ " + v : "");
  }
  function link(msg) {
    return "https://wa.me/" + numero + "?text=" + encodeURIComponent(msg + SUFIXO);
  }
  function formataCnpj(v) {
    var d = String(v).replace(/\D/g, "");
    if (d.length === 14 && String(v).replace(/[\d.\/\-\s]/g, "") === "") {
      return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
    }
    return v;
  }
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt) e.textContent = txt;
    return e;
  }

  var raiz = el("div", "bot");
  var fab = el("button", "bot-fab", "Fale com a gente");
  fab.type = "button";
  fab.setAttribute("aria-expanded", "false");
  fab.setAttribute("aria-controls", "bot-painel");

  var painel = el("section", "bot-painel");
  painel.id = "bot-painel";
  painel.setAttribute("role", "dialog");
  painel.setAttribute("aria-label", "Assistente virtual da Staff");
  painel.hidden = true;

  var topo = el("header", "bot-topo");
  var titulo = el("div");
  titulo.appendChild(el("strong", "", "Assistente Staff"));
  titulo.appendChild(el("span", "", "Atendimento pelo WhatsApp"));
  var fechar = el("button", "bot-fechar", "×");
  fechar.type = "button";
  fechar.setAttribute("aria-label", "Fechar atendimento");
  topo.appendChild(titulo);
  topo.appendChild(fechar);

  var msgs = el("div", "bot-msgs");
  msgs.setAttribute("aria-live", "polite");
  var opcoes = el("div", "bot-opcoes");

  painel.appendChild(topo);
  painel.appendChild(msgs);
  painel.appendChild(opcoes);
  raiz.appendChild(painel);
  raiz.appendChild(fab);
  document.body.appendChild(raiz);

  function bolha(txt, quem) {
    msgs.appendChild(el("p", "bot-b " + quem, txt));
    msgs.scrollTop = msgs.scrollHeight;
  }
  function focaPrimeiro() {
    var alvo = opcoes.querySelector("input, .bot-op");
    if (alvo && !painel.hidden) alvo.focus({ preventScroll: true });
  }
  function botoes(lista) {
    opcoes.textContent = "";
    lista.forEach(function (o) {
      var b;
      if (o.href) {
        b = el("a", "bot-op bot-wa", o.rotulo);
        b.href = o.href;
        b.target = "_blank";
        b.rel = "noopener";
      } else {
        b = el("button", "bot-op" + (o.sec ? " sec" : ""), o.rotulo);
        b.type = "button";
        b.addEventListener("click", o.acao);
      }
      opcoes.appendChild(b);
    });
    focaPrimeiro();
  }

  function voltaMenu() {
    bolha("Qual serviço você procura?", "robo");
    menu();
  }
  function menu() {
    botoes(SERVICOS.map(function (s) {
      return { rotulo: s.rotulo, acao: function () { escolher(s); } };
    }));
  }
  function final(msg, texto, abrirAgora) {
    bolha(texto || "Perfeito! Toque no botão abaixo para continuar no WhatsApp. A mensagem já vai pronta e nossa equipe responde por lá.", "robo");
    if (abrirAgora) window.open(link(msg), "_blank", "noopener");
    botoes([
      { rotulo: "Continuar no WhatsApp", href: link(msg) },
      { rotulo: "Escolher outro serviço", sec: true, acao: voltaMenu }
    ]);
  }

  // Pergunta com resposta digitada. cb recebe o texto (ou "" se pulou).
  function perguntar(p, cb) {
    bolha(p.texto, "robo");
    opcoes.textContent = "";
    var form = el("form", "bot-form");
    var inp = el("input");
    inp.type = "text";
    inp.placeholder = p.ph || "Digite aqui";
    inp.maxLength = 160;
    inp.setAttribute("aria-label", p.rot);
    var env = el("button", "bot-enviar", "Enviar");
    env.type = "submit";
    form.appendChild(inp);
    form.appendChild(env);
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var v = inp.value.trim();
      if (!v) { inp.focus(); return; }
      if (p.cnpj) v = formataCnpj(v);
      bolha(v, "eu");
      cb(v);
    });
    opcoes.appendChild(form);
    if (p.opcional) {
      var pular = el("button", "bot-op sec", "Pular esta pergunta");
      pular.type = "button";
      pular.addEventListener("click", function () { bolha("Pular", "eu"); cb(""); });
      opcoes.appendChild(pular);
    }
    var voltar = el("button", "bot-op sec", "Voltar ao início");
    voltar.type = "button";
    voltar.addEventListener("click", function () { bolha("Voltar ao início", "eu"); voltaMenu(); });
    opcoes.appendChild(voltar);
    focaPrimeiro();
  }
  function fazerPerguntas(s, i, linhas) {
    if (i >= s.perguntas.length) {
      final(s.msg + (linhas.length ? "\n" + linhas.join("\n") : ""));
      return;
    }
    var p = s.perguntas[i];
    perguntar(p, function (v) {
      if (v) linhas.push(p.rot + ": " + v);
      fazerPerguntas(s, i + 1, linhas);
    });
  }

  function escolher(s) {
    bolha(s.rotulo, "eu");
    if (s.certificado) {
      var pf = preco("Pessoa Física"), pj = preco("Pessoa Jurídica");
      bolha("O certificado é para pessoa física" + (pf ? " (R$ " + pf + ")" : "") + " ou jurídica" + (pj ? " (R$ " + pj + ")" : "") + "?", "robo");
      botoes([
        { rotulo: "Pessoa física", acao: function () { bolha("Pessoa física", "eu"); final(msgCertificado("Pessoa Física", "e-CPF A1")); } },
        { rotulo: "Pessoa jurídica", acao: function () { bolha("Pessoa jurídica", "eu"); final(msgCertificado("Pessoa Jurídica", "e-CNPJ A1")); } },
        { rotulo: "Voltar", sec: true, acao: function () { bolha("Voltar", "eu"); voltaMenu(); } }
      ]);
    } else if (s.perguntas) {
      fazerPerguntas(s, 0, []);
    } else if (s.direto) {
      final(s.msg, "Abrindo o WhatsApp para você falar direto com a nossa equipe. Se não abrir, toque no botão abaixo.", true);
    } else {
      final(s.msg);
    }
  }

  function abrir() {
    painel.hidden = false;
    fab.setAttribute("aria-expanded", "true");
    if (!msgs.children.length) {
      bolha("Olá! 👋 Eu sou o assistente virtual da Staff Assessoria Contábil.", "robo");
      bolha("Qual serviço você procura?", "robo");
      menu();
    } else {
      focaPrimeiro();
    }
  }
  function fecharPainel() {
    painel.hidden = true;
    fab.setAttribute("aria-expanded", "false");
    fab.focus();
  }
  fab.addEventListener("click", function () { if (painel.hidden) abrir(); else fecharPainel(); });
  fechar.addEventListener("click", fecharPainel);
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && !painel.hidden) fecharPainel();
  });
})();
