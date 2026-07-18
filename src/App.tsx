import React, { useState, useEffect } from 'react';
import { db, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from './lib/firebase';
import { CalendarEvent, SlotType } from './types';
import { USER_A, USER_B, USERS, HardcodedUser } from './config';
import Dashboard from './components/Dashboard';
import PersonalCalendar from './components/PersonalCalendar';
import SharedCalendar from './components/SharedCalendar';
import MatchFinder from './components/MatchFinder';
import NotificationsFeed from './components/NotificationsFeed';
import EventModal from './components/EventModal';
import { Sparkles, Calendar, BookOpen, Users, Zap, HelpCircle, Keyboard, RefreshCw, X } from 'lucide-react';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('study_sync_auth_v2') === 'true';
  });
  const [activeUserId, setActiveUserId] = useState<string>(() => {
    return localStorage.getItem('study_sync_user_id') || USER_A.id;
  });
  const [selectedLoginUser, setSelectedLoginUser] = useState<string>(USER_A.id);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');

  const [activeTab, setActiveTab] = useState<'dashboard' | 'personal' | 'shared' | 'matches'>('dashboard');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  
  // Real-time Sync Status
  const [syncStatus, setSyncStatus] = useState<'synced' | 'connecting' | 'error'>('connecting');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | undefined>(undefined);
  const [defaultStartHour, setDefaultStartHour] = useState<string | undefined>(undefined);

  // Keyboard shortcut state
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Compute active & partner users
  const activeUser = activeUserId === USER_A.id ? USER_A : USER_B;
  const partnerUser = activeUserId === USER_A.id ? USER_B : USER_A;

  // Handle Authentication submit
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredPin === '2009') {
      setIsAuthenticated(true);
      setActiveUserId(selectedLoginUser);
      localStorage.setItem('study_sync_auth_v2', 'true');
      localStorage.setItem('study_sync_user_id', selectedLoginUser);
      setPinError('');
      setEnteredPin('');
    } else {
      setPinError('Incorrect Secret PIN. Please check with your study partner.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('study_sync_auth_v2');
  };

  const handleUserSwitch = (userId: string) => {
    setActiveUserId(userId);
    localStorage.setItem('study_sync_user_id', userId);
  };

  // Real-time sync listener
  useEffect(() => {
    setSyncStatus('connecting');
    const unsubscribe = onSnapshot(
      collection(db, 'events'),
      (snapshot) => {
        const list: CalendarEvent[] = [];
        snapshot.forEach((doc) => {
          list.push({ ...doc.data(), id: doc.id } as CalendarEvent);
        });
        setEvents(list);
        setSyncStatus('synced');
      },
      (error) => {
        console.error("Firestore sync error:", error);
        setSyncStatus('error');
      }
    );

    return () => unsubscribe();
  }, []);

  // Keyboard Shortcuts Keydown Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid triggering when user is typing in inputs or textareas
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.tagName === 'SELECT'
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      
      if (key === 'd') setActiveTab('dashboard');
      if (key === 'p') setActiveTab('personal');
      if (key === 's') setActiveTab('shared');
      if (key === 'm') setActiveTab('matches');
      if (key === 'u') {
        setActiveUserId((prev) => (prev === USER_A.id ? USER_B.id : USER_A.id));
      }
      if (key === 'a') {
        handleOpenAddModal();
      }
      if (key === 'k') {
        setShowShortcuts((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Open modal to add event
  const handleOpenAddModal = (dateStr?: string, startHour?: string) => {
    setSelectedEvent(null);
    setDefaultDate(dateStr);
    setDefaultStartHour(startHour);
    setIsModalOpen(true);
  };

  // Open modal to edit event
  const handleOpenEditModal = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
  };

  // Save Event Mutation
  const handleSaveEvent = async (eventData: Omit<CalendarEvent, 'id' | 'createdAt'>) => {
    try {
      if (selectedEvent) {
        const ref = doc(db, 'events', selectedEvent.id);
        await updateDoc(ref, {
          ...eventData,
        });

        await addDoc(collection(db, 'notifications'), {
          text: `🔄 ${activeUser.name} modified a slot: "${eventData.title}"`,
          timestamp: new Date().toISOString(),
          unread: true,
          type: 'info',
        });
      } else {
        await addDoc(collection(db, 'events'), {
          ...eventData,
          createdAt: new Date().toISOString(),
        });

        await addDoc(collection(db, 'notifications'), {
          text: `🟢 ${activeUser.name} added a slot: "${eventData.title}"`,
          timestamp: new Date().toISOString(),
          unread: true,
          type: 'success',
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Event Mutation
  const handleDeleteEvent = async (eventId: string) => {
    try {
      const ref = doc(db, 'events', eventId);
      await deleteDoc(ref);

      await addDoc(collection(db, 'notifications'), {
        text: `🔴 ${activeUser.name} deleted a slot.`,
        timestamp: new Date().toISOString(),
        unread: true,
        type: 'alert',
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Duplicate Event Mutation
  const handleDuplicateEvent = async (event: CalendarEvent) => {
    try {
      const start = new Date(event.start);
      const end = new Date(event.end);
      
      // Shift by 1 day
      start.setDate(start.getDate() + 1);
      end.setDate(end.getDate() + 1);

      await addDoc(collection(db, 'events'), {
        userId: event.userId,
        title: `${event.title} (Copy)`,
        type: event.type,
        start: start.toISOString(),
        end: end.toISOString(),
        recurrence: event.recurrence,
        timezone: event.timezone,
        notes: event.notes,
        createdAt: new Date().toISOString(),
      });

      await addDoc(collection(db, 'notifications'), {
        text: `👯 ${activeUser.name} duplicated a slot.`,
        timestamp: new Date().toISOString(),
        unread: true,
        type: 'info',
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Auto-seed Sample Data Routine
  const handleSeedData = async () => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const sat = new Date();
    sat.setDate(sat.getDate() + (6 - sat.getDay())); // Saturday of this week
    const satStr = sat.toISOString().slice(0, 10);

    const sampleEvents = [
      // Alex (User A)
      {
        userId: 'user_a',
        title: 'Chemistry Exam Prep',
        type: 'studying',
        start: `${todayStr}T15:00:00`,
        end: `${todayStr}T17:00:00`,
        recurrence: 'none',
        timezone: 'UTC',
        notes: 'Chapter 5 revision and mock tests.'
      },
      {
        userId: 'user_a',
        title: 'Review Window',
        type: 'free',
        start: `${tomorrowStr}T09:00:00`,
        end: `${tomorrowStr}T12:00:00`,
        recurrence: 'none',
        timezone: 'UTC',
        notes: 'Ready for joint math study.'
      },
      {
        userId: 'user_a',
        title: 'Weekend Available',
        type: 'free',
        start: `${satStr}T14:00:00`,
        end: `${satStr}T17:00:00`,
        recurrence: 'none',
        timezone: 'UTC',
      },

      // Blake (User B)
      {
        userId: 'user_b',
        title: 'Chemistry Group Prep',
        type: 'studying',
        start: `${todayStr}T15:00:00`,
        end: `${todayStr}T17:00:00`,
        recurrence: 'none',
        timezone: 'UTC',
      },
      {
        userId: 'user_b',
        title: 'Math Study Session',
        type: 'studying',
        start: `${tomorrowStr}T09:00:00`,
        end: `${tomorrowStr}T11:00:00`,
        recurrence: 'none',
        timezone: 'UTC',
      },
      {
        userId: 'user_b',
        title: 'Weekend Study Block',
        type: 'free',
        start: `${satStr}T14:00:00`,
        end: `${satStr}T16:00:00`,
        recurrence: 'none',
        timezone: 'UTC',
      }
    ];

    try {
      for (const ev of sampleEvents) {
        // Parse dates correctly using local system timezone offsets
        const startISO = new Date(ev.start).toISOString();
        const endISO = new Date(ev.end).toISOString();
        
        await addDoc(collection(db, 'events'), {
          userId: ev.userId,
          title: ev.title,
          type: ev.type,
          start: startISO,
          end: endISO,
          recurrence: ev.recurrence,
          timezone: ev.timezone,
          notes: ev.notes || '',
          createdAt: new Date().toISOString(),
        });
      }

      await addDoc(collection(db, 'notifications'), {
        text: `🌱 Seeded sample calendar data for Alex and Blake. Overlapping slots are ready!`,
        timestamp: new Date().toISOString(),
        unread: true,
        type: 'success',
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Render the Welcome PIN Authentication screen if not logged in
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F5F2EB] paper-pattern text-stone-800 flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-white border-2 border-[#D9D1C0] rounded-2xl p-8 shadow-[6px_6px_0px_0px_rgba(217,209,192,0.5)] flex flex-col relative overflow-hidden">
          {/* Top binder style rings decor */}
          <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-r from-stone-200 via-stone-300 to-stone-200 border-b border-stone-300/40" />
          
          <div className="text-center space-y-2 mt-2">
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#B59F74] font-mono block">
              📚 Locked Partner Portal
            </span>
            <h1 className="text-4xl font-serif font-black tracking-tight text-stone-900">
              Study Sync
            </h1>
            <p className="text-xs text-stone-500 font-serif italic max-w-xs mx-auto">
              A private, real-time study ledger and scheduler for exactly two partners. Entered pin is synced.
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="mt-8 space-y-6">
            {/* Identity Select */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 font-mono">
                Identify Yourself
              </label>
              <div className="grid grid-cols-2 gap-3">
                {USERS.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelectedLoginUser(u.id)}
                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                      selectedLoginUser === u.id
                        ? 'border-stone-800 bg-stone-50 text-stone-900 shadow-sm'
                        : 'border-stone-200 bg-[#FAF9F6] text-stone-500 hover:border-stone-300'
                    }`}
                  >
                    <span className="text-3xl">{u.avatar}</span>
                    <span className="text-xs font-bold uppercase tracking-wide">{u.name}</span>
                    <span className="text-[9px] text-stone-400 font-medium font-mono">
                      {u.id === 'user_a' ? 'User 1' : 'User 2'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* PIN Code entry */}
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 font-mono">
                  Secret PIN
                </label>
                <span className="text-[10px] text-stone-400 font-sans italic">hint: year in prompt (2009)</span>
              </div>
              <input
                type="password"
                maxLength={4}
                required
                placeholder="••••"
                value={enteredPin}
                onChange={(e) => {
                  setEnteredPin(e.target.value);
                  setPinError('');
                }}
                className="w-full text-center tracking-[0.5rem] text-xl font-mono bg-stone-50 border-2 border-[#D9D1C0] focus:border-stone-800 rounded-xl px-4 py-3 focus:outline-none transition"
              />
            </div>

            {pinError && (
              <p className="text-xs font-semibold font-mono text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-lg text-center">
                ⚠️ {pinError}
              </p>
            )}

            <button
              type="submit"
              className="w-full bg-stone-900 hover:bg-stone-800 active:bg-black text-white font-bold py-3.5 px-4 rounded-xl text-xs uppercase tracking-widest transition-all cursor-pointer shadow-md"
            >
              Unlock Partner Portal
            </button>
          </form>

          {/* Connection status */}
          <div className="mt-8 pt-4 border-t border-stone-100 flex items-center justify-center gap-2 text-[10px] font-mono text-stone-400 uppercase tracking-wider">
            <span className={`h-2 w-2 rounded-full ${syncStatus === 'synced' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
            <span>Firebase DB Status: {syncStatus}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBF9F6] paper-pattern text-stone-800 flex flex-col font-sans transition-all duration-300">
      
      {/* Main Navigation Header - Paper Stationery aesthetic */}
      <header className="border-b-2 border-[#E3DEC3] bg-white/90 backdrop-blur-md sticky top-0 z-40 px-4 py-3.5 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-stone-900 flex items-center justify-center shadow-md text-white">
              <Sparkles className="h-5 w-5 text-amber-200" />
            </div>
            <div>
              <h1 className="text-xl font-serif font-black tracking-tight text-stone-900 flex items-center gap-1.5 leading-none">
                Study Sync
              </h1>
              <span className="text-[10px] font-bold text-[#A58D56] tracking-widest block uppercase font-mono mt-1">
                Two-Partner Sync Engine
              </span>
            </div>
          </div>

          {/* Central Tabs Navigation */}
          <nav className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200 shadow-inner">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: BookOpen },
              { id: 'personal', label: 'My Calendar', icon: Calendar },
              { id: 'shared', label: 'Shared Grid', icon: Users },
              { id: 'matches', label: 'Match Finder', icon: Zap },
            ].map((tab) => {
              const IconComp = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-stone-900 text-white shadow-sm'
                      : 'text-stone-500 hover:text-stone-800 hover:bg-stone-200/50'
                  }`}
                >
                  <IconComp className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Header Panel */}
          <div className="flex items-center gap-3">
            {/* Real-time Sync state */}
            <div className="hidden lg:flex items-center gap-1.5 bg-stone-50 px-2.5 py-1.5 rounded-lg border border-stone-200 text-[10px] font-bold uppercase tracking-wider text-stone-500 font-mono">
              <span className={`h-1.5 w-1.5 rounded-full ${
                syncStatus === 'synced' ? 'bg-emerald-500 animate-pulse' : syncStatus === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'
              }`} />
              <span>{syncStatus}</span>
            </div>

            {/* Switch Active User */}
            <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200">
              <span className="text-[9px] font-bold uppercase text-stone-400 px-1.5 font-mono">Actor:</span>
              <div className="flex gap-0.5">
                {USERS.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleUserSwitch(u.id)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1 ${
                      activeUserId === u.id
                        ? 'bg-white text-stone-900 shadow-sm border border-stone-200'
                        : 'text-stone-400 hover:text-stone-700'
                    }`}
                    title={`Act as ${u.name}`}
                  >
                    <span>{u.avatar}</span>
                    <span className="hidden md:inline text-[11px]">{u.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Help & Shortcuts toggles */}
            <button
              onClick={() => setShowShortcuts(true)}
              className="p-2 rounded-xl border border-stone-200 bg-white text-stone-500 hover:text-stone-900 transition hover:bg-stone-50 cursor-pointer shadow-sm"
              title="Keyboard Shortcuts"
            >
              <Keyboard className="h-4 w-4" />
            </button>

            {/* Real-time activity alerts */}
            <NotificationsFeed currentUser={activeUser} partner={partnerUser} events={events} />

            {/* Exit/Logout gateway */}
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl border border-stone-200 bg-white text-stone-500 hover:text-rose-700 transition hover:bg-rose-50 cursor-pointer shadow-sm text-xs font-bold uppercase font-mono flex items-center gap-1"
              title="Lock Session"
            >
              🔒 Lock
            </button>
          </div>
        </div>
      </header>

      {/* Main Body Content stage */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6 relative z-10">
        
        {/* Dynamic header summary bar - Premium Stationery Feel */}
        <div className="flex flex-col sm:flex-row items-center justify-between bg-white border-2 border-[#D9D1C0] rounded-xl p-4 shadow-[3px_3px_0px_0px_rgba(217,209,192,0.3)]">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{activeUser.avatar}</span>
            <div>
              <p className="text-xs font-bold text-stone-400 uppercase tracking-widest font-mono">Currently viewing as</p>
              <p className="text-lg font-serif font-black text-stone-900">
                {activeUser.name} <span className="text-xs font-sans font-normal text-stone-500">(Partner 1)</span>
              </p>
            </div>
          </div>
          <div className="text-center sm:text-right mt-2 sm:mt-0 font-serif italic text-stone-500 text-xs">
            Linked to <strong className="text-stone-800 not-italic font-bold font-sans">{partnerUser.name}</strong> • Realtime Sync Enabled
          </div>
        </div>

        {/* Empty State Banner Offer */}
        {events.length === 0 && (
          <div className="p-5 rounded-xl border-2 border-dashed border-[#B59F74] bg-[#FDFCF7] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-[#B59F74]" />
              <div>
                <p className="text-sm font-bold text-stone-900 font-serif">Empty Study Sync Ledger! 📔</p>
                <p className="text-xs text-stone-500">Seed sample scheduling data to instantly preview overlapping slots, side-by-side grids, and analytics.</p>
              </div>
            </div>
            <button
              onClick={handleSeedData}
              className="px-5 py-2.5 rounded-lg bg-stone-950 hover:bg-stone-800 text-stone-100 text-xs font-black tracking-wider uppercase shadow-md cursor-pointer transition-all"
            >
              Seed Sample Schedules
            </button>
          </div>
        )}

        {/* View Switch Stage */}
        <div className="transition-all duration-300">
          {activeTab === 'dashboard' && (
            <Dashboard
              currentUser={activeUser}
              partner={partnerUser}
              events={events}
              onAddSlotClick={() => handleOpenAddModal()}
            />
          )}

          {activeTab === 'personal' && (
            <PersonalCalendar
              userId={activeUser.id}
              userName={activeUser.name}
              events={events}
              onAddSlotClick={handleOpenAddModal}
              onEditSlotClick={handleOpenEditModal}
            />
          )}

          {activeTab === 'shared' && (
            <SharedCalendar
              userA={USER_A}
              userB={USER_B}
              events={events}
            />
          )}

          {activeTab === 'matches' && (
            <MatchFinder
              currentUser={activeUser}
              partner={partnerUser}
              events={events}
            />
          )}
        </div>
      </main>

      {/* Keyboard Shortcuts Drawer / Overlay */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-xs" onClick={() => setShowShortcuts(false)} />
          <div className="relative w-full max-w-sm rounded-2xl border-2 border-stone-200 bg-white p-6 text-stone-800 shadow-2xl z-10">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3 mb-4">
              <h4 className="text-sm font-bold text-stone-900 flex items-center gap-2 uppercase tracking-wider font-mono">
                <Keyboard className="h-4 w-4 text-stone-600" />
                Keyboard Shortcuts
              </h4>
              <button onClick={() => setShowShortcuts(false)} className="text-stone-400 hover:text-stone-900 transition">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2.5 text-xs font-mono">
              {[
                { keys: ['D'], label: 'Jump to Dashboard' },
                { keys: ['P'], label: 'Jump to My Calendar' },
                { keys: ['S'], label: 'Jump to Shared Blended Grid' },
                { keys: ['M'], label: 'Jump to Match Overlaps Finder' },
                { keys: ['A'], label: 'Quick Open Create Slot Form' },
                { keys: ['U'], label: 'Switch Active Persona (Alex / Blake)' },
                { keys: ['K'], label: 'Toggle Shortcuts list overlay' },
              ].map((sc, idx) => (
                <div key={idx} className="flex justify-between items-center py-1 border-b border-stone-50">
                  <span className="text-stone-500 text-[11px]">{sc.label}</span>
                  <div className="flex gap-1">
                    {sc.keys.map((k) => (
                      <kbd key={k} className="bg-stone-100 border border-stone-200 px-2 py-0.5 rounded text-[10px] font-bold text-stone-800">
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Global Event Adding/Editing Modal */}
      <EventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        onDuplicate={handleDuplicateEvent}
        event={selectedEvent}
        defaultDate={defaultDate}
        defaultStartHour={defaultStartHour}
        userId={activeUser.id}
      />

      {/* Footer Design Credits and shortcuts prompt */}
      <footer className="border-t-2 border-[#E3DEC3] py-8 text-center text-[10px] font-bold text-stone-400 uppercase tracking-widest bg-[#FAF9F6] font-mono">
        <p>Study Sync Two-Person Scheduler Ledger • All Data Synced to Firestore</p>
        <p className="mt-1.5 text-stone-300">Press <kbd className="bg-white border border-stone-200 text-stone-500 px-1.5 py-0.5 rounded text-[9px] mx-1 shadow-sm">K</kbd> for Keyboard shortcuts</p>
      </footer>
    </div>
  );
}
