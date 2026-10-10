// Daftar transaksi yang bisa diubah langsung (klik dua kali / ikon pensil) dan dihapus (dengan Urungkan).
// Dipakai di Dashboard dan halaman Transaksi.
const Ledger = {
  head: `<div class="ledger-row head"><div>Tanggal</div><div>Kategori / Catatan</div><div>Jenis</div><div style="text-align:right">Jumlah</div><div></div></div>`,

  rowHTML(t) {
    const inc = t.type === 'income';
    return `<div class="ledger-row" data-id="${esc(t.id)}" title="Klik dua kali untuk mengubah">
      <div>${esc(fmtDate(t.date))}</div>
      <div><b>${esc(t.category)}</b>${t.note ? ` <span class="note">— ${esc(t.note)}</span>` : ''}</div>
      <div class="tag-cell"><span class="tag ${t.type}">${inc ? 'Pemasukan' : 'Pengeluaran'}</span></div>
      <div class="amt ${t.type}">${inc ? '+' : '-'}${rupiah(t.amount)}</div>
      <div class="row-actions">
        <button class="icon-btn" data-act="edit" title="Ubah" aria-label="Ubah">✎</button>
        <button class="icon-btn danger" data-act="del" title="Hapus" aria-label="Hapus">✕</button>
      </div></div>`;
  },

  editHTML(t) {
    return `<form class="ledger-row editing" data-id="${esc(t.id)}">
      <input type="date" name="date" value="${esc(dateOnly(t.date))}" required aria-label="Tanggal">
      <div class="edit-mid">
        <input type="text" name="category" value="${esc(t.category)}" required placeholder="Kategori" aria-label="Kategori">
        <input type="text" name="note" value="${esc(t.note || '')}" placeholder="Catatan" aria-label="Catatan">
      </div>
      <select name="type" aria-label="Jenis"><option value="income"${t.type === 'income' ? ' selected' : ''}>Pemasukan</option><option value="expense"${t.type === 'expense' ? ' selected' : ''}>Pengeluaran</option></select>
      <input type="number" name="amount" value="${esc(t.amount)}" min="0" required aria-label="Jumlah">
      <div class="row-actions">
        <button class="icon-btn ok" type="submit" title="Simpan (Enter)" aria-label="Simpan">✓</button>
        <button class="icon-btn" type="button" data-act="cancel" title="Batal (Esc)" aria-label="Batal">↶</button>
      </div></form>`;
  },

  // rows: array transaksi (sudah difilter/diurutkan). onChange: dipanggil setelah data berubah.
  render(el, rows, onChange, emptyMsg) {
    el._rows = rows; el._onChange = onChange;
    el.innerHTML = rows.length ? this.head + rows.map(t => this.rowHTML(t)).join('') : `<div class="empty">${esc(emptyMsg || 'Belum ada transaksi.')}</div>`;
    if (!el._wired) { el._wired = true; this._wire(el); }
  },

  _find(el, id) { return (el._rows || []).find(t => String(t.id) === String(id)); },

  _wire(el) {
    const startEdit = row => {
      const t = this._find(el, row.dataset.id); if (!t) return;
      row.outerHTML = this.editHTML(t);
      const f = el.querySelector(`form[data-id="${CSS.escape(String(t.id))}"]`);
      f && f.elements.category.focus();
    };
    const cancel = id => {
      const f = el.querySelector(`form[data-id="${CSS.escape(String(id))}"]`), t = this._find(el, id);
      if (f && t) f.outerHTML = this.rowHTML(t);
    };

    el.addEventListener('dblclick', e => {
      const row = e.target.closest('.ledger-row:not(.head):not(.editing)');
      if (row && !e.target.closest('button')) startEdit(row);
    });

    el.addEventListener('click', async e => {
      const b = e.target.closest('button[data-act]'); if (!b) return;
      const row = b.closest('[data-id]'), id = row.dataset.id, t = this._find(el, id);
      if (b.dataset.act === 'edit') return startEdit(row);
      if (b.dataset.act === 'cancel') return cancel(id);
      if (b.dataset.act === 'del' && t) {
        row.classList.add('leaving');
        await new Promise(r => setTimeout(r, reduceMotion() ? 0 : 280));
        try {
          await Store.deleteTransaction(id);
          Sound.pop();
          toast(`"${t.category}" dihapus`, {
            action: 'Urungkan',
            onAction: async () => {
              const { id: _drop, ...copy } = t;
              try { await Store.addTransaction(copy); toast('Transaksi dikembalikan'); } catch (err) { toast('Gagal mengembalikan: ' + err.message, { error: true }); }
              el._onChange();
            }
          });
        } catch (err) { row.classList.remove('leaving'); toast('Gagal menghapus: ' + err.message, { error: true }); return; }
        el._onChange();
      }
    });

    el.addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target, id = f.dataset.id;
      const E = f.elements;
      const tx = { date: E.date.value, type: E.type.value, category: E.category.value.trim(), amount: E.amount.value, note: E.note.value.trim() };
      f.querySelector('.ok').disabled = true;
      try {
        await Store.updateTransaction(id, tx);
        Sound.coin(); toast('Perubahan disimpan');
        el._flash = id;
        await el._onChange();
        const row = el.querySelector(`.ledger-row[data-id="${CSS.escape(String(id))}"]`);
        if (row) row.classList.add('fresh');
      } catch (err) { f.querySelector('.ok').disabled = false; toast('Gagal menyimpan: ' + err.message, { error: true }); }
    });

    el.addEventListener('keydown', e => {
      if (e.key === 'Escape') { const f = e.target.closest('form.editing'); if (f) cancel(f.dataset.id); }
    });
  }
};
