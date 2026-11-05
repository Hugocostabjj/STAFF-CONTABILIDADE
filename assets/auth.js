// Login da equipe.
// ATENÇÃO: o modo "demo" não protege nada. Senha conferida só no navegador pode ser
// contornada por qualquer pessoa. Antes de colocar dados reais atrás deste login,
// troque por um provedor com servidor (ex.: Supabase Auth) implementando entrar/sair/usuario.
(function () {
  var CHAVE = "staff_usuario";

  var Auth = {
    modo: function () {
      return (window.STAFF_CONFIG || {}).AUTH_MODE;
    },
    usuario: function () {
      try {
        return sessionStorage.getItem(CHAVE);
      } catch (e) {
        return null;
      }
    },
    entrar: function (email, senha) {
      if (this.modo() !== "demo") {
        return Promise.reject(new Error("O login da equipe ainda não está conectado a um servidor."));
      }
      if (!email || !senha) {
        return Promise.reject(new Error("Informe e-mail e senha."));
      }
      try {
        sessionStorage.setItem(CHAVE, email);
      } catch (e) {}
      return Promise.resolve(email);
    },
    sair: function () {
      try {
        sessionStorage.removeItem(CHAVE);
      } catch (e) {}
    }
  };

  window.StaffAuth = Auth;
})();
