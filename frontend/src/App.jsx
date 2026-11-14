import React, { useEffect, useMemo, useState } from 'react';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
// The supplied Stitch screens show Attendee and Organizer; Admin is added as a read-only dashboard context.
const ROLES = ['Attendee', 'Organizer', 'Admin'];
const PROVIDED_USERS = [
  { id: '1edc4326-21c3-4cd9-b884-ef4b1bbe3c1c', email: 'organizer@gmail.com', role: 'organizer' },
  { id: 'dfa5b63c-efca-4e18-98b9-5f8f750e4f65', email: 'rahul@gmail.com', role: 'student' },
  { id: '2b333acd-b68c-43ad-96a2-408cb0b2cd65', email: 'priya@gmail.com', role: 'student' },
  { id: '9458d485-26d4-4589-a460-330565a92a4b', email: 'amit@gmail.com', role: 'student' },
  { id: 'bd24502a-4a7e-4979-9817-e94e48dcbd5b', email: 'neha@gmail.com', role: 'student' },
  { id: 'b343a7df-7755-4eaa-adad-f94260745e80', email: 'rohit@gmail.com', role: 'student' },
  { id: '57a50cf9-0a80-499f-8590-8d99a268aa24', email: 'sneha@gmail.com', role: 'student' },
  { id: '658cb2bc-b89d-40d8-a467-2477fd059d47', email: 'vikram@gmail.com', role: 'student' },
  { id: 'ddd131f2-6992-496f-be0f-c11ccea0dbb9', email: 'anjali@gmail.com', role: 'student' },
];
const get = (obj, ...keys) => keys.map((key) => obj?.[key]).find((value) => value != null && value !== '') ?? null;
const eventId = (event) => get(event, 'id', 'event_id');
const title = (event) => get(event, 'title', 'name', 'event_name') || 'Untitled event';
const date = (event) => get(event, 'date', 'event_date', 'start_date', 'starts_at', 'start_time');
const place = (event) => get(event, 'location', 'venue', 'place') || 'Campus';
const category = (event) => get(event, 'category', 'event_type', 'type') || 'Campus';
const eventStatus = (event) => get(event, 'status') || 'upcoming';
const capacityLabel = (event) => { const capacity = get(event, 'capacity'); if (capacity == null) return null; const explicitRemaining = get(event, 'remaining_capacity'); const registered = Number(get(event, 'registered_count', 'registration_count') || 0); const remaining = explicitRemaining == null ? Math.max(Number(capacity) - registered, 0) : Number(explicitRemaining); return `${remaining} / ${capacity} spots left`; };
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
  const [students, setStudents] = useState([]);
  const [organizers, setOrganizers] = useState([]);
  const [registeredEventIds, setRegisteredEventIds] = useState([]);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventCapacity, setNewEventCapacity] = useState('');
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState(() => localStorage.getItem('campuspulse_student_id') || '');
  const [selectedOrganizerId, setSelectedOrganizerId] = useState(() => localStorage.getItem('campuspulse_organizer_id') || '');
  const [page, setPage] = useState('events');
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [toast, setToast] = useState('');
  const [registrations, setRegistrations] = useState(null);
  const [attendeeEventId, setAttendeeEventId] = useState('');
  const [attendees, setAttendees] = useState(null);
  const [busy, setBusy] = useState(false);
  const activeUserId = role === 'Organizer' ? selectedOrganizerId : selectedStudentId;
  const notify = (message) => { setToast(message); window.setTimeout(() => setToast(''), 3600); };

  const refresh = async () => {
    setLoading(true); setLoadError('');
    try {
      const eventRows = await api('/api/events');
      const [studentResult, organizerResult] = await Promise.allSettled([
        api('/api/users?role=student'), api('/api/users?role=organizer'),
      ]);
      const nextEvents = Array.isArray(eventRows) ? eventRows : [];
      const nextStudents = studentResult.status === 'fulfilled' && Array.isArray(studentResult.value) ? studentResult.value : PROVIDED_USERS.filter((user) => user.role === 'student');
      const nextOrganizers = organizerResult.status === 'fulfilled' && Array.isArray(organizerResult.value) ? organizerResult.value : PROVIDED_USERS.filter((user) => user.role === 'organizer');
      setEvents(nextEvents); setStudents(nextStudents); setOrganizers(nextOrganizers);
      const savedStudent = localStorage.getItem('campuspulse_student_id') || '';
      const initialStudent = nextStudents.find((user) => String(user.id) === savedStudent)?.id ?? nextStudents[0]?.id ?? '';
      if (initialStudent) { setSelectedStudentId(String(initialStudent)); localStorage.setItem('campuspulse_student_id', String(initialStudent)); }
      const savedOrganizer = localStorage.getItem('campuspulse_organizer_id') || '';
      const initialOrganizer = nextOrganizers.find((user) => String(user.id) === savedOrganizer)?.id ?? nextOrganizers[0]?.id ?? '';
      if (initialOrganizer) { setSelectedOrganizerId(String(initialOrganizer)); localStorage.setItem('campuspulse_organizer_id', String(initialOrganizer)); }
    } catch (error) { setLoadError(error.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    if (!activeUserId) { setRegisteredEventIds([]); return; }
    api(`/api/me/registrations?user_id=${encodeURIComponent(activeUserId)}`)
      .then((rows) => setRegisteredEventIds(Array.isArray(rows) ? rows.map((row) => String(row.event_id)) : []))
      .catch(() => setRegisteredEventIds([]));
  }, [activeUserId]);
  const categories = useMemo(() => ['all', ...new Set(events.map(category))], [events]);
  const totalRegistrations = events.reduce((sum, event) => sum + Number(get(event, 'registered_count', 'registration_count') || 0), 0);
  const totalCapacity = events.reduce((sum, event) => sum + Number(get(event, 'capacity') || 0), 0);
  const availableSpots = events.reduce((sum, event) => sum + Number(get(event, 'remaining_capacity') ?? Math.max(Number(get(event, 'capacity') || 0) - Number(get(event, 'registered_count') || 0), 0)), 0);
  const visibleEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((event) => (activeCategory === 'all' || category(event) === activeCategory) && (!q || [title(event), category(event), place(event), get(event, 'speaker', 'description', 'organizer') || ''].join(' ').toLowerCase().includes(q)));
  }, [events, query, activeCategory]);
  const openPage = async (target) => {
    setPage(target); setSelected(null);
    if (target === 'registrations') {
      setRegistrations(null);
      const userId = activeUserId;
      if (!userId) { setRegistrations({ error: role === 'Organizer' ? 'Choose an organizer from the dropdown first.' : 'No student users were found in the users table.' }); return; }
      try { const rows = await api(`/api/me/registrations?user_id=${encodeURIComponent(userId)}`); setRegistrations(Array.isArray(rows) ? rows : []); }
      catch (error) { setRegistrations({ error: error.message }); }
    }
  };
  const isOwnEvent = (event) => role === 'Organizer' && String(selectedOrganizerId) === String(get(event, 'organizer_id', 'owner_id'));
  const register = async (event, userId = activeUserId) => {
    if (!userId) { notify(role === 'Organizer' ? 'Choose an organizer from the dropdown first.' : 'No student is selected. Check the users table and refresh.'); return; }
    if (String(userId) === String(get(event, 'organizer_id', 'owner_id'))) { notify('You cannot register for an event you organized.'); return; }
    if (registeredEventIds.includes(String(eventId(event)))) { notify('This user is already registered for this event.'); return; }
    setBusy(true);
    try { const result = await api('/api/registrations', { method: 'POST', body: JSON.stringify({ event_id: eventId(event), user_id: userId }) }); setRegisteredEventIds((current) => [...new Set([...current, String(eventId(event))])]); setEvents((current) => current.map((item) => String(eventId(item)) === String(eventId(event)) ? { ...item, registered_count: result.registered_count, remaining_capacity: result.remaining_capacity } : item)); setSelected((current) => current && String(eventId(current)) === String(eventId(event)) ? { ...current, registered_count: result.registered_count, remaining_capacity: result.remaining_capacity } : current); notify(result.remaining_capacity == null ? 'You’re registered for this event.' : `You’re registered. ${result.remaining_capacity} spots left.`); }
    catch (error) { if (/already registered/i.test(error.message)) setRegisteredEventIds((current) => [...new Set([...current, String(eventId(event))])]); notify(error.message); }
    finally { setBusy(false); }
  };
  const loadAttendees = async (eventKey = attendeeEventId) => {
    if (!eventKey) { notify('Choose an event first.'); return; }
    setAttendees(null);
    try { const rows = await api(`/api/events/${encodeURIComponent(eventKey)}/registrations`); setAttendees(Array.isArray(rows) ? rows : []); }
    catch (error) { setAttendees({ error: error.message }); }
  };
  const createEvent = async (event) => {
    event.preventDefault();
    if (!selectedOrganizerId) { notify('Select an organizer from the users list first.'); return; }
    setCreatingEvent(true);
    try {
      const created = await api('/api/events', { method: 'POST', body: JSON.stringify({ title: newEventTitle.trim(), capacity: Number(newEventCapacity), organizer_id: selectedOrganizerId, status: 'upcoming' }) });
      const complete = { ...created, registered_count: 0, remaining_capacity: Number(created.capacity ?? newEventCapacity) };
      setEvents((current) => [complete, ...current]);
      setNewEventTitle(''); setNewEventCapacity('');
      setAttendeeEventId(String(eventId(complete))); setAttendees([]);
      notify('Event created and saved to the database.');
    } catch (error) { notify(error.message); }
    finally { setCreatingEvent(false); }
  };
  const selectStudent = (value) => { setSelectedStudentId(value); setRegisteredEventIds([]); if (value) localStorage.setItem('campuspulse_student_id', value); if (page === 'registrations' && value) { setRegistrations(null); api(`/api/me/registrations?user_id=${encodeURIComponent(value)}`).then((rows) => setRegistrations(Array.isArray(rows) ? rows : [])).catch((error) => setRegistrations({ error: error.message })); } };
  const selectOrganizer = (value) => { setSelectedOrganizerId(value); if (value) localStorage.setItem('campuspulse_organizer_id', value); setAttendeeEventId(''); setAttendees(null); };
  const organizerEvents = selectedOrganizerId ? events.filter((event) => String(get(event, 'organizer_id', 'owner_id') || '') === selectedOrganizerId) : [];
  const changeRole = (value) => { setRole(value); localStorage.setItem('campuspulse_role', value); if (value === 'Organizer') openPage('organizer'); else if (value === 'Admin') openPage('admin'); else openPage('events'); };

  return <>
    <header className="topbar">
      <a className="brand" href="#events" onClick={(e) => { e.preventDefault(); openPage('events'); }}><span className="brand-mark">✳</span><span>Campus<span className="brand-light">Pulse</span></span></a>
      <nav className="main-nav" aria-label="Main navigation">
        <button className={`nav-link ${page === 'events' || page === 'detail' ? 'active' : ''}`} onClick={() => openPage('events')}>Browse events</button>
        <button className={`nav-link ${page === 'registrations' ? 'active' : ''}`} onClick={() => openPage('registrations')}>My registrations</button>
        {role === 'Organizer' && <button className={`nav-link ${page === 'organizer' ? 'active' : ''}`} onClick={() => openPage('organizer')}>Organizer</button>}
        {role === 'Admin' && <button className={`nav-link ${page === 'admin' ? 'active' : ''}`} onClick={() => openPage('admin')}>Admin dashboard</button>}
      </nav>
      <div className="top-actions">{role === 'Attendee' && <label className="identity-wrap"><span>Student</span><select aria-label="Select student" value={selectedStudentId} onChange={(e) => selectStudent(e.target.value)}><option value="">Choose student…</option>{students.map((user) => <option key={user.id} value={user.id}>{user.email}</option>)}</select></label>}{role === 'Organizer' && <label className="identity-wrap"><span>Organizer</span><select aria-label="Select organizer" value={selectedOrganizerId} onChange={(e) => selectOrganizer(e.target.value)}><option value="">Choose organizer…</option>{organizers.map((user) => <option key={user.id} value={user.id}>{user.email} · {user.id}</option>)}</select></label>}<label className="role-wrap"><span className="role-dot"/><select aria-label="Select role" value={role} onChange={(e) => changeRole(e.target.value)}>{ROLES.map((item) => <option key={item}>{item}</option>)}</select></label><span className="avatar" title="Campus member">C</span></div>
    </header>

    {page === 'events' && <main>
      <section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="pulse"/> YOUR CAMPUS, IN THE KNOW</div><h1>Find your <span>next thing.</span></h1><p>Discover the talks, workshops, and moments happening around campus.</p><div className="hero-search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events, speakers, locations…" aria-label="Search events"/><button onClick={() => setQuery('')} title="Clear search">×</button></div></div><div className="hero-art"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-sticker">✦</div><div className="art-card"><span className="art-date">THU · 06:30 PM</span><strong>Ideas<br/>in motion.</strong><span className="art-foot">MEET YOUR PEOPLE ↗</span></div><span className="art-star star-one">✳</span><span className="art-star star-two">✦</span></div></section>
      <section className="content-wrap"><div className="section-heading"><div><span className="eyebrow muted">WHAT’S HAPPENING</span><h2>Events around you</h2></div><button className="subtle-button" onClick={refresh}>↻ &nbsp;Refresh</button></div><div className="toolbar"><div className="chips">{categories.map((item) => <button key={item} className={`chip ${activeCategory === item ? 'selected' : ''}`} onClick={() => setActiveCategory(item)}>{item === 'all' ? 'All events' : item}</button>)}</div><span className="count-label">{visibleEvents.length} {visibleEvents.length === 1 ? 'event' : 'events'}</span></div>
        <div className="event-grid">{loading ? <div className="loading-card">Loading campus events…</div> : loadError ? <div className="loading-card"><strong>Could not load events.</strong><br/><br/>{loadError}<br/><br/><button className="subtle-button" onClick={refresh}>Try again</button></div> : visibleEvents.length ? visibleEvents.map((event, index) => <article className="event-card" key={eventId(event) ?? index} onClick={() => { setSelected(event); setPage('detail'); }} tabIndex="0" onKeyDown={(e) => e.key === 'Enter' && (setSelected(event), setPage('detail'))}><div className={`event-cover cover-${index % 6}`}><span className="cover-symbol">{['✳','◉','✦','⌁','✣','◌'][index % 6]}</span><span className="category-tag">{category(event)}</span><span className="event-status-badge card-status">{eventStatus(event)}</span></div><div className="event-body"><h3>{title(event)}</h3><div className="event-meta"><span>◷ {formatDate(date(event))}</span><span>⌖ {place(event)}</span></div>{capacityLabel(event) && <div className="capacity-badge">◉ &nbsp;{capacityLabel(event)}</div>}<div className="event-foot"><span>{get(event, 'organizer', 'organizer_name', 'host') || 'Campus community'}</span><button className="text-link">Details&nbsp; ↗</button></div></div></article>) : <div className="empty-state"><span>✳</span><h3>No events found</h3><p>Try another search or category.</p></div>}</div>
      </section>
    </main>}

    {page === 'detail' && selected && <main className="content-wrap detail-wrap"><button className="back-link" onClick={() => setPage('events')}>← &nbsp;All events</button><div className="detail-content"><div className={`detail-banner cover-${Math.max(0, events.indexOf(selected)) % 6}`}><span className="category-tag">{category(selected)}</span></div><div className="detail-info"><div><div className="eyebrow muted">EVENT DETAILS</div><h1>{title(selected)}</h1><div className="event-meta"><span>◷ {formatDate(date(selected))}</span><span>⌖ {place(selected)}</span></div><div className="capacity-badge detail-capacity">Event status: {eventStatus(selected)}</div>{capacityLabel(selected) && <div className="capacity-badge detail-capacity">◉ &nbsp;{capacityLabel(selected)}</div>}<p className="detail-description">{get(selected, 'description', 'details', 'summary') || 'Join your campus community for this event. Check back for more details.'}</p><p className="detail-description">Hosted by <strong>{get(selected, 'organizer', 'organizer_name', 'host') || 'Campus community'}</strong></p></div><aside className="detail-side"><div className="eyebrow muted">SAVE YOUR SPOT</div><p>Ready to join?</p><button className="primary-button" disabled={busy || registeredEventIds.includes(String(eventId(selected))) || isOwnEvent(selected)} onClick={() => register(selected)}>{isOwnEvent(selected) ? 'You organized this event' : registeredEventIds.includes(String(eventId(selected))) ? 'Already registered ✓' : busy ? 'Registering…' : <>Register for event <span>→</span></>}</button><p className="small-note">Registration uses your database user ID; no sign-in token is sent.</p></aside></div></div></main>}

    {page === 'registrations' && <main className="content-wrap inner-page"><div className="eyebrow muted">YOUR CAMPUS PLANS</div><h1 className="page-title">My registrations<span>.</span></h1><p className="page-intro">The events you’ve signed up for, all in one place.</p>{registrations === null ? <div className="loading-card">Loading your registrations…</div> : registrations.error ? <div className="empty-state"><span>↗</span><h3>Could not load registrations</h3><p>{registrations.error}</p></div> : registrations.length === 0 ? <div className="empty-state"><span>✳</span><h3>Your list is ready for an event</h3><p>Browse campus events and register to see them here.</p></div> : <div className="registration-list">{registrations.map((row, index) => { const event = events.find((item) => String(eventId(item)) === String(get(row, 'event_id'))); return <article className="registration-item" key={get(row, 'id') || index}><div><h3>{event ? title(event) : `Event ${get(row, 'event_id')}`}</h3><p>{event ? `${formatDate(date(event))} · ${place(event)}` : `Registered ${formatDate(get(row, 'created_at', 'registered_at'))}`}</p></div><span className="status-badge">{get(row, 'status') || 'REGISTERED'}</span></article>; })}</div>}</main>}

    {page === 'admin' && <main className="content-wrap inner-page admin-page"><div className="eyebrow muted">CAMPUSPULSE ADMIN</div><h1 className="page-title">Campus <span>overview.</span></h1><p className="page-intro">Review event activity, registrations, and available capacity.</p><div className="admin-summary"><article className="admin-stat"><span>EVENTS</span><strong>{events.length}</strong><small>Listed in the events API</small></article><article className="admin-stat"><span>REGISTRATIONS</span><strong>{totalRegistrations}</strong><small>Across all listed events</small></article><article className="admin-stat"><span>SPOTS AVAILABLE</span><strong>{availableSpots}<small className="stat-total"> / {totalCapacity}</small></strong><small>Remaining event capacity</small></article></div><div className="section-heading admin-heading"><div><span className="eyebrow muted">EVENT MANAGEMENT</span><h2>All campus events</h2></div><button className="subtle-button" onClick={refresh}>↻ &nbsp;Refresh</button></div><div className="admin-table-wrap"><table className="attendee-table admin-table"><thead><tr><th>Event</th><th>Status</th><th>Registrations</th><th>Capacity left</th><th>Users</th></tr></thead><tbody>{events.map((event, index) => <tr key={eventId(event) ?? index}><td><strong>{title(event)}</strong><small className="admin-event-meta">{category(event)} · {place(event)}</small></td><td>{get(event, 'status') || 'Active'}</td><td>{Number(get(event, 'registered_count', 'registration_count') || 0)}</td><td>{capacityLabel(event) || '—'}</td><td><button className="text-link" onClick={() => { const key = String(eventId(event)); setAttendeeEventId(key); loadAttendees(key); }}>View users ↗</button></td></tr>)}</tbody></table></div>{attendeeEventId && attendees !== null && <div className="attendee-panel admin-attendee-panel"><h2>{events.find((event) => String(eventId(event)) === String(attendeeEventId)) ? title(events.find((event) => String(eventId(event)) === String(attendeeEventId))) : 'Event'} users</h2>{attendees.error ? <div className="empty-state"><p>{attendees.error}</p></div> : attendees.length === 0 ? <div className="empty-state"><p>No registrations for this event yet.</p></div> : <table className="attendee-table"><thead><tr><th>Registration</th><th>User ID</th><th>Status</th><th>Registered</th></tr></thead><tbody>{attendees.map((row, index) => <tr key={get(row, 'id') || index}><td>{index + 1}</td><td>{get(row, 'user_id', 'attendee_id') || '—'}</td><td><span className="status-badge">REGISTERED</span></td><td>{formatDate(get(row, 'created_at', 'registered_at'))}</td></tr>)}</tbody></table>}</div>}</main>}

    {page === 'organizer' && <main className="content-wrap inner-page"><div className="eyebrow muted">FOR EVENT ORGANIZERS</div><h1 className="page-title">Organizer <span>workspace.</span></h1><p className="page-intro">Create events, check their status, and see who registered.</p><section className="create-event-card"><div><div className="eyebrow muted">NEW CAMPUS EVENT</div><h2>Create an event</h2><p>New events are saved with an Upcoming status.</p></div><form className="create-event-form" onSubmit={createEvent}><label>Event title<input value={newEventTitle} onChange={(e) => setNewEventTitle(e.target.value)} required maxLength={180} placeholder="e.g. Robotics workshop" /></label><label>Capacity<input type="number" min="1" step="1" value={newEventCapacity} onChange={(e) => setNewEventCapacity(e.target.value)} required placeholder="Number of seats" /></label><button className="primary-button" disabled={creatingEvent}>{creatingEvent ? 'Saving…' : 'Create event'} <span>→</span></button></form></section><div className="section-heading admin-heading"><div><span className="eyebrow muted">YOUR EVENTS</span><h2>Events by {organizers.find((user) => String(user.id) === selectedOrganizerId)?.email || 'selected organizer'}</h2></div><button className="subtle-button" onClick={refresh}>↻ &nbsp;Refresh</button></div>{organizerEvents.length === 0 ? <div className="empty-state"><span>✳</span><h3>No events for this organizer yet</h3><p>Create an event above and it will appear here.</p></div> : <div className="admin-table-wrap"><table className="attendee-table admin-table"><thead><tr><th>Event</th><th>Status</th><th>Registered</th><th>Capacity</th><th>Users</th><th>Participate</th></tr></thead><tbody>{organizerEvents.map((event, index) => <tr key={eventId(event) ?? index}><td><strong>{title(event)}</strong></td><td><span className="event-status-badge">{get(event, 'status') || 'upcoming'}</span></td><td>{Number(get(event, 'registered_count') || 0)}</td><td>{capacityLabel(event) || '—'}</td><td><button className="text-link" onClick={() => { const key = String(eventId(event)); setAttendeeEventId(key); loadAttendees(key); }}>View users ↗</button></td><td><button className="text-link" disabled={isOwnEvent(event) || registeredEventIds.includes(String(eventId(event)))} onClick={() => register(event, selectedOrganizerId)}>{isOwnEvent(event) ? 'You organized this' : registeredEventIds.includes(String(eventId(event))) ? 'Already registered' : 'Register as user'}</button></td></tr>)}</tbody></table></div>}<div className="attendee-panel">{attendeeEventId && attendees !== null ? attendees.error ? <div className="empty-state"><h3>Could not load users</h3><p>{attendees.error}</p></div> : attendees.length === 0 ? <div className="empty-state"><span>✳</span><h3>No registrations yet</h3><p>Registered users will appear here.</p></div> : <table className="attendee-table"><thead><tr><th>Registration</th><th>User</th><th>User ID</th><th>Status</th><th>Registered</th></tr></thead><tbody>{attendees.map((row, index) => { const student = students.find((user) => String(user.id) === String(row.user_id)); return <tr key={get(row, 'id') || index}><td>{index + 1}</td><td>{student?.email || 'Student'}</td><td>{get(row, 'user_id', 'attendee_id') || '—'}</td><td><span className="status-badge">REGISTERED</span></td><td>{formatDate(get(row, 'created_at', 'registered_at'))}</td></tr>; })}</tbody></table> : <div className="empty-state"><span>↗</span><h3>Select an event</h3><p>Registered users will appear here.</p></div>}</div></main>}

    <footer><a className="brand footer-brand" href="#events" onClick={(e) => { e.preventDefault(); openPage('events'); }}><span className="brand-mark">✳</span><span>Campus<span className="brand-light">Pulse</span></span></a><span>Made for campus life.</span><small className="api-label">API: {API_BASE}</small></footer>
    {toast && <div className="toast show" role="status" aria-live="polite">{toast}</div>}
  </>;
}

export default App;


