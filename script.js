(function () {
  "use strict";

  /* ===== Configuração (ajuste aqui) ===== */
  var CONFIG = {
    whatsapp: "5562995674876",
    abre: 9,            // hora de abertura (confirmar com o proprietário)
    fecha: 19,          // fecha às 19h (conforme Google Maps)
    intervaloMin: 40,   // duração de cada horário
    diasFechados: [0],  // 0 = domingo (confirmar com o proprietário)
    storageKey: "prado_cookies_v1"
  };

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ===== Utilidades ===== */
  var toastEl = $("#toast"), toastTimer;
  function aviso(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("on"); }, 4000);
  }
  function setErro(nome, msg) {
    var span = $('[data-erro="' + nome + '"]');
    if (!span) return;
    span.textContent = msg || "";
    var campo = span.closest(".campo");
    if (campo) campo.classList.toggle("invalido", !!msg);
  }
  function limparTel(v) { return v.replace(/\D/g, ""); }
  function pad(n) { return String(n).padStart(2, "0"); }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }

  /* ===== Menu mobile ===== */
  var menuBtn = $("#menuBtn"), nav = $("#nav");
  menuBtn.addEventListener("click", function () {
    var aberto = nav.classList.toggle("aberto");
    menuBtn.setAttribute("aria-expanded", aberto);
  });
  $$("#nav a").forEach(function (a) {
    a.addEventListener("click", function () {
      nav.classList.remove("aberto");
      menuBtn.setAttribute("aria-expanded", "false");
    });
  });

  /* ===== Diálogos ===== */
  $$("[data-abrir]").forEach(function (el) {
    el.addEventListener("click", function (e) {
      e.preventDefault();
      $("#" + el.getAttribute("data-abrir")).showModal();
    });
  });
  $$("[data-fechar]").forEach(function (el) {
    el.addEventListener("click", function () { el.closest("dialog").close(); });
  });

  /* ===== Cookies e consentimento ===== */
  var banner = $("#cookies"), dlgCook = $("#dlgCookies");
  var ck = { pref: $("#ckPref"), est: $("#ckEst"), mkt: $("#ckMkt") };

  function lerConsent() {
    try { return JSON.parse(localStorage.getItem(CONFIG.storageKey)); } catch (e) { return null; }
  }
  function salvarConsent(c) {
    try { localStorage.setItem(CONFIG.storageKey, JSON.stringify(c)); } catch (e) { /* sem armazenamento: banner volta na próxima visita */ }
    banner.hidden = true;
    aplicarConsent(c);
  }
  // Scripts não essenciais só podem ser carregados aqui, depois da escolha.
  function aplicarConsent(c) {
    if (c.est) { /* carregar analytics aqui (ex.: Google Analytics) */ }
    if (c.mkt) { /* carregar pixels de marketing aqui */ }
  }
  var salvo = lerConsent();
  if (salvo) { aplicarConsent(salvo); } else { banner.hidden = false; }

  $("#cAceitar").addEventListener("click", function () { salvarConsent({ pref: true, est: true, mkt: true }); aviso("Preferências salvas."); });
  $("#cRejeitar").addEventListener("click", function () { salvarConsent({ pref: false, est: false, mkt: false }); aviso("Cookies não essenciais recusados."); });
  function abrirPersonalizar() {
    var c = lerConsent() || {};
    ck.pref.checked = !!c.pref; ck.est.checked = !!c.est; ck.mkt.checked = !!c.mkt;
    dlgCook.showModal();
  }
  $("#cPersonalizar").addEventListener("click", abrirPersonalizar);
  $("#abrirCookies").addEventListener("click", function (e) { e.preventDefault(); abrirPersonalizar(); });
  $("#formCookies").addEventListener("submit", function (e) {
    e.preventDefault();
    salvarConsent({ pref: ck.pref.checked, est: ck.est.checked, mkt: ck.mkt.checked });
    dlgCook.close();
    aviso("Preferências salvas.");
  });

  /* ===== Agendamento ===== */
  var inData = $("#data"), selHora = $("#hora");
  var hoje = new Date();
  inData.min = iso(hoje);
  var max = new Date(); max.setDate(max.getDate() + 60);
  inData.max = iso(max);

  function montarHorarios() {
    selHora.innerHTML = "";
    var val = inData.value;
    if (!val) { selHora.innerHTML = '<option value="">Escolha a data primeiro</option>'; return; }
    var p = val.split("-"), dia = new Date(+p[0], +p[1] - 1, +p[2]);
    if (CONFIG.diasFechados.indexOf(dia.getDay()) !== -1) {
      selHora.innerHTML = '<option value="">Fechado neste dia</option>';
      return;
    }
    var opts = ['<option value="">Selecione</option>'];
    var agora = new Date();
    for (var m = CONFIG.abre * 60; m + CONFIG.intervaloMin <= CONFIG.fecha * 60; m += CONFIG.intervaloMin) {
      var h = pad(Math.floor(m / 60)) + ":" + pad(m % 60);
      var passou = iso(dia) === iso(agora) && m <= agora.getHours() * 60 + agora.getMinutes();
      if (!passou) opts.push('<option value="' + h + '">' + h + "</option>");
    }
    if (opts.length === 1) opts = ['<option value="">Sem horários restantes hoje</option>'];
    selHora.innerHTML = opts.join("");
  }
  inData.addEventListener("change", montarHorarios);

  $("#tel").addEventListener("input", function (e) {
    var d = limparTel(e.target.value).slice(0, 11), s = d;
    if (d.length > 2) s = "(" + d.slice(0, 2) + ") " + d.slice(2);
    if (d.length > 7) s = "(" + d.slice(0, 2) + ") " + d.slice(2, d.length - 4) + "-" + d.slice(-4);
    e.target.value = s;
  });

  var ultimoEnvio = 0;
  $("#formAgenda").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target, ok = true;
    if (f.site.value) return; // campo-armadilha preenchido: provável robô

    var nome = f.nome.value.trim(), tel = limparTel(f.tel.value);
    var erros = {
      nome: nome.length < 3 ? "Informe seu nome." : "",
      tel: (tel.length < 10 || tel.length > 11) ? "Informe um telefone com DDD." : "",
      servico: f.servico.value ? "" : "Escolha um serviço.",
      data: f.data.value ? "" : "Escolha uma data.",
      hora: f.hora.value ? "" : "Escolha um horário.",
      aceite: $("#aceite").checked ? "" : "Marque para continuar."
    };
    Object.keys(erros).forEach(function (k) { setErro(k, erros[k]); if (erros[k]) ok = false; });
    if (!ok) { var primeiro = $(".campo.invalido input, .campo.invalido select", f); if (primeiro) primeiro.focus(); return; }

    if (Date.now() - ultimoEnvio < 5000) return; // limita envios repetidos
    ultimoEnvio = Date.now();

    var d = f.data.value.split("-");
    var msg = "Olá! Quero agendar na Barbearia Prado.\n" +
      "Nome: " + nome + "\nServiço: " + f.servico.value +
      "\nData: " + d[2] + "/" + d[1] + "/" + d[0] + "\nHorário: " + f.hora.value;
    window.open("https://wa.me/" + CONFIG.whatsapp + "?text=" + encodeURIComponent(msg), "_blank", "noopener");
    aviso("Abrindo o WhatsApp para confirmar.");
    f.reset();
    montarHorarios();
  });

  /* ===== Direitos do titular (LGPD, art. 18) ===== */
  $("#formDireitos").addEventListener("submit", function (e) {
    e.preventDefault();
    var nome = $("#dNome").value.trim(), tipo = $("#dTipo").value, ok = true;
    setErro("dNome", nome.length < 3 ? "Informe seu nome." : ""); if (nome.length < 3) ok = false;
    setErro("dTipo", tipo ? "" : "Escolha uma opção."); if (!tipo) ok = false;
    if (!ok) return;
    var msg = "Solicitação LGPD\nNome: " + nome + "\nPedido: " + tipo;
    window.open("https://wa.me/" + CONFIG.whatsapp + "?text=" + encodeURIComponent(msg), "_blank", "noopener");
    $("#dlgDireitos").close();
    e.target.reset();
    aviso("Pedido enviado. Responderemos em breve.");
  });

  $("#ano").textContent = new Date().getFullYear();
})();