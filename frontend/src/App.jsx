import React, { useEffect, useMemo, useState } from 'react';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
// These are the only role contexts evidenced in the supplied UI and backend behavior.
const ROLES = ['Attendee', 'Organizer'];
const get = (obj, ...keys) => keys.map((key) => obj?.[key]).find((value) => value != null && value !== '') ?? null;
const eventId = (event) => get(event, 'id', 'event_id');
const title = (event) => get(event, 'title', 'name', 'event_name') || 'Untitled event';
const date = (event) => get(event, 'date', 'event_date', 'start_date', 'starts_at', 'start_time');
const place = (event) => get(event, 'location', 'venue', 'place') || 'Campus';
const category = (event) => get(event, 'category', 'event_type', 'type') || 'Campus';
function getDatabaseUserId() {
  let id = localStorage.getItem('campuspulse_user_id') || '';
  if (!id) { id = window.prompt('Enter your database user ID (UUID) to use registrations:')?.trim() || ''; if (id) localStorage.setItem('campuspulse_user_id', id); }
  return id;
}
const formatDate = (value) => {
  if (!value) return 'Date to be announced';
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? String(value) : parsed.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

async function api(path, options = {}) {
  let response;
  try { response = await fetch(`${API_BASE}${path}`, { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } }); }
  catch { throw new Error(`Cannot reach ${API_BASE}. Start the Flask backend and check VITE_API_BASE_URL.`); }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || `Request failed (${response.status}).`);
  return data;
}

function App() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [role, setRole] = useState(() => localStorage.getItem('campuspulse_role') || ROLES[0]);
  const [page, setPage] = useState('events');
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [toast, setToast] = useState('');
  const [registrations, setRegistrations] = useState(null);
  const [attendeeEventId, setAttendeeEventId] = useState('');
  const [attendees, setAttendees] = useState(null);
  const [busy, setBusy] = useState(false);
  const notify = (message) => { setToast(message); window.setTimeout(() => setToast(''), 3600); };

  const refresh = async () => {
    setLoading(true); setLoadError('');
    try { const rows = await api('/api/events'); setEvents(Array.isArray(rows) ? rows : []); }
    catch (error) { setLoadError(error.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);
  const categories = useMemo(() => ['all', ...new Set(events.map(category))], [events]);
  const visibleEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((event) => (activeCategory === 'all' || category(event) === activeCategory) && (!q || [title(event), category(event), place(event), get(event, 'speaker', 'description', 'organizer') || ''].join(' ').toLowerCase().includes(q)));
  }, [events, query, activeCategory]);
  const openPage = async (target) => {
    setPage(target); setSelected(null);
    if (target === 'registrations') {
      setRegistrations(null);
      const userId = getDatabaseUserId();
      if (!userId) { setRegistrations({ error: 'A database user ID is needed to find your registrations.' }); return; }
      try { const rows = await api(`/api/me/registrations?user_id=${encodeURIComponent(userId)}`); setRegistrations(Array.isArray(rows) ? rows : []); }
      catch (error) { setRegistrations({ error: error.message }); }
    }
  };
  const register = async (event) => {
    const userId = getDatabaseUserId();
    if (!userId) return;
    setBusy(true);
    try { await api('/api/registrations', { method: 'POST', body: JSON.stringify({ event_id: eventId(event), user_id: userId }) }); notify('You’re registered for this event.'); }
    catch (error) { notify(error.message); }
    finally { setBusy(false); }
  };
  const loadAttendees = async () => {
    if (!attendeeEventId) { notify('Choose an event first.'); return; }
    setAttendees(null);
    try { const rows = await api(`/api/events/${encodeURIComponent(attendeeEventId)}/registrations`); setAttendees(Array.isArray(rows) ? rows : []); }
    catch (error) { setAttendees({ error: error.message }); }
  };
  const changeRole = (value) => { setRole(value); localStorage.setItem('campuspulse_role', value); if (value === 'Organizer') openPage('organizer'); else openPage('events'); };

  return <>
    <header className="topbar">
      <a className="brand" href="#events" onClick={(e) => { e.preventDefault(); openPage('events'); }}><span className="brand-mark">✳</span><span>Campus<span className="brand-light">Pulse</span></span></a>
      <nav className="main-nav" aria-label="Main navigation">
        <button className={`nav-link ${page === 'events' || page === 'detail' ? 'active' : ''}`} onClick={() => openPage('events')}>Browse events</button>
        <button className={`nav-link ${page === 'registrations' ? 'active' : ''}`} onClick={() => openPage('registrations')}>My registrations</button>
        {role === 'Organizer' && <button className={`nav-link ${page === 'organizer' ? 'active' : ''}`} onClick={() => openPage('organizer')}>Organizer</button>}
      </nav>
      <div className="top-actions"><label className="role-wrap"><span className="role-dot"/><select aria-label="Select role" value={role} onChange={(e) => changeRole(e.target.value)}>{ROLES.map((item) => <option key={item}>{item}</option>)}</select></label><span className="avatar" title="Campus member">C</span></div>
    </header>

    {page === 'events' && <main>
      <section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="pulse"/> YOUR CAMPUS, IN THE KNOW</div><h1>Find your <span>next thing.</span></h1><p>Discover the talks, workshops, and moments happening around campus.</p><div className="hero-search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events, speakers, locations…" aria-label="Search events"/><button onClick={() => setQuery('')} title="Clear search">×</button></div></div><div className="hero-art"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-sticker">✦</div><div className="art-card"><span className="art-date">THU · 06:30 PM</span><strong>Ideas<br/>in motion.</strong><span className="art-foot">MEET YOUR PEOPLE ↗</span></div><span className="art-star star-one">✳</span><span className="art-star star-two">✦</span></div></section>
      <section className="content-wrap"><div className="section-heading"><div><span className="eyebrow muted">WHAT’S HAPPENING</span><h2>Events around you</h2></div><button className="subtle-button" onClick={refresh}>↻ &nbsp;Refresh</button></div><div className="toolbar"><div className="chips">{categories.map((item) => <button key={item} className={`chip ${activeCategory === item ? 'selected' : ''}`} onClick={() => setActiveCategory(item)}>{item === 'all' ? 'All events' : item}</button>)}</div><span className="count-label">{visibleEvents.length} {visibleEvents.length === 1 ? 'event' : 'events'}</span></div>
        <div className="event-grid">{loading ? <div className="loading-card">Loading campus events…</div> : loadError ? <div className="loading-card"><strong>Could not load events.</strong><br/><br/>{loadError}<br/><br/><button className="subtle-button" onClick={refresh}>Try again</button></div> : visibleEvents.length ? visibleEvents.map((event, index) => <article className="event-card" key={eventId(event) ?? index} onClick={() => { setSelected(event); setPage('detail'); }} tabIndex="0" onKeyDown={(e) => e.key === 'Enter' && (setSelected(event), setPage('detail'))}><div className={`event-cover cover-${index % 6}`}><span className="cover-symbol">{['✳','◉','✦','⌁','✣','◌'][index % 6]}</span><span className="category-tag">{category(event)}</span></div><div className="event-body"><h3>{title(event)}</h3><div className="event-meta"><span>◷ {formatDate(date(event))}</span><span>⌖ {place(event)}</span></div><div className="event-foot"><span>{get(event, 'organizer', 'organizer_name', 'host') || 'Campus community'}</span><button className="text-link">Details&nbsp; ↗</button></div></div></article>) : <div className="empty-state"><span>✳</span><h3>No events found</h3><p>Try another search or category.</p></div>}</div>
      </section>
    </main>}

    {page === 'detail' && selected && <main className="content-wrap detail-wrap"><button className="back-link" onClick={() => setPage('events')}>← &nbsp;All events</button><div className="detail-content"><div className={`detail-banner cover-${Math.max(0, events.indexOf(selected)) % 6}`}><span className="category-tag">{category(selected)}</span></div><div className="detail-info"><div><div className="eyebrow muted">EVENT DETAILS</div><h1>{title(selected)}</h1><div className="event-meta"><span>◷ {formatDate(date(selected))}</span><span>⌖ {place(selected)}</span></div><p className="detail-description">{get(selected, 'description', 'details', 'summary') || 'Join your campus community for this event. Check back for more details.'}</p><p className="detail-description">Hosted by <strong>{get(selected, 'organizer', 'organizer_name', 'host') || 'Campus community'}</strong></p></div><aside className="detail-side"><div className="eyebrow muted">SAVE YOUR SPOT</div><p>Ready to join?</p><button className="primary-button" disabled={busy} onClick={() => register(selected)}>{busy ? 'Registering…' : <>Register for event <span>→</span></>}</button><p className="small-note">Registration uses your database user ID; no sign-in token is sent.</p></aside></div></div></main>}

    {page === 'registrations' && <main className="content-wrap inner-page"><div className="eyebrow muted">YOUR CAMPUS PLANS</div><h1 className="page-title">My registrations<span>.</span></h1><p className="page-intro">The events you’ve signed up for, all in one place.</p>{registrations === null ? <div className="loading-card">Loading your registrations…</div> : registrations.error ? <div className="empty-state"><span>↗</span><h3>Could not load registrations</h3><p>{registrations.error}</p></div> : registrations.length === 0 ? <div className="empty-state"><span>✳</span><h3>Your list is ready for an event</h3><p>Browse campus events and register to see them here.</p></div> : <div className="registration-list">{registrations.map((row, index) => { const event = events.find((item) => String(eventId(item)) === String(get(row, 'event_id'))); return <article className="registration-item" key={get(row, 'id') || index}><div><h3>{event ? title(event) : `Event ${get(row, 'event_id')}`}</h3><p>{event ? `${formatDate(date(event))} · ${place(event)}` : `Registered ${formatDate(get(row, 'created_at', 'registered_at'))}`}</p></div><span className="status-badge">REGISTERED</span></article>; })}</div>}</main>}

    {page === 'organizer' && <main className="content-wrap inner-page"><div className="eyebrow muted">FOR EVENT ORGANIZERS</div><h1 className="page-title">Attendee <span>registry.</span></h1><p className="page-intro">Choose an event to view its registrations.</p><div className="organizer-toolbar"><label htmlFor="organizerEvent">Your event</label><select id="organizerEvent" value={attendeeEventId} onChange={(e) => { setAttendeeEventId(e.target.value); setAttendees(null); }}><option value="">Choose an event…</option>{events.map((event, index) => <option key={eventId(event) ?? index} value={eventId(event)}>{title(event)}</option>)}</select><button className="primary-button" onClick={loadAttendees}>View attendees <span>→</span></button></div><div className="attendee-panel">{attendees === null ? <div className="empty-state"><span>↗</span><h3>Select an event</h3><p>Attendee details will appear here.</p></div> : attendees.error ? <div className="empty-state"><span>↗</span><h3>Could not load attendees</h3><p>{attendees.error}</p></div> : attendees.length === 0 ? <div className="empty-state"><span>✳</span><h3>No registrations yet</h3><p>Attendees will appear here when they register.</p></div> : <table className="attendee-table"><thead><tr><th>Registration</th><th>Attendee user ID</th><th>Registered</th></tr></thead><tbody>{attendees.map((row, index) => <tr key={get(row, 'id') || index}><td>{index + 1}</td><td>{get(row, 'user_id', 'attendee_id') || '—'}</td><td>{formatDate(get(row, 'created_at', 'registered_at'))}</td></tr>)}</tbody></table>}</div></main>}

    <footer><a className="brand footer-brand" href="#events" onClick={(e) => { e.preventDefault(); openPage('events'); }}><span className="brand-mark">✳</span><span>Campus<span className="brand-light">Pulse</span></span></a><span>Made for campus life.</span><small className="api-label">API: {API_BASE}</small></footer>
    {toast && <div className="toast show" role="status" aria-live="polite">{toast}</div>}
  </>;
}

export default App;


