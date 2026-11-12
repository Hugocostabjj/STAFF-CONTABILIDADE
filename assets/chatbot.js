// Assistente virtual: pergunta o serviço e leva o cliente ao WhatsApp com a mensagem pronta.
// Para mudar as opções ou os textos, edite a lista SERVICOS abaixo.
(function () {
  var cfg = window.STAFF_CONFIG || {};
  var numero = String(cfg.WHATSAPP || cfg.TELEFONE || "").replace(/\D/g, "");
  if (!numero) return;
  if (numero.length <= 11) numero = "55" + numero;

  var SUFIXO = "\n(Atendimento iniciado pelo site)";
  var SERVICOS = [
    { rotulo: "Certificado digital", certificado: true },
    { rotulo: "Abertura de empresa", msg: "Olá, tenho interesse em abrir uma empresa." },
    { rotulo: "Regularização de empresa", msg: "Olá, preciso de ajuda com a regularização da minha empresa." },
    { rotulo: "Departamento pessoal", msg: "Olá, tenho interesse nos serviços de departamento pessoal e recursos humanos." },
    { rotulo: "Assessoria tributária", msg: "Olá, tenho interesse em planejamento e assessoria tributária." },
    { rotulo: "Contabilidade geral", msg: "Olá, tenho interesse em contabilidade geral e financeira para minha empresa." },
    { rotulo: "Outro assunto", msg: "Olá, vim pelo site da Staff Assessoria Contábil e gostaria de atendimento." }
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
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt) e.textContent = txt;
    return e;
  }

  var raiz = el("div", "bot");
  var fab = el("button", "bot-fab");
  fab.type = "button";
  fab.setAttribute("aria-expanded", "false");
  fab.setAttribute("aria-controls", "bot-painel");
  fab.setAttribute("aria-label", "Abrir atendimento automático");
  fab.innerHTML =
    '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 6v6M10 20h-3v8h3M38 20h3v8h-3"/>' +
    '<rect x="10" y="12" width="28" height="26" rx="8"/><circle cx="19" cy="25" r="2.6"/><circle cx="29" cy="25" r="2.6"/>' +
    '<path d="M18 32h12"/><circle cx="24" cy="5" r="1.8"/></svg><span>Fale com a gente</span>';

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
    var primeiro = opcoes.querySelector(".bot-op");
    if (primeiro && !painel.hidden) primeiro.focus({ preventScroll: true });
  }

  function menu() {
    botoes(SERVICOS.map(function (s) {
      return { rotulo: s.rotulo, acao: function () { escolher(s); } };
    }));
  }
  function final(msg) {
    bolha("Perfeito! Toque no botão abaixo para continuar no WhatsApp. A mensagem já vai pronta e nossa equipe responde por lá.", "robo");
    botoes([
      { rotulo: "Continuar no WhatsApp", href: link(msg) },
      { rotulo: "Escolher outro serviço", sec: true, acao: function () { bolha("Qual serviço você procura?", "robo"); menu(); } }
    ]);
  }
  function escolher(s) {
    bolha(s.rotulo, "eu");
    if (s.certificado) {
      var pf = preco("Pessoa Física"), pj = preco("Pessoa Jurídica");
      bolha("O certificado é para pessoa física" + (pf ? " (R$ " + pf + ")" : "") + " ou jurídica" + (pj ? " (R$ " + pj + ")" : "") + "?", "robo");
      botoes([
        { rotulo: "Pessoa física", acao: function () { bolha("Pessoa física", "eu"); final(msgCertificado("Pessoa Física", "e-CPF A1")); } },
        { rotulo: "Pessoa jurídica", acao: function () { bolha("Pessoa jurídica", "eu"); final(msgCertificado("Pessoa Jurídica", "e-CNPJ A1")); } },
        { rotulo: "Voltar", sec: true, acao: function () { bolha("Qual serviço você procura?", "robo"); menu(); } }
      ]);
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
      var p = opcoes.querySelector(".bot-op");
      if (p) p.focus({ preventScroll: true });
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
