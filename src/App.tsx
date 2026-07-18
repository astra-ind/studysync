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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'personal' | 'shared' | 'matches'>('dashboard');
  const [activeUserId, setActiveUserId] = useState<string>(USER_A.id);
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Dynamic Glowing Accents */}
      <div className="absolute top-0 left-1/4 h-[300px] w-[500px] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 h-[400px] w-[600px] rounded-full bg-purple-500/5 blur-[150px] pointer-events-none" />

      {/* Main Navigation Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Logo Brand */}
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
              <Sparkles className="h-5 w-5 animate-spin-slow" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-wider text-white flex items-center gap-1.5 uppercase">
                Study Sync
              </h1>
              <span className="text-[9px] font-bold text-slate-500 tracking-widest block uppercase -mt-0.5">
                Two-Partner Sync Engine
              </span>
            </div>
          </div>

          {/* Central Tabs Navigation */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-900/60 p-0.5 rounded-xl border border-slate-800">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: BookOpen },
              { id: 'personal', label: 'Personal Calendar', icon: Calendar },
              { id: 'shared', label: 'Shared Grid', icon: Users },
              { id: 'matches', label: 'Match Finder', icon: Zap },
            ].map((tab) => {
              const IconComp = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-slate-800 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <IconComp className="h-4.5 w-4.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Header Panel */}
          <div className="flex items-center gap-3">
            {/* Real-time Sync state */}
            <div className="hidden sm:flex items-center gap-1.5 bg-slate-900/40 px-2.5 py-1.5 rounded-lg border border-slate-800/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span className={`h-1.5 w-1.5 rounded-full ${
                syncStatus === 'synced' ? 'bg-emerald-500' : syncStatus === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'
              }`} />
              <span>{syncStatus}</span>
            </div>

            {/* Quick Switch Actor */}
            <div className="flex items-center gap-2 bg-slate-900/60 p-1 rounded-xl border border-slate-800">
              <span className="text-[9px] font-black uppercase text-slate-500 px-2 tracking-wider">Act As:</span>
              <div className="flex gap-1">
                {USERS.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setActiveUserId(u.id)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1 ${
                      activeUserId === u.id
                        ? 'bg-slate-800 text-white shadow-md border border-slate-700/60'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>{u.avatar}</span>
                    <span className="hidden xs:inline">{u.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Help & Shortcuts toggles */}
            <button
              onClick={() => setShowShortcuts(true)}
              className="p-2.5 rounded-xl border border-slate-800 bg-slate-900/40 text-slate-400 hover:text-white transition"
              title="Keyboard Shortcuts"
            >
              <Keyboard className="h-4 w-4" />
            </button>

            {/* Real-time activity activity alerts */}
            <NotificationsFeed currentUser={activeUser} partner={partnerUser} events={events} />
          </div>
        </div>
      </header>

      {/* Mobile Sub-Navigation Bar */}
      <div className="md:hidden border-b border-slate-900 bg-slate-950 p-2 overflow-x-auto">
        <div className="flex gap-1.5">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: BookOpen },
            { id: 'personal', label: 'Personal', icon: Calendar },
            { id: 'shared', label: 'Shared', icon: Users },
            { id: 'matches', label: 'Matches', icon: Zap },
          ].map((tab) => {
            const IconComp = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white border border-slate-800'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                <IconComp className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Body Content stage */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6 relative z-10">
        
        {/* Empty State Banner Offer */}
        {events.length === 0 && (
          <div className="p-4 rounded-xl border border-dashed border-indigo-500/40 bg-indigo-500/5 flex flex-col sm:flex-row items-center justify-between gap-4 animate-pulse">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-indigo-400" />
              <div>
                <p className="text-xs font-bold text-white">Prstine Study Sync Slate detected! 🌱</p>
                <p className="text-[10px] text-slate-400">Seed sample scheduling data to instantly preview overlapping slots and dashboard visuals.</p>
              </div>
            </div>
            <button
              onClick={handleSeedData}
              className="px-4.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-black tracking-wider uppercase text-white shadow-lg shadow-indigo-500/10 cursor-pointer"
            >
              Seed Sample Schedules
            </button>
          </div>
        )}

        {/* View Switch Stage */}
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
      </main>

      {/* Keyboard Shortcuts Drawer / Overlay */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setShowShortcuts(false)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-200 shadow-2xl z-10">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h4 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
                <Keyboard className="h-4 w-4 text-indigo-400" />
                Keyboard Shortcuts
              </h4>
              <button onClick={() => setShowShortcuts(false)} className="text-slate-400 hover:text-white transition">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2.5 text-xs">
              {[
                { keys: ['D'], label: 'Jump to Dashboard' },
                { keys: ['P'], label: 'Jump to Personal Calendar' },
                { keys: ['S'], label: 'Jump to Shared Blended Grid' },
                { keys: ['M'], label: 'Jump to Match Overlaps Finder' },
                { keys: ['A'], label: 'Quick Open Create Slot Form' },
                { keys: ['U'], label: 'Switch Active Persona (Alex / Blake)' },
                { keys: ['K'], label: 'Toggle Shortcuts list overlay' },
              ].map((sc, idx) => (
                <div key={idx} className="flex justify-between items-center py-0.5 border-b border-slate-900/40">
                  <span className="text-slate-400 font-medium">{sc.label}</span>
                  <div className="flex gap-1">
                    {sc.keys.map((k) => (
                      <kbd key={k} className="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-[10px] font-black text-indigo-400">
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
      <footer className="border-t border-slate-950 py-6 text-center text-[10px] font-bold text-slate-600 uppercase tracking-widest bg-slate-950/20">
        <p>Study Sync Two-Person Scheduler • All rights reserved • Press <kbd className="bg-slate-900 border border-slate-800/80 text-indigo-400 px-1.5 py-0.5 rounded text-[9px] mx-1">K</kbd> for Keyboard shortcuts</p>
      </footer>
    </div>
  );
}
