// Garantia do efeito "hover/focus" nos cards (.grid-item) mesmo se houver conflitos de CSS.
// Adiciona/remover a classe .hovered via eventos e ainda trata foco de teclado.

(function () {
  function attachGridHoverHandlers(grid) {
    if (!grid) return;

    // Usa delegação de eventos para qualquer .grid-item criado dinamicamente
    grid.addEventListener('mouseover', (e) => {
      const item = e.target.closest('.grid-item');
      if (!item || !grid.contains(item)) return;
      item.classList.add('hovered');
    });

    grid.addEventListener('mouseout', (e) => {
      const item = e.target.closest('.grid-item');
      if (!item || !grid.contains(item)) return;
      // Só remove se realmente saiu do item (e não para um filho)
      const toEl = e.relatedTarget;
      if (!toEl || !item.contains(toEl)) {
        item.classList.remove('hovered');
      }
    });

    // Acessibilidade: foco via teclado/controle remoto
    grid.addEventListener('focusin', (e) => {
      const item = e.target.closest('.grid-item');
      if (item) item.classList.add('hovered');
    });

    grid.addEventListener('focusout', (e) => {
      const item = e.target.closest('.grid-item');
      if (!item) return;
      const toEl = e.relatedTarget;
      if (!toEl || !item.contains(toEl)) {
        item.classList.remove('hovered');
      }
    });
  }

  function init() {
    const grid = document.getElementById('tv-grid');
    attachGridHoverHandlers(grid);

    // Observa mudanças no grid (pois seu Painel.js redesenha a grade com frequência)
    const mo = new MutationObserver(() => {
      attachGridHoverHandlers(document.getElementById('tv-grid'));
    });
    if (grid) mo.observe(grid, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
