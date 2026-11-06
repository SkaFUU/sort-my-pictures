// Rueckfragen und Meldungen oben in der Seitenleiste statt Browser-Fenster (confirm/alert/prompt).
// Ist die Bildansicht offen, erscheinen sie in deren Seitenleiste. Enter = Bestaetigen, Esc = Abbrechen.
const Ask = (() => {
  const { h } = Util;
  let box = null, done = null, cancelValue = null;

  function host() {
    const v = document.getElementById('viewer');
    if (v && !v.hidden) return v.querySelector('.v-side');
    const p = document.getElementById('props');
    if (p.classList.contains('hide')) document.getElementById('togProps')?.click();
    return p;
  }
  function close(v) {
    box?.remove();
    box = null;
    const d = done;
    done = null;
    d?.(v);
  }

  // buttons: [{ label, value, primary }]; input: Vorgabe fuer ein Eingabefeld (dann liefert der Hauptknopf dessen Text)
  function show({ title = '', text = '', kind = 'ask', buttons, input = null, cancel = false }) {
    close(cancelValue);  // vorherige Frage gilt als abgebrochen
    cancelValue = cancel;
    return new Promise(res => {
      done = res;
      const inp = input !== null ? h('input', { type: 'text', value: input }) : null;
      const btns = buttons.map(b => h('button', { class: b.primary ? 'primary' : '',
        onclick: () => close(inp && b.primary ? inp.value.trim() : b.value) }, b.label));
      box = h('div', { class: 'askbox ' + kind },
        title ? h('h3', {}, title) : null,
        text ? h('div', { class: 'ask-text' }, text) : null,
        inp, h('div', { class: 'ask-btns' }, btns));
      box.addEventListener('keydown', e => {
        e.stopPropagation();  // nicht an Bildansicht, Schnell zuordnen usw. weitergeben
        if (e.key === 'Escape') { e.preventDefault(); close(cancel); }
        else if (e.key === 'Enter' && e.target === inp) { e.preventDefault(); btns.find((_, i) => buttons[i].primary)?.click(); }
      });
      const hst = host();
      hst.prepend(box);
      hst.scrollTop = 0;
      // erst nach dem laufenden Tastendruck: sonst loest das Enter, das die Frage ausgeloest hat, gleich den Knopf aus
      document.activeElement?.blur?.();
      setTimeout(() => { if (box) (inp || btns.find((_, i) => buttons[i].primary) || btns[0])?.focus(); }, 0);
    });
  }

  // Ja/Nein -> true/false; extra: weitere Knoepfe [{ label, value }]
  const confirm = (text, { title = '', yes = T('OK'), no = T('Abbrechen'), extra = [] } = {}) =>
    show({ title, text, cancel: false, buttons: [{ label: yes, value: true, primary: true }, ...extra, { label: no, value: false }] });
  // Meldung mit OK; kind: 'err' (rot), 'ok' (gruen), 'info'
  const alert = (text, { title = '', kind = 'err' } = {}) =>
    show({ title, text, kind, cancel: true, buttons: [{ label: T('OK'), value: true, primary: true }] });
  // Texteingabe -> Text oder null
  const prompt = (text, value = '', { title = '' } = {}) =>
    show({ title, text, input: value, cancel: null, buttons: [{ label: T('OK'), primary: true }, { label: T('Abbrechen'), value: null }] });

  return { confirm, alert, prompt, close: () => close(cancelValue), get open() { return !!box; } };
})();
