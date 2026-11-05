// Edite este arquivo para ajustar links, contatos e funções da área da equipe.
window.STAFF_CONFIG = {
  NOME: "Staff Assessoria Contábil",

  // Portal do cliente no Onvio, aba Documentos. O cliente entra lá com o login que criou.
  ONVIO_PORTAL_URL: "https://onvio.com.br/staff/#/documents/client",

  // Contato mostrado no site. Preencha antes de publicar.
  EMAIL: "atendimento@staffassessoria.com",
  TELEFONE: "(86) 99818-7475",
  WHATSAPP: "", // somente números com DDI e DDD, ex.: 5586999999999
  ENDERECO: "Rua Desembargador João Pereira, 4092, Bairro Santa Isabel, Teresina - PI, CEP 64053-040",
  CRC: "", // ex.: CRC-PI nº 000000/O

  // "off": o login da equipe fica desligado (seguro para publicar).
  // "demo": aceita qualquer e-mail/senha e serve só para visualizar a interface em teste local.
  // Para uso real, troque por um provedor de login com servidor (veja assets/auth.js).
  AUTH_MODE: "off",

  // Funções da área da equipe. Sem "url" o item aparece como "Em breve".
  FUNCOES: [
    { nome: "Portal Onvio da equipe", descricao: "Acesso ao Onvio para atendimento e documentos dos clientes.", url: "https://onvio.com.br/staff/" },
    { nome: "Consulta de clientes", descricao: "Pesquisar empresa, regime tributário e responsáveis.", url: null },
    { nome: "Guias e vencimentos", descricao: "Calendário de obrigações e guias do mês.", url: null },
    { nome: "Emissão de DAS-MEI", descricao: "Emitir e arquivar as guias dos MEIs da competência.", url: null },
    { nome: "Solicitações de clientes", descricao: "Pedidos abertos pelo portal e pendências de documentos.", url: null },
    { nome: "Modelos e documentos", descricao: "Declarações, contratos e modelos usados pelo escritório.", url: null }
  ]
};
