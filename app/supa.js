/* VillaTrack live mode: connects the pilot to Supabase (sign-in, shared data, photos). */
(function () {
  var CFG = window.VT_CONFIG || {};
  var ready = typeof window.supabase !== 'undefined' && /^https:\/\//.test(CFG.supabaseUrl || '') && CFG.supabaseAnonKey && CFG.supabaseAnonKey.indexOf('YOUR_') !== 0;
  var sb = ready ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey) : null;
  var store = {}, listeners = [], me = null, caps = null, resolveCaps, capsP = new Promise(function (r) { resolveCaps = r; });

  window.__vtBlob = function (id) { return sb ? sb.storage.from('photos').getPublicUrl(String(id)).data.publicUrl : ''; };
  window.claude = Object.freeze({ use: function (n) { return capsP.then(function (c) { return c ? (c[n] || null) : null; }); } });

  // ---------- local mirror of the shared table ----------
  function rid() { return Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-6); }
  function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function col(c) { return store[c] || (store[c] = {}); }
  function notify(c) { listeners.slice().forEach(function (l) { if (l.col === c) l.fire(); }); }
  function err(code, msg) { var e = new Error(msg || code); e.code = code; return e; }
  function mapErr(e) {
    if (!e) return err('unknown');
    if (e.code === '42501' || /row-level security|permission/i.test(e.message || '')) return err('invalid_argument', 'Not allowed');
    if (/fetch|network/i.test(e.message || '')) return err('unavailable', e.message);
    return err(e.code || 'unknown', e.message);
  }
  function put(c, id, data) {
    var before = (store[c] || {})[id];
    col(c)[id] = clone(data); notify(c);
    return sb.from('vt_docs').upsert({ col: c, id: id, data: data, updated_by: me.id }).then(function (r) {
      if (r.error) { if (before === undefined) delete col(c)[id]; else col(c)[id] = before; notify(c); throw mapErr(r.error); }
    });
  }
  function docSnap(c, id) { var d = (store[c] || {})[id]; return { id: id, exists: d !== undefined, data: function () { return clone(d); } }; }
  function DocRef(c, id) {
    return {
      id: id, path: c + '/' + id,
      get: function () { return Promise.resolve(docSnap(c, id)); },
      set: function (data, opts) { var cur = col(c)[id]; return put(c, id, (opts && opts.merge && cur) ? Object.assign({}, cur, clone(data)) : clone(data)); },
      update: function (data) {
        if (col(c)[id] === undefined) return Promise.reject(err('not_found', 'No document to update'));
        var d = clone(col(c)[id]);
        Object.keys(data).forEach(function (k) {
          var v = data[k], parts = k.split('.'), o = d;
          for (var i = 0; i < parts.length - 1; i++) { if (typeof o[parts[i]] !== 'object' || o[parts[i]] === null) o[parts[i]] = {}; o = o[parts[i]]; }
          var last = parts[parts.length - 1];
          if (v && typeof v === 'object' && v.__delete__ === true) delete o[last]; else o[last] = clone(v);
        });
        return put(c, id, d);
      },
      delete: function () {
        var before = col(c)[id]; delete col(c)[id]; notify(c);
        return sb.from('vt_docs').delete().eq('col', c).eq('id', id).then(function (r) { if (r.error) { col(c)[id] = before; notify(c); throw mapErr(r.error); } });
      },
      onSnapshot: function (cb) { var l = { col: c, fire: function () { try { cb(docSnap(c, id)); } catch (e) { console.error(e); } } }; listeners.push(l); setTimeout(l.fire, 0); return function () { listeners = listeners.filter(function (x) { return x !== l; }); }; }
    };
  }
  function cmp(a, b) { if (a === b) return 0; if (a === undefined || a === null) return -1; if (b === undefined || b === null) return 1; return a < b ? -1 : 1; }
  function test(v, op, x) {
    switch (op) { case '==': case 'eq': return v === x; case '!=': case 'ne': return v !== x; case '<': case 'lt': return v < x; case '<=': case 'lte': return v <= x; case '>': case 'gt': return v > x; case '>=': case 'gte': return v >= x; case 'in': return (x || []).indexOf(v) >= 0; case 'not-in': return (x || []).indexOf(v) < 0; case 'array-contains': return Array.isArray(v) && v.indexOf(x) >= 0; }
    return true;
  }
  function Query(c, q) {
    q = q || { where: [], order: [], lim: null };
    function run() {
      var m = store[c] || {};
      var rows = Object.keys(m).map(function (id) { return { id: id, d: m[id] }; });
      q.where.forEach(function (w) { rows = rows.filter(function (r) { return test(r.d[w[0]], w[1], w[2]); }); });
      if (q.order.length) rows.sort(function (a, b) { for (var i = 0; i < q.order.length; i++) { var o = q.order[i], r = cmp(a.d[o[0]], b.d[o[0]]); if (r) return o[1] === 'desc' ? -r : r; } return 0; });
      if (q.lim != null) rows = rows.slice(0, q.lim);
      var docs = rows.map(function (r) { return { id: r.id, exists: true, data: function () { return clone(r.d); } }; });
      return { docs: docs, size: docs.length, empty: !docs.length, forEach: function (f) { docs.forEach(f); } };
    }
    function next(ch) { return Query(c, { where: q.where.concat(ch.where || []), order: q.order.concat(ch.order || []), lim: ch.lim != null ? ch.lim : q.lim }); }
    return {
      where: function (f, op, v) { return next({ where: [[f, op, v]] }); },
      orderBy: function (f, dir) { return next({ order: [[f, dir || 'asc']] }); },
      limit: function (n) { return next({ lim: n }); },
      get: function () { return Promise.resolve(run()); },
      onSnapshot: function (cb) { var l = { col: c, fire: function () { try { cb(run()); } catch (e) { console.error(e); } } }; listeners.push(l); setTimeout(l.fire, 0); return function () { listeners = listeners.filter(function (x) { return x !== l; }); }; },
      doc: function (id) { return DocRef(c, id || rid()); },
      add: function (data) { var id = rid(); return put(c, id, clone(data)).then(function () { return DocRef(c, id); }); }
    };
  }

  async function loadAll() {
    var from = 0, size = 1000;
    for (;;) {
      var r = await sb.from('vt_docs').select('col,id,data').range(from, from + size - 1);
      if (r.error) throw r.error;
      r.data.forEach(function (row) { col(row.col)[row.id] = row.data; });
      if (r.data.length < size) break;
      from += size;
    }
    sb.channel('vt_docs').on('postgres_changes', { event: '*', schema: 'public', table: 'vt_docs' }, function (p) {
      if (p.eventType === 'DELETE') { var o = p.old || {}; if (o.col && store[o.col]) { delete store[o.col][o.id]; notify(o.col); } }
      else { var n = p.new; col(n.col)[n.id] = n.data; notify(n.col); }
    }).subscribe();
  }

  var names = {};
  async function profiles(ids) {
    var need = ids.filter(function (i) { return !names[i]; });
    if (need.length) {
      var r = await sb.from('vt_profiles').select('id,name,email').in('id', need);
      (r.data || []).forEach(function (p) { names[p.id] = p.name || p.email || 'Team member'; });
    }
    var o = {}; ids.forEach(function (i) { o[i] = { id: i, name: names[i] || '', guest: false }; }); return o;
  }

  async function start(session) {
    var u = session.user;
    var name = (u.user_metadata && u.user_metadata.name) || (u.email || '').split('@')[0];
    await sb.from('vt_profiles').upsert({ id: u.id, email: u.email, name: name });
    var adm = await sb.rpc('vt_is_admin');
    me = { id: u.id, name: name, email: u.email, canEdit: !!adm.data, guest: false };
    names[u.id] = name;
    await loadAll();
    var db = Object.freeze({ collection: function (c) { return Query(c); }, doc: function (path) { var p = path.split('/'); return DocRef(p.slice(0, -1).join('/'), p[p.length - 1]); } });
    var user = Object.freeze({
      me: function () { return Promise.resolve(Object.assign({}, me)); }, id: function () { return Promise.resolve(me.id); },
      isOwner: function () { return me.canEdit; }, canEdit: function () { return me.canEdit; }, can: function () { return true; },
      profiles: profiles,
      search: async function (q) {
        var s = sb.from('vt_profiles').select('id,name,email').limit(20);
        if (q) s = s.or('email.ilike.%' + q.replace(/[%,()]/g, '') + '%,name.ilike.%' + q.replace(/[%,()]/g, '') + '%');
        var r = await s; return (r.data || []).filter(function (p) { return p.id !== me.id; }).map(function (p) { names[p.id] = p.name || p.email; return { id: p.id, name: (p.name || '') + (p.email ? ' · ' + p.email : '') }; });
      }
    });
    var assets = Object.freeze({
      upload: async function (file) {
        if (file.size > 20 * 1024 * 1024) throw err('too_large');
        if (!/^image\/|^application\/pdf$/.test(file.type)) throw err('unsupported_type');
        var id = rid() + rid();
        var r = await sb.storage.from('photos').upload(id, file, { contentType: file.type, upsert: false });
        if (r.error) throw mapErr(r.error);
        return { id: id, url: window.__vtBlob(id), sizeBytes: file.size, contentType: file.type };
      },
      list: function () { return Promise.resolve({ assets: [], usage: {} }); },
      delete: function (id) { return sb.storage.from('photos').remove([id]); }
    });
    showBar();
    resolveCaps({ db: db, user: user, assets: assets });
  }

  // ---------- sign-in screen ----------
  function gate(msg) {
    var g = document.getElementById('vt-gate');
    g.hidden = false;
    if (msg) { var s = document.getElementById('vt-gate-msg'); s.textContent = msg; }
  }
  function showBar() {
    var b = document.getElementById('vt-userbar');
    b.querySelector('span').textContent = 'Signed in as ' + me.email;
    b.hidden = false;
  }
  document.addEventListener('DOMContentLoaded', function () {
    var g = document.getElementById('vt-gate');
    if (!sb) { gate(); document.getElementById('vt-gate-form').hidden = true; document.getElementById('vt-gate-msg').textContent = 'This app isn’t connected to its database yet. Add the Supabase URL and anon key in config.js.'; resolveCaps(null); return; }
    document.getElementById('vt-gate-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var email = document.getElementById('vt-email').value.trim(), btn = document.getElementById('vt-send');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { gate('Enter a valid email address.'); return; }
      btn.disabled = true; gate('Sending…');
      var r = await sb.auth.signInWithOtp({ email: email, options: { emailRedirectTo: location.origin + location.pathname } });
      btn.disabled = false;
      gate(r.error ? 'That didn’t send: ' + r.error.message : 'Check your email for a sign-in link from VillaTrack. Open it on this device.');
    });
    document.getElementById('vt-signout').addEventListener('click', async function () { await sb.auth.signOut(); location.reload(); });
    var started = false;
    sb.auth.onAuthStateChange(function (ev, session) {
      if (session && !started) { started = true; g.hidden = true; start(session).catch(function (e) { console.error(e); started = false; gate('Couldn’t load the project: ' + (e.message || 'unknown error') + '. Reload to try again.'); }); }
    });
    sb.auth.getSession().then(function (r) { if (!r.data.session) gate(); });
  });
})();
