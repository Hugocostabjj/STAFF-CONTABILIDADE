(function () {
  var cfg = window.STAFF_CONFIG || {};
  var reduzMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.querySelectorAll("[data-cfg-href]").forEach(function (el) {
    var v = cfg[el.getAttribute("data-cfg-href")];
    if (v) el.setAttribute("href", v);
  });
  document.querySelectorAll("[data-cfg-text]").forEach(function (el) {
    var v = cfg[el.getAttribute("data-cfg-text")];
    if (v) el.textContent = v;
  });
  document.querySelectorAll("[data-cfg-tel]").forEach(function (el) {
    var v = cfg[el.getAttribute("data-cfg-tel")];
    if (v) {
      el.textContent = v;
      el.setAttribute("href", "tel:+55" + v.replace(/\D/g, ""));
    }
  });
  document.querySelectorAll("[data-cfg-mail]").forEach(function (el) {
    var v = cfg[el.getAttribute("data-cfg-mail")];
    if (v) {
      el.textContent = v;
      el.setAttribute("href", "mailto:" + v);
    }
  });
  var ano = document.getElementById("ano");
  if (ano) ano.textContent = new Date().getFullYear();

  // Menu no celular
  var hamb = document.getElementById("hamb");
  var menu = document.getElementById("menu");
  if (hamb && menu) {
    hamb.addEventListener("click", function () {
      var aberto = menu.classList.toggle("aberto");
      hamb.setAttribute("aria-expanded", aberto ? "true" : "false");
    });
    menu.addEventListener("click", function (ev) {
      if (ev.target.tagName === "A") {
        menu.classList.remove("aberto");
        hamb.setAttribute("aria-expanded", "false");
      }
    });
  }

  // Carrossel principal
  var slides = document.querySelectorAll(".hero .slide");
  if (slides.length > 1 && !reduzMovimento) {
    var atual = 0;
    setInterval(function () {
      slides[atual].classList.remove("ativo");
      atual = (atual + 1) % slides.length;
      slides[atual].classList.add("ativo");
    }, 6000);
  }

  // Carrosséis de rolagem (artigos, depoimentos)
  document.querySelectorAll(".carrossel").forEach(function (c) {
    var faixa = c.querySelector(".faixa");
    var esq = c.querySelector(".seta.esq");
    var dir = c.querySelector(".seta.dir");
    if (!faixa) return;
    var passo = function (sinal) {
      faixa.scrollBy({ left: sinal * faixa.clientWidth * 0.85, behavior: reduzMovimento ? "auto" : "smooth" });
    };
    if (esq) esq.addEventListener("click", function () { passo(-1); });
    if (dir) dir.addEventListener("click", function () { passo(1); });
  });

  // Formulário de contato: abre WhatsApp ou e-mail com a mensagem pronta.
  var form = document.getElementById("form-contato");
  if (form) {
    var aviso = document.getElementById("aviso-contato");
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var d = new FormData(form);
      if (!String(d.get("nome") || "").trim() || !String(d.get("mensagem") || "").trim()) {
        aviso.textContent = "Preencha seu nome e a mensagem.";
        aviso.hidden = false;
        return;
      }
      var texto =
        "Olá, sou " + d.get("nome") + ". " + d.get("mensagem") +
        "\nTelefone: " + d.get("telefone") + "\nE-mail: " + d.get("email");
      if (cfg.WHATSAPP) {
        window.open("https://wa.me/" + cfg.WHATSAPP + "?text=" + encodeURIComponent(texto), "_blank", "noopener");
      } else if (cfg.EMAIL) {
        window.location.href =
          "mailto:" + cfg.EMAIL + "?subject=" + encodeURIComponent("Contato pelo site") + "&body=" + encodeURIComponent(texto);
      } else {
        aviso.textContent = "Os canais de contato ainda não foram configurados.";
        aviso.hidden = false;
      }
    });
  }

  // Área da equipe
  var painel = document.getElementById("painel");
  var login = document.getElementById("login");
  if (painel && login && window.StaffAuth) {
    var lista = document.getElementById("lista-funcoes");
    var quem = document.getElementById("quem");
    var erro = document.getElementById("erro-login");
    var faixaDemo = document.getElementById("faixa-demo");

    (cfg.FUNCOES || []).forEach(function (f) {
      var li = document.createElement("li");
      var el = document.createElement(f.url ? "a" : "div");
      el.className = "funcao" + (f.url ? "" : " funcao-off");
      if (f.url) {
        el.href = f.url;
        el.target = "_blank";
        el.rel = "noopener";
      }
      var nome = document.createElement("strong");
      nome.textContent = f.nome;
      var desc = document.createElement("span");
      desc.textContent = f.descricao;
      var estado = document.createElement("em");
      estado.textContent = f.url ? "Abrir" : "Em breve";
      el.appendChild(nome);
      el.appendChild(desc);
      el.appendChild(estado);
      li.appendChild(el);
      lista.appendChild(li);
    });

    var atualizar = function () {
      var u = window.StaffAuth.usuario();
      login.hidden = !!u;
      painel.hidden = !u;
      if (u) quem.textContent = u;
      if (faixaDemo) faixaDemo.hidden = window.StaffAuth.modo() !== "demo";
    };

    document.getElementById("form-login").addEventListener("submit", function (ev) {
      ev.preventDefault();
      erro.hidden = true;
      var f = ev.target;
      window.StaffAuth.entrar(f.email.value.trim(), f.senha.value).then(function () {
        f.reset();
        atualizar();
      }).catch(function (e) {
        erro.textContent = e.message;
        erro.hidden = false;
      });
    });

    document.getElementById("btn-sair").addEventListener("click", function () {
      window.StaffAuth.sair();
      atualizar();
    });

    atualizar();
  }
})();
