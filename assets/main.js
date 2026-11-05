(function () {
  var cfg = window.STAFF_CONFIG || {};
  var reduzMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.querySelectorAll("[data-cfg-href]").forEach(function (el) {
    var v = cfg[el.getAttribute("data-cfg-href")];
    if (v) el.setAttribute("href", v);
  });
  document.querySelectorAll("[data-cfg-text]").forEach(function (el) {
    var v = cfg[el.getAttribute("data-cfg-text")];
    if (v) {
      el.textContent = v;
      el.hidden = false;
    }
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

  // Balancete que se soma uma vez ao carregar e termina carimbado.
  var balancete = document.getElementById("balancete");
  if (balancete) {
    var fmt = function (n) {
      return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };
    var celulas = balancete.querySelectorAll("[data-valor]");
    var totD = document.getElementById("total-d");
    var totC = document.getElementById("total-c");
    var dif = document.getElementById("diferenca");

    var somaD = 0, somaC = 0;
    celulas.forEach(function (c) {
      var v = parseFloat(c.getAttribute("data-valor"));
      if (c.getAttribute("data-col") === "d") somaD += v; else somaC += v;
    });

    var mostrarFinal = function () {
      celulas.forEach(function (c) {
        c.textContent = fmt(parseFloat(c.getAttribute("data-valor")));
      });
      totD.textContent = fmt(somaD);
      totC.textContent = fmt(somaC);
      dif.textContent = fmt(somaD - somaC);
      balancete.classList.add("conferido");
    };

    if (reduzMovimento) {
      mostrarFinal();
    } else {
      var duracao = 1400;
      var inicio = null;
      var passo = function (t) {
        if (inicio === null) inicio = t;
        var p = Math.min((t - inicio) / duracao, 1);
        var e = 1 - Math.pow(1 - p, 3);
        celulas.forEach(function (c) {
          c.textContent = fmt(parseFloat(c.getAttribute("data-valor")) * e);
        });
        totD.textContent = fmt(somaD * e);
        totC.textContent = fmt(somaC * e);
        dif.textContent = fmt((somaD - somaC) * e);
        if (p < 1) {
          requestAnimationFrame(passo);
        } else {
          mostrarFinal();
        }
      };
      requestAnimationFrame(passo);
    }
  }

  // Formulário de contato: abre WhatsApp ou e-mail com a mensagem pronta.
  var form = document.getElementById("form-contato");
  if (form) {
    var aviso = document.getElementById("aviso-contato");
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var d = new FormData(form);
      var texto =
        "Olá, sou " + d.get("nome") + ". " + d.get("mensagem") +
        "\nTelefone: " + d.get("telefone") + "\nE-mail: " + d.get("email");
      if (cfg.WHATSAPP) {
        window.open("https://wa.me/" + cfg.WHATSAPP + "?text=" + encodeURIComponent(texto), "_blank", "noopener");
      } else if (cfg.EMAIL) {
        window.location.href =
          "mailto:" + cfg.EMAIL + "?subject=" + encodeURIComponent("Contato pelo site") + "&body=" + encodeURIComponent(texto);
      } else {
        aviso.textContent = "Os canais de contato ainda não foram configurados. Preencha EMAIL ou WHATSAPP em assets/config.js.";
        aviso.hidden = false;
      }
    });
  }

  // Área da equipe.
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
